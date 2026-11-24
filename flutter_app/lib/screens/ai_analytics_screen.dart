import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/health_score_ring.dart';

class AiAnalyticsScreen extends StatelessWidget {
  final void Function(String route) onNavigate;

  const AiAnalyticsScreen({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;
    final baseSales = prov.totalSales > 0 ? prov.totalSales : 45000.0;
    final goal = prov.settings.monthlySalesGoal;
    final progress = (baseSales / goal).clamp(0.0, 1.0);
    final alerts = prov.smartAlerts;

    final forecast = List.generate(
      6,
      (i) => FlSpot(i.toDouble(), baseSales * (1 + (i + 1) * 0.085)),
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
                      AppStrings.t('sales_goal', ar),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: progress,
                      minHeight: 10,
                      borderRadius: BorderRadius.circular(8),
                      backgroundColor: Colors.white.withValues(alpha: 0.2),
                      valueColor: const AlwaysStoppedAnimation(AppTheme.accentGold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${baseSales.toStringAsFixed(0)} / ${goal.toStringAsFixed(0)} $cur (${(progress * 100).round()}%)',
                      style: const TextStyle(color: AppTheme.accentGold, fontWeight: FontWeight.w700, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(AppStrings.t('forecast_6m', ar), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 16),
                SizedBox(
                  height: 200,
                  child: LineChart(
                    LineChartData(
                      gridData: const FlGridData(show: true),
                      borderData: FlBorderData(show: false),
                      titlesData: FlTitlesData(
                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (v, _) => Text('M${v.toInt() + 1}', style: const TextStyle(fontSize: 11)),
                          ),
                        ),
                      ),
                      lineBarsData: [
                        LineChartBarData(
                          spots: forecast,
                          isCurved: true,
                          color: AppTheme.primaryEmerald,
                          barWidth: 4,
                          dotData: const FlDotData(show: true),
                          belowBarData: BarAreaData(
                            show: true,
                            color: AppTheme.accentGold.withValues(alpha: 0.18),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        Text(AppStrings.t('smart_alerts', ar), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (alerts.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Center(child: Text(AppStrings.t('no_data', ar))),
            ),
          )
        else
          ...alerts.map((a) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ar ? a.titleAr : a.titleEn, style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(ar ? a.subtitleAr : a.subtitleEn, style: TextStyle(color: Theme.of(context).hintColor, fontSize: 13)),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: () => prov.dismissAlert(a.id),
                              child: Text(AppStrings.t('dismiss', ar)),
                            ),
                            const SizedBox(width: 8),
                            FilledButton(
                              style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryEmerald),
                              onPressed: () => onNavigate(a.actionRoute),
                              child: Text(AppStrings.t('take_action', ar)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              )),
      ],
    );
  }
}
