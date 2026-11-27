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

  static String? getSignedInEmail() => _prefs.getString('signed_in_email');
  static Future<void> setSignedInEmail(String? email) async {
    if (email == null || email.isEmpty) {
      await _prefs.remove('signed_in_email');
    } else {
      await _prefs.setString('signed_in_email', email.toLowerCase());
    }
  }

  static String _hashSecret(String salt, String password) {
    final bytes = utf8.encode('$salt::$password::ostora-v1');
    var h1 = 0x811c9dc5;
    var h2 = 0x9e3779b9;
    var h3 = 0x85ebca6b;
    var h4 = 0xc2b2ae35;
    for (var round = 0; round < 64; round++) {
      for (final b in bytes) {
        h1 = ((h1 ^ (b + round)) * 0x01000193) & 0xffffffff;
        h2 = ((h2 + (b ^ round)) * 0x45d9f3b) & 0xffffffff;
        h3 = (((h3 << 5) | (h3 >>> 27)) ^ h1 ^ b) & 0xffffffff;
        h4 = (((h4 << 7) | (h4 >>> 25)) + h2 + round) & 0xffffffff;
      }
    }
    return [h1, h2, h3, h4].map((v) => v.toRadixString(16).padLeft(8, '0')).join();
  }

  static Future<void> saveLocalAccount(String email, String name, String password) async {
    final normalized = email.trim().toLowerCase();
    final salt = '${DateTime.now().microsecondsSinceEpoch}-$normalized';
    final hash = _hashSecret(salt, password);
    final raw = _prefs.getString('local_auth_accounts');
    final Map<String, dynamic> map =
        raw != null ? Map<String, dynamic>.from(jsonDecode(raw) as Map) : {};
    map[normalized] = {'name': name.trim(), 'salt': salt, 'hash': hash};
    await _prefs.setString('local_auth_accounts', jsonEncode(map));
  }

  static Map<String, dynamic>? getLocalAccount(String email) {
    final normalized = email.trim().toLowerCase();
    final raw = _prefs.getString('local_auth_accounts');
    if (raw == null) return null;
    final map = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    final entry = map[normalized];
    if (entry is Map) return Map<String, dynamic>.from(entry);
    return null;
  }

  static bool verifyLocalAccount(String email, String password) {
    final acc = getLocalAccount(email);
    if (acc == null) return false;
    final salt = acc['salt'] as String? ?? '';
    final expected = acc['hash'] as String? ?? '';
    if (salt.isEmpty || expected.isEmpty) return false;
    return _hashSecret(salt, password) == expected;
  }

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
