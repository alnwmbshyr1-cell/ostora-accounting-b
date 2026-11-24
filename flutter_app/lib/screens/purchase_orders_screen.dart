import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../services/pdf_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class PurchaseOrdersScreen extends StatelessWidget {
  const PurchaseOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: prov.purchaseOrders.isEmpty
          ? Center(child: Text(AppStrings.t('no_data', ar)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prov.purchaseOrders.length,
              itemBuilder: (_, idx) {
                final po = prov.purchaseOrders[idx];
                final isReceived = po.status == PurchaseOrderStatus.received;
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
                              Text(po.id, style: const TextStyle(fontWeight: FontWeight.w700)),
                              Text(
                                isReceived ? AppStrings.t('received', ar) : AppStrings.t('pending', ar),
                                style: TextStyle(
                                  color: isReceived ? AppTheme.successGreen : AppTheme.warningAmber,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(po.supplierName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          Text('${po.productName} × ${po.quantity} (${po.total.toStringAsFixed(0)} $cur)'),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            children: [
                              if (!isReceived)
                                FilledButton.icon(
                                  style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryEmerald),
                                  onPressed: () => prov.receivePurchaseOrder(po.id),
                                  icon: const Icon(Icons.check_circle_outline, size: 18),
                                  label: Text(AppStrings.t('receive', ar)),
                                ),
                              OutlinedButton.icon(
                                onPressed: () => PdfService.printPurchaseOrder(po: po, company: prov.settings),
                                icon: const Icon(Icons.print_rounded, size: 18),
                                label: Text(AppStrings.t('print_pdf', ar)),
                              ),
                              IconButton(
                                icon: const Icon(Icons.chat_rounded, color: Colors.green),
                                onPressed: () {
                                  final msg = ar
                                      ? 'أمر شراء رقم ${po.id} من ${prov.settings.companyName}: الصنف ${po.productName} - الكمية ${po.quantity} - الإجمالي ${po.total.toStringAsFixed(2)} $cur.'
                                      : 'Purchase Order ${po.id} from ${prov.settings.companyName}: ${po.productName} x ${po.quantity}, Total ${po.total.toStringAsFixed(2)} $cur.';
                                  WhatsAppService.sendWhatsApp(phone: po.supplierPhone, message: msg);
                                },
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
        onPressed: () => _openAddPo(context, prov, ar),
        icon: const Icon(Icons.add_shopping_cart_rounded),
        label: Text(AppStrings.t('create_po', ar)),
      ),
    );
  }

  void _openAddPo(BuildContext context, AppProvider prov, bool ar) {
    final supCtrl = TextEditingController(text: prov.suppliers.isNotEmpty ? prov.suppliers.first.name : '');
    final phoneCtrl = TextEditingController(text: prov.suppliers.isNotEmpty ? prov.suppliers.first.phone : '');
    final prodCtrl = TextEditingController(text: prov.products.isNotEmpty ? prov.products.first.name : '');
    final qtyCtrl = TextEditingController(text: '10');
    final costCtrl = TextEditingController(text: '200');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(AppStrings.t('create_po', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: supCtrl, decoration: InputDecoration(labelText: AppStrings.t('suppliers', ar))),
            const SizedBox(height: 10),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
            const SizedBox(height: 10),
            TextField(controller: prodCtrl, decoration: InputDecoration(labelText: AppStrings.t('inventory', ar))),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('qty', ar)))),
                const SizedBox(width: 10),
                Expanded(child: TextField(controller: costCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('cost', ar)))),
              ],
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                final qty = int.tryParse(qtyCtrl.text) ?? 0;
                final cost = double.tryParse(costCtrl.text) ?? 0.0;
                if (supCtrl.text.trim().isEmpty || qty <= 0) return;
                prov.addPurchaseOrder(PurchaseOrder(
                  id: 'PO-${300 + prov.purchaseOrders.length + 1}',
                  supplierId: '',
                  supplierName: supCtrl.text.trim(),
                  supplierPhone: phoneCtrl.text.trim(),
                  productId: '',
                  productName: prodCtrl.text.trim(),
                  quantity: qty,
                  unitCost: cost,
                  total: qty * cost,
                  status: PurchaseOrderStatus.ordered,
                  date: DateTime.now(),
                ));
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
