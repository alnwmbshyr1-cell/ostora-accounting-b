import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class SuppliersScreen extends StatelessWidget {
  final void Function(String route) onNavigate;

  const SuppliersScreen({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: prov.suppliers.isEmpty
          ? Center(child: Text(AppStrings.t('no_data', ar)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prov.suppliers.length,
              itemBuilder: (_, idx) {
                final s = prov.suppliers[idx];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(s.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                    Text('${s.category} · ${s.phone}', style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                                  ],
                                ),
                              ),
                              Text('${s.payable.toStringAsFixed(0)} $cur',
                                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.dangerRed)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton.icon(
                                onPressed: () => onNavigate('purchase_orders'),
                                icon: const Icon(Icons.shopping_bag_outlined, size: 18),
                                label: Text(AppStrings.t('create_po', ar)),
                              ),
                              IconButton(
                                icon: const Icon(Icons.edit_outlined),
                                onPressed: () => _openForm(context, prov, ar, existing: s),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed),
                                onPressed: () => prov.deleteSupplier(s.id),
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, prov, ar),
        icon: const Icon(Icons.add_business_rounded),
        label: Text(AppStrings.t('add_supplier', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {Supplier? existing}) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final phoneCtrl = TextEditingController(text: existing?.phone ?? '');
    final catCtrl = TextEditingController(text: existing?.category ?? '');
    final payCtrl = TextEditingController(text: existing != null ? existing.payable.toString() : '0');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(AppStrings.t('add_supplier', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: AppStrings.t('full_name', ar))),
            const SizedBox(height: 10),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
            const SizedBox(height: 10),
            TextField(controller: catCtrl, decoration: InputDecoration(labelText: AppStrings.t('category', ar))),
            const SizedBox(height: 10),
            TextField(controller: payCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('supplier_debt', ar))),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                prov.saveSupplier(
                  Supplier(
                    id: existing?.id ?? 'S-${200 + prov.suppliers.length + 1}',
                    name: nameCtrl.text.trim(),
                    phone: phoneCtrl.text.trim(),
                    category: catCtrl.text.trim(),
                    payable: double.tryParse(payCtrl.text) ?? 0.0,
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
