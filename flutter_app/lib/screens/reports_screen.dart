import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../services/app_provider.dart';
import '../services/pdf_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    final cash = prov.totalCashAndBanks;
    final receivables = prov.totalCustomerDebt;
    final inventory = prov.totalStockValue;
    final totalAssets = cash + receivables + inventory;
    final payables = prov.totalSupplierDebt;
    final vatPayable = prov.invoices.fold(0.0, (s, i) => s + i.vat);
    final revenue = prov.invoices.fold(0.0, (s, i) => s + i.subtotal);
    final expenses = prov.totalExpenses;
    final netProfit = revenue - expenses;
    final totalLiabilities = payables + vatPayable;
    final equity = totalAssets - totalLiabilities;
    final openingCapital = equity - netProfit;
    final profitMarginPct = revenue > 0 ? ((netProfit / revenue) * 100).toStringAsFixed(1) : '0.0';

    final titles = [
      AppStrings.t('trial_balance', ar),
      AppStrings.t('income_statement', ar),
      AppStrings.t('balance_sheet', ar),
    ];

    List<List<String>> buildRows() {
      if (_tab == 0) {
        final totalDebit = cash + receivables + inventory + expenses + (openingCapital < 0 ? openingCapital.abs() : 0.0);
        final totalCredit = payables + vatPayable + revenue + (openingCapital >= 0 ? openingCapital : 0.0);
        return [
          [AppStrings.t('account', ar), AppStrings.t('debit', ar), AppStrings.t('credit', ar)],
          [ar ? 'البنوك والصندوق' : 'Cash & Banks', cash.toStringAsFixed(2), '0.00'],
          [ar ? 'العملاء' : 'Accounts Receivable', receivables.toStringAsFixed(2), '0.00'],
          [ar ? 'المخزون' : 'Inventory', inventory.toStringAsFixed(2), '0.00'],
          [ar ? 'المصروفات' : 'Expenses', expenses.toStringAsFixed(2), '0.00'],
          [ar ? 'الموردون' : 'Accounts Payable', '0.00', payables.toStringAsFixed(2)],
          [ar ? 'ضريبة القيمة المضافة' : 'VAT Output', '0.00', vatPayable.toStringAsFixed(2)],
          [ar ? 'المبيعات' : 'Sales Revenue', '0.00', revenue.toStringAsFixed(2)],
          [
            ar ? 'رأس المال والأرباح المبقاة' : 'Capital & Retained Equity',
            openingCapital < 0 ? openingCapital.abs().toStringAsFixed(2) : '0.00',
            openingCapital >= 0 ? openingCapital.toStringAsFixed(2) : '0.00',
          ],
          [
            AppStrings.t('total_balanced', ar),
            totalDebit.toStringAsFixed(2),
            totalCredit.toStringAsFixed(2),
          ],
        ];
      } else if (_tab == 1) {
        return [
          [AppStrings.t('account', ar), '${AppStrings.t('amount', ar)} ($cur)'],
          [ar ? 'صافي المبيعات' : 'Net Sales Revenue', revenue.toStringAsFixed(2)],
          [ar ? 'إجمالي المصروفات التشغيلية' : 'Operating Expenses', '-${expenses.toStringAsFixed(2)}'],
          [AppStrings.t('net_profit', ar), netProfit.toStringAsFixed(2)],
          [AppStrings.t('margin', ar), '$profitMarginPct%'],
        ];
      } else {
        return [
          [AppStrings.t('account', ar), '${AppStrings.t('amount', ar)} ($cur)'],
          [ar ? 'النقد والبنوك' : 'Cash & Banks', cash.toStringAsFixed(2)],
          [ar ? 'ذمم العملاء' : 'Accounts Receivable', receivables.toStringAsFixed(2)],
          [ar ? 'المخزون' : 'Inventory', inventory.toStringAsFixed(2)],
          [ar ? 'إجمالي الأصول' : 'Total Assets', totalAssets.toStringAsFixed(2)],
          [ar ? 'ذمم الموردين' : 'Accounts Payable', payables.toStringAsFixed(2)],
          [ar ? 'الضريبة المستحقة' : 'VAT Liability', vatPayable.toStringAsFixed(2)],
          [ar ? 'إجمالي الالتزامات' : 'Total Liabilities', totalLiabilities.toStringAsFixed(2)],
          [ar ? 'حقوق الملكية' : 'Owner Equity', equity.toStringAsFixed(2)],
          [AppStrings.t('liabilities_equity', ar), (totalLiabilities + equity).toStringAsFixed(2)],
        ];
      }
    }

    final rows = buildRows();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SegmentedButton<int>(
          segments: [
            ButtonSegment(value: 0, label: Text(titles[0], style: const TextStyle(fontSize: 11))),
            ButtonSegment(value: 1, label: Text(titles[1], style: const TextStyle(fontSize: 11))),
            ButtonSegment(value: 2, label: Text(titles[2], style: const TextStyle(fontSize: 11))),
          ],
          selected: {_tab},
          onSelectionChanged: (s) => setState(() => _tab = s.first),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryEmerald),
                onPressed: () => PdfService.printFinancialReport(
                  title: titles[_tab],
                  rows: rows,
                  company: prov.settings,
                ),
                icon: const Icon(Icons.print_rounded, size: 18),
                label: Text(AppStrings.t('print_pdf', ar)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  final csv = rows.map((r) => r.map((c) => '"$c"').join(',')).join('\n');
                  WhatsAppService.exportCsvAndShare(
                    fileName: 'ostora_report_${_tab + 1}.csv',
                    csvContent: csv,
                  );
                },
                icon: const Icon(Icons.table_view_rounded, size: 18),
                label: Text(AppStrings.t('export_csv', ar)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: rows.asMap().entries.map((entry) {
                final isHeader = entry.key == 0;
                final isSummary = entry.key == rows.length - 1 || (_tab == 2 && entry.key == 4);
                final cols = entry.value;
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
                  decoration: BoxDecoration(
                    color: isHeader
                        ? AppTheme.primaryEmerald.withValues(alpha: 0.08)
                        : isSummary
                            ? AppTheme.accentGold.withValues(alpha: 0.14)
                            : null,
                    border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
                  ),
                  child: Row(
                    children: cols
                        .asMap()
                        .entries
                        .map((c) => Expanded(
                              flex: c.key == 0 ? 2 : 1,
                              child: Text(
                                c.value,
                                textAlign: c.key == 0 ? TextAlign.start : TextAlign.end,
                                style: TextStyle(
                                  fontWeight: (isHeader || isSummary) ? FontWeight.w800 : FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ))
                        .toList(),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
