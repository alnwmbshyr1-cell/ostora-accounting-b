import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/health_score_ring.dart';

class DashboardScreen extends StatelessWidget {
  final void Function(String route) onNavigate;

  const DashboardScreen({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Hero Financial Health Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.primaryEmerald,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              HealthScoreRing(
                score: prov.healthScore,
                label: AppStrings.t('health_score', ar),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      prov.settings.companyName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${AppStrings.t('net_profit', ar)}: ${prov.netProfit.toStringAsFixed(0)} $cur',
                      style: const TextStyle(
                        color: AppTheme.accentGold,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: [
                        ActionChip(
                          backgroundColor: Colors.white.withValues(alpha: 0.14),
                          side: BorderSide.none,
                          label: Text(
                            AppStrings.t('ai_analytics', ar),
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                          onPressed: () => onNavigate('ai_analytics'),
                        ),
                        ActionChip(
                          backgroundColor: AppTheme.accentGold.withValues(alpha: 0.22),
                          side: BorderSide.none,
                          label: Text(
                            '${prov.trialDaysRemaining} ${AppStrings.t('days', ar)}',
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                          onPressed: () => onNavigate('subscription'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // KPI Grid Cards (20px radius)
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.55,
          children: [
            _kpiCard(
              context,
              AppStrings.t('total_sales', ar),
              '${prov.totalSales.toStringAsFixed(0)} $cur',
              Icons.trending_up_rounded,
              AppTheme.primaryEmerald,
              () => onNavigate('invoices'),
            ),
            _kpiCard(
              context,
              AppStrings.t('customer_debt', ar),
              '${prov.totalCustomerDebt.toStringAsFixed(0)} $cur',
              Icons.people_alt_rounded,
              AppTheme.warningAmber,
              () => onNavigate('customers'),
            ),
            _kpiCard(
              context,
              AppStrings.t('supplier_debt', ar),
              '${prov.totalSupplierDebt.toStringAsFixed(0)} $cur',
              Icons.local_shipping_rounded,
              AppTheme.dangerRed,
              () => onNavigate('suppliers'),
            ),
            _kpiCard(
              context,
              AppStrings.t('stock_value', ar),
              '${prov.totalStockValue.toStringAsFixed(0)} $cur',
              Icons.inventory_2_rounded,
              AppTheme.accentGold,
              () => onNavigate('inventory'),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Quick Actions Row
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.t('quick_actions', ar),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).hintColor,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => onNavigate('invoices'),
                      icon: const Icon(Icons.receipt_long_rounded, size: 16),
                      label: Text(AppStrings.t('add_invoice', ar), style: const TextStyle(fontSize: 12)),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => onNavigate('vouchers'),
                      icon: const Icon(Icons.payments_outlined, size: 16),
                      label: Text(AppStrings.t('add_voucher', ar), style: const TextStyle(fontSize: 12)),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => onNavigate('expenses'),
                      icon: const Icon(Icons.money_off_rounded, size: 16),
                      label: Text(AppStrings.t('add_expense', ar), style: const TextStyle(fontSize: 12)),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => onNavigate('inventory'),
                      icon: const Icon(Icons.inventory_2_outlined, size: 16),
                      label: Text(AppStrings.t('inventory', ar), style: const TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        if (prov.smartAlerts.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: AppTheme.accentGold, size: 18),
                      const SizedBox(width: 6),
                      Text(
                        AppStrings.t('smart_alerts', ar),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...prov.smartAlerts.take(2).map(
                        (al) => ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text(ar ? al.titleAr : al.titleEn, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          subtitle: Text(ar ? al.subtitleAr : al.subtitleEn, style: const TextStyle(fontSize: 11)),
                          trailing: TextButton(
                            onPressed: () => onNavigate(al.actionRoute),
                            child: Text(AppStrings.t('take_action', ar), style: const TextStyle(fontSize: 12)),
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 20),

        // Recent Invoices Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              AppStrings.t('recent_invoices', ar),
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            TextButton(
              onPressed: () => onNavigate('invoices'),
              child: Text(AppStrings.t('all', ar)),
            ),
          ],
        ),
        const SizedBox(height: 8),

        if (prov.invoices.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Center(child: Text(AppStrings.t('no_data', ar))),
            ),
          )
        else
          ...prov.invoices.take(5).map((inv) {
            final statusColor = inv.status == InvoiceStatus.paid
                ? AppTheme.successGreen
                : inv.status == InvoiceStatus.overdue
                    ? AppTheme.dangerRed
                    : AppTheme.warningAmber;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Card(
                child: ListTile(
                  onTap: () => onNavigate('invoices'),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  title: Text(inv.customerName, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${inv.id} · ${AppStrings.t(inv.status.name, ar)}'),
                  trailing: Text(
                    '${inv.total.toStringAsFixed(2)} $cur',
                    style: TextStyle(fontWeight: FontWeight.w800, color: statusColor),
                  ),
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _kpiCard(
    BuildContext context,
    String title,
    String value,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: Theme.of(context).hintColor),
                    ),
                  ),
                  Icon(icon, color: color, size: 20),
                ],
              ),
              Text(
                value,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
