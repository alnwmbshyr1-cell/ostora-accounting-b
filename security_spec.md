# Security Specification — أسطورة المحاسبة (Ostora Accounting ERP)

## Phase 0: Data Invariants & Zero-Trust Boundaries

1. **Authentication & Email Verification Invariant**:
   - Every write operation (`create`, `update`, `delete`) across `/users/*`, `/workspaces/*`, and all workspace subcollections strictly requires `request.auth != null && request.auth.token.email_verified == true`.
   - Default-deny catch-all (`match /{document=**} { allow read, write: if false; }`) sits at the top of `match /databases/{database}/documents`.

2. **PII Isolation Invariant**:
   - Private user profile records (`/users/{userId}`) contain PII (`email`, `displayName`) and are readable (`get`) ONLY by `request.auth.uid == userId` or verified admins (`isAdmin()`). Blanket `isSignedIn()` reads are strictly forbidden.
   - `list` queries on `/users` are restricted exclusively to verified admins (`isAdmin()`).

3. **Master Gate & Relational Integrity Invariant**:
   - `/workspaces/{workspaceId}` is the Master Source of Truth for every ERP subcollection (`invoices`, `returns`, `quotations`, `customers`, `suppliers`, `purchaseOrders`, `vouchers`, `journals`, `products`, `employees`, `expenses`, `banks`).
   - Creating, reading (`get`), updating, or deleting any subcollection document MUST verify parent workspace ownership via `get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.ownerId == request.auth.uid` (or `isAdmin()`).
   - Every subcollection document carries an immutable `ownerId` matching `request.auth.uid`.

4. **Query Enforcer (O(1) Secure List Queries)**:
   - Every `allow list` rule explicitly enforces `resource.data.ownerId == request.auth.uid || isAdmin()` without calling `get()` or `exists()`.

5. **Temporal Integrity, Path Hardening, & Payload Bounds**:
   - Every document ID path variable is validated via `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
   - `createdAt == request.time` on `create`; `createdAt == existing().createdAt` and `updatedAt == request.time` on `update`.
   - Every string and list has explicit `.size()` upper bounds (`Product.imageBase64 <= 250000`, `Invoice.description <= 500`, `Workspace.enabledCurrencies <= 15`, etc.), numeric fields enforce non-negative bounds (`Customer.creditLimit >= 0`, `Workspace.autoSyncIntervalMinutes` in `0..1440`, `Invoice.exchangeRate > 0`, `taxRate` in `0..100`), and currency codes are restricted to the explicit 13-currency allowlist.
   - All keys are locked via `hasAll([...]) && hasOnly([...])` on `create` plus action-based `diff(existing()).affectedKeys().hasOnly([...])` on `update`.

6. **Terminal State Locking & Anti-Privilege-Escalation**:
   - `/users/{userId}` forbids setting `role: 'admin'` during creation or modifying `role` during non-admin updates.
   - Settled `invoices` (`status == 'paid'`), received `purchaseOrders` (`status == 'received'`), and finalized `quotations` (`status in ['accepted', 'rejected']`) cannot be mutated by non-admins once terminal (enforced in both `firestore.rules` and UI edit guards).

---

## The "Dirty Dozen+" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Condition | Expected Result |
|---|---------------|-------------|-------------------------------|-----------------|
| 1 | **Identity Spoofing (Create)** | `/workspaces/ws1/invoices/INV-1` | Authenticated as `userA`, payload sets `ownerId: "userB"` | `PERMISSION_DENIED` |
| 2 | **Shadow / Ghost Field Injection** | `/workspaces/ws1/customers/C-1` | Valid customer payload + `"isVerified": true` | `PERMISSION_DENIED` |
| 3 | **Self-Assigned Admin Role** | `/users/userA` | New profile sets `"role": "admin"` | `PERMISSION_DENIED` |
| 4 | **Email Spoof Without Verification** | `/workspaces/ws1/banks/cash` | Auth token `email: "alnwmbshyr1@gmail.com"`, `email_verified: false` | `PERMISSION_DENIED` |
| 5 | **PII Cross-Tenant Read** | `/users/victimUid` | `get` request signed in as `attackerUid` | `PERMISSION_DENIED` |
| 6 | **Blanket List Query Scraping** | `/workspaces/ws1/invoices` | Unfiltered `list` query by `attackerUid` without `where('ownerId', '==', attackerUid)` | `PERMISSION_DENIED` |
| 7 | **Path Variable ID Poisoning** | `/workspaces/ws1/products/bad..id$1500chars` | Document ID fails `^[a-zA-Z0-9_\-]+$` or exceeds 128 bytes | `PERMISSION_DENIED` |
| 8 | **Denial-of-Wallet Oversized String** | `/workspaces/ws1/invoices/INV-2` | `description` string of 100,000 characters (`> 500` limit) or `imageBase64 > 250000` | `PERMISSION_DENIED` |
| 9 | **Timestamp Forgery** | `/workspaces/ws1/expenses/EXP-1` | Client supplies `"createdAt": "2020-01-01T00:00:00Z"` instead of `request.time` | `PERMISSION_DENIED` |
| 10 | **Immutable Owner Tampering** | `/workspaces/ws1/products/P-1` | `update` attempts to mutate `ownerId` or `createdAt` | `PERMISSION_DENIED` |
| 11 | **Terminal State Bypass** | `/workspaces/ws1/invoices/INV-1002` | Non-admin attempts to update `total` or `status` when `existing().status == 'paid'` | `PERMISSION_DENIED` |
| 12 | **Orphaned Subcollection Write** | `/workspaces/nonexistentWs/vouchers/V-1` | Subcollection `create` where parent `/workspaces/nonexistentWs` does not exist or belongs to another owner | `PERMISSION_DENIED` |
| 13 | **Negative Credit Limit Bypass** | `/workspaces/ws1/customers/C-2` | Payload sets `"creditLimit": -500` | `PERMISSION_DENIED` |
| 14 | **Unapproved Currency / Out-of-Bounds Sync Interval** | `/workspaces/ws1` | Payload sets `"currency": "BTC"` or `"autoSyncIntervalMinutes": 9999` | `PERMISSION_DENIED` |
