import { ViolationRecord, ViolationCategory } from '../types';

export interface WebhookPayload {
  event: string;
  id: string;
  tanggal: string;
  waktu: string;
  id_siswa: string;
  nama_siswa: string;
  kelas: string;
  kategori: string;
  jenis_transaksi: string;
  deskripsi: string;
  poin: number;
  pelapor: string;
  link_foto_bukti: string;
  timestamp_iso: string;
  // Aliases for English / external integrations
  studentId: string;
  studentName: string;
  studentClass: string;
  category: string;
  description: string;
  points: number;
  reporterName: string;
  evidenceUrl: string;
}

export function formatViolationForWebhook(record: ViolationRecord): WebhookPayload {
  const dateObj = new Date(record.date || Date.now());
  const isValidDate = !isNaN(dateObj.getTime());
  const validDate = isValidDate ? dateObj : new Date();

  return {
    event: 'NEW_RECORD',
    id: record.id,
    tanggal: record.date.includes('T') ? record.date.split('T')[0] : record.date,
    waktu: validDate.toLocaleTimeString('id-ID'),
    id_siswa: record.studentId,
    nama_siswa: record.studentName,
    kelas: record.studentClass,
    kategori: record.category,
    jenis_transaksi: record.category === ViolationCategory.PRESTASI ? 'Reward / Prestasi' : 'Pelanggaran Siswa',
    deskripsi: record.description,
    poin: record.points,
    pelapor: record.reporterName,
    link_foto_bukti: record.evidenceUrl || '',
    timestamp_iso: validDate.toISOString(),
    // Aliases
    studentId: record.studentId,
    studentName: record.studentName,
    studentClass: record.studentClass,
    category: record.category,
    description: record.description,
    points: record.points,
    reporterName: record.reporterName,
    evidenceUrl: record.evidenceUrl || ''
  };
}

export interface WebhookResult {
  success: boolean;
  message: string;
  isDirectSpreadsheetUrl?: boolean;
}

/**
 * Checks whether a URL is a direct Google Spreadsheet web page URL
 */
export function isGoogleSpreadsheetUrl(url: string): boolean {
  if (!url) return false;
  return /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i.test(url.trim());
}

/**
 * Extracts spreadsheet ID from a Google Spreadsheet URL
 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  return match ? match[1] : null;
}

/**
 * Generates ready-to-copy Google Apps Script code for Google Sheets integration
 */
export function getGoogleAppsScriptCode(sheetId?: string): string {
  const targetSheetComment = sheetId 
    ? `// Menghubungkan ke Spreadsheet ID: ${sheetId}\n  var ss = SpreadsheetApp.openById("${sheetId}");`
    : `// Menggunakan Spreadsheet aktif tempat skrip ini dipasang\n  var ss = SpreadsheetApp.getActiveSpreadsheet();`;

  return `/**
 * SKRIP INTEGRASI OTOMATIS SIPERSIS KE GOOGLE SHEETS
 * SMAN 1 KUDUS
 * 
 * Cara Pasang (Hanya 1 Menit):
 * 1. Buka Google Spreadsheet Anda
 * 2. Klik menu: Ekstensi > Apps Script
 * 3. Hapus semua kode yang ada di editor, lalu PASTE kode di bawah ini
 * 4. Klik tombol biru: Terapkan (Deploy) > Deployment baru (New deployment)
 * 5. Pilih jenis: Aplikasi web (Web app)
 * 6. Pada bagian "Siapa yang memiliki akses" (Who has access), PILIH: "Siapa saja" (Anyone)
 * 7. Klik "Terapkan" (Deploy) dan salin URL Web App yang berakhiran /exec
 * 8. Tempelkan URL /exec tersebut ke Pengaturan SiPerSis
 */

function doPost(e) {
  try {
    ${targetSheetComment}
    var sheet = ss.getActiveSheet();
    
    // Buat baris header otomatis jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Waktu Input",
        "Tanggal Kejadian",
        "Jam",
        "NIS / ID Siswa",
        "Nama Siswa",
        "Kelas",
        "Kategori",
        "Jenis Transaksi",
        "Deskripsi Pelanggaran / Prestasi",
        "Poin",
        "Nama Pelapor",
        "Link Bukti Foto"
      ]);
      sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.setFrozenRows(1);
    }
    
    // Parse data kiriman dari SiPerSis
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    // Masukkan baris data baru ke Spreadsheet
    var waktuSekarang = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([
      waktuSekarang,
      data.tanggal || "-",
      data.waktu || "-",
      data.id_siswa || data.nis || "-",
      data.nama_siswa || "-",
      data.kelas || "-",
      data.kategori || "-",
      data.jenis_transaksi || "-",
      data.deskripsi || "-",
      data.poin !== undefined ? data.poin : 0,
      data.pelapor || "-",
      data.link_foto_bukti || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Data SiPerSis berhasil disimpan ke Google Sheets!" 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "active", 
    service: "SiPerSis Google Sheets Webhook Receiver" 
  })).setMimeType(ContentService.MimeType.JSON);
}`;
}

/**
 * Sends violation/reward record to an external webhook URL (e.g., Google Apps Script, Make, Zapier, or API).
 */
export async function sendViolationToExternalWebhook(
  webhookUrl: string,
  record: ViolationRecord
): Promise<WebhookResult> {
  if (!webhookUrl || !webhookUrl.trim()) {
    return { success: false, message: 'URL webhook belum diatur' };
  }

  const cleanUrl = webhookUrl.trim();

  // Detect direct spreadsheet link mistake
  if (isGoogleSpreadsheetUrl(cleanUrl) && !cleanUrl.includes('script.google.com')) {
    return {
      success: false,
      isDirectSpreadsheetUrl: true,
      message: 'Link yang dimasukkan adalah link tampilan Google Spreadsheet langsung. Server Google Sheet menolak pengiriman POST langsung (Error 405). Gunakan link Google Apps Script Web App (/exec) yang menghubungkan ke spreadsheet ini.'
    };
  }

  const payload = formatViolationForWebhook(record);
  const jsonString = JSON.stringify(payload);

  try {
    // For Google Apps Script Web Apps, send with text/plain to avoid CORS OPTIONS preflight blocking in browsers
    const isAppsScript = cleanUrl.includes('script.google.com');
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': isAppsScript ? 'text/plain;charset=utf-8' : 'application/json',
      },
      body: jsonString,
    });

    if (res.status === 401) {
      return {
        success: false,
        message: 'Akses ditolak oleh Google (401 Unauthorized). Pada Apps Script: Klik Terapkan (Deploy) > Kelola deployment > Edit (ikon pensil) > pilih "Versi baru" dan ubah "Siapa yang memiliki akses" menjadi "Siapa saja" (Anyone).'
      };
    }

    if (res.ok) {
      return { success: true, message: 'Data berhasil terkirim ke tautan eksternal' };
    }

    // If redirected to login page (status 302 or URL contains accounts.google.com)
    if (res.url && res.url.includes('accounts.google.com')) {
      return {
        success: false,
        message: 'Aplikasi Google Apps Script meminta login Google. Silakan ubah izin akses deployment menjadi "Siapa saja" (Anyone) agar dapat menerima kiriman data.'
      };
    }

    return { 
      success: false, 
      message: `Server eksternal merespons dengan status ${res.status}: ${res.statusText || 'Gagal mengirim data'}` 
    };
  } catch {
    // 2. CORS fallback for Google Apps Script Web Apps (which redirect and lack standard CORS preflight headers)
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: jsonString,
      });
      // In no-cors mode, the request is dispatched and received by Google Apps Script successfully
      return { success: true, message: 'Data terkirim ke Google Sheets / Webhook eksternal' };
    } catch (fallbackErr: unknown) {
      const errMessage = fallbackErr instanceof Error ? fallbackErr.message : 'Koneksi gagal';
      return { success: false, message: `Gagal mengirim ke link: ${errMessage}` };
    }
  }
}

/**
 * Test ping connection to the provided webhook URL
 */
export async function testWebhookConnection(webhookUrl: string): Promise<WebhookResult> {
  if (!webhookUrl || !webhookUrl.trim()) {
    return { success: false, message: 'Masukkan URL webhook terlebih dahulu.' };
  }

  const sampleRecord: ViolationRecord = {
    id: `test-${Date.now()}`,
    studentId: 'test-student-id',
    studentName: 'Tes Integrasi (Contoh Siswa)',
    studentClass: 'X-A',
    category: ViolationCategory.RINGAN,
    description: 'Uji coba koneksi pengiriman data otomatis SiPerSis',
    points: 5,
    date: new Date().toISOString(),
    reporterName: 'Sistem SiPerSis'
  };

  return await sendViolationToExternalWebhook(webhookUrl, sampleRecord);
}
