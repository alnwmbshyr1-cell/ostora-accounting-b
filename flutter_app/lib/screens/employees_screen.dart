import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class EmployeesScreen extends StatelessWidget {
  const EmployeesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;
    final cur = prov.settings.currency;

    return Scaffold(
      body: prov.employees.isEmpty
          ? Center(child: Text(AppStrings.t('no_data', ar)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prov.employees.length,
              itemBuilder: (_, idx) {
                final e = prov.employees[idx];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: AppTheme.accentGold.withValues(alpha: 0.2),
                                child: const Icon(Icons.badge_rounded, color: AppTheme.primaryEmerald),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(e.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                    Text('${e.role} · ${e.phone}', style: TextStyle(color: Theme.of(context).hintColor, fontSize: 12)),
                                  ],
                                ),
                              ),
                              Text('${e.salary.toStringAsFixed(0)} $cur', style: const TextStyle(fontWeight: FontWeight.w800)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              FilledButton.icon(
                                style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryEmerald),
                                onPressed: () async {
                                  await prov.payEmployeeSalary(e.id);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('${AppStrings.t('pay_salary', ar)}: ${e.name}')),
                                    );
                                  }
                                },
                                icon: const Icon(Icons.payments_rounded, size: 18),
                                label: Text(AppStrings.t('pay_salary', ar)),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.chat_rounded, color: Colors.green),
                                onPressed: () {
                                  final msg = ar
                                      ? 'مرحباً ${e.name}، تم تحويل راتبك الشهري بمبلغ ${e.salary.toStringAsFixed(2)} $cur من ${prov.settings.companyName}.'
                                      : 'Hi ${e.name}, your monthly salary of ${e.salary.toStringAsFixed(2)} $cur has been transferred from ${prov.settings.companyName}.';
                                  WhatsAppService.sendWhatsApp(phone: e.phone, message: msg);
                                },
                              ),
                              const Spacer(),
                              IconButton(
                                icon: const Icon(Icons.delete_outline_rounded, color: AppTheme.dangerRed),
                                onPressed: () => prov.deleteEmployee(e.id),
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
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: Text(AppStrings.t('add_employee', ar)),
      ),
    );
  }

  void _openForm(BuildContext context, AppProvider prov, bool ar) {
    final nameCtrl = TextEditingController();
    final roleCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final salaryCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(AppStrings.t('add_employee', ar), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: AppStrings.t('full_name', ar))),
            const SizedBox(height: 10),
            TextField(controller: roleCtrl, decoration: InputDecoration(labelText: AppStrings.t('role', ar))),
            const SizedBox(height: 10),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
            const SizedBox(height: 10),
            TextField(controller: salaryCtrl, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: AppStrings.t('salary', ar))),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                prov.saveEmployee(Employee(
                  id: 'E-${10 + prov.employees.length + 1}',
                  name: nameCtrl.text.trim(),
                  role: roleCtrl.text.trim(),
                  phone: phoneCtrl.text.trim(),
                  salary: double.tryParse(salaryCtrl.text) ?? 0.0,
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
