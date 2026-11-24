import 'dart:convert';
import 'dart:typed_data';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../models/models.dart';

class PdfService {
  /// Generates ZATCA Phase 1 TLV Base64 QR string
  static String buildZatcaQrPayload({
    required String sellerName,
    required String vatNumber,
    required String timestampIso,
    required String totalWithVat,
    required String vatAmount,
  }) {
    final bytes = BytesBuilder();
    void addTag(int tag, String value) {
      final encoded = utf8.encode(value);
      bytes.addByte(tag);
      bytes.addByte(encoded.length);
      bytes.add(encoded);
    }

    addTag(1, sellerName);
    addTag(2, vatNumber);
    addTag(3, timestampIso);
    addTag(4, totalWithVat);
    addTag(5, vatAmount);
    return base64Encode(bytes.toBytes());
  }

  static Future<pw.ThemeData?> _loadPdfTheme() async {
    try {
      final base = await PdfGoogleFonts.cairoRegular();
      final bold = await PdfGoogleFonts.cairoBold();
      return pw.ThemeData.withFont(base: base, bold: bold);
    } catch (_) {
      return null;
    }
  }

  static Future<void> printTaxInvoice({
    required Invoice invoice,
    required CompanySettings company,
  }) async {
    final theme = await _loadPdfTheme();
    final doc = pw.Document(theme: theme);
    final dateFmt = DateFormat('yyyy-MM-dd HH:mm');
    final qrData = buildZatcaQrPayload(
      sellerName: company.companyName,
      vatNumber: company.taxNumber,
      timestampIso: invoice.date.toIso8601String(),
      totalWithVat: invoice.total.toStringAsFixed(2),
      vatAmount: invoice.vat.toStringAsFixed(2),
    );

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (pw.Context ctx) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // Company Header + TAX INVOICE banner
              pw.Container(
                padding: const pw.EdgeInsets.all(16),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromHex('#0A3D2C'),
                  borderRadius: pw.BorderRadius.circular(10),
                ),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          company.companyName,
                          style: pw.TextStyle(
                            color: PdfColors.white,
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'VAT: ${company.taxNumber}  |  CR: ${company.crNumber}',
                          style: const pw.TextStyle(color: PdfColors.white, fontSize: 9),
                        ),
                        pw.Text(
                          '${company.phone}  |  ${company.email}',
                          style: const pw.TextStyle(color: PdfColors.white, fontSize: 9),
                        ),
                        pw.Text(
                          company.address,
                          style: const pw.TextStyle(color: PdfColors.white, fontSize: 9),
                        ),
                      ],
                    ),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.Text(
                          'TAX INVOICE',
                          style: pw.TextStyle(
                            color: PdfColor.fromHex('#C9A227'),
                            fontSize: 18,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.Text(
                          'ID: ${invoice.id}',
                          style: const pw.TextStyle(color: PdfColors.white, fontSize: 11),
                        ),
                        pw.Text(
                          dateFmt.format(invoice.date),
                          style: const pw.TextStyle(color: PdfColors.white, fontSize: 9),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              pw.SizedBox(height: 18),

              // Bill To + ZATCA QR Code
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                    padding: const pw.EdgeInsets.all(12),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.grey300),
                      borderRadius: pw.BorderRadius.circular(8),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('BILL TO:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        pw.SizedBox(height: 4),
                        pw.Text(invoice.customerName, style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
                        pw.Text('Phone: ${invoice.customerPhone}', style: const pw.TextStyle(fontSize: 10)),
                        pw.Text('Status: ${invoice.status.name.toUpperCase()}', style: const pw.TextStyle(fontSize: 10)),
                      ],
                    ),
                  ),
                  pw.BarcodeWidget(
                    barcode: pw.Barcode.qrCode(),
                    data: qrData,
                    width: 86,
                    height: 86,
                  ),
                ],
              ),
              pw.SizedBox(height: 20),

              // Line Item Table
              pw.TableHelper.fromTextArray(
                headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white),
                headerDecoration: pw.BoxDecoration(color: PdfColor.fromHex('#0A3D2C')),
                cellAlignment: pw.Alignment.centerLeft,
                headers: ['Description', 'Subtotal', 'VAT (15%)', 'Total (${company.currency})'],
                data: [
                  [
                    invoice.description.isEmpty ? 'Accounting & Supply Services' : invoice.description,
                    invoice.subtotal.toStringAsFixed(2),
                    invoice.vat.toStringAsFixed(2),
                    invoice.total.toStringAsFixed(2),
                  ],
                ],
              ),
              pw.SizedBox(height: 18),

              // Summary Totals
              pw.Align(
                alignment: pw.Alignment.centerRight,
                child: pw.Container(
                  width: 220,
                  padding: const pw.EdgeInsets.all(12),
                  decoration: pw.BoxDecoration(
                    color: PdfColors.grey100,
                    borderRadius: pw.BorderRadius.circular(8),
                  ),
                  child: pw.Column(
                    children: [
                      _summaryRow('Subtotal', '${invoice.subtotal.toStringAsFixed(2)} ${company.currency}'),
                      pw.SizedBox(height: 4),
                      _summaryRow('VAT 15%', '${invoice.vat.toStringAsFixed(2)} ${company.currency}'),
                      pw.Divider(),
                      _summaryRow(
                        'TOTAL',
                        '${invoice.total.toStringAsFixed(2)} ${company.currency}',
                        bold: true,
                      ),
                    ],
                  ),
                ),
              ),
              pw.Spacer(),

              // Signatures
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    children: [
                      pw.Container(width: 150, height: 1, color: PdfColors.grey600),
                      pw.SizedBox(height: 4),
                      pw.Text('Authorized Signature', style: const pw.TextStyle(fontSize: 9)),
                    ],
                  ),
                  pw.Column(
                    children: [
                      pw.Container(width: 150, height: 1, color: PdfColors.grey600),
                      pw.SizedBox(height: 4),
                      pw.Text('Recipient Signature', style: const pw.TextStyle(fontSize: 9)),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 16),

              // ZATCA Footer
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.all(8),
                decoration: pw.BoxDecoration(
                  border: pw.Border(top: pw.BorderSide(color: PdfColor.fromHex('#C9A227'), width: 1.5)),
                ),
                child: pw.Text(
                  'ZATCA Phase-1 Compliant E-Invoice · Generated by Ostora Systems (com.ostora.accounting)',
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                ),
              ),
            ],
          );
        },
      ),
    );

    await Printing.layoutPdf(onLayout: (format) async => doc.save());
  }

  static Future<void> printVoucher({
    required Voucher voucher,
    required CompanySettings company,
  }) async {
    final theme = await _loadPdfTheme();
    final doc = pw.Document(theme: theme);
    final isReceipt = voucher.type == VoucherType.receipt;
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Container(
              padding: const pw.EdgeInsets.all(16),
              decoration: pw.BoxDecoration(
                color: PdfColor.fromHex('#0A3D2C'),
                borderRadius: pw.BorderRadius.circular(10),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    company.companyName,
                    style: pw.TextStyle(color: PdfColors.white, fontSize: 15, fontWeight: pw.FontWeight.bold),
                  ),
                  pw.Text(
                    isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER',
                    style: pw.TextStyle(
                      color: PdfColor.fromHex('#C9A227'),
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 24),
            pw.Center(
              child: pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 28, vertical: 16),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColor.fromHex('#C9A227'), width: 2),
                  borderRadius: pw.BorderRadius.circular(12),
                ),
                child: pw.Text(
                  '${voucher.amount.toStringAsFixed(2)} ${company.currency}',
                  style: pw.TextStyle(fontSize: 28, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#0A3D2C')),
                ),
              ),
            ),
            pw.SizedBox(height: 24),
            pw.Text('Voucher ID: ${voucher.id}', style: const pw.TextStyle(fontSize: 12)),
            pw.SizedBox(height: 6),
            pw.Text('Date: ${DateFormat('yyyy-MM-dd').format(voucher.date)}', style: const pw.TextStyle(fontSize: 12)),
            pw.SizedBox(height: 6),
            pw.Text('${isReceipt ? "Received From" : "Paid To"}: ${voucher.partyName}', style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 6),
            pw.Text('Method: ${voucher.paymentMethod}', style: const pw.TextStyle(fontSize: 12)),
            pw.SizedBox(height: 12),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(14),
              decoration: pw.BoxDecoration(color: PdfColors.grey100, borderRadius: pw.BorderRadius.circular(8)),
              child: pw.Text('Reason: ${voucher.reason}', style: const pw.TextStyle(fontSize: 12)),
            ),
            pw.Spacer(),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Accountant Signature: ___________________'),
                pw.Text('Receiver Signature: ___________________'),
              ],
            ),
          ],
        ),
      ),
    );
    await Printing.layoutPdf(onLayout: (format) async => doc.save());
  }

  static Future<void> printPurchaseOrder({
    required PurchaseOrder po,
    required CompanySettings company,
  }) async {
    final theme = await _loadPdfTheme();
    final doc = pw.Document(theme: theme);
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(company.companyName, style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
            pw.Text('PURCHASE ORDER #${po.id}', style: pw.TextStyle(fontSize: 15, color: PdfColor.fromHex('#0A3D2C'))),
            pw.SizedBox(height: 14),
            pw.Text('Supplier: ${po.supplierName} (${po.supplierPhone})'),
            pw.Text('Date: ${DateFormat('yyyy-MM-dd').format(po.date)}'),
            pw.Text('Status: ${po.status.name.toUpperCase()}'),
            pw.SizedBox(height: 18),
            pw.TableHelper.fromTextArray(
              headers: ['Product', 'Qty', 'Unit Cost', 'Total (${company.currency})'],
              data: [
                [po.productName, '${po.quantity}', po.unitCost.toStringAsFixed(2), po.total.toStringAsFixed(2)],
              ],
            ),
          ],
        ),
      ),
    );
    await Printing.layoutPdf(onLayout: (format) async => doc.save());
  }

  static Future<void> printFinancialReport({
    required String title,
    required List<List<String>> rows,
    required CompanySettings company,
  }) async {
    final theme = await _loadPdfTheme();
    final doc = pw.Document(theme: theme);
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(company.companyName, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
            pw.Text(title, style: pw.TextStyle(fontSize: 14, color: PdfColor.fromHex('#0A3D2C'))),
            pw.Text('Currency: ${company.currency} | Generated: ${DateFormat('yyyy-MM-dd').format(DateTime.now())}',
                style: const pw.TextStyle(fontSize: 9)),
            pw.SizedBox(height: 16),
            pw.TableHelper.fromTextArray(
              headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white),
              headerDecoration: pw.BoxDecoration(color: PdfColor.fromHex('#0A3D2C')),
              headers: rows.isNotEmpty ? rows.first : ['Item', 'Amount'],
              data: rows.length > 1 ? rows.sublist(1) : [],
            ),
          ],
        ),
      ),
    );
    await Printing.layoutPdf(onLayout: (format) async => doc.save());
  }

  static pw.Widget _summaryRow(String label, String val, {bool bold = false}) {
    final style = pw.TextStyle(
      fontSize: bold ? 12 : 10,
      fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
    );
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [pw.Text(label, style: style), pw.Text(val, style: style)],
    );
  }
}
