import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class JournalsScreen extends StatelessWidget {
  const JournalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: prov.journals.isEmpty
          ? Center(child: Text(AppStrings.t('no_data', ar)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prov.journals.length,
              itemBuilder: (_, idx) {
                final j = prov.journals[idx];
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
                              Text('${j.id} · ${j.reference}', style: const TextStyle(fontWeight: FontWeight.w700)),
                              Row(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 20),
                                    onPressed: () => _openForm(context, prov, ar, existing: j),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed, size: 20),
                                    onPressed: () => prov.deleteJournal(j.id),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Text(j.description, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          const Divider(height: 16),
                          ...j.lines.map((l) => Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Row(
                                  children: [
                                    Expanded(flex: 3, child: Text(l.account, style: const TextStyle(fontSize: 13))),
                                    Expanded(
                                      child: Text(
                                        l.debit > 0 ? l.debit.toStringAsFixed(0) : '-',
                                        textAlign: TextAlign.end,
                                        style: const TextStyle(color: AppTheme.successGreen, fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        l.credit > 0 ? l.credit.toStringAsFixed(0) : '-',
                                        textAlign: TextAlign.end,
                                        style: const TextStyle(color: AppTheme.dangerRed, fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                  ],
                                ),
                              )),
                          const Divider(height: 16),
                          Text(
                            '${AppStrings.t('debit', ar)}: ${j.totalDebit.toStringAsFixed(2)} $cur  |  ${AppStrings.t('credit', ar)}: ${j.totalCredit.toStringAsFixed(2)} $cur',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, prov, ar),
        icon: const Icon(Icons.add_rounded),
        label: Text(AppStrings.t('add_journal', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {JournalEntry? existing}) {
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final debitAccCtrl = TextEditingController(
      text: existing != null && existing.lines.isNotEmpty ? existing.lines.first.account : '1010 - Cash / Bank',
    );
    final creditAccCtrl = TextEditingController(
      text: existing != null && existing.lines.length > 1 ? existing.lines[1].account : '4010 - Sales Revenue',
    );
    final debitAmtCtrl = TextEditingController(
      text: existing != null ? existing.totalDebit.toString() : '',
    );
    final creditAmtCtrl = TextEditingController(
      text: existing != null ? existing.totalCredit.toString() : '',
    );
    String? errorMsg;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(AppStrings.t('add_journal', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                TextField(controller: descCtrl, decoration: InputDecoration(labelText: AppStrings.t('reason', ar))),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(flex: 2, child: TextField(controller: debitAccCtrl, decoration: InputDecoration(labelText: '${AppStrings.t('account', ar)} (${AppStrings.t('debit', ar)})'))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: debitAmtCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('debit', ar)))),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(flex: 2, child: TextField(controller: creditAccCtrl, decoration: InputDecoration(labelText: '${AppStrings.t('account', ar)} (${AppStrings.t('credit', ar)})'))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: creditAmtCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('credit', ar)))),
                  ],
                ),
                if (errorMsg != null) ...[
                  const SizedBox(height: 10),
                  Text(errorMsg!, style: const TextStyle(color: AppTheme.dangerRed, fontWeight: FontWeight.w700)),
                ],
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: () {
                    final d = double.tryParse(debitAmtCtrl.text) ?? 0.0;
                    final c = double.tryParse(creditAmtCtrl.text) ?? 0.0;
                    if (d <= 0 || (d - c).abs() > 0.001) {
                      setModalState(() => errorMsg = AppStrings.t('unbalanced_error', ar));
                      return;
                    }
                    prov.saveJournal(
                      JournalEntry(
                        id: existing?.id ?? 'JRN-${700 + prov.journals.length + 1}',
                        reference: existing?.reference ?? 'MANUAL',
                        description: descCtrl.text.trim(),
                        date: existing?.date ?? DateTime.now(),
                        lines: [
                          JournalLine(account: debitAccCtrl.text.trim(), debit: d, credit: 0),
                          JournalLine(account: creditAccCtrl.text.trim(), debit: 0, credit: c),
                        ],
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
      ),
    );
  }
}
