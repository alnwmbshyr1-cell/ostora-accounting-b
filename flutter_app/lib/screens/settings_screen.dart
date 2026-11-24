import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../l10n/app_strings.dart';
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
                  items: ['SAR', 'YER', 'EGP', 'AED']
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (c) {
                    if (c != null) prov.updateSettings(prov.settings.copyWith(currency: c));
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
