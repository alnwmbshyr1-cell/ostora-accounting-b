import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class BanksScreen extends StatelessWidget {
  const BanksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: prov.banks.length,
      itemBuilder: (_, idx) {
        final b = prov.banks[idx];
        final isCash = b.id == 'cash';
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isCash ? AppTheme.accentGold.withValues(alpha: 0.16) : AppTheme.primaryEmerald,
              borderRadius: BorderRadius.circular(20),
              border: isCash ? Border.all(color: AppTheme.accentGold) : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      ar ? b.nameAr : b.nameEn,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: isCash ? null : Colors.white,
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.edit_rounded, color: isCash ? AppTheme.primaryEmerald : AppTheme.accentGold),
                      onPressed: () {
                        final ctrl = TextEditingController(text: b.balance.toString());
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: Text(ar ? b.nameAr : b.nameEn),
                            content: TextField(
                              controller: ctrl,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(labelText: AppStrings.t('amount', ar)),
                            ),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx), child: Text(AppStrings.t('cancel', ar))),
                              FilledButton(
                                onPressed: () {
                                  prov.adjustBankBalance(b.id, double.tryParse(ctrl.text) ?? b.balance);
                                  Navigator.pop(ctx);
                                },
                                child: Text(AppStrings.t('save', ar)),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  b.accountNumber,
                  style: TextStyle(
                    fontSize: 12,
                    color: isCash ? Theme.of(context).hintColor : Colors.white.withValues(alpha: 0.75),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '${b.balance.toStringAsFixed(2)} $cur',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: isCash ? AppTheme.primaryEmerald : AppTheme.accentGold,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
