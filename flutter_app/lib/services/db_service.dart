import 'dart:convert';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';

class DbService {
  static Database? _db;
  static late SharedPreferences _prefs;
  static late Box<dynamic> _hiveBox;

  static Future<void> init() async {
    await Hive.initFlutter();
    _hiveBox = await Hive.openBox('ostora_settings_box');
    _prefs = await SharedPreferences.getInstance();
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'ostora_accounting_v1.db');

    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE kv_store (
            collection TEXT PRIMARY KEY,
            payload TEXT NOT NULL
          )
        ''');
      },
    );
  }

  static Future<List<Map<String, dynamic>>> loadCollection(String collection) async {
    final rows = await _db!.query(
      'kv_store',
      where: 'collection = ?',
      whereArgs: [collection],
    );
    if (rows.isEmpty) return [];
    final decoded = jsonDecode(rows.first['payload'] as String) as List<dynamic>;
    return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  static Future<void> saveCollection(
    String collection,
    List<Map<String, dynamic>> items,
  ) async {
    await _db!.insert(
      'kv_store',
      {
        'collection': collection,
        'payload': jsonEncode(items),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<void> clearAllCollections() async {
    await _db!.delete('kv_store');
  }

  static Future<Map<String, dynamic>?> loadSettings() async {
    final raw = _hiveBox.get('company_settings') as String?;
    if (raw == null) return null;
    return Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  static Future<void> saveSettings(Map<String, dynamic> settings) async {
    await _hiveBox.put('company_settings', jsonEncode(settings));
  }

  static bool getOnboardingSeen() => _prefs.getBool('onboarding_seen') ?? false;
  static Future<void> setOnboardingSeen() => _prefs.setBool('onboarding_seen', true);

  static bool getIsLoggedIn() => _prefs.getBool('is_logged_in') ?? false;
  static Future<void> setIsLoggedIn(bool v) => _prefs.setBool('is_logged_in', v);

  static String getTrialStartIso() {
    final existing = _prefs.getString('trial_start_iso');
    if (existing != null) return existing;
    final now = DateTime.now().toIso8601String();
    _prefs.setString('trial_start_iso', now);
    return now;
  }

  static String getActivePlan() => _prefs.getString('active_plan') ?? 'trial';
  static Future<void> setActivePlan(String plan) => _prefs.setString('active_plan', plan);

  /// Uploads full ERP JSON backup to Google Drive appDataFolder / My Drive
  static Future<String> backupToGoogleDrive(String jsonPayload) async {
    final googleSignIn = GoogleSignIn(
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    );
    final account = await googleSignIn.signIn();
    if (account == null) {
      throw Exception('Google Sign-In cancelled');
    }
    final headers = await account.authHeaders;
    final boundary = 'ostora_backup_boundary_${DateTime.now().millisecondsSinceEpoch}';
    final metadata = jsonEncode({
      'name': 'ostora_accounting_backup_${DateTime.now().toIso8601String().substring(0, 10)}.json',
      'mimeType': 'application/json',
    });

    final body = '--$boundary\r\n'
        'Content-Type: application/json; charset=UTF-8\r\n\r\n'
        '$metadata\r\n'
        '--$boundary\r\n'
        'Content-Type: application/json\r\n\r\n'
        '$jsonPayload\r\n'
        '--$boundary--';

    final response = await http.post(
      Uri.parse('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'),
      headers: {
        ...headers,
        'Content-Type': 'multipart/related; boundary=$boundary',
      },
      body: body,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return account.email;
    }
    throw Exception('Drive upload failed (${response.statusCode})');
  }
}
