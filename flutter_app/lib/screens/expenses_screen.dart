import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class ExpensesScreen extends StatelessWidget {
  const ExpensesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: prov.expenses.isEmpty
          ? Center(child: Text(AppStrings.t('no_data', ar)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prov.expenses.length,
              itemBuilder: (_, idx) {
                final e = prov.expenses[idx];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      title: Text(e.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${e.category} · ${DateFormat('yyyy-MM-dd').format(e.date)}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('${e.amount.toStringAsFixed(0)} $cur',
                              style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.dangerRed)),
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 20),
                            onPressed: () => _openForm(context, prov, ar, existing: e),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed, size: 20),
                            onPressed: () => prov.deleteExpense(e.id),
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
        label: Text(AppStrings.t('add_expense', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {Expense? existing}) {
    final titleCtrl = TextEditingController(text: existing?.title ?? '');
    final catCtrl = TextEditingController(text: existing?.category ?? (ar ? 'تشغيل' : 'Operations'));
    final amtCtrl = TextEditingController(text: existing != null ? existing.amount.toString() : '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(AppStrings.t('add_expense', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: titleCtrl, decoration: InputDecoration(labelText: AppStrings.t('reason', ar))),
            const SizedBox(height: 10),
            TextField(controller: catCtrl, decoration: InputDecoration(labelText: AppStrings.t('category', ar))),
            const SizedBox(height: 10),
            TextField(controller: amtCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('amount', ar))),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                final amt = double.tryParse(amtCtrl.text) ?? 0.0;
                if (titleCtrl.text.trim().isEmpty || amt <= 0) return;
                prov.saveExpense(
                  Expense(
                    id: existing?.id ?? 'EXP-${900 + prov.expenses.length + 1}',
                    title: titleCtrl.text.trim(),
                    category: catCtrl.text.trim(),
                    amount: amt,
                    paidFromBankId: existing?.paidFromBankId ?? 'cash',
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
    );
  }
}
