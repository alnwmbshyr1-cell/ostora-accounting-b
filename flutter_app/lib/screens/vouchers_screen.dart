import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../services/pdf_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class VouchersScreen extends StatefulWidget {
  const VouchersScreen({super.key});

  @override
  State<VouchersScreen> createState() => _VouchersScreenState();
}

class _VouchersScreenState extends State<VouchersScreen> {
  VoucherType _tab = VoucherType.receipt;

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;
    final items = prov.vouchers.where((v) => v.type == _tab).toList();

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: SegmentedButton<VoucherType>(
              segments: [
                ButtonSegment(value: VoucherType.receipt, label: Text(AppStrings.t('receipt_voucher', ar))),
                ButtonSegment(value: VoucherType.payment, label: Text(AppStrings.t('payment_voucher', ar))),
              ],
              selected: {_tab},
              onSelectionChanged: (s) => setState(() => _tab = s.first),
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? Center(child: Text(AppStrings.t('no_data', ar)))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: items.length,
                    itemBuilder: (_, idx) {
                      final v = items[idx];
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
                                    Text(v.id, style: const TextStyle(fontWeight: FontWeight.w700)),
                                    Text(
                                      '${v.amount.toStringAsFixed(2)} $cur',
                                      style: TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w800,
                                        color: _tab == VoucherType.receipt ? AppTheme.successGreen : AppTheme.dangerRed,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(v.partyName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                Text(v.reason, style: TextStyle(color: Theme.of(context).hintColor, fontSize: 13)),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.print_rounded, color: AppTheme.primaryEmerald),
                                      onPressed: () => PdfService.printVoucher(voucher: v, company: prov.settings),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.chat_rounded, color: Colors.green),
                                      onPressed: () {
                                        final label = _tab == VoucherType.receipt ? 'سند قبض' : 'سند صرف';
                                        WhatsAppService.sendWhatsApp(
                                          phone: v.partyPhone,
                                          message: '$label رقم ${v.id} بمبلغ ${v.amount.toStringAsFixed(2)} $cur - ${v.partyName}. البيان: ${v.reason}',
                                        );
                                      },
                                    ),
                                    const Spacer(),
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined),
                                      onPressed: () => _openForm(context, prov, ar, existing: v),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed),
                                      onPressed: () => prov.deleteVoucher(v.id),
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
        label: Text(AppStrings.t('add_voucher', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {Voucher? existing}) {
    final partyCtrl = TextEditingController(text: existing?.partyName ?? '');
    final phoneCtrl = TextEditingController(text: existing?.partyPhone ?? '');
    final amtCtrl = TextEditingController(text: existing != null ? existing.amount.toString() : '');
    final reasonCtrl = TextEditingController(text: existing?.reason ?? '');
    var type = existing?.type ?? _tab;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SegmentedButton<VoucherType>(
                segments: [
                  ButtonSegment(value: VoucherType.receipt, label: Text(AppStrings.t('receipt_voucher', ar))),
                  ButtonSegment(value: VoucherType.payment, label: Text(AppStrings.t('payment_voucher', ar))),
                ],
                selected: {type},
                onSelectionChanged: (s) => setModalState(() => type = s.first),
              ),
              const SizedBox(height: 12),
              TextField(controller: partyCtrl, decoration: InputDecoration(labelText: AppStrings.t('client', ar))),
              const SizedBox(height: 10),
              TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
              const SizedBox(height: 10),
              TextField(controller: amtCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('amount', ar))),
              const SizedBox(height: 10),
              TextField(controller: reasonCtrl, decoration: InputDecoration(labelText: AppStrings.t('reason', ar))),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: () {
                  final amt = double.tryParse(amtCtrl.text) ?? 0.0;
                  if (partyCtrl.text.trim().isEmpty || amt <= 0) return;
                  prov.saveVoucher(
                    Voucher(
                      id: existing?.id ?? 'VCH-${500 + prov.vouchers.length + 1}',
                      type: type,
                      partyName: partyCtrl.text.trim(),
                      partyPhone: phoneCtrl.text.trim(),
                      amount: amt,
                      reason: reasonCtrl.text.trim(),
                      paymentMethod: 'Cash',
                      date: existing?.date ?? DateTime.now(),
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
      ),
    );
  }
}
