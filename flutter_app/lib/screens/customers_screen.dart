import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class CustomersScreen extends StatelessWidget {
  final void Function(String route) onNavigate;

  const CustomersScreen({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    final buffer = StringBuffer('ID,Name,Phone,Email,Debt\n');
                    for (final c in prov.customers) {
                      buffer.writeln('${c.id},"${c.name}",${c.phone},${c.email},${c.debt}');
                    }
                    WhatsAppService.exportCsvAndShare(
                      fileName: 'ostora_customers.csv',
                      csvContent: buffer.toString(),
                    );
                  },
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: Text(AppStrings.t('export_csv', ar)),
                ),
              ],
            ),
          ),
          Expanded(
            child: prov.customers.isEmpty
                ? Center(child: Text(AppStrings.t('no_data', ar)))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: prov.customers.length,
                    itemBuilder: (_, idx) {
                      final c = prov.customers[idx];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor: AppTheme.primaryEmerald,
                                      foregroundColor: Colors.white,
                                      child: Text(c.name.isNotEmpty ? c.name.characters.first : '?'),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                          Text(c.phone, style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: (c.debt > 0 ? AppTheme.dangerRed : AppTheme.successGreen).withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        '${c.debt.toStringAsFixed(0)} $cur',
                                        style: TextStyle(
                                          color: c.debt > 0 ? AppTheme.dangerRed : AppTheme.successGreen,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    TextButton.icon(
                                      onPressed: () {
                                        final msg = ar
                                            ? 'السلام عليكم ${c.name}، تذكير ودي بخصوص الرصيد المستحق وقدره ${c.debt.toStringAsFixed(2)} $cur لدى ${prov.settings.companyName}. شاكرين تعاونكم.'
                                            : 'Dear ${c.name}, friendly reminder regarding outstanding balance of ${c.debt.toStringAsFixed(2)} $cur with ${prov.settings.companyName}.';
                                        WhatsAppService.sendWhatsApp(phone: c.phone, message: msg);
                                      },
                                      icon: const Icon(Icons.chat_rounded, color: Colors.green, size: 18),
                                      label: Text(AppStrings.t('whatsapp_reminder', ar)),
                                    ),
                                    TextButton.icon(
                                      onPressed: () async {
                                        if (c.debt <= 0) {
                                          onNavigate('vouchers');
                                          return;
                                        }
                                        await prov.saveVoucher(Voucher(
                                          id: 'VCH-${DateTime.now().millisecondsSinceEpoch % 10000}',
                                          type: VoucherType.receipt,
                                          partyName: c.name,
                                          partyPhone: c.phone,
                                          amount: c.debt,
                                          reason: ar ? 'سداد رصيد عميل' : 'Customer balance receipt',
                                          paymentMethod: 'Cash',
                                          date: DateTime.now(),
                                        ));
                                        onNavigate('vouchers');
                                      },
                                      icon: const Icon(Icons.payments_rounded, size: 18),
                                      label: Text(AppStrings.t('create_receipt', ar)),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined, size: 20),
                                      onPressed: () => _openForm(context, prov, ar, existing: c),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed, size: 20),
                                      onPressed: () => prov.deleteCustomer(c.id),
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
        icon: const Icon(Icons.person_add_rounded),
        label: Text(AppStrings.t('add_customer', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {Customer? existing}) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final phoneCtrl = TextEditingController(text: existing?.phone ?? '');
    final emailCtrl = TextEditingController(text: existing?.email ?? '');
    final debtCtrl = TextEditingController(text: existing != null ? existing.debt.toString() : '0');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(AppStrings.t('add_customer', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: AppStrings.t('full_name', ar))),
            const SizedBox(height: 10),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
            const SizedBox(height: 10),
            TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: AppStrings.t('email', ar))),
            const SizedBox(height: 10),
            TextField(controller: debtCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('debt', ar))),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                prov.saveCustomer(
                  Customer(
                    id: existing?.id ?? 'C-${100 + prov.customers.length + 1}',
                    name: nameCtrl.text.trim(),
                    phone: phoneCtrl.text.trim(),
                    email: emailCtrl.text.trim(),
                    debt: double.tryParse(debtCtrl.text) ?? 0.0,
                  ),
                  isEdit: existing != null,
                );
                Navigator.pop(ctx);
              },
              child: Text(AppStrings.t('save', ar)),
            ),
          ],
        ),
      ),
    );
  }
}
