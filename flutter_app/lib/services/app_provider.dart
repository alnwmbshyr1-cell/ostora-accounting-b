import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/models.dart';
import 'db_service.dart';

class AppProvider extends ChangeNotifier {
  CompanySettings settings = CompanySettings.defaults();
  bool isLoggedIn = false;
  bool onboardingSeen = false;
  String activePlan = 'trial';
  int trialDaysRemaining = 30;

  List<Invoice> invoices = [];
  List<Customer> customers = [];
  List<Supplier> suppliers = [];
  List<PurchaseOrder> purchaseOrders = [];
  List<Voucher> vouchers = [];
  List<JournalEntry> journals = [];
  List<Product> products = [];
  List<Employee> employees = [];
  List<Expense> expenses = [];
  List<BankAccount> banks = [];
  final Set<String> dismissedAlertIds = {};

  bool get isAr => settings.isArabic;

  Future<void> initialize() async {
    onboardingSeen = DbService.getOnboardingSeen();
    isLoggedIn = DbService.getIsLoggedIn();
    activePlan = DbService.getActivePlan();

    final trialStart = DateTime.tryParse(DbService.getTrialStartIso()) ?? DateTime.now();
    final elapsed = DateTime.now().difference(trialStart).inDays;
    trialDaysRemaining = (30 - elapsed).clamp(0, 30);

    final savedSettings = await DbService.loadSettings();
    if (savedSettings != null) {
      settings = CompanySettings.fromMap(savedSettings);
    }

    await _loadAllFromDb();
    if (invoices.isEmpty && customers.isEmpty && products.isEmpty) {
      await restoreDemoData();
    }
    notifyListeners();
  }

  Future<void> _loadAllFromDb() async {
    invoices = (await DbService.loadCollection('invoices')).map(Invoice.fromMap).toList();
    customers = (await DbService.loadCollection('customers')).map(Customer.fromMap).toList();
    suppliers = (await DbService.loadCollection('suppliers')).map(Supplier.fromMap).toList();
    purchaseOrders = (await DbService.loadCollection('purchase_orders')).map(PurchaseOrder.fromMap).toList();
    vouchers = (await DbService.loadCollection('vouchers')).map(Voucher.fromMap).toList();
    journals = (await DbService.loadCollection('journals')).map(JournalEntry.fromMap).toList();
    products = (await DbService.loadCollection('products')).map(Product.fromMap).toList();
    employees = (await DbService.loadCollection('employees')).map(Employee.fromMap).toList();
    expenses = (await DbService.loadCollection('expenses')).map(Expense.fromMap).toList();
    banks = (await DbService.loadCollection('banks')).map(BankAccount.fromMap).toList();
  }

  Future<void> _persist(String name, List<dynamic> list) async {
    await DbService.saveCollection(name, list.map((e) => (e as dynamic).toMap() as Map<String, dynamic>).toList());
  }

  // Auth & Onboarding
  Future<void> completeOnboarding() async {
    onboardingSeen = true;
    await DbService.setOnboardingSeen();
    notifyListeners();
  }

  Future<void> loginDemo() async {
    isLoggedIn = true;
    await DbService.setIsLoggedIn(true);
    notifyListeners();
  }

  Future<void> logout() async {
    isLoggedIn = false;
    await DbService.setIsLoggedIn(false);
    notifyListeners();
  }

  // Language, Theme & Settings
  Future<void> toggleLanguage() async {
    settings = settings.copyWith(isArabic: !settings.isArabic);
    await DbService.saveSettings(settings.toMap());
    notifyListeners();
  }

  Future<void> updateSettings(CompanySettings updated) async {
    settings = updated;
    await DbService.saveSettings(settings.toMap());
    notifyListeners();
  }

  Future<void> setPlan(String plan) async {
    activePlan = plan;
    await DbService.setActivePlan(plan);
    notifyListeners();
  }

  // Calculated KPIs
  double get totalSales => invoices.fold(0.0, (s, i) => s + i.total);
  double get totalCustomerDebt => customers.fold(0.0, (s, c) => s + c.debt);
  double get totalSupplierDebt => suppliers.fold(0.0, (s, sp) => s + sp.payable);
  double get totalStockValue => products.fold(0.0, (s, p) => s + (p.qty * p.cost));
  double get totalExpenses => expenses.fold(0.0, (s, e) => s + e.amount);
  double get totalCashAndBanks => banks.fold(0.0, (s, b) => s + b.balance);
  double get netProfit => invoices.fold(0.0, (s, i) => s + i.subtotal) - totalExpenses;

  int get healthScore {
    if (invoices.isEmpty && banks.isEmpty) return 50;
    double score = 60;
    if (netProfit > 0) score += 20;
    if (totalCashAndBanks > totalSupplierDebt) score += 10;
    final overdueCount = invoices.where((i) => i.status == InvoiceStatus.overdue).length;
    score -= overdueCount * 5;
    final lowStockCount = products.where((p) => p.isLowStock).length;
    score -= lowStockCount * 3;
    return score.clamp(12, 98).round();
  }

  List<SmartAlert> get smartAlerts {
    final list = <SmartAlert>[];
    final lowStock = products.where((p) => p.isLowStock).toList();
    if (lowStock.isNotEmpty) {
      list.add(SmartAlert(
        id: 'alert_low_stock',
        titleAr: '${lowStock.length} أصناف وصلت للحد الأدنى للمخزون',
        titleEn: '${lowStock.length} products reached low stock threshold',
        subtitleAr: 'أول صنف: ${lowStock.first.name} (${lowStock.first.qty} وحدة)',
        subtitleEn: 'Top item: ${lowStock.first.name} (${lowStock.first.qty} units)',
        actionRoute: 'inventory',
        severity: 'warning',
      ));
    }
    final overdue = invoices.where((i) => i.status == InvoiceStatus.overdue).toList();
    if (overdue.isNotEmpty) {
      list.add(SmartAlert(
        id: 'alert_overdue',
        titleAr: '${overdue.length} فواتير متأخرة السداد تحتاج متابعة',
        titleEn: '${overdue.length} overdue invoices require collection',
        subtitleAr: 'بإجمالي ${overdue.fold(0.0, (s, i) => s + i.total).toStringAsFixed(0)} ${settings.currency}',
        subtitleEn: 'Total ${overdue.fold(0.0, (s, i) => s + i.total).toStringAsFixed(0)} ${settings.currency}',
        actionRoute: 'invoices',
        severity: 'danger',
      ));
    }
    if (totalCustomerDebt > 15000) {
      list.add(SmartAlert(
        id: 'alert_debt',
        titleAr: 'ارتفاع ذمم العملاء المدينة',
        titleEn: 'Elevated customer receivables balance',
        subtitleAr: 'أرسل تذكيرات واتساب لتحصيل السيولة',
        subtitleEn: 'Send WhatsApp payment reminders to boost cashflow',
        actionRoute: 'customers',
        severity: 'info',
      ));
    }
    return list.where((a) => !dismissedAlertIds.contains(a.id)).toList();
  }

  void dismissAlert(String id) {
    dismissedAlertIds.add(id);
    notifyListeners();
  }

  // Invoices CRUD
  Future<void> addOrUpdateInvoice(Invoice inv, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = invoices.indexWhere((i) => i.id == inv.id);
      if (idx != -1) invoices[idx] = inv;
    } else {
      invoices.insert(0, inv);
      if (inv.status != InvoiceStatus.paid && inv.customerId.isNotEmpty) {
        final cIdx = customers.indexWhere((c) => c.id == inv.customerId);
        if (cIdx != -1) {
          final c = customers[cIdx];
          customers[cIdx] = Customer(
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            debt: c.debt + inv.total,
          );
          await _persist('customers', customers);
        }
      }
    }
    await _persist('invoices', invoices);
    notifyListeners();
  }

  Future<void> deleteInvoice(String id) async {
    invoices.removeWhere((i) => i.id == id);
    await _persist('invoices', invoices);
    notifyListeners();
  }

  Future<void> deleteAllInvoices() async {
    invoices.clear();
    await _persist('invoices', invoices);
    notifyListeners();
  }

  Future<void> markInvoicePaid(String id) async {
    final idx = invoices.indexWhere((i) => i.id == id);
    if (idx == -1) return;
    final target = invoices[idx];
    if (target.status == InvoiceStatus.paid) return;

    invoices[idx] = Invoice(
      id: target.id,
      customerId: target.customerId,
      customerName: target.customerName,
      customerPhone: target.customerPhone,
      description: target.description,
      subtotal: target.subtotal,
      vat: target.vat,
      total: target.total,
      status: InvoiceStatus.paid,
      date: target.date,
    );

    final cIdx = customers.indexWhere(
      (c) => c.id == target.customerId || c.name == target.customerName,
    );
    if (cIdx != -1) {
      final c = customers[cIdx];
      customers[cIdx] = Customer(
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        debt: (c.debt - target.total).clamp(0, double.infinity),
      );
      await _persist('customers', customers);
    }

    final bIdx = banks.indexWhere((b) => b.id == 'alrajhi');
    if (bIdx != -1) {
      final b = banks[bIdx];
      banks[bIdx] = BankAccount(
        id: b.id,
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        accountNumber: b.accountNumber,
        balance: b.balance + target.total,
      );
      await _persist('banks', banks);
    }

    final now = DateTime.now();
    vouchers.insert(
      0,
      Voucher(
        id: 'VCH-${500 + vouchers.length + 1}',
        type: VoucherType.receipt,
        partyName: target.customerName,
        partyPhone: target.customerPhone,
        amount: target.total,
        reason: isAr ? 'تحصيل الفاتورة ${target.id}' : 'Settlement for ${target.id}',
        paymentMethod: 'AlRajhi Bank',
        date: now,
      ),
    );
    journals.insert(
      0,
      JournalEntry(
        id: 'JRN-${700 + journals.length + 1}',
        reference: target.id,
        description: isAr
            ? 'سداد الفاتورة ${target.id} - ${target.customerName}'
            : 'Invoice ${target.id} payment - ${target.customerName}',
        date: now,
        lines: [
          JournalLine(account: '1010 - مصرف الراجحي', debit: target.total, credit: 0),
          JournalLine(account: '1020 - ذمم العملاء (${target.customerName})', debit: 0, credit: target.total),
        ],
      ),
    );

    await _persist('invoices', invoices);
    await _persist('vouchers', vouchers);
    await _persist('journals', journals);
    notifyListeners();
  }

  // Customers CRUD
  Future<void> saveCustomer(Customer c, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = customers.indexWhere((x) => x.id == c.id);
      if (idx != -1) customers[idx] = c;
    } else {
      customers.insert(0, c);
    }
    await _persist('customers', customers);
    notifyListeners();
  }

  Future<void> deleteCustomer(String id) async {
    customers.removeWhere((c) => c.id == id);
    await _persist('customers', customers);
    notifyListeners();
  }

  // Suppliers CRUD
  Future<void> saveSupplier(Supplier s, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = suppliers.indexWhere((x) => x.id == s.id);
      if (idx != -1) suppliers[idx] = s;
    } else {
      suppliers.insert(0, s);
    }
    await _persist('suppliers', suppliers);
    notifyListeners();
  }

  Future<void> deleteSupplier(String id) async {
    suppliers.removeWhere((s) => s.id == id);
    await _persist('suppliers', suppliers);
    notifyListeners();
  }

  // Purchase Orders CRUD + Receive increases stock
  Future<void> addPurchaseOrder(PurchaseOrder po) async {
    purchaseOrders.insert(0, po);
    await _persist('purchase_orders', purchaseOrders);
    notifyListeners();
  }

  Future<void> receivePurchaseOrder(String poId) async {
    final idx = purchaseOrders.indexWhere((p) => p.id == poId);
    if (idx == -1) return;
    final po = purchaseOrders[idx];
    if (po.status == PurchaseOrderStatus.received) return;

    purchaseOrders[idx] = PurchaseOrder(
      id: po.id,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      supplierPhone: po.supplierPhone,
      productId: po.productId,
      productName: po.productName,
      quantity: po.quantity,
      unitCost: po.unitCost,
      total: po.total,
      status: PurchaseOrderStatus.received,
      date: po.date,
    );

    final pIdx = products.indexWhere((pr) => pr.id == po.productId || pr.name == po.productName);
    if (pIdx != -1) {
      final pr = products[pIdx];
      products[pIdx] = Product(
        id: pr.id,
        name: pr.name,
        sku: pr.sku,
        qty: pr.qty + po.quantity,
        cost: po.unitCost,
        price: pr.price,
      );
    } else {
      products.insert(
        0,
        Product(
          id: 'PRD-${DateTime.now().millisecondsSinceEpoch % 10000}',
          name: po.productName,
          sku: 'SKU-${po.quantity}',
          qty: po.quantity,
          cost: po.unitCost,
          price: po.unitCost * 1.25,
        ),
      );
    }

    await _persist('purchase_orders', purchaseOrders);
    await _persist('products', products);
    notifyListeners();
  }

  // Vouchers CRUD
  Future<void> saveVoucher(Voucher v, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = vouchers.indexWhere((x) => x.id == v.id);
      if (idx != -1) vouchers[idx] = v;
    } else {
      vouchers.insert(0, v);
      if (v.type == VoucherType.receipt) {
        final cIdx = customers.indexWhere((c) => c.name == v.partyName);
        if (cIdx != -1) {
          final c = customers[cIdx];
          customers[cIdx] = Customer(
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            debt: (c.debt - v.amount).clamp(0, double.infinity),
          );
          await _persist('customers', customers);
        }
      }
    }
    await _persist('vouchers', vouchers);
    notifyListeners();
  }

  Future<void> deleteVoucher(String id) async {
    vouchers.removeWhere((v) => v.id == id);
    await _persist('vouchers', vouchers);
    notifyListeners();
  }

  // Journals CRUD
  Future<void> saveJournal(JournalEntry j, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = journals.indexWhere((x) => x.id == j.id);
      if (idx != -1) journals[idx] = j;
    } else {
      journals.insert(0, j);
    }
    await _persist('journals', journals);
    notifyListeners();
  }

  Future<void> deleteJournal(String id) async {
    journals.removeWhere((j) => j.id == id);
    await _persist('journals', journals);
    notifyListeners();
  }

  // Inventory CRUD
  Future<void> saveProduct(Product p, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = products.indexWhere((x) => x.id == p.id);
      if (idx != -1) products[idx] = p;
    } else {
      products.insert(0, p);
    }
    await _persist('products', products);
    notifyListeners();
  }

  Future<void> addTenStock(String id) async {
    final idx = products.indexWhere((p) => p.id == id);
    if (idx == -1) return;
    final p = products[idx];
    products[idx] = Product(
      id: p.id,
      name: p.name,
      sku: p.sku,
      qty: p.qty + 10,
      cost: p.cost,
      price: p.price,
    );
    await _persist('products', products);
    notifyListeners();
  }

  Future<void> deleteProduct(String id) async {
    products.removeWhere((p) => p.id == id);
    await _persist('products', products);
    notifyListeners();
  }

  // Employees CRUD & Pay Salary
  Future<void> saveEmployee(Employee emp, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = employees.indexWhere((x) => x.id == emp.id);
      if (idx != -1) employees[idx] = emp;
    } else {
      employees.insert(0, emp);
    }
    await _persist('employees', employees);
    notifyListeners();
  }

  Future<void> payEmployeeSalary(String id) async {
    final idx = employees.indexWhere((e) => e.id == id);
    if (idx == -1) return;
    final emp = employees[idx];
    employees[idx] = Employee(
      id: emp.id,
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      salary: emp.salary,
      lastPaidDate: DateTime.now(),
    );
    expenses.insert(
      0,
      Expense(
        id: 'EXP-${DateTime.now().millisecondsSinceEpoch % 10000}',
        title: isAr ? 'راتب ${emp.name}' : 'Salary - ${emp.name}',
        category: isAr ? 'الرواتب والأجور' : 'Payroll',
        amount: emp.salary,
        paidFromBankId: 'alrajhi',
        date: DateTime.now(),
      ),
    );
    await _persist('employees', employees);
    await _persist('expenses', expenses);
    notifyListeners();
  }

  Future<void> deleteEmployee(String id) async {
    employees.removeWhere((e) => e.id == id);
    await _persist('employees', employees);
    notifyListeners();
  }

  // Expenses CRUD
  Future<void> saveExpense(Expense exp, {bool isEdit = false}) async {
    if (isEdit) {
      final idx = expenses.indexWhere((x) => x.id == exp.id);
      if (idx != -1) expenses[idx] = exp;
    } else {
      expenses.insert(0, exp);
    }
    await _persist('expenses', expenses);
    notifyListeners();
  }

  Future<void> deleteExpense(String id) async {
    expenses.removeWhere((e) => e.id == id);
    await _persist('expenses', expenses);
    notifyListeners();
  }

  // Banks Update
  Future<void> adjustBankBalance(String id, double newBalance) async {
    final idx = banks.indexWhere((b) => b.id == id);
    if (idx == -1) return;
    final b = banks[idx];
    banks[idx] = BankAccount(
      id: b.id,
      nameAr: b.nameAr,
      nameEn: b.nameEn,
      accountNumber: b.accountNumber,
      balance: newBalance,
    );
    await _persist('banks', banks);
    notifyListeners();
  }

  // Backup / Restore JSON
  String exportFullBackupJson() {
    return const JsonEncoder.withIndent('  ').convert({
      'app': 'com.ostora.accounting',
      'version': '1.0.0',
      'exportedAt': DateTime.now().toIso8601String(),
      'settings': settings.toMap(),
      'invoices': invoices.map((e) => e.toMap()).toList(),
      'customers': customers.map((e) => e.toMap()).toList(),
      'suppliers': suppliers.map((e) => e.toMap()).toList(),
      'purchaseOrders': purchaseOrders.map((e) => e.toMap()).toList(),
      'vouchers': vouchers.map((e) => e.toMap()).toList(),
      'journals': journals.map((e) => e.toMap()).toList(),
      'products': products.map((e) => e.toMap()).toList(),
      'employees': employees.map((e) => e.toMap()).toList(),
      'expenses': expenses.map((e) => e.toMap()).toList(),
      'banks': banks.map((e) => e.toMap()).toList(),
    });
  }

  Future<void> importFullBackupJson(String rawJson) async {
    final map = jsonDecode(rawJson) as Map<String, dynamic>;
    if (map['settings'] != null) {
      settings = CompanySettings.fromMap(Map<String, dynamic>.from(map['settings'] as Map));
      await DbService.saveSettings(settings.toMap());
    }
    invoices = (map['invoices'] as List? ?? []).map((e) => Invoice.fromMap(Map<String, dynamic>.from(e))).toList();
    customers = (map['customers'] as List? ?? []).map((e) => Customer.fromMap(Map<String, dynamic>.from(e))).toList();
    suppliers = (map['suppliers'] as List? ?? []).map((e) => Supplier.fromMap(Map<String, dynamic>.from(e))).toList();
    purchaseOrders = (map['purchaseOrders'] as List? ?? []).map((e) => PurchaseOrder.fromMap(Map<String, dynamic>.from(e))).toList();
    vouchers = (map['vouchers'] as List? ?? []).map((e) => Voucher.fromMap(Map<String, dynamic>.from(e))).toList();
    journals = (map['journals'] as List? ?? []).map((e) => JournalEntry.fromMap(Map<String, dynamic>.from(e))).toList();
    products = (map['products'] as List? ?? []).map((e) => Product.fromMap(Map<String, dynamic>.from(e))).toList();
    employees = (map['employees'] as List? ?? []).map((e) => Employee.fromMap(Map<String, dynamic>.from(e))).toList();
    expenses = (map['expenses'] as List? ?? []).map((e) => Expense.fromMap(Map<String, dynamic>.from(e))).toList();
    banks = (map['banks'] as List? ?? []).map((e) => BankAccount.fromMap(Map<String, dynamic>.from(e))).toList();

    await _saveAllCollections();
    notifyListeners();
  }

  Future<void> deleteAllData() async {
    invoices.clear();
    customers.clear();
    suppliers.clear();
    purchaseOrders.clear();
    vouchers.clear();
    journals.clear();
    products.clear();
    employees.clear();
    expenses.clear();
    banks.clear();
    await DbService.clearAllCollections();
    notifyListeners();
  }

  Future<void> restoreDemoData() async {
    final now = DateTime.now();
    customers = [
      Customer(id: 'C-101', name: 'شركة النخبة التجارية', phone: '0504412398', email: 'accounts@nokhba.sa', debt: 18400),
      Customer(id: 'C-102', name: 'مؤسسة الفجر للمقاولات', phone: '0558231904', email: 'finance@fajr.sa', debt: 9200),
      Customer(id: 'C-103', name: 'متاجر الريادة الحديثة', phone: '0531187420', email: 'pay@riyadah.sa', debt: 0),
    ];
    suppliers = [
      Supplier(id: 'S-201', name: 'مصنع الخليج للتجهيزات', phone: '0549012234', category: 'مواد خام', payable: 14500),
      Supplier(id: 'S-202', name: 'شركة التقنية السحابية', phone: '0567721109', category: 'أجهزة ومعدات', payable: 4800),
    ];
    products = [
      Product(id: 'P-01', name: 'أجهزة نقاط بيع ذكية POS', sku: 'POS-900', qty: 24, cost: 850, price: 1450),
      Product(id: 'P-02', name: 'طابعة فواتير حرارية 80mm', sku: 'PRT-80', qty: 7, cost: 220, price: 390),
      Product(id: 'P-03', name: 'ماسح باركود لاسلكي 2D', sku: 'SCN-2D', qty: 18, cost: 160, price: 310),
      Product(id: 'P-04', name: 'درج نقدية فولاذي 5 خانات', sku: 'DRW-05', qty: 5, cost: 140, price: 260),
    ];
    invoices = [
      Invoice.create(
        id: 'INV-1001',
        customerId: 'C-101',
        customerName: 'شركة النخبة التجارية',
        customerPhone: '0504412398',
        description: 'توريد 10 أجهزة نقاط بيع ذكية',
        subtotal: 16000,
        status: InvoiceStatus.pending,
        date: now.subtract(const Duration(days: 2)),
      ),
      Invoice.create(
        id: 'INV-1002',
        customerId: 'C-103',
        customerName: 'متاجر الريادة الحديثة',
        customerPhone: '0531187420',
        description: 'نظام كاشير متكامل مع طابعات',
        subtotal: 24500,
        status: InvoiceStatus.paid,
        date: now.subtract(const Duration(days: 5)),
      ),
      Invoice.create(
        id: 'INV-1003',
        customerId: 'C-102',
        customerName: 'مؤسسة الفجر للمقاولات',
        customerPhone: '0558231904',
        description: 'عقد صيانة وتجهيز فروع',
        subtotal: 8000,
        status: InvoiceStatus.overdue,
        date: now.subtract(const Duration(days: 19)),
      ),
    ];
    purchaseOrders = [
      PurchaseOrder(
        id: 'PO-301',
        supplierId: 'S-201',
        supplierName: 'مصنع الخليج للتجهيزات',
        supplierPhone: '0549012234',
        productId: 'P-02',
        productName: 'طابعة فواتير حرارية 80mm',
        quantity: 15,
        unitCost: 215,
        total: 3225,
        status: PurchaseOrderStatus.ordered,
        date: now.subtract(const Duration(days: 1)),
      ),
    ];
    vouchers = [
      Voucher(
        id: 'VCH-501',
        type: VoucherType.receipt,
        partyName: 'متاجر الريادة الحديثة',
        partyPhone: '0531187420',
        amount: 28175,
        reason: 'سداد الفاتورة INV-1002',
        paymentMethod: 'AlRajhi Bank',
        date: now.subtract(const Duration(days: 4)),
      ),
      Voucher(
        id: 'VCH-502',
        type: VoucherType.payment,
        partyName: 'شركة التقنية السحابية',
        partyPhone: '0567721109',
        amount: 4200,
        reason: 'دفعة من مستحقات التوريد',
        paymentMethod: 'AlAhli Bank',
        date: now.subtract(const Duration(days: 3)),
      ),
    ];
    journals = [
      JournalEntry(
        id: 'JRN-701',
        reference: 'INV-1002',
        description: 'إثبات مبيعات نقدية متاجر الريادة',
        date: now.subtract(const Duration(days: 5)),
        lines: [
          JournalLine(account: '1010 - مصرف الراجحي', debit: 28175, credit: 0),
          JournalLine(account: '4010 - إيرادات المبيعات', debit: 0, credit: 24500),
          JournalLine(account: '2020 - ضريبة القيمة المضافة', debit: 0, credit: 3675),
        ],
      ),
    ];
    employees = [
      Employee(id: 'E-01', name: 'خالد العتيبي', role: 'محاسب مالي', phone: '0509981234', salary: 8500),
      Employee(id: 'E-02', name: 'سارة القحطاني', role: 'مديرة مبيعات', phone: '0552218743', salary: 9200),
    ];
    expenses = [
      Expense(
        id: 'EXP-901',
        title: 'إيجار المكتب الرئيسي - الربع الرابع',
        category: 'إيجارات',
        amount: 12000,
        paidFromBankId: 'alrajhi',
        date: now.subtract(const Duration(days: 10)),
      ),
      Expense(
        id: 'EXP-902',
        title: 'فواتير الكهرباء والإنترنت',
        category: 'مرافق',
        amount: 1450,
        paidFromBankId: 'cash',
        date: now.subtract(const Duration(days: 6)),
      ),
    ];
    banks = [
      BankAccount(id: 'alrajhi', nameAr: 'مصرف الراجحي', nameEn: 'AlRajhi Bank', accountNumber: 'SA44 8000 0219 6080 1044', balance: 142500),
      BankAccount(id: 'alahli', nameAr: 'البنك الأهلي السعودي', nameEn: 'AlAhli (SNB)', accountNumber: 'SA19 1000 0011 8920 3310', balance: 68900),
      BankAccount(id: 'cash', nameAr: 'الصندوق النقدي', nameEn: 'Main Cash Box', accountNumber: 'CASH-01', balance: 19450),
    ];

    await _saveAllCollections();
    notifyListeners();
  }

  Future<void> _saveAllCollections() async {
    await _persist('invoices', invoices);
    await _persist('customers', customers);
    await _persist('suppliers', suppliers);
    await _persist('purchase_orders', purchaseOrders);
    await _persist('vouchers', vouchers);
    await _persist('journals', journals);
    await _persist('products', products);
    await _persist('employees', employees);
    await _persist('expenses', expenses);
    await _persist('banks', banks);
  }
}
