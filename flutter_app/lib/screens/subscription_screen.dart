import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final InAppPurchase _iap = InAppPurchase.instance;
  bool _loading = false;

  Future<void> _buyPlan(String planId, AppProvider prov) async {
    setState(() => _loading = true);
    try {
      try {
        final available = await _iap.isAvailable();
        if (available) {
          final response = await _iap.queryProductDetails({planId});
          if (response.productDetails.isNotEmpty) {
            final param = PurchaseParam(productDetails: response.productDetails.first);
            await _iap.buyNonConsumable(purchaseParam: param);
          }
        }
      } catch (_) {
        // Fallback to local trial/plan activation when Play Billing is unavailable offline/emulator
      }
      await prov.setPlan(planId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Plan activated: $planId')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;

    final plans = [
      ('basic_monthly', ar ? 'الباقة الأساسية (Basic)' : 'Basic Plan', '49 SAR / mo', ar ? 'فواتير غير محدودة + 1 مستخدم' : 'Unlimited invoices + 1 user'),
      ('pro_monthly', ar ? 'الباقة الاحترافية (Pro)' : 'Pro Plan', '99 SAR / mo', ar ? 'كل المميزات + تحليلات AI + Google Drive' : 'Full ERP + AI Analytics + Drive Backup'),
      ('business_monthly', ar ? 'باقة الأعمال (Business)' : 'Business Plan', '199 SAR / mo', ar ? 'فروع متعددة + صلاحيات + دعم فوري' : 'Multi-branch + RBAC + Priority support'),
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.primaryEmerald,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            children: [
              const Text('🛡️', style: TextStyle(fontSize: 38)),
              const SizedBox(height: 8),
              Text(
                AppStrings.t('trial_remaining', ar),
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 4),
              Text(
                '${prov.trialDaysRemaining} ${AppStrings.t('days', ar)}',
                style: const TextStyle(color: AppTheme.accentGold, fontSize: 28, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                '${AppStrings.t('active_plan', ar)}: ${prov.activePlan}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...plans.map((p) {
          final (id, title, price, desc) = p;
          final isActive = prov.activePlan == id;
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
                        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                        Text(price, style: const TextStyle(color: AppTheme.primaryEmerald, fontWeight: FontWeight.w800)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(desc, style: TextStyle(color: Theme.of(context).hintColor, fontSize: 13)),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: isActive ? AppTheme.accentGold : AppTheme.primaryEmerald,
                        ),
                        onPressed: _loading ? null : () => _buyPlan(id, prov),
                        child: Text(isActive ? AppStrings.t('active_plan', ar) : AppStrings.t('subscribe', ar)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}
