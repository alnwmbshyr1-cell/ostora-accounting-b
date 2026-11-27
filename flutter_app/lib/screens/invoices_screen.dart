import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../services/pdf_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});
  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  String _search = '';
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;
    final filtered = prov.invoices.where((inv) {
      final matchesFilter = _filter == 'all' || inv.status.name == _filter;
      final q = _search.toLowerCase();
      final matchesSearch = q.isEmpty ||
          inv.customerName.toLowerCase().contains(q) ||
          inv.id.toLowerCase().contains(q);
      return matchesFilter && matchesSearch;
    }).toList();

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      hintText: AppStrings.t('search', ar),
                      prefixIcon: const Icon(Icons.search_rounded),
                    ),
                  ),
                ),
                if (prov.invoices.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    tooltip: AppStrings.t('delete_all', ar),
                    onPressed: () => _confirmDeleteAll(context, prov, ar),
                    icon: const Icon(Icons.delete_sweep_rounded, color: AppTheme.dangerRed),
                  ),
                ],
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: ['all', 'paid', 'pending', 'overdue'].map((st) {
                final active = _filter == st;
                return Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: ChoiceChip(
                    selected: active,
                    label: Text(AppStrings.t(st, ar)),
                    onSelected: (_) => setState(() => _filter = st),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: filtered.isEmpty
                ? Center(child: Text(AppStrings.t('no_data', ar)))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    itemBuilder: (_, idx) {
                      final inv = filtered[idx];
                      final stColor = inv.status == InvoiceStatus.paid
                          ? AppTheme.successGreen
                          : inv.status == InvoiceStatus.overdue
                              ? AppTheme.dangerRed
                              : AppTheme.warningAmber;
                      // المتبقي = الإجمالي - المدفوع (اذا المودل ما فيه paid نعتبره 0)
                      final paid = 0.0;
                      final remain = inv.total - paid;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(inv.id, style: const TextStyle(fontWeight: FontWeight.w700)),
                                    Text(AppStrings.t(inv.status.name, ar),
                                        style: TextStyle(color: stColor, fontWeight: FontWeight.w700)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(inv.customerName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                if (inv.description.isNotEmpty)
                                  Text(inv.description, style: TextStyle(color: Theme.of(context).hintColor, fontSize: 13)),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('${AppStrings.t('subtotal', ar)}: ${inv.subtotal.toStringAsFixed(2)} | ${AppStrings.t('vat_15', ar)}: ${inv.vat.toStringAsFixed(2)}',
                                        style: const TextStyle(fontSize: 12)),
                                    Text('${inv.total.toStringAsFixed(2)} $cur',
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(ar ? 'المدفوع: ${paid.toStringAsFixed(2)} $cur' : 'Paid: ${paid.toStringAsFixed(2)} $cur', style: const TextStyle(fontSize: 12, color: Colors.green)),
                                    Text(ar ? 'المتبقي: ${remain.toStringAsFixed(2)} $cur' : 'Remaining: ${remain.toStringAsFixed(2)} $cur', style: const TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w700)),
                                  ],
                                ),
                                const Divider(height: 20),
                                Wrap(
                                  spacing: 6,
                                  children: [
                                    if (inv.status != InvoiceStatus.paid)
                                      ActionChip(
                                        backgroundColor: AppTheme.accentGold,
                                        side: BorderSide.none,
                                        avatar: const Icon(Icons.check_circle_outline_rounded, size: 16, color: Colors.black87),
                                        label: Text(AppStrings.t('mark_paid', ar), style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.w800, fontSize: 12)),
                                        onPressed: () => prov.markInvoicePaid(inv.id),
                                      ),
                                    IconButton(tooltip: AppStrings.t('print_pdf', ar), icon: const Icon(Icons.print_rounded, color: AppTheme.primaryEmerald), onPressed: () => PdfService.printTaxInvoice(invoice: inv, company: prov.settings)),
                                    IconButton(tooltip: 'QR ZATCA', icon: const Icon(Icons.qr_code_2_rounded, color: AppTheme.accentGold), onPressed: () => _showQrDialog(context, inv, prov.settings)),
                                    IconButton(tooltip: AppStrings.t('whatsapp', ar), icon: const Icon(Icons.chat_rounded, color: Colors.green), onPressed: () {
                                      final msg = ar ? 'السلام عليكم ${inv.customerName}، مرفق تفاصيل الفاتورة الضريبية رقم ${inv.id} بمبلغ إجمالي ${inv.total.toStringAsFixed(2)} $cur (شامل ضريبة 15%). المتبقي: ${remain.toStringAsFixed(2)} $cur. شكراً لتعاملكم مع ${prov.settings.companyName}.' : 'Hello ${inv.customerName}, Tax Invoice ${inv.id} total ${inv.total.toStringAsFixed(2)} $cur (incl. 15% VAT) from ${prov.settings.companyName}.';
                                      WhatsAppService.sendWhatsApp(phone: inv.customerPhone, message: msg);
                                    }),
                                    IconButton(tooltip: AppStrings.t('share_email', ar), icon: const Icon(Icons.email_outlined), onPressed: () => WhatsAppService.sendEmail(to: '', subject: 'Tax Invoice ${inv.id} - ${prov.settings.companyName}', body: 'Customer: ${inv.customerName}\nTotal: ${inv.total.toStringAsFixed(2)} $cur')),
                                    IconButton(tooltip: AppStrings.t('edit', ar), icon: const Icon(Icons.edit_outlined), onPressed: () => _openForm(context, prov, ar, existing: inv)),
                                    IconButton(tooltip: AppStrings.t('delete', ar), icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed), onPressed: () => _confirmDelete(context, prov, ar, inv.id)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, prov, ar),
        icon: const Icon(Icons.add_rounded),
        label: Text(AppStrings.t('add_invoice', ar)),
      ),
    );
  }

  void _showQrDialog(BuildContext context, Invoice inv, CompanySettings company) {
    final qrData = PdfService.buildZatcaQrPayload(sellerName: company.companyName, vatNumber: company.taxNumber, timestampIso: inv.date.toIso8601String(), totalWithVat: inv.total.toStringAsFixed(2), vatAmount: inv.vat.toStringAsFixed(2));
    showDialog(context: context, builder: (_) => AlertDialog(title: Text('ZATCA QR · ${inv.id}'), content: SizedBox(width: 220, height: 220, child: Center(child: QrImageView(data: qrData, size: 200))), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))]));
  }

  // ====== فورم عالمي جديد ======
  void _openForm(BuildContext context, AppProvider prov, bool ar, {Invoice? existing}) {
    final clientCtrl = TextEditingController(text: existing?.customerName ?? (prov.customers.isNotEmpty ? prov.customers.first.name : ''));
    final phoneCtrl = TextEditingController(text: existing?.customerPhone ?? (prov.customers.isNotEmpty ? prov.customers.first.phone : ''));
    final vatCtrl = TextEditingController(text: '');
    final addressCtrl = TextEditingController(text: '');
    final emailCtrl = TextEditingController(text: '');
    final orderCtrl = TextEditingController(text: 'ORD-${100 + prov.invoices.length + 1}');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final notesCtrl = TextEditingController(text: ar ? 'شكراً لتعاملكم معنا' : 'Thank you for your business');
    final termsCtrl = TextEditingController(text: ar ? 'الدفع خلال 7 أيام' : 'Payment within 7 days');
    final ibanCtrl = TextEditingController(text: '');
    final gDiscCtrl = TextEditingController(text: '0');
    final shipCtrl = TextEditingController(text: '0');
    final paidCtrl = TextEditingController(text: '0');
    var status = existing?.status ?? InvoiceStatus.pending;
    var payMethod = ar ? 'تحويل بنكي' : 'Bank Transfer';
    var currency = prov.settings.currency;
    var issueDate = existing?.date ?? DateTime.now();
    var dueDate = DateTime.now().add(const Duration(days: 7));
    // أصناف - كل صنف: sku, name, unit, qty, price, disc%, vat%
    List<Map<String, dynamic>> items = [
      {'sku': 'SKU-001', 'name': ar ? 'اشتراك برنامج - سنوي' : 'Subscription - Yearly', 'unit': ar ? 'خدمة' : 'Service', 'qty': 1.0, 'price': existing?.subtotal ?? 0.0, 'disc': 0.0, 'vat': 15.0}
    ];

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setModalState) {
        double calcSub() { double s = 0; for (var it in items) { s += (it['qty'] as double) * (it['price'] as double) * (1 - (it['disc'] as double) / 100); } return s; }
        double calcVat() { double v = 0; for (var it in items) { final line = (it['qty'] as double) * (it['price'] as double) * (1 - (it['disc'] as double) / 100); v += line * (it['vat'] as double) / 100; } return v; }
        final sub = calcSub(); final vat = calcVat();
        final gDisc = double.tryParse(gDiscCtrl.text) ?? 0; final ship = double.tryParse(shipCtrl.text) ?? 0; final paid = double.tryParse(paidCtrl.text) ?? 0;
        final total = sub - gDisc + ship + vat; final remain = total - paid;
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(AppStrings.t(existing == null ? 'add_invoice' : 'edit_invoice', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            // رقم الفاتورة + التواريخ
            Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
              Row(children: [Expanded(child: Text(ar ? 'رقم الفاتورة: ${existing?.id ?? 'INV-${1000 + prov.invoices.length + 1}'}' : 'Invoice: ${existing?.id ?? 'INV-${1000 + prov.invoices.length + 1}'}', style: const TextStyle(fontWeight: FontWeight.w700))), const SizedBox(width: 8), Expanded(child: TextField(controller: orderCtrl, decoration: InputDecoration(labelText: ar ? 'رقم الطلب' : 'Order No')))]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: InkWell(onTap: () async { final d = await showDatePicker(context: ctx, initialDate: issueDate, firstDate: DateTime(2020), lastDate: DateTime(2030)); if (d != null) setModalState(() => issueDate = d); }, child: InputDecorator(decoration: InputDecoration(labelText: ar ? 'تاريخ الإصدار' : 'Issue Date'), child: Text('${issueDate.year}-${issueDate.month}-${issueDate.day}')))),
                const SizedBox(width: 8),
                Expanded(child: InkWell(onTap: () async { final d = await showDatePicker(context: ctx, initialDate: dueDate, firstDate: DateTime(2020), lastDate: DateTime(2030)); if (d != null) setModalState(() => dueDate = d); }, child: InputDecorator(decoration: InputDecoration(labelText: ar ? 'تاريخ الاستحقاق' : 'Due Date'), child: Text('${dueDate.year}-${dueDate.month}-${dueDate.day}', style: TextStyle(color: dueDate.isBefore(DateTime.now()) ? Colors.red : null))))),
              ]),
            ]))),
            const SizedBox(height: 10),
            if (prov.customers.isNotEmpty) ...[
              DropdownButtonFormField<String>(decoration: InputDecoration(labelText: AppStrings.t('customers', ar)), items: prov.customers.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(), onChanged: (cid) { if (cid == null) return; final m = prov.customers.firstWhere((c) => c.id == cid); setModalState(() { clientCtrl.text = m.name; phoneCtrl.text = m.phone; }); }),
              const SizedBox(height: 10),
            ],
            TextField(controller: clientCtrl, decoration: InputDecoration(labelText: AppStrings.t('client', ar))),
            const SizedBox(height: 10),
            Row(children: [Expanded(child: TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar)))), const SizedBox(width: 8), Expanded(child: TextField(controller: vatCtrl, decoration: InputDecoration(labelText: ar ? 'الرقم الضريبي للعميل' : 'Customer VAT No')))]),
            const SizedBox(height: 10),
            Row(children: [Expanded(child: TextField(controller: addressCtrl, decoration: InputDecoration(labelText: ar ? 'العنوان' : 'Address'))), const SizedBox(width: 8), Expanded(child: TextField(controller: emailCtrl, decoration: InputDecoration(labelText: ar ? 'الايميل' : 'Email')))]),
            const SizedBox(height: 14),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'الأصناف / Items' : 'Items', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)), TextButton.icon(onPressed: () => setModalState(() => items.add({'sku': 'SKU-00${items.length + 1}', 'name': '', 'unit': ar ? 'حبة' : 'Pcs', 'qty': 1.0, 'price': 0.0, 'disc': 0.0, 'vat': 15.0})), icon: const Icon(Icons.add), label: Text(ar ? '+ إضافة صنف' : '+ Add Item'))]),
            ...items.asMap().entries.map((e) {
              final i = e.key; final it = e.value;
              return Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(children: [
                Row(children: [Expanded(child: TextField(controller: TextEditingController(text: it['sku']), onChanged: (v) => it['sku'] = v, decoration: InputDecoration(labelText: 'SKU'))), const SizedBox(width: 8), Expanded(flex: 2, child: TextField(controller: TextEditingController(text: it['name']), onChanged: (v) => it['name'] = v, decoration: InputDecoration(labelText: ar ? 'اسم الصنف' : 'Item'))), IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => setModalState(() => items.removeAt(i)))]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: DropdownButtonFormField<String>(value: it['unit'], items: [ar ? 'حبة' : 'Pcs', ar ? 'كرتون' : 'Carton', ar ? 'كيلو' : 'Kg', ar ? 'خدمة' : 'Service', ar ? 'سنة' : 'Year'].map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(), onChanged: (v) => setModalState(() => it['unit'] = v), decoration: InputDecoration(labelText: ar ? 'الوحدة' : 'Unit'))),
                  const SizedBox(width: 6),
                  Expanded(child: TextField(keyboardType: TextInputType.number, controller: TextEditingController(text: it['qty'].toString()), onChanged: (v) => setModalState(() => it['qty'] = double.tryParse(v) ?? 0), decoration: InputDecoration(labelText: ar ? 'الكمية' : 'Qty'))),
                  const SizedBox(width: 6),
                  Expanded(child: TextField(keyboardType: TextInputType.number, controller: TextEditingController(text: it['price'].toString()), onChanged: (v) => setModalState(() => it['price'] = double.tryParse(v) ?? 0), decoration: InputDecoration(labelText: ar ? 'السعر' : 'Price'))),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: TextField(keyboardType: TextInputType.number, controller: TextEditingController(text: it['disc'].toString()), onChanged: (v) => setModalState(() => it['disc'] = double.tryParse(v) ?? 0), decoration: InputDecoration(labelText: 'خصم %'))),
                  const SizedBox(width: 6),
                  Expanded(child: TextField(keyboardType: TextInputType.number, controller: TextEditingController(text: it['vat'].toString()), onChanged: (v) => setModalState(() => it['vat'] = double.tryParse(v) ?? 0), decoration: InputDecoration(labelText: 'ضريبة %'))),
                  const SizedBox(width: 6),
                  Expanded(child: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)), child: Text('${((it['qty'] as double) * (it['price'] as double) * (1 - (it['disc'] as double) / 100)).toStringAsFixed(2)}', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)))),
                ]),
              ]))),
            }),
            const SizedBox(height: 10),
            TextField(controller: descCtrl, decoration: InputDecoration(labelText: AppStrings.t('reason', ar))),
            const SizedBox(height: 10),
            Row(children: [Expanded(child: TextField(controller: gDiscCtrl, keyboardType: TextInputType.number, onChanged: (_) => setModalState(() {}), decoration: InputDecoration(labelText: ar ? 'الخصم العام' : 'General Discount'))), const SizedBox(width: 8), Expanded(child: TextField(controller: shipCtrl, keyboardType: TextInputType.number, onChanged: (_) => setModalState(() {}), decoration: InputDecoration(labelText: ar ? 'الشحن' : 'Shipping')))]),
            const SizedBox(height: 10),
            Row(children: [Expanded(child: TextField(controller: paidCtrl, keyboardType: TextInputType.number, onChanged: (_) => setModalState(() {}), decoration: InputDecoration(labelText: ar ? 'المدفوع' : 'Paid'))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(value: payMethod, items: [ar ? 'تحويل بنكي' : 'Bank Transfer', ar ? 'نقدي' : 'Cash', ar ? 'شبكة' : 'Card', ar ? 'آجل' : 'Credit', ar ? 'فيزا' : 'Visa'].map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(), onChanged: (v) => setModalState(() => payMethod = v ?? payMethod), decoration: InputDecoration(labelText: ar ? 'طريقة الدفع' : 'Payment Method')))]),
            const SizedBox(height: 10),
            Row(children: [Expanded(child: DropdownButtonFormField<InvoiceStatus>(value: status, items: InvoiceStatus.values.map((s) => DropdownMenuItem(value: s, child: Text(AppStrings.t(s.name, ar)))).toList(), onChanged: (v) => setModalState(() => status = v ?? InvoiceStatus.pending), decoration: InputDecoration(labelText: AppStrings.t('status', ar)))), const SizedBox(width: 8), Expanded(child: DropdownButtonFormField<String>(value: currency, items: ['ر.س', 'ر.ي', 'USD', 'AED', 'EUR'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(), onChanged: (v) => setModalState(() => currency = v ?? currency), decoration: InputDecoration(labelText: ar ? 'العملة' : 'Currency')))]),
            const SizedBox(height: 10),
            TextField(controller: ibanCtrl, decoration: InputDecoration(labelText: 'IBAN / البنك')),
            const SizedBox(height: 10),
            TextField(controller: notesCtrl, decoration: InputDecoration(labelText: ar ? 'ملاحظات' : 'Notes')),
            const SizedBox(height: 10),
            TextField(controller: termsCtrl, decoration: InputDecoration(labelText: ar ? 'شروط الدفع' : 'Terms')),
            const SizedBox(height: 12),
            Card(color: AppTheme.primaryEmerald.withOpacity(0.08), child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'قبل الضريبة' : 'Subtotal'), Text(sub.toStringAsFixed(2))]),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'الضريبة' : 'VAT'), Text(vat.toStringAsFixed(2))]),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'الخصم + الشحن' : 'Disc + Ship'), Text('${(-gDisc + ship).toStringAsFixed(2)}')]),
              const Divider(),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'الإجمالي' : 'Total', style: const TextStyle(fontWeight: FontWeight.w800)), Text(total.toStringAsFixed(2), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))]),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'المدفوع' : 'Paid', style: const TextStyle(color: Colors.green)), Text(paid.toStringAsFixed(2), style: const TextStyle(color: Colors.green))]),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(ar ? 'المتبقي' : 'Remaining', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w700)), Text(remain.toStringAsFixed(2), style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w700))]),
            ]))),
            const SizedBox(height: 14),
            FilledButton(onPressed: () {
              if (clientCtrl.text.trim().isEmpty || sub <= 0) return;
              final fullDesc = '${descCtrl.text.trim()}\nOrder: ${orderCtrl.text} | VAT Customer: ${vatCtrl.text} | Addr: ${addressCtrl.text} | Pay: $payMethod | Paid: $paid | Remain: $remain | IBAN: ${ibanCtrl.text} | Notes: ${notesCtrl.text} | Terms: ${termsCtrl.text} | Items: ${items.map((e) => '${e['sku']} ${e['name']} x${e['qty']} @${e['price']}').join(', ')}';
              final inv = Invoice.create(id: existing?.id ?? 'INV-${1000 + prov.invoices.length + 1}', customerId: existing?.customerId ?? '', customerName: clientCtrl.text.trim(), customerPhone: phoneCtrl.text.trim(), description: fullDesc, subtotal: sub, status: status, date: issueDate);
              prov.addOrUpdateInvoice(inv, isEdit: existing != null);
              Navigator.pop(ctx);
            }, child: Text(AppStrings.t('save', ar))),
          ])))),
        );
      },
    );
  }

  void _confirmDelete(BuildContext context, AppProvider prov, bool ar, String id) {
    showDialog(context: context, builder: (ctx) => AlertDialog(title: Text(AppStrings.t('confirm_delete', ar)), content: Text(AppStrings.t('confirm_delete_msg', ar)), actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(AppStrings.t('cancel', ar))), FilledButton(style: FilledButton.styleFrom(backgroundColor: AppTheme.dangerRed), onPressed: () { prov.deleteInvoice(id); Navigator.pop(ctx); }, child: Text(AppStrings.t('delete', ar)))]));
  }

  void _confirmDeleteAll(BuildContext context, AppProvider prov, bool ar) {
    showDialog(context: context, builder: (ctx) => AlertDialog(title: Text(AppStrings.t('delete_all', ar)), content: Text(AppStrings.t('confirm_delete_msg', ar)), actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(AppStrings.t('cancel', ar))), FilledButton(style: FilledButton.styleFrom(backgroundColor: AppTheme.dangerRed), onPressed: () { prov.deleteAllInvoices(); Navigator.pop(ctx); }, child: Text(AppStrings.t('delete_all', ar)))]));
  }
      }
