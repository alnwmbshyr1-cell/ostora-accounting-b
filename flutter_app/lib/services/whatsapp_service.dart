import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

class WhatsAppService {
  /// Removes all non-digit characters and converts leading 0 to 966 (Saudi Arabia).
  static String cleanPhone(String raw) {
    var digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.startsWith('00')) {
      digits = digits.substring(2);
    }
    if (digits.startsWith('0')) {
      digits = '966${digits.substring(1)}';
    }
    if (digits.isNotEmpty && !digits.startsWith('966') && digits.length == 9 && digits.startsWith('5')) {
      digits = '966$digits';
    }
    return digits;
  }

  static Future<void> sendWhatsApp({
    required String phone,
    required String message,
  }) async {
    final cleaned = cleanPhone(phone);
    final encoded = Uri.encodeComponent(message);
    final url = cleaned.isNotEmpty
        ? Uri.parse('https://wa.me/$cleaned?text=$encoded')
        : Uri.parse('https://wa.me/?text=$encoded');

    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  static Future<void> sendEmail({
    required String to,
    required String subject,
    required String body,
  }) async {
    final uri = Uri(
      scheme: 'mailto',
      path: to,
      queryParameters: {
        'subject': subject,
        'body': body,
      },
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  static Future<void> exportCsvAndShare({
    required String fileName,
    required String csvContent,
  }) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileName');
    // Prepend UTF-8 BOM so Excel renders Arabic cleanly
    await file.writeAsString('\uFEFF$csvContent');
    await Share.shareXFiles([XFile(file.path)], text: fileName);
  }
}
