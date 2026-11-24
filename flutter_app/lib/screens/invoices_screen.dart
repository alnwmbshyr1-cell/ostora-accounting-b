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
                                    Text(
                                      AppStrings.t(inv.status.name, ar),
                                      style: TextStyle(color: stColor, fontWeight: FontWeight.w700),
                                    ),
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
                                const Divider(height: 20),
                                Wrap(
                                  spacing: 6,
                                  children: [
                                    if (inv.status != InvoiceStatus.paid)
                                      ActionChip(
                                        backgroundColor: AppTheme.accentGold,
                                        side: BorderSide.none,
                                        avatar: const Icon(Icons.check_circle_outline_rounded, size: 16, color: Colors.black87),
                                        label: Text(
                                          AppStrings.t('mark_paid', ar),
                                          style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.w800, fontSize: 12),
                                        ),
                                        onPressed: () => prov.markInvoicePaid(inv.id),
                                      ),
                                    IconButton(
                                      tooltip: AppStrings.t('print_pdf', ar),
                                      icon: const Icon(Icons.print_rounded, color: AppTheme.primaryEmerald),
                                      onPressed: () => PdfService.printTaxInvoice(invoice: inv, company: prov.settings),
                                    ),
                                    IconButton(
                                      tooltip: 'QR ZATCA',
                                      icon: const Icon(Icons.qr_code_2_rounded, color: AppTheme.accentGold),
                                      onPressed: () => _showQrDialog(context, inv, prov.settings),
                                    ),
                                    IconButton(
                                      tooltip: AppStrings.t('whatsapp', ar),
                                      icon: const Icon(Icons.chat_rounded, color: Colors.green),
                                      onPressed: () {
                                        final msg = ar
                                            ? 'السلام عليكم ${inv.customerName}، مرفق تفاصيل الفاتورة الضريبية رقم ${inv.id} بمبلغ إجمالي ${inv.total.toStringAsFixed(2)} $cur (شامل ضريبة 15%). شكراً لتعاملكم مع ${prov.settings.companyName}.'
                                            : 'Hello ${inv.customerName}, Tax Invoice ${inv.id} total ${inv.total.toStringAsFixed(2)} $cur (incl. 15% VAT) from ${prov.settings.companyName}.';
                                        WhatsAppService.sendWhatsApp(phone: inv.customerPhone, message: msg);
                                      },
                                    ),
                                    IconButton(
                                      tooltip: AppStrings.t('share_email', ar),
                                      icon: const Icon(Icons.email_outlined),
                                      onPressed: () => WhatsAppService.sendEmail(
                                        to: '',
                                        subject: 'Tax Invoice ${inv.id} - ${prov.settings.companyName}',
                                        body: 'Customer: ${inv.customerName}\nTotal: ${inv.total.toStringAsFixed(2)} $cur',
                                      ),
                                    ),
                                    IconButton(
                                      tooltip: AppStrings.t('edit', ar),
                                      icon: const Icon(Icons.edit_outlined),
                                      onPressed: () => _openForm(context, prov, ar, existing: inv),
                                    ),
                                    IconButton(
                                      tooltip: AppStrings.t('delete', ar),
                                      icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed),
                                      onPressed: () => _confirmDelete(context, prov, ar, inv.id),
                                    ),
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
    final qrData = PdfService.buildZatcaQrPayload(
      sellerName: company.companyName,
      vatNumber: company.taxNumber,
      timestampIso: inv.date.toIso8601String(),
      totalWithVat: inv.total.toStringAsFixed(2),
      vatAmount: inv.vat.toStringAsFixed(2),
    );
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('ZATCA QR · ${inv.id}'),
        content: SizedBox(
          width: 220,
          height: 220,
          child: Center(child: QrImageView(data: qrData, size: 200)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
        ],
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {Invoice? existing}) {
    final clientCtrl = TextEditingController(text: existing?.customerName ?? (prov.customers.isNotEmpty ? prov.customers.first.name : ''));
    final phoneCtrl = TextEditingController(text: existing?.customerPhone ?? (prov.customers.isNotEmpty ? prov.customers.first.phone : ''));
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final amountCtrl = TextEditingController(text: existing != null ? existing.subtotal.toString() : '');
    var status = existing?.status ?? InvoiceStatus.pending;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final sub = double.tryParse(amountCtrl.text) ?? 0.0;
          final vat = sub * 0.15;
          final total = sub + vat;
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    AppStrings.t(existing == null ? 'add_invoice' : 'edit_invoice', ar),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 14),
                  if (prov.customers.isNotEmpty) ...[
                    DropdownButtonFormField<String>(
                      decoration: InputDecoration(labelText: AppStrings.t('customers', ar)),
                      items: prov.customers
                          .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                          .toList(),
                      onChanged: (cid) {
                        if (cid == null) return;
                        final match = prov.customers.firstWhere((c) => c.id == cid);
                        setModalState(() {
                          clientCtrl.text = match.name;
                          phoneCtrl.text = match.phone;
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextField(controller: clientCtrl, decoration: InputDecoration(labelText: AppStrings.t('client', ar))),
                  const SizedBox(height: 10),
                  TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
                  const SizedBox(height: 10),
                  TextField(controller: descCtrl, decoration: InputDecoration(labelText: AppStrings.t('reason', ar))),
                  const SizedBox(height: 10),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setModalState(() {}),
                    decoration: InputDecoration(labelText: AppStrings.t('subtotal', ar)),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<InvoiceStatus>(
                    value: status,
                    items: InvoiceStatus.values
                        .map((s) => DropdownMenuItem(value: s, child: Text(AppStrings.t(s.name, ar))))
                        .toList(),
                    onChanged: (v) => setModalState(() => status = v ?? InvoiceStatus.pending),
                    decoration: InputDecoration(labelText: AppStrings.t('status', ar)),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${AppStrings.t('vat_15', ar)}: ${vat.toStringAsFixed(2)}'),
                          Text('${AppStrings.t('total', ar)}: ${total.toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: () {
                      if (clientCtrl.text.trim().isEmpty || sub <= 0) return;
                      final inv = Invoice.create(
                        id: existing?.id ?? 'INV-${1000 + prov.invoices.length + 1}',
                        customerId: existing?.customerId ?? '',
                        customerName: clientCtrl.text.trim(),
                        customerPhone: phoneCtrl.text.trim(),
                        description: descCtrl.text.trim(),
                        subtotal: sub,
                        status: status,
                        date: existing?.date,
                      );
                      prov.addOrUpdateInvoice(inv, isEdit: existing != null);
                      Navigator.pop(ctx);
                    },
                    child: Text(AppStrings.t('save', ar)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _confirmDelete(BuildContext context, AppProvider prov, bool ar, String id) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppStrings.t('confirm_delete', ar)),
        content: Text(AppStrings.t('confirm_delete_msg', ar)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(AppStrings.t('cancel', ar))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.dangerRed),
            onPressed: () {
              prov.deleteInvoice(id);
              Navigator.pop(ctx);
            },
            child: Text(AppStrings.t('delete', ar)),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAll(BuildContext context, AppProvider prov, bool ar) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppStrings.t('delete_all', ar)),
        content: Text(AppStrings.t('confirm_delete_msg', ar)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(AppStrings.t('cancel', ar))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.dangerRed),
            onPressed: () {
              prov.deleteAllInvoices();
              Navigator.pop(ctx);
            },
            child: Text(AppStrings.t('delete_all', ar)),
          ),
        ],
      ),
    );
  }
}
