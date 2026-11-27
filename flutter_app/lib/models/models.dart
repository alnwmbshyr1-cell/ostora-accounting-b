enum InvoiceStatus { paid, pending, overdue }

enum VoucherType { receipt, payment }

enum PurchaseOrderStatus { ordered, received }

// ====== صنف الفاتورة - عالمي ======
class InvoiceItem {
  final String sku;
  final String name;
  final String unit; // حبة / كرتون / كيلو / خدمة / سنة
  final double qty;
  final double price;
  final double disc; // خصم %
  final double vat; // ضريبة %

  InvoiceItem({
    required this.sku,
    required this.name,
    required this.unit,
    required this.qty,
    required this.price,
    this.disc = 0,
    this.vat = 15,
  });

  double get lineTotal => qty * price * (1 - disc / 100);
  double get lineVat => lineTotal * vat / 100;

  Map<String, dynamic> toMap() => {
        'sku': sku,
        'name': name,
        'unit': unit,
        'qty': qty,
        'price': price,
        'disc': disc,
        'vat': vat,
      };

  factory InvoiceItem.fromMap(Map<String, dynamic> map) => InvoiceItem(
        sku: map['sku'] as String? ?? '',
        name: map['name'] as String? ?? '',
        unit: map['unit'] as String? ?? 'حبة',
        qty: (map['qty'] as num?)?.toDouble() ?? 1,
        price: (map['price'] as num?)?.toDouble() ?? 0,
        disc: (map['disc'] as num?)?.toDouble() ?? 0,
        vat: (map['vat'] as num?)?.toDouble() ?? 15,
      );
}

class Invoice {
  final String id;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String customerVat;
  final String customerAddress;
  final String customerEmail;
  final String description;
  final String orderNo;
  final String paymentMethod; // تحويل بنكي / نقدي / شبكة / فيزا / آجل
  final String currency; // SAR / YER / USD ...
  final String notes;
  final String terms;
  final String iban;
  final double subtotal; // قبل الضريبة وبعد خصم الأصناف
  final double discount; // خصم عام
  final double shipping;
  final double vat;
  final double total;
  final double paid;
  final double cogs;
  final InvoiceStatus status;
  final DateTime date;
  final DateTime dueDate;
  final List<InvoiceItem> items;

  Invoice({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    this.customerVat = '',
    this.customerAddress = '',
    this.customerEmail = '',
    required this.description,
    this.orderNo = '',
    this.paymentMethod = 'تحويل بنكي',
    this.currency = 'SAR',
    this.notes = '',
    this.terms = '',
    this.iban = '',
    required this.subtotal,
    this.discount = 0,
    this.shipping = 0,
    required this.vat,
    required this.total,
    this.paid = 0,
    this.cogs = 0.0,
    required this.status,
    required this.date,
    DateTime? dueDate,
    List<InvoiceItem>? items,
  })  : dueDate = dueDate ?? date.add(const Duration(days: 7)),
        items = items ?? [];

  // المتبقي - أهم خانة عالمية
  double get remaining => (total - paid).clamp(0, double.infinity);
  double get isPaidFully => remaining <= 0.01 ? 1 : 0;

  factory Invoice.create({
    required String id,
    required String customerId,
    required String customerName,
    required String customerPhone,
    String customerVat = '',
    String customerAddress = '',
    String customerEmail = '',
    required String description,
    String orderNo = '',
    String paymentMethod = 'تحويل بنكي',
    String currency = 'SAR',
    String notes = '',
    String terms = '',
    String iban = '',
    required double subtotal,
    double discount = 0,
    double shipping = 0,
    double paid = 0,
    double cogs = 0.0,
    required InvoiceStatus status,
    DateTime? date,
    DateTime? dueDate,
    List<InvoiceItem>? items,
  }) {
    // اذا فيه أصناف، نحسب منها تلقائياً
    double calcSub = subtotal;
    double calcVat = 0;
    if (items != null && items.isNotEmpty) {
      calcSub = items.fold(0.0, (s, it) => s + it.lineTotal);
      calcVat = items.fold(0.0, (s, it) => s + it.lineVat);
    } else {
      calcVat = double.parse((calcSub * 0.15).toStringAsFixed(2));
    }
    final total = double.parse((calcSub - discount + shipping + calcVat).toStringAsFixed(2));
    // حالة تلقائية حسب المدفوع
    InvoiceStatus finalStatus = status;
    if (paid >= total && total > 0) finalStatus = InvoiceStatus.paid;
    else if (paid > 0 && paid < total) finalStatus = InvoiceStatus.pending;

    return Invoice(
      id: id,
      customerId: customerId,
      customerName: customerName,
      customerPhone: customerPhone,
      customerVat: customerVat,
      customerAddress: customerAddress,
      customerEmail: customerEmail,
      description: description,
      orderNo: orderNo,
      paymentMethod: paymentMethod,
      currency: currency,
      notes: notes,
      terms: terms,
      iban: iban,
      subtotal: double.parse(calcSub.toStringAsFixed(2)),
      discount: discount,
      shipping: shipping,
      vat: double.parse(calcVat.toStringAsFixed(2)),
      total: total,
      paid: paid,
      cogs: cogs,
      status: finalStatus,
      date: date ?? DateTime.now(),
      dueDate: dueDate,
      items: items ?? [],
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'customerId': customerId,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'customerVat': customerVat,
        'customerAddress': customerAddress,
        'customerEmail': customerEmail,
        'description': description,
        'orderNo': orderNo,
        'paymentMethod': paymentMethod,
        'currency': currency,
        'notes': notes,
        'terms': terms,
        'iban': iban,
        'subtotal': subtotal,
        'discount': discount,
        'shipping': shipping,
        'vat': vat,
        'total': total,
        'paid': paid,
        'cogs': cogs,
        'status': status.name,
        'date': date.toIso8601String(),
        'dueDate': dueDate.toIso8601String(),
        'items': items.map((e) => e.toMap()).toList(),
      };

  factory Invoice.fromMap(Map<String, dynamic> map) {
    // توافق مع الفواتير القديمة - اذا الحقل مو موجود نعطيه قيمة افتراضية
    final itemsRaw = map['items'] as List<dynamic>?;
    return Invoice(
      id: map['id'] as String,
      customerId: map['customerId'] as String? ?? '',
      customerName: map['customerName'] as String,
      customerPhone: map['customerPhone'] as String? ?? '',
      customerVat: map['customerVat'] as String? ?? '',
      customerAddress: map['customerAddress'] as String? ?? '',
      customerEmail: map['customerEmail'] as String? ?? '',
      description: map['description'] as String? ?? '',
      orderNo: map['orderNo'] as String? ?? '',
      paymentMethod: map['paymentMethod'] as String? ?? 'تحويل بنكي',
      currency: map['currency'] as String? ?? 'SAR',
      notes: map['notes'] as String? ?? '',
      terms: map['terms'] as String? ?? '',
      iban: map['iban'] as String? ?? '',
      subtotal: (map['subtotal'] as num).toDouble(),
      discount: (map['discount'] as num?)?.toDouble() ?? 0,
      shipping: (map['shipping'] as num?)?.toDouble() ?? 0,
      vat: (map['vat'] as num).toDouble(),
      total: (map['total'] as num).toDouble(),
      paid: (map['paid'] as num?)?.toDouble() ?? 0,
      cogs: (map['cogs'] as num?)?.toDouble() ?? 0.0,
      status: InvoiceStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => InvoiceStatus.pending,
      ),
      date: DateTime.parse(map['date'] as String),
      dueDate: map['dueDate'] != null ? DateTime.parse(map['dueDate'] as String) : DateTime.parse(map['date'] as String).add(const Duration(days: 7)),
      items: itemsRaw != null ? itemsRaw.map((e) => InvoiceItem.fromMap(e as Map<String, dynamic>)).toList() : [],
    );
  }
}

class Customer {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String vatNumber;
  final String address;
  final double debt;

  Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.vatNumber = '',
    this.address = '',
    required this.debt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'vatNumber': vatNumber,
        'address': address,
        'debt': debt,
      };

  factory Customer.fromMap(Map<String, dynamic> map) => Customer(
        id: map['id'] as String,
        name: map['name'] as String,
        phone: map['phone'] as String? ?? '',
        email: map['email'] as String? ?? '',
        vatNumber: map['vatNumber'] as String? ?? '',
        address: map['address'] as String? ?? '',
        debt: (map['debt'] as num?)?.toDouble() ?? 0.0,
      );
}

class Supplier {
  final String id;
  final String name;
  final String phone;
  final String category;
  final double payable;

  Supplier({
    required this.id,
    required this.name,
    required this.phone,
    required this.category,
    required this.payable,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'phone': phone,
        'category': category,
        'payable': payable,
      };

  factory Supplier.fromMap(Map<String, dynamic> map) => Supplier(
        id: map['id'] as String,
        name: map['name'] as String,
        phone: map['phone'] as String? ?? '',
        category: map['category'] as String? ?? '',
        payable: (map['payable'] as num?)?.toDouble() ?? 0.0,
      );
}

class PurchaseOrder {
  final String id;
  final String supplierId;
  final String supplierName;
  final String supplierPhone;
  final String productId;
  final String productName;
  final int quantity;
  final double unitCost;
  final double total;
  final PurchaseOrderStatus status;
  final DateTime date;

  PurchaseOrder({
    required this.id,
    required this.supplierId,
    required this.supplierName,
    required this.supplierPhone,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitCost,
    required this.total,
    required this.status,
    required this.date,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'supplierId': supplierId,
        'supplierName': supplierName,
        'supplierPhone': supplierPhone,
        'productId': productId,
        'productName': productName,
        'quantity': quantity,
        'unitCost': unitCost,
        'total': total,
        'status': status.name,
        'date': date.toIso8601String(),
      };

  factory PurchaseOrder.fromMap(Map<String, dynamic> map) => PurchaseOrder(
        id: map['id'] as String,
        supplierId: map['supplierId'] as String? ?? '',
        supplierName: map['supplierName'] as String,
        supplierPhone: map['supplierPhone'] as String? ?? '',
        productId: map['productId'] as String? ?? '',
        productName: map['productName'] as String,
        quantity: (map['quantity'] as num).toInt(),
        unitCost: (map['unitCost'] as num).toDouble(),
        total: (map['total'] as num).toDouble(),
        status: PurchaseOrderStatus.values.firstWhere(
          (e) => e.name == map['status'],
          orElse: () => PurchaseOrderStatus.ordered,
        ),
        date: DateTime.parse(map['date'] as String),
      );
}

class Voucher {
  final String id;
  final VoucherType type;
  final String partyName;
  final String partyPhone;
  final double amount;
  final String reason;
  final String paymentMethod;
  final DateTime date;

  Voucher({
    required this.id,
    required this.type,
    required this.partyName,
    required this.partyPhone,
    required this.amount,
    required this.reason,
    required this.paymentMethod,
    required this.date,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'type': type.name,
        'partyName': partyName,
        'partyPhone': partyPhone,
        'amount': amount,
        'reason': reason,
        'paymentMethod': paymentMethod,
        'date': date.toIso8601String(),
      };

  factory Voucher.fromMap(Map<String, dynamic> map) => Voucher(
        id: map['id'] as String,
        type: VoucherType.values.firstWhere(
          (e) => e.name == map['type'],
          orElse: () => VoucherType.receipt,
        ),
        partyName: map['partyName'] as String,
        partyPhone: map['partyPhone'] as String? ?? '',
        amount: (map['amount'] as num).toDouble(),
        reason: map['reason'] as String? ?? '',
        paymentMethod: map['paymentMethod'] as String? ?? 'Cash',
        date: DateTime.parse(map['date'] as String),
      );
}

class JournalLine {
  final String account;
  final double debit;
  final double credit;

  JournalLine({required this.account, required this.debit, required this.credit});

  Map<String, dynamic> toMap() => {'account': account, 'debit': debit, 'credit': credit};

  factory JournalLine.fromMap(Map<String, dynamic> map) => JournalLine(
        account: map['account'] as String,
        debit: (map['debit'] as num?)?.toDouble() ?? 0.0,
        credit: (map['credit'] as num?)?.toDouble() ?? 0.0,
      );
}

class JournalEntry {
  final String id;
  final String reference;
  final String description;
  final DateTime date;
  final List<JournalLine> lines;

  JournalEntry({required this.id, required this.reference, required this.description, required this.date, required this.lines});

  double get totalDebit => lines.fold(0.0, (s, l) => s + l.debit);
  double get totalCredit => lines.fold(0.0, (s, l) => s + l.credit);
  bool get isBalanced => (totalDebit - totalCredit).abs() < 0.01 && totalDebit > 0;

  Map<String, dynamic> toMap() => {'id': id, 'reference': reference, 'description': description, 'date': date.toIso8601String(), 'lines': lines.map((l) => l.toMap()).toList()};

  factory JournalEntry.fromMap(Map<String, dynamic> map) => JournalEntry(
        id: map['id'] as String,
        reference: map['reference'] as String? ?? '',
        description: map['description'] as String,
        date: DateTime.parse(map['date'] as String),
        lines: (map['lines'] as List<dynamic>).map((e) => JournalLine.fromMap(e as Map<String, dynamic>)).toList(),
      );
}

class Product {
  final String id;
  final String name;
  final String sku;
  final int qty;
  final double cost;
  final double price;

  Product({required this.id, required this.name, required this.sku, required this.qty, required this.cost, required this.price});

  bool get isLowStock => qty <= 10;

  Map<String, dynamic> toMap() => {'id': id, 'name': name, 'sku': sku, 'qty': qty, 'cost': cost, 'price': price};

  factory Product.fromMap(Map<String, dynamic> map) => Product(
        id: map['id'] as String,
        name: map['name'] as String,
        sku: map['sku'] as String? ?? '',
        qty: (map['qty'] as num).toInt(),
        cost: (map['cost'] as num).toDouble(),
        price: (map['price'] as num).toDouble(),
      );
}

class Employee {
  final String id;
  final String name;
  final String role;
  final String phone;
  final double salary;
  final DateTime? lastPaidDate;

  Employee({required this.id, required this.name, required this.role, required this.phone, required this.salary, this.lastPaidDate});

  Map<String, dynamic> toMap() => {'id': id, 'name': name, 'role': role, 'phone': phone, 'salary': salary, 'lastPaidDate': lastPaidDate?.toIso8601String()};

  factory Employee.fromMap(Map<String, dynamic> map) => Employee(
        id: map['id'] as String,
        name: map['name'] as String,
        role: map['role'] as String? ?? '',
        phone: map['phone'] as String? ?? '',
        salary: (map['salary'] as num).toDouble(),
        lastPaidDate: map['lastPaidDate'] != null ? DateTime.parse(map['lastPaidDate'] as String) : null,
      );
}

class Expense {
  final String id;
  final String title;
  final String category;
  final double amount;
  final String paidFromBankId;
  final DateTime date;

  Expense({required this.id, required this.title, required this.category, required this.amount, required this.paidFromBankId, required this.date});

  Map<String, dynamic> toMap() => {'id': id, 'title': title, 'category': category, 'amount': amount, 'paidFromBankId': paidFromBankId, 'date': date.toIso8601String()};

  factory Expense.fromMap(Map<String, dynamic> map) => Expense(
        id: map['id'] as String,
        title: map['title'] as String,
        category: map['category'] as String? ?? 'Operations',
        amount: (map['amount'] as num).toDouble(),
        paidFromBankId: map['paidFromBankId'] as String? ?? 'cash',
        date: DateTime.parse(map['date'] as String),
      );
}

class BankAccount {
  final String id;
  final String nameAr;
  final String nameEn;
  final String accountNumber;
  final double balance;

  BankAccount({required this.id, required this.nameAr, required this.nameEn, required this.accountNumber, required this.balance});

  Map<String, dynamic> toMap() => {'id': id, 'nameAr': nameAr, 'nameEn': nameEn, 'accountNumber': accountNumber, 'balance': balance};

  factory BankAccount.fromMap(Map<String, dynamic> map) => BankAccount(
        id: map['id'] as String,
        nameAr: map['nameAr'] as String,
        nameEn: map['nameEn'] as String,
        accountNumber: map['accountNumber'] as String? ?? '',
        balance: (map['balance'] as num).toDouble(),
      );
}

const List<String> kAllSupportedCurrencies = ['SAR','AED','USD','EUR','GBP','EGP','YER','KWD','QAR','BHD','OMR','JOD','IQD','TRY','JPY'];

const Map<String, double> kDefaultExchangeRates = {'SAR': 1.0,'AED': 1.021,'USD': 3.75,'EUR': 4.05,'GBP': 4.76,'EGP': 0.077,'YER': 0.015,'KWD': 12.22,'QAR': 1.03,'BHD': 9.95,'OMR': 9.74,'JOD': 5.29,'IQD': 0.00286,'TRY': 0.11,'JPY': 0.025};

class CompanySettings {
  final String companyName;
  final String taxNumber;
  final String crNumber;
  final String phone;
  final String email;
  final String address;
  final String currency;
  final String displayCurrency;
  final List<String> enabledCurrencies;
  final bool fxAutoUpdate;
  final int fxAutoIntervalHours;
  final String lastRatesSource;
  final String currencyDisplayStyle;
  final String currencyNumberLocale;
  final String currencyDecimalMode;
  final Map<String, double> exchangeRates;
  final bool isArabic;
  final bool isDarkMode;
  final double monthlySalesGoal;

  CompanySettings({
    required this.companyName,
    required this.taxNumber,
    required this.crNumber,
    required this.phone,
    required this.email,
    required this.address,
    required this.currency,
    this.displayCurrency = 'SAR',
    List<String>? enabledCurrencies,
    this.fxAutoUpdate = true,
    this.fxAutoIntervalHours = 6,
    this.lastRatesSource = 'Default FX Table',
    this.currencyDisplayStyle = 'symbol',
    this.currencyNumberLocale = 'en',
    this.currencyDecimalMode = 'auto',
    Map<String, double>? exchangeRates,
    required this.isArabic,
    required this.isDarkMode,
    this.monthlySalesGoal = 120000,
  })  : enabledCurrencies = enabledCurrencies ?? List<String>.from(kAllSupportedCurrencies),
        exchangeRates = exchangeRates ?? Map<String, double>.from(kDefaultExchangeRates);

  factory CompanySettings.defaults() => CompanySettings(
        companyName: 'مؤسسة الأسطورة للتجارة والمقاولات',
        taxNumber: '310482910400003',
        crNumber: '1010592831',
        phone: '0501234567',
        email: 'finance@ostora.systems',
        address: 'الرياض، حي العليا، المملكة العربية السعودية',
        currency: 'SAR',
        displayCurrency: 'SAR',
        enabledCurrencies: List<String>.from(kAllSupportedCurrencies),
        fxAutoUpdate: true,
        fxAutoIntervalHours: 6,
        lastRatesSource: 'Default FX Table',
        currencyDisplayStyle: 'symbol',
        currencyNumberLocale: 'en',
        currencyDecimalMode: 'auto',
        exchangeRates: Map<String, double>.from(kDefaultExchangeRates),
        isArabic: true,
        isDarkMode: false,
        monthlySalesGoal: 120000,
      );

  CompanySettings copyWith({
    String? companyName, String? taxNumber, String? crNumber, String? phone, String? email, String? address, String? currency, String? displayCurrency, List<String>? enabledCurrencies, bool? fxAutoUpdate, int? fxAutoIntervalHours, String? lastRatesSource, String? currencyDisplayStyle, String? currencyNumberLocale, String? currencyDecimalMode, Map<String, double>? exchangeRates, bool? isArabic, bool? isDarkMode, double? monthlySalesGoal,
  }) => CompanySettings(
        companyName: companyName ?? this.companyName,
        taxNumber: taxNumber ?? this.taxNumber,
        crNumber: crNumber ?? this.crNumber,
        phone: phone ?? this.phone,
        email: email ?? this.email,
        address: address ?? this.address,
        currency: currency ?? this.currency,
        displayCurrency: displayCurrency ?? this.displayCurrency,
        enabledCurrencies: enabledCurrencies ?? this.enabledCurrencies,
        fxAutoUpdate: fxAutoUpdate ?? this.fxAutoUpdate,
        fxAutoIntervalHours: fxAutoIntervalHours ?? this.fxAutoIntervalHours,
        lastRatesSource: lastRatesSource ?? this.lastRatesSource,
        currencyDisplayStyle: currencyDisplayStyle ?? this.currencyDisplayStyle,
        currencyNumberLocale: currencyNumberLocale ?? this.currencyNumberLocale,
        currencyDecimalMode: currencyDecimalMode ?? this.currencyDecimalMode,
        exchangeRates: exchangeRates ?? this.exchangeRates,
        isArabic: isArabic ?? this.isArabic,
        isDarkMode: isDarkMode ?? this.isDarkMode,
        monthlySalesGoal: monthlySalesGoal ?? this.monthlySalesGoal,
      );

  Map<String, dynamic> toMap() => {
        'companyName': companyName, 'taxNumber': taxNumber, 'crNumber': crNumber, 'phone': phone, 'email': email, 'address': address, 'currency': currency, 'displayCurrency': displayCurrency, 'enabledCurrencies': enabledCurrencies, 'fxAutoUpdate': fxAutoUpdate, 'fxAutoIntervalHours': fxAutoIntervalHours, 'lastRatesSource': lastRatesSource, 'currencyDisplayStyle': currencyDisplayStyle, 'currencyNumberLocale': currencyNumberLocale, 'currencyDecimalMode': currencyDecimalMode, 'exchangeRates': exchangeRates, 'isArabic': isArabic, 'isDarkMode': isDarkMode, 'monthlySalesGoal': monthlySalesGoal,
      };

  factory CompanySettings.fromMap(Map<String, dynamic> map) {
    final rawRates = map['exchangeRates'] as Map<String, dynamic>?;
    final parsedRates = Map<String, double>.from(kDefaultExchangeRates);
    if (rawRates != null) { rawRates.forEach((k, v) { if (v is num && v > 0) parsedRates[k] = v.toDouble(); }); }
    final rawEnabled = (map['enabledCurrencies'] as List<dynamic>?)?.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
    final cur = map['currency'] as String? ?? 'SAR';
    return CompanySettings(
      companyName: map['companyName'] as String? ?? 'أسطورة المحاسبة',
      taxNumber: map['taxNumber'] as String? ?? '',
      crNumber: map['crNumber'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      email: map['email'] as String? ?? '',
      address: map['address'] as String? ?? '',
      currency: cur,
      displayCurrency: map['displayCurrency'] as String? ?? cur,
      enabledCurrencies: (rawEnabled != null && rawEnabled.isNotEmpty) ? rawEnabled : List<String>.from(kAllSupportedCurrencies),
      fxAutoUpdate: map['fxAutoUpdate'] as bool? ?? true,
      fxAutoIntervalHours: (map['fxAutoIntervalHours'] as num?)?.toInt() ?? 6,
      lastRatesSource: map['lastRatesSource'] as String? ?? 'Default FX Table',
      currencyDisplayStyle: map['currencyDisplayStyle'] as String? ?? 'symbol',
      currencyNumberLocale: map['currencyNumberLocale'] as String? ?? 'en',
      currencyDecimalMode: map['currencyDecimalMode'] as String? ?? 'auto',
      exchangeRates: parsedRates,
      isArabic: map['isArabic'] as bool? ?? true,
      isDarkMode: map['isDarkMode'] as bool? ?? false,
      monthlySalesGoal: (map['monthlySalesGoal'] as num?)?.toDouble() ?? 120000,
    );
  }
}

class SmartAlert {
  final String id;
  final String titleAr;
  final String titleEn;
  final String subtitleAr;
  final String subtitleEn;
  final String actionRoute;
  final String severity;

  SmartAlert({required this.id, required this.titleAr, required this.titleEn, required this.subtitleAr, required this.subtitleEn, required this.actionRoute, required this.severity});
}
