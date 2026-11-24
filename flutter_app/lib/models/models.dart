enum InvoiceStatus { paid, pending, overdue }

enum VoucherType { receipt, payment }

enum PurchaseOrderStatus { ordered, received }

class Invoice {
  final String id;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String description;
  final double subtotal;
  final double vat;
  final double total;
  final InvoiceStatus status;
  final DateTime date;

  Invoice({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.description,
    required this.subtotal,
    required this.vat,
    required this.total,
    required this.status,
    required this.date,
  });

  factory Invoice.create({
    required String id,
    required String customerId,
    required String customerName,
    required String customerPhone,
    required String description,
    required double subtotal,
    required InvoiceStatus status,
    DateTime? date,
  }) {
    final vat = double.parse((subtotal * 0.15).toStringAsFixed(2));
    final total = double.parse((subtotal + vat).toStringAsFixed(2));
    return Invoice(
      id: id,
      customerId: customerId,
      customerName: customerName,
      customerPhone: customerPhone,
      description: description,
      subtotal: subtotal,
      vat: vat,
      total: total,
      status: status,
      date: date ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'customerId': customerId,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'description': description,
        'subtotal': subtotal,
        'vat': vat,
        'total': total,
        'status': status.name,
        'date': date.toIso8601String(),
      };

  factory Invoice.fromMap(Map<String, dynamic> map) => Invoice(
        id: map['id'] as String,
        customerId: map['customerId'] as String? ?? '',
        customerName: map['customerName'] as String,
        customerPhone: map['customerPhone'] as String? ?? '',
        description: map['description'] as String? ?? '',
        subtotal: (map['subtotal'] as num).toDouble(),
        vat: (map['vat'] as num).toDouble(),
        total: (map['total'] as num).toDouble(),
        status: InvoiceStatus.values.firstWhere(
          (e) => e.name == map['status'],
          orElse: () => InvoiceStatus.pending,
        ),
        date: DateTime.parse(map['date'] as String),
      );
}

class Customer {
  final String id;
  final String name;
  final String phone;
  final String email;
  final double debt;

  Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.debt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'debt': debt,
      };

  factory Customer.fromMap(Map<String, dynamic> map) => Customer(
        id: map['id'] as String,
        name: map['name'] as String,
        phone: map['phone'] as String? ?? '',
        email: map['email'] as String? ?? '',
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

  JournalLine({
    required this.account,
    required this.debit,
    required this.credit,
  });

  Map<String, dynamic> toMap() => {
        'account': account,
        'debit': debit,
        'credit': credit,
      };

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

  JournalEntry({
    required this.id,
    required this.reference,
    required this.description,
    required this.date,
    required this.lines,
  });

  double get totalDebit => lines.fold(0.0, (s, l) => s + l.debit);
  double get totalCredit => lines.fold(0.0, (s, l) => s + l.credit);
  bool get isBalanced => (totalDebit - totalCredit).abs() < 0.01 && totalDebit > 0;

  Map<String, dynamic> toMap() => {
        'id': id,
        'reference': reference,
        'description': description,
        'date': date.toIso8601String(),
        'lines': lines.map((l) => l.toMap()).toList(),
      };

  factory JournalEntry.fromMap(Map<String, dynamic> map) => JournalEntry(
        id: map['id'] as String,
        reference: map['reference'] as String? ?? '',
        description: map['description'] as String,
        date: DateTime.parse(map['date'] as String),
        lines: (map['lines'] as List<dynamic>)
            .map((e) => JournalLine.fromMap(e as Map<String, dynamic>))
            .toList(),
      );
}

class Product {
  final String id;
  final String name;
  final String sku;
  final int qty;
  final double cost;
  final double price;

  Product({
    required this.id,
    required this.name,
    required this.sku,
    required this.qty,
    required this.cost,
    required this.price,
  });

  bool get isLowStock => qty <= 10;

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'sku': sku,
        'qty': qty,
        'cost': cost,
        'price': price,
      };

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

  Employee({
    required this.id,
    required this.name,
    required this.role,
    required this.phone,
    required this.salary,
    this.lastPaidDate,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'role': role,
        'phone': phone,
        'salary': salary,
        'lastPaidDate': lastPaidDate?.toIso8601String(),
      };

  factory Employee.fromMap(Map<String, dynamic> map) => Employee(
        id: map['id'] as String,
        name: map['name'] as String,
        role: map['role'] as String? ?? '',
        phone: map['phone'] as String? ?? '',
        salary: (map['salary'] as num).toDouble(),
        lastPaidDate: map['lastPaidDate'] != null
            ? DateTime.parse(map['lastPaidDate'] as String)
            : null,
      );
}

class Expense {
  final String id;
  final String title;
  final String category;
  final double amount;
  final String paidFromBankId;
  final DateTime date;

  Expense({
    required this.id,
    required this.title,
    required this.category,
    required this.amount,
    required this.paidFromBankId,
    required this.date,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'title': title,
        'category': category,
        'amount': amount,
        'paidFromBankId': paidFromBankId,
        'date': date.toIso8601String(),
      };

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

  BankAccount({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.accountNumber,
    required this.balance,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'nameAr': nameAr,
        'nameEn': nameEn,
        'accountNumber': accountNumber,
        'balance': balance,
      };

  factory BankAccount.fromMap(Map<String, dynamic> map) => BankAccount(
        id: map['id'] as String,
        nameAr: map['nameAr'] as String,
        nameEn: map['nameEn'] as String,
        accountNumber: map['accountNumber'] as String? ?? '',
        balance: (map['balance'] as num).toDouble(),
      );
}

class CompanySettings {
  final String companyName;
  final String taxNumber;
  final String crNumber;
  final String phone;
  final String email;
  final String address;
  final String currency;
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
    required this.isArabic,
    required this.isDarkMode,
    this.monthlySalesGoal = 120000,
  });

  factory CompanySettings.defaults() => CompanySettings(
        companyName: 'مؤسسة الأسطورة للتجارة والمقاولات',
        taxNumber: '310482910400003',
        crNumber: '1010592831',
        phone: '0501234567',
        email: 'finance@ostora.systems',
        address: 'الرياض، حي العليا، المملكة العربية السعودية',
        currency: 'SAR',
        isArabic: true,
        isDarkMode: false,
        monthlySalesGoal: 120000,
      );

  CompanySettings copyWith({
    String? companyName,
    String? taxNumber,
    String? crNumber,
    String? phone,
    String? email,
    String? address,
    String? currency,
    bool? isArabic,
    bool? isDarkMode,
    double? monthlySalesGoal,
  }) =>
      CompanySettings(
        companyName: companyName ?? this.companyName,
        taxNumber: taxNumber ?? this.taxNumber,
        crNumber: crNumber ?? this.crNumber,
        phone: phone ?? this.phone,
        email: email ?? this.email,
        address: address ?? this.address,
        currency: currency ?? this.currency,
        isArabic: isArabic ?? this.isArabic,
        isDarkMode: isDarkMode ?? this.isDarkMode,
        monthlySalesGoal: monthlySalesGoal ?? this.monthlySalesGoal,
      );

  Map<String, dynamic> toMap() => {
        'companyName': companyName,
        'taxNumber': taxNumber,
        'crNumber': crNumber,
        'phone': phone,
        'email': email,
        'address': address,
        'currency': currency,
        'isArabic': isArabic,
        'isDarkMode': isDarkMode,
        'monthlySalesGoal': monthlySalesGoal,
      };

  factory CompanySettings.fromMap(Map<String, dynamic> map) => CompanySettings(
        companyName: map['companyName'] as String? ?? 'أسطورة المحاسبة',
        taxNumber: map['taxNumber'] as String? ?? '',
        crNumber: map['crNumber'] as String? ?? '',
        phone: map['phone'] as String? ?? '',
        email: map['email'] as String? ?? '',
        address: map['address'] as String? ?? '',
        currency: map['currency'] as String? ?? 'SAR',
        isArabic: map['isArabic'] as bool? ?? true,
        isDarkMode: map['isDarkMode'] as bool? ?? false,
        monthlySalesGoal: (map['monthlySalesGoal'] as num?)?.toDouble() ?? 120000,
      );
}

class SmartAlert {
  final String id;
  final String titleAr;
  final String titleEn;
  final String subtitleAr;
  final String subtitleEn;
  final String actionRoute;
  final String severity; // warning, danger, info

  SmartAlert({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.subtitleAr,
    required this.subtitleEn,
    required this.actionRoute,
    required this.severity,
  });
}
