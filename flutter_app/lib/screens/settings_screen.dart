import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../l10n/app_strings.dart';
import '../models/models.dart';
import '../services/app_provider.dart';
import '../services/db_service.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _nameCtrl;
  late TextEditingController _taxCtrl;
  late TextEditingController _crCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _addrCtrl;

  @override
  void initState() {
    super.initState();
    final s = context.read<AppProvider>().settings;
    _nameCtrl = TextEditingController(text: s.companyName);
    _taxCtrl = TextEditingController(text: s.taxNumber);
    _crCtrl = TextEditingController(text: s.crNumber);
    _phoneCtrl = TextEditingController(text: s.phone);
    _emailCtrl = TextEditingController(text: s.email);
    _addrCtrl = TextEditingController(text: s.address);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _taxCtrl.dispose();
    _crCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addrCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(controller: _nameCtrl, decoration: InputDecoration(labelText: AppStrings.t('company_name', ar))),
                const SizedBox(height: 10),
                TextField(controller: _taxCtrl, decoration: InputDecoration(labelText: AppStrings.t('tax_number', ar))),
                const SizedBox(height: 10),
                TextField(controller: _crCtrl, decoration: InputDecoration(labelText: AppStrings.t('cr_number', ar))),
                const SizedBox(height: 10),
                TextField(controller: _phoneCtrl, decoration: InputDecoration(labelText: AppStrings.t('phone', ar))),
                const SizedBox(height: 10),
                TextField(controller: _emailCtrl, decoration: InputDecoration(labelText: AppStrings.t('email', ar))),
                const SizedBox(height: 10),
                TextField(controller: _addrCtrl, decoration: InputDecoration(labelText: AppStrings.t('address', ar))),
                const SizedBox(height: 14),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppTheme.primaryEmerald),
                  onPressed: () {
                    prov.updateSettings(prov.settings.copyWith(
                      companyName: _nameCtrl.text.trim(),
                      taxNumber: _taxCtrl.text.trim(),
                      crNumber: _crCtrl.text.trim(),
                      phone: _phoneCtrl.text.trim(),
                      email: _emailCtrl.text.trim(),
                      address: _addrCtrl.text.trim(),
                    ));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(AppStrings.t('save', ar))),
                    );
                  },
                  child: Text(AppStrings.t('save', ar)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.translate_rounded),
                title: Text(AppStrings.t('language', ar)),
                trailing: Switch(
                  value: prov.isAr,
                  onChanged: (_) => prov.toggleLanguage(),
                ),
                subtitle: Text(prov.isAr ? 'العربية (RTL)' : 'English (LTR)'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.currency_exchange_rounded),
                title: Text(AppStrings.t('currency', ar)),
                trailing: DropdownButton<String>(
                  value: prov.settings.currency,
                  underline: const SizedBox.shrink(),
                  items: kAllSupportedCurrencies
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (c) {
                    if (c != null) prov.updateSettings(prov.settings.copyWith(currency: c));
                  },
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.visibility_rounded),
                title: Text(AppStrings.t('display_currency', ar)),
                trailing: DropdownButton<String>(
                  value: kAllSupportedCurrencies.contains(prov.settings.displayCurrency)
                      ? prov.settings.displayCurrency
                      : prov.settings.currency,
                  underline: const SizedBox.shrink(),
                  items: kAllSupportedCurrencies
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (c) {
                    if (c != null) prov.updateSettings(prov.settings.copyWith(displayCurrency: c));
                  },
                ),
              ),
              const Divider(height: 1),
              SwitchListTile(
                secondary: const Icon(Icons.sync_rounded),
                title: Text(AppStrings.t('fx_auto_update', ar)),
                value: prov.settings.fxAutoUpdate,
                onChanged: (v) => prov.updateSettings(prov.settings.copyWith(fxAutoUpdate: v)),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.schedule_rounded),
                title: Text(AppStrings.t('fx_interval', ar)),
                trailing: DropdownButton<int>(
                  value: [1, 6, 12, 24].contains(prov.settings.fxAutoIntervalHours)
                      ? prov.settings.fxAutoIntervalHours
                      : 6,
                  underline: const SizedBox.shrink(),
                  items: const [1, 6, 12, 24]
                      .map((h) => DropdownMenuItem(value: h, child: Text('${h}h')))
                      .toList(),
                  onChanged: (h) {
                    if (h != null) prov.updateSettings(prov.settings.copyWith(fxAutoIntervalHours: h));
                  },
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.style_rounded),
                title: Text(AppStrings.t('currency_display_style', ar)),
                trailing: DropdownButton<String>(
                  value: prov.settings.currencyDisplayStyle,
                  underline: const SizedBox.shrink(),
                  items: [
                    DropdownMenuItem(value: 'symbol', child: Text(ar ? 'الرمز' : 'Symbol')),
                    DropdownMenuItem(value: 'code', child: Text(ar ? 'الرمز ISO' : 'ISO Code')),
                  ],
                  onChanged: (v) {
                    if (v != null) prov.updateSettings(prov.settings.copyWith(currencyDisplayStyle: v));
                  },
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.pin_rounded),
                title: Text(AppStrings.t('currency_decimals', ar)),
                trailing: DropdownButton<String>(
                  value: prov.settings.currencyDecimalMode,
                  underline: const SizedBox.shrink(),
                  items: [
                    DropdownMenuItem(value: 'auto', child: Text(ar ? 'تلقائي' : 'Auto')),
                    const DropdownMenuItem(value: '2', child: Text('2')),
                    const DropdownMenuItem(value: '0', child: Text('0')),
                  ],
                  onChanged: (v) {
                    if (v != null) prov.updateSettings(prov.settings.copyWith(currencyDecimalMode: v));
                  },
                ),
              ),
              const Divider(height: 1),
              SwitchListTile(
                secondary: const Icon(Icons.dark_mode_rounded),
                title: Text(AppStrings.t('dark_mode', ar)),
                value: prov.settings.isDarkMode,
                onChanged: (v) => prov.updateSettings(prov.settings.copyWith(isDarkMode: v)),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.shield_outlined, color: AppTheme.primaryEmerald),
                title: Text(AppStrings.t('privacy_policy', ar)),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text(AppStrings.t('privacy_policy', ar)),
                    content: Text(
                      ar
                          ? 'تُحفظ بيانات منشأتك محلياً وتُزامن بأمان عبر Firebase Auth & Firestore مع عزل لمساحات العمل وعدم تخزين أي كلمات مرور للموظفين. للتواصل: alnwmbshyr1@gmail.com.'
                          : 'Workspace records persist locally and sync via Firebase Auth & Firestore with strict tenant isolation and zero employee password storage. Contact: alnwmbshyr1@gmail.com.',
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: Text(ar ? 'إغلاق' : 'Close')),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.cloud_upload_rounded, color: AppTheme.primaryEmerald),
                title: Text(AppStrings.t('backup_gdrive', ar)),
                onTap: () async {
                  try {
                    final email = await DbService.backupToGoogleDrive(prov.exportFullBackupJson());
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Drive Backup OK ($email)')),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  }
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.download_rounded),
                title: Text(AppStrings.t('export_json', ar)),
                onTap: () async {
                  final dir = await getTemporaryDirectory();
                  final file = File('${dir.path}/ostora_backup.json');
                  await file.writeAsString(prov.exportFullBackupJson());
                  await Share.shareXFiles([XFile(file.path)], text: 'Ostora Backup JSON');
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.upload_file_rounded),
                title: Text(AppStrings.t('import_json', ar)),
                onTap: () async {
                  final res = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['json']);
                  if (res != null && res.files.single.path != null) {
                    final raw = await File(res.files.single.path!).readAsString();
                    await prov.importFullBackupJson(raw);
                  }
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.restore_rounded, color: AppTheme.accentGold),
                title: Text(AppStrings.t('restore_demo', ar)),
                onTap: prov.restoreDemoData,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.delete_forever_rounded, color: AppTheme.dangerRed),
                title: Text(AppStrings.t('delete_all', ar), style: const TextStyle(color: AppTheme.dangerRed)),
                onTap: prov.deleteAllData,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
