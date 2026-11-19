import { ViolationRecord, Student, AppConfig, User, PrintDocumentSettings } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfKopSurat, drawPdfSignatures, resolvePrintSettings } from './pdfKop';

export const isTardinessRecord = (record: { description?: string; points?: number }): boolean => {
  if (!record || !record.description) return false;
  const desc = record.description.toLowerCase();
  return desc.includes('terlambat') || desc.includes('telat') || desc.includes('kesiangan');
};

export interface StudentTardinessInfo {
  studentId: string;
  studentName: string;
  studentClass: string;
  count: number;
  lastDate: string;
  records: ViolationRecord[];
  isAlarm: boolean; // count >= 3
  isMultipleOfThree: boolean; // count >= 3 && count % 3 === 0
  stage: 0 | 1 | 2 | 3; // 0 = <3, 1 = 3-5x, 2 = 6-8x, 3 = 9x+
  statusLabel: string;
  actionRequired: string;
}

export const getStudentTardinessInfo = (
  studentId: string, 
  studentName: string, 
  studentClass: string, 
  violations: ViolationRecord[]
): StudentTardinessInfo => {
  const records = violations
    .filter(v => v.studentId === studentId && isTardinessRecord(v))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const count = records.length;
  const lastDate = records.length > 0 ? records[0].date : '';
  const isAlarm = count >= 3;
  const isMultipleOfThree = count >= 3 && count % 3 === 0;

  let stage: 0 | 1 | 2 | 3 = 0;
  let statusLabel = 'Tertib / Normal';
  let actionRequired = 'Tidak ada tindakan khusus';

  if (count >= 9) {
    stage = 3;
    statusLabel = isMultipleOfThree ? `🚨 TINGKAT 3: Terlambat ${count}x (Kelipatan 3x)` : `⚠️ Peringatan Keras: Terlambat ${count}x`;
    actionRequired = 'Sidang Kasus / Pemanggilan Orang Tua Tahap III & Skorsing / Rapat BK';
  } else if (count >= 6) {
    stage = 2;
    statusLabel = isMultipleOfThree ? `🚨 TINGKAT 2: Terlambat ${count}x (Kelipatan 3x)` : `⚠️ Peringatan Lanjutan: Terlambat ${count}x`;
    actionRequired = 'Surat Pemanggilan Orang Tua Tahap II & Penandatanganan Surat Perjanjian';
  } else if (count >= 3) {
    stage = 1;
    statusLabel = isMultipleOfThree ? `🚨 TINGKAT 1: Terlambat ${count}x (Batas Alarm)` : `⚠️ Peringatan Awal: Terlambat ${count}x`;
    actionRequired = 'Surat Pemanggilan Orang Tua Tahap I & Pembinaan Khusus Guru BK / Wali Kelas';
  } else if (count > 0) {
    statusLabel = `Terlambat ${count}x`;
    actionRequired = 'Teguran lisan oleh guru piket';
  }

  return {
    studentId,
    studentName,
    studentClass,
    count,
    lastDate,
    records,
    isAlarm,
    isMultipleOfThree,
    stage,
    statusLabel,
    actionRequired
  };
};

export const getAllTardinessSummary = (students: Student[], violations: ViolationRecord[]): StudentTardinessInfo[] => {
  const map: Record<string, ViolationRecord[]> = {};
  violations.forEach(v => {
    if (isTardinessRecord(v)) {
      if (!map[v.studentId]) map[v.studentId] = [];
      map[v.studentId].push(v);
    }
  });

  const list: StudentTardinessInfo[] = [];

  Object.keys(map).forEach(studentId => {
    const student = students.find(s => s.id === studentId);
    const studentName = student ? student.name : (map[studentId][0]?.studentName || 'Siswa');
    const studentClass = student ? student.class : (map[studentId][0]?.studentClass || '-');
    list.push(getStudentTardinessInfo(studentId, studentName, studentClass, violations));
  });

  return list.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
  });
};

export const playAlarmSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Distinctive 3-tone chime
    const tones = [739.99, 880.00, 1108.73];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.36);
    });
  } catch (e) {
    // Fail silently if browser blocks audio
  }
};

// Generate Surat Panggilan Orang Tua Khusus Keterlambatan
export const buildTardinessLetterPdfDoc = async (
  student: Student,
  tardinessInfo: StudentTardinessInfo,
  appConfig: AppConfig,
  currentUser: User,
  printSettings?: PrintDocumentSettings
): Promise<jsPDF> => {
  const settings = printSettings || resolvePrintSettings(appConfig, currentUser);
  const font = settings.documentFontFamily || 'helvetica';
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Kop Surat Resmi
  let currentY = await drawPdfKopSurat(doc, appConfig, 8, settings);

  // Surat Details
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  const romanMonth = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const letterNumber = `421.3 / BK-${student.nis.slice(-3) || '001'} / ${romanMonth} / ${currentYear}`;
  const city = settings.cityLabel?.trim() || 'Kudus';

  let letterY = currentY + 3;
  doc.text(`Nomor     : ${letterNumber}`, 15, letterY);
  doc.text(`Lampiran  : 1 (satu) Berkas Riwayat`, 15, letterY + 5);
  doc.text(`Hal       : SURAT PEMANGGILAN ORANG TUA / WALI (KETERLAMBATAN)`, 15, letterY + 10);

  doc.text(`${city}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - 15, letterY, { align: 'right' });

  letterY += 18;

  doc.text("Kepada Yth.", 15, letterY);
  doc.setFont(font, 'bold');
  doc.text(`Bapak / Ibu Orang Tua / Wali dari : ${student.name}`, 15, letterY + 5);
  doc.setFont(font, 'normal');
  doc.text(`di Tempat`, 15, letterY + 10);

  letterY += 18;

  // Isi Surat
  doc.text("Dengan hormat,", 15, letterY);
  currentY = letterY + 5;

  const introText = `Sehubungan dengan penegakan tata tertib sekolah, khususnya mengenai kedisiplinan waktu kehadiran di sekolah, kami memberitahukan bahwa putra/putri Bapak/Ibu:`;
  const introLines = doc.splitTextToSize(introText, pageWidth - 30);
  doc.text(introLines, 15, currentY);
  currentY += introLines.length * 4.5 + 2;

  // Biodata Siswa Box
  doc.setFont(font, 'bold');
  doc.text(`• Nama Siswa      : ${student.name}`, 20, currentY);
  doc.text(`• NIS / NISN       : ${student.nis} / ${student.nisn || '-'}`, 20, currentY + 5);
  doc.text(`• Kelas            : ${student.class}`, 20, currentY + 10);
  doc.setFont(font, 'bold');
  doc.setTextColor(180, 0, 0);
  doc.text(`• Frekuensi Terlambat : ${tardinessInfo.count} KALI (${tardinessInfo.statusLabel})`, 20, currentY + 15);
  doc.setTextColor(0, 0, 0);

  currentY += 22;

  const noticeText = `Berdasarkan data sistem kedisiplinan siswa (SiPerSis), siswa tersebut telah tercatat terlambat hadir sebanyak ${tardinessInfo.count} kali yang telah mencapai ambang batas peringatan (${tardinessInfo.count >= 6 ? 'Peringatan Lanjutan / SP' : 'Peringatan Tahap I'}). Oleh karena itu, kami mengharap kehadiran Bapak/Ibu pada:`;
  const noticeLines = doc.splitTextToSize(noticeText, pageWidth - 30);
  doc.setFont(font, 'normal');
  doc.text(noticeLines, 15, currentY);
  currentY += noticeLines.length * 4.5 + 3;

  // Jadwal Box
  const nextWorkDay = new Date();
  nextWorkDay.setDate(nextWorkDay.getDate() + 1);
  if (nextWorkDay.getDay() === 0) nextWorkDay.setDate(nextWorkDay.getDate() + 1);

  doc.setFillColor(248, 250, 252);
  doc.rect(15, currentY, pageWidth - 30, 24, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(15, currentY, pageWidth - 30, 24, 'S');

  doc.text(`Hari / Tanggal : ${nextWorkDay.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, 20, currentY + 6);
  doc.text(`Pukul          : 08.00 WIB s.d. 10.00 WIB`, 20, currentY + 11);
  doc.text(`Tempat         : Ruang Bimbingan & Konseling (BK) ${appConfig.schoolName}`, 20, currentY + 16);
  doc.text(`Keperluan      : Konsultasi & Pembinaan Khusus Kedisiplinan Siswa`, 20, currentY + 21);

  currentY += 29;

  const outroText = `Mengingat pentingnya koordinasi antara pihak sekolah dan orang tua demi masa depan pendidikan siswa yang bersangkutan, kami sangat mengharapkan kehadiran Bapak/Ibu tepat pada waktunya.`;
  const outroLines = doc.splitTextToSize(outroText, pageWidth - 30);
  doc.text(outroLines, 15, currentY);
  currentY += outroLines.length * 4.5 + 2;

  doc.text("Demikian surat pemanggilan ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.", 15, currentY);
  currentY += 10;

  if (tardinessInfo.records.length > 0) {
    const tableData = tardinessInfo.records.slice(0, 8).map((r, idx) => [
      (idx + 1).toString(),
      new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      new Date(r.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      r.description,
      r.reporterName
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["No", "Tanggal Terlambat", "Waktu", "Catatan Pelanggaran", "Pencatat/Piket"]],
      body: tableData,
      theme: 'grid',
      styles: { font, fontSize: 7, cellPadding: 2 },
      headStyles: { font, fillColor: [153, 27, 27], textColor: 255, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 25 },
        3: { cellWidth: 80 },
        4: { cellWidth: 35 }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  drawPdfSignatures(doc, settings, appConfig, currentY);
  return doc;
};

export const generateTardinessLetterPdf = async (
  student: Student,
  tardinessInfo: StudentTardinessInfo,
  appConfig: AppConfig,
  currentUser: User,
  printSettings?: PrintDocumentSettings
): Promise<string> => {
  const doc = await buildTardinessLetterPdfDoc(student, tardinessInfo, appConfig, currentUser, printSettings);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

// Generate Laporan Rekapitulasi Semua Siswa Terlambat
export const buildAllTardinessRecapPdfDoc = async (
  tardinessList: StudentTardinessInfo[],
  appConfig: AppConfig,
  currentUser: User,
  printSettings?: PrintDocumentSettings
): Promise<jsPDF> => {
  const settings = printSettings || resolvePrintSettings(appConfig, currentUser);
  const font = settings.documentFontFamily || 'helvetica';
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Kop Surat Resmi
  const currentY = await drawPdfKopSurat(doc, appConfig, 8, settings);

  // Title
  doc.setFontSize(12);
  doc.setFont(font, 'bold');
  doc.text("REKAPITULASI SISWA SERING TERLAMBAT & STATUS ALARM", pageWidth / 2, currentY + 5, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.text(`Tahun Ajaran: ${appConfig.academicYear} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, currentY + 10, { align: 'center' });

  const tableStartY = currentY + 16;

  const tableBody = tardinessList.map((item, index) => [
    (index + 1).toString(),
    item.studentName,
    item.studentClass,
    `${item.count} kali`,
    item.isAlarm ? (item.count >= 6 ? 'ALARM TINGKAT 2 (SP-2)' : 'ALARM TINGKAT 1 (SP-1)') : 'Waspada (<3x)',
    item.lastDate ? new Date(item.lastDate).toLocaleDateString('id-ID') : '-',
    item.actionRequired
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [["No", "Nama Siswa", "Kelas", "Frekuensi", "Status Alarm", "Terakhir", "Tindakan Yang Diperlukan"]],
    body: tableBody,
    theme: 'grid',
    styles: { font, fontSize: 8, cellPadding: 2.5 },
    headStyles: { font, fillColor: [185, 28, 28], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 20 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 32 },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 42 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;
  drawPdfSignatures(doc, settings, appConfig, finalY);

  return doc;
};

export const generateAllTardinessRecapPdf = async (
  tardinessList: StudentTardinessInfo[],
  appConfig: AppConfig,
  currentUser: User,
  printSettings?: PrintDocumentSettings
): Promise<string> => {
  const doc = await buildAllTardinessRecapPdfDoc(tardinessList, appConfig, currentUser, printSettings);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

