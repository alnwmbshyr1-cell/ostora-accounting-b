import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class AppDrawer extends StatelessWidget {
  final String currentRoute;
  final void Function(String route) onNavigate;

  const AppDrawer({
    super.key,
    required this.currentRoute,
    required this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;

    final items = [
      ('dashboard', Icons.dashboard_rounded, AppStrings.t('dashboard', ar)),
      ('invoices', Icons.receipt_long_rounded, AppStrings.t('invoices', ar)),
      ('customers', Icons.people_alt_rounded, AppStrings.t('customers', ar)),
      ('suppliers', Icons.local_shipping_rounded, AppStrings.t('suppliers', ar)),
      ('purchase_orders', Icons.shopping_bag_rounded, AppStrings.t('purchase_orders', ar)),
      ('vouchers', Icons.payments_rounded, AppStrings.t('vouchers', ar)),
      ('journals', Icons.menu_book_rounded, AppStrings.t('journals', ar)),
      ('inventory', Icons.inventory_2_rounded, AppStrings.t('inventory', ar)),
      ('employees', Icons.badge_rounded, AppStrings.t('employees', ar)),
      ('expenses', Icons.account_balance_wallet_rounded, AppStrings.t('expenses', ar)),
      ('banks', Icons.account_balance_rounded, AppStrings.t('banks', ar)),
      ('reports', Icons.assessment_rounded, AppStrings.t('reports', ar)),
      ('ai_analytics', Icons.auto_graph_rounded, AppStrings.t('ai_analytics', ar)),
      ('subscription', Icons.workspace_premium_rounded, AppStrings.t('subscription', ar)),
      ('settings', Icons.settings_rounded, AppStrings.t('settings', ar)),
    ];

    return Drawer(
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 48, 20, 20),
            decoration: const BoxDecoration(
              color: AppTheme.primaryEmerald,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppTheme.accentGold.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.accentGold),
                      ),
                      child: const Center(
                        child: Text('🛡️', style: TextStyle(fontSize: 24)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppStrings.t('app_name', ar),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            prov.settings.companyName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final (route, icon, label) = items[index];
                final active = currentRoute == route;
                return ListTile(
                  selected: active,
                  selectedTileColor: AppTheme.primaryEmerald.withValues(alpha: 0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  leading: Icon(
                    icon,
                    color: active ? AppTheme.primaryEmerald : null,
                  ),
                  title: Text(
                    label,
                    style: TextStyle(
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    onNavigate(route);
                  },
                );
              },
            ),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: AppTheme.dangerRed),
            title: Text(AppStrings.t('logout', ar)),
            onTap: () {
              Navigator.pop(context);
              prov.logout();
            },
          ),
        ],
      ),
    );
  }
}
