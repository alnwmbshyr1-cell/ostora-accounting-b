export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const payload = mime.includes('csv') ? `\uFEFF${content}` : content;
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a genuine multi-sheet .xlsx Excel workbook using ExcelJS.
 * Automatically normalizes .xls filenames to .xlsx.
 */
export async function exportMultiSheetExcel(
  filename: string,
  sheets: { name: string; rows: (string | number)[][] }[],
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ostora Accounting Legend';
  workbook.created = new Date();

  const usedNames = new Set<string>();
  for (const s of sheets) {
    let baseName = (s.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet';
    let candidate = baseName;
    let idx = 1;
    while (usedNames.has(candidate)) {
      candidate = `${baseName.slice(0, 25)}_${idx++}`;
    }
    usedNames.add(candidate);

    const sheet = workbook.addWorksheet(candidate, {
      views: [{ rightToLeft: true }],
    });

    s.rows.forEach((rowValues, rIdx) => {
      const row = sheet.addRow(rowValues);
      if (rIdx === 0) {
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0A3D2C' },
        };
      }
    });

    sheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len + 4 > maxLen) maxLen = Math.min(48, len + 4);
      });
      col.width = maxLen;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = filename.replace(/\.xls$/i, '.xlsx').endsWith('.xlsx')
    ? filename.replace(/\.xls$/i, '.xlsx')
    : `${filename}.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Renders any DOM element (such as PrintPreviewModal, BatchPrintModal, or Financial Report)
 * into a multi-page A4 PDF file using html2canvas + jsPDF, preserving Arabic RTL typography cleanly.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 2) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  pdf.save(safeName);
}

/**
 * Exports structured report tables cleanly to an A4 PDF via offscreen HTML container so Arabic & RTL render identically.
 */
export async function exportTableReportToPdf(params: {
  filename: string;
  title: string;
  subtitle?: string;
  isRtl?: boolean;
  headers: string[];
  rows: (string | number)[][];
}): Promise<void> {
  const container = document.createElement('div');
  container.dir = params.isRtl ? 'rtl' : 'ltr';
  container.style.cssText =
    'position:fixed;left:-99999px;top:0;width:794px;background:#ffffff;color:#0f172a;padding:32px;font-family:Tajawal,Arial,sans-serif;';

  const ths = params.headers
    .map((h) => `<th style="border:1px solid #cbd5e1;padding:8px 10px;background:#0A3D2C;color:#fff;font-size:12px;">${String(h)}</th>`)
    .join('');
  const trs = params.rows
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">${r
          .map((c) => `<td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;">${String(c)}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  container.innerHTML = `
    <div style="border-bottom:3px solid #0A3D2C;padding-bottom:12px;margin-bottom:16px;">
      <h1 style="margin:0;font-size:20px;color:#0A3D2C;">${params.title}</h1>
      ${params.subtitle ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">${params.subtitle}</p>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;text-align:${params.isRtl ? 'right' : 'left'};">
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
  `;

  document.body.appendChild(container);
  try {
    await exportElementToPdf(container, params.filename);
  } finally {
    document.body.removeChild(container);
  }
}
