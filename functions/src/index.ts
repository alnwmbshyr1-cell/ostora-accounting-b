import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();

/**
 * Recomputes server-side profit rollup whenever invoices change inside a workspace.
 */
export const onInvoiceProfitRollup = onDocumentWritten(
  'workspaces/{workspaceId}/invoices/{invoiceId}',
  async (event) => {
    const workspaceId = event.params.workspaceId;
    const snap = await db.collection(`workspaces/${workspaceId}/invoices`).get();
    let totalSalesH = 0;
    let totalSubtotalH = 0;
    let totalVatH = 0;

    for (const doc of snap.docs) {
      const inv = doc.data();
      if (inv.status === 'cancelled' || inv.status === 'draft' || inv.invoiceType === 'quotation') continue;
      const fx = typeof inv.exchangeRate === 'number' && inv.exchangeRate > 0 ? inv.exchangeRate : 1;
      const sign = inv.invoiceType === 'return' ? -1 : 1;
      totalSalesH += Math.round(Number(inv.total || 0) * 100 * fx) * sign;
      totalSubtotalH += Math.round(Number(inv.subtotal || 0) * 100 * fx) * sign;
      totalVatH += Math.round(Number(inv.vat || 0) * 100 * fx) * sign;
    }

    const expSnap = await db.collection(`workspaces/${workspaceId}/expenses`).get();
    let totalExpH = 0;
    for (const doc of expSnap.docs) {
      const exp = doc.data();
      if (exp.status === 'draft' || exp.status === 'cancelled') continue;
      const fx = typeof exp.exchangeRate === 'number' && exp.exchangeRate > 0 ? exp.exchangeRate : 1;
      const vatInH = Math.round(Number(exp.vatInput || 0) * 100 * fx);
      const grossH = Math.round(Number(exp.baseAmount ?? Number(exp.amount || 0) * fx) * 100);
      totalExpH += Math.max(0, grossH - vatInH);
    }

    await db.doc(`workspaces/${workspaceId}/analytics/rollup`).set(
      {
        totalSales: totalSalesH / 100,
        totalRevenueExVat: totalSubtotalH / 100,
        totalOutputVat: totalVatH / 100,
        totalOperatingExpenses: totalExpH / 100,
        estimatedNetBeforeCogs: (totalSubtotalH - totalExpH) / 100,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);

/**
 * Daily scheduler: detects overdue invoices, low-stock/expiring items, creates automated backups,
 * and dispatches Firebase Cloud Messaging notifications when FCM device tokens are registered.
 */
export const dailyErpMonitorAndBackup = onSchedule('every 24 hours', async () => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const soonIso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const workspacesSnap = await db.collection('workspaces').get();

  for (const wsDoc of workspacesSnap.docs) {
    const wsId = wsDoc.id;
    const [invSnap, prodSnap, tokensSnap] = await Promise.all([
      db.collection(`workspaces/${wsId}/invoices`).get(),
      db.collection(`workspaces/${wsId}/products`).get(),
      db.collection(`workspaces/${wsId}/fcmTokens`).get(),
    ]);

    const overdueCount = invSnap.docs.filter((d) => {
      const x = d.data();
      return x.status !== 'paid' && x.status !== 'cancelled' && x.status !== 'draft' && x.dueDate && x.dueDate < todayIso;
    }).length;

    const expiringCount = prodSnap.docs.filter((d) => {
      const p = d.data();
      return Boolean(p.expiryDate) && p.expiryDate <= soonIso && Number(p.qty || 0) > 0;
    }).length;

    await db.doc(`workspaces/${wsId}/backups/${todayIso}`).set(
      {
        id: todayIso,
        dateKey: todayIso,
        invoiceCount: invSnap.size,
        productCount: prodSnap.size,
        overdueCount,
        expiringCount,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if ((overdueCount > 0 || expiringCount > 0) && !tokensSnap.empty) {
      const tokens = tokensSnap.docs
        .map((t) => String(t.data().token || ''))
        .filter(Boolean);
      if (tokens.length > 0) {
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: {
            title: 'تنبيه أسطورة المحاسبة',
            body: `فواتير متأخرة: ${overdueCount} · أصناف قاربت على الانتهاء: ${expiringCount}`,
          },
        });
      }
    }
  }
});
