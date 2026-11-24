import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: prov.products.isEmpty
          ? Center(child: Text(AppStrings.t('no_data', ar)))
          : GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.82,
              ),
              itemCount: prov.products.length,
              itemBuilder: (_, idx) {
                final p = prov.products[idx];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(p.sku, style: TextStyle(fontSize: 11, color: Theme.of(context).hintColor)),
                            if (p.isLowStock)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.dangerRed.withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  AppStrings.t('low_stock', ar),
                                  style: const TextStyle(fontSize: 10, color: AppTheme.dangerRed, fontWeight: FontWeight.w700),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        const Spacer(),
                        Text('${AppStrings.t('qty', ar)}: ${p.qty}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        Text('${p.price.toStringAsFixed(0)} $cur', style: TextStyle(color: AppTheme.primaryEmerald, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
                                onPressed: () => prov.addTenStock(p.id),
                                child: Text(AppStrings.t('add_10', ar), style: const TextStyle(fontSize: 11)),
                              ),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(Icons.edit_outlined, size: 18),
                              onPressed: () => _openForm(context, prov, ar, existing: p),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.dangerRed),
                              onPressed: () => prov.deleteProduct(p.id),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, prov, ar),
        icon: const Icon(Icons.add_box_rounded),
        label: Text(AppStrings.t('add_product', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar, {Product? existing}) {
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final skuCtrl = TextEditingController(text: existing?.sku ?? '');
    final qtyCtrl = TextEditingController(text: existing != null ? existing.qty.toString() : '15');
    final costCtrl = TextEditingController(text: existing != null ? existing.cost.toString() : '100');
    final priceCtrl = TextEditingController(text: existing != null ? existing.price.toString() : '150');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(AppStrings.t('add_product', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: AppStrings.t('full_name', ar))),
            const SizedBox(height: 10),
            TextField(controller: skuCtrl, decoration: InputDecoration(labelText: AppStrings.t('sku', ar))),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('qty', ar)))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: costCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('cost', ar)))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('price', ar)))),
              ],
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                prov.saveProduct(
                  Product(
                    id: existing?.id ?? 'P-${10 + prov.products.length + 1}',
                    name: nameCtrl.text.trim(),
                    sku: skuCtrl.text.trim(),
                    qty: int.tryParse(qtyCtrl.text) ?? 0,
                    cost: double.tryParse(costCtrl.text) ?? 0.0,
                    price: double.tryParse(priceCtrl.text) ?? 0.0,
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
