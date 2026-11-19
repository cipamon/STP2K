import * as XLSX from 'xlsx';

export function exportRowsToSpreadsheet(
  rows: Record<string, any>[],
  sheetName: string,
  fileBaseName: string,
  colWidths?: number[],
  format: 'xls' | 'xlsx' = 'xls'
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  if (colWidths && colWidths.length > 0) {
    worksheet['!cols'] = colWidths.map((wch) => ({ wch }));
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const ext = format === 'xls' ? 'xls' : 'xlsx';
  XLSX.writeFile(workbook, `${fileBaseName}.${ext}`, {
    bookType: format === 'xls' ? 'xls' : 'xlsx',
  });
}

export function exportAoaToSpreadsheet(
  aoa: any[][],
  sheetName: string,
  fileBaseName: string,
  colWidths?: number[],
  format: 'xls' | 'xlsx' = 'xls'
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths && colWidths.length > 0) {
    worksheet['!cols'] = colWidths.map((wch) => ({ wch }));
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const ext = format === 'xls' ? 'xls' : 'xlsx';
  XLSX.writeFile(workbook, `${fileBaseName}.${ext}`, {
    bookType: format === 'xls' ? 'xls' : 'xlsx',
  });
}
