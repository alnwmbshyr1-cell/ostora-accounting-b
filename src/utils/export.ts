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

function escapeXml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportMultiSheetExcel(
  filename: string,
  sheets: { name: string; rows: (string | number)[][] }[],
) {
  const worksheets = sheets
    .map((s) => {
      const rowsXml = s.rows
        .map(
          (r) =>
            `<Row>${r
              .map((cell) => {
                const isNum = typeof cell === 'number' && Number.isFinite(cell);
                return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`;
              })
              .join('')}</Row>`,
        )
        .join('');
      return `<Worksheet ss:Name="${escapeXml(s.name.slice(0, 31))}"><Table>${rowsXml}</Table></Worksheet>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
