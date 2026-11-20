import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Student, ViolationRecord, ViolationCategory, AppConfig, User, PrintDocumentSettings } from '../types';
import { X, User as UserIcon, Trophy, AlertTriangle, Calendar, Award, Printer, ArrowDownCircle, Clock, BellRing, Volume2, FileText, Image as ImageIcon, ExternalLink, Phone, Mail, MapPin, ShieldCheck, FileSpreadsheet, FileDown, Sliders } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStudentTardinessInfo, buildTardinessLetterPdfDoc, playAlarmSound, isTardinessRecord } from '../utils/tardiness';
import { KopSurat } from './KopSurat';
import { SignatureLayoutEditor } from './SignatureLayoutEditor';
import { drawPdfKopSurat, drawPdfSignatures, getPdfFontFamily, resolvePrintSettings } from '../utils/pdfKop';
import PrintPreviewModal from './PrintPreviewModal';
import PrintSettingsPanel from './PrintSettingsPanel';
import {
  formatBirthPlaceDate,
  getStatusBadgeClasses,
  getStudentPhone,
  getStudentPhoto,
  getStudentStatus,
} from '../utils/studentHelpers';
import { getDefaultStudentAvatar } from '../utils/avatarHelpers';
import { exportAoaToSpreadsheet } from '../utils/exportHelpers';
import { loadStudentPdfPhoto } from '../utils/pdfImages';

interface StudentDetailModalProps {
  student: Student;
  violations: ViolationRecord[];
  onClose: () => void;
  appConfig: AppConfig;
  currentUser: User;
  users?: User[];
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ student, violations, onClose, appConfig, currentUser, users = [], onSavePrintSettings }) => {
  const [printModalMode, setPrintModalMode] = useState<null | 'detail' | 'tardinessLetter'>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'tardiness'>('all');
  const [showPrePrintPanel, setShowPrePrintPanel] = useState(false);
  const [draftPrintSettings, setDraftPrintSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(appConfig, currentUser, users)
  );

  useEffect(() => {
    setDraftPrintSettings(resolvePrintSettings(appConfig, currentUser, users));
  }, [appConfig, currentUser, users]);

  const handleDownloadImage = async (url: string) => {
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `bukti-foto-${student.name.replace(/\s+/g, '_')}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Foto berhasil diunduh.");
        return;
      }

      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const extension = blob.type.split('/')[1] || 'jpg';
        link.download = `bukti-foto-${student.name.replace(/\s+/g, '_')}-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        toast.success("Foto berhasil diunduh.");
      } catch (fetchErr) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = `bukti-foto-${student.name.replace(/\s+/g, '_')}-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Mengunduh / membuka gambar.");
      }
    } catch (err) {
      console.error(err);
      window.open(url, '_blank');
      toast.info("Gambar dibuka di tab baru.");
    }
  };

  // Tardiness summary for this student
  const tardinessInfo = getStudentTardinessInfo(student.id, student.name, student.class, violations);

  // Filter violations for this student and sort by date (newest first)
  const allStudentRecords = violations
    .filter(v => v.studentId === student.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const studentRecords = activeFilter === 'tardiness'
    ? allStudentRecords.filter(r => isTardinessRecord(r))
    : allStudentRecords;

  const handlePrintTardinessLetter = () => {
    setPrintModalMode('tardinessLetter');
  };

  const buildStudentDetailPdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || resolvePrintSettings(appConfig, currentUser, users);
    const showPoints = settings.showPoints !== false;
    const font = getPdfFontFamily(settings.documentFontFamily);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Kop Surat Resmi
    const currentY = await drawPdfKopSurat(doc, appConfig, 8, settings);

    // Title
    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    doc.text("LAPORAN RIWAYAT PELANGGARAN & PRESTASI SISWA", pageWidth / 2, currentY + 6, { align: 'center' });

    const studentPhone = getStudentPhone(student);
    const studentStatus = getStudentStatus(student);
    const studentTtl = formatBirthPlaceDate(student.birthPlace, student.birthDate);
    const studentPhoto = await loadStudentPdfPhoto(student);

    // Student Info + Foto Siswa
    doc.setFontSize(10);
    doc.text("BIODATA SISWA", 15, currentY + 15);

    const textX = studentPhoto ? 41 : 15;
    if (studentPhoto) {
      const photoX = 15;
      const photoY = currentY + 19;
      const photoW = 22;
      const photoH = 28;
      try {
        doc.setFillColor(248, 250, 252);
        doc.rect(photoX - 0.6, photoY - 0.6, photoW + 1.2, photoH + 1.2, 'F');
        doc.addImage(studentPhoto.dataUrl, studentPhoto.format, photoX, photoY, photoW, photoH);
        doc.setDrawColor(203, 213, 225);
        doc.rect(photoX - 0.6, photoY - 0.6, photoW + 1.2, photoH + 1.2, 'S');
      } catch {
        // ignore
      }
    }

    const bioMaxW = pageWidth - textX - 15;
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(`Nama Lengkap   : ${student.name}`, textX, currentY + 21, { maxWidth: showPoints ? bioMaxW - 35 : bioMaxW });
    doc.text(`NIS / NISN     : ${student.nis} / ${student.nisn || '-'}`, textX, currentY + 26, { maxWidth: bioMaxW });
    doc.text(`Kelas / Absen  : ${student.class} / No. Absen ${student.absenNumber || '-'}`, textX, currentY + 31, { maxWidth: bioMaxW });
    doc.text(`Wali Kelas     : ${student.waliKelas || '-'} | Guru BK: ${student.guruBk || '-'}`, textX, currentY + 36, { maxWidth: bioMaxW });
    doc.text(`Jenis Kelamin  : ${student.gender === 'L' ? 'Laki-laki' : 'Perempuan'} | Status: ${studentStatus}`, textX, currentY + 41, { maxWidth: bioMaxW });
    doc.text(`Tempat, Tgl Lhr: ${studentTtl}`, textX, currentY + 46, { maxWidth: bioMaxW });
    doc.text(`No. HP / Email : ${studentPhone || '-'} / ${student.email || '-'}`, textX, currentY + 51, { maxWidth: bioMaxW });
    doc.text(`Alamat         : ${student.address || '-'}`, textX, currentY + 56, { maxWidth: bioMaxW });
    
    if (showPoints) {
      doc.setFontSize(11);
      doc.setFont(font, 'bold');
      doc.text(`TOTAL POIN : ${student.totalPoints}`, pageWidth - 15, currentY + 21, { align: 'right' });
    }

    // Table
    const headers = showPoints
      ? [["Tanggal", "Kategori", "Deskripsi Kejadian", "Poin"]]
      : [["Tanggal", "Kategori", "Deskripsi Kejadian"]];
    const body = studentRecords.map(record => {
      const row: any[] = [
        new Date(record.date).toLocaleDateString('id-ID'),
        record.category.toUpperCase(),
        record.description,
      ];
      if (showPoints) {
        row.push(record.category === ViolationCategory.PRESTASI ? record.points : `+${record.points}`);
      }
      return row;
    });

    const columnStyles: Record<number, any> = {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 'auto' },
    };
    if (showPoints) {
      columnStyles[3] = { cellWidth: 15, halign: 'center', fontStyle: 'bold' };
    }

    autoTable(doc, {
      startY: currentY + 65,
      head: headers,
      body: body,
      theme: 'grid',
      styles: { font, fontSize: 8, cellPadding: 3 },
      headStyles: { font, fillColor: [51, 65, 85], textColor: 255, halign: 'center' },
      columnStyles,
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 14;
    drawPdfSignatures(doc, settings, appConfig, finalY);

    return doc;
  };

  const handlePrint = () => {
    setPrintModalMode('detail');
  };

  const handleDirectDownloadPdf = async () => {
    try {
      const doc = await buildStudentDetailPdfDoc(draftPrintSettings);
      doc.save(`SIPERSIS_Siswa_${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF riwayat siswa berhasil diunduh.");
    } catch (error) {
      console.error("PDF download failed:", error);
      toast.error("Gagal mengunduh PDF. Silakan coba lagi.");
    }
  };

  const handleDownloadXls = () => {
    const aoa: any[][] = [
      ['LAPORAN BIODATA & RIWAYAT SISWA'],
      ['Sekolah', appConfig.schoolName],
      ['Tahun Ajaran', appConfig.academicYear],
      ['Nama Lengkap', student.name],
      ['NIS / NISN', `${student.nis} / ${student.nisn || '-'}`],
      ['Kelas / No Absen', `${student.class} / ${student.absenNumber || '-'}`],
      ['Wali Kelas', student.waliKelas || '-'],
      ['Guru BK', student.guruBk || '-'],
      ['Jenis Kelamin', student.gender === 'L' ? 'Laki-laki' : 'Perempuan'],
      ['Tempat, Tanggal Lahir', formatBirthPlaceDate(student.birthPlace, student.birthDate)],
      ['No. HP / Email', `${getStudentPhone(student) || '-'} / ${student.email || '-'}`],
      ['Alamat', student.address || '-'],
      ['Status / Total Poin', `${getStudentStatus(student)} / ${student.totalPoints}`],
      [],
      ['Tanggal', 'Kategori', 'Deskripsi Kejadian', 'Poin', 'Pelapor'],
      ...studentRecords.map((r) => [
        new Date(r.date).toLocaleDateString('id-ID'),
        r.category,
        r.description,
        r.points,
        r.reporterName || '-',
      ]),
    ];
    exportAoaToSpreadsheet(
      aoa,
      'Riwayat Siswa',
      `Riwayat_${student.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
      [22, 18, 45, 10, 22],
      'xls'
    );
    toast.success("File XLS biodata & riwayat siswa berhasil diunduh.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:block">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94dvh] sm:max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:h-auto print:overflow-visible">
        
        {/* Screen Header (Hidden on Print) */}
        <div className="relative bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-4 py-4 sm:px-6 sm:py-5 text-white shrink-0 print:hidden">
          <div className="flex items-start justify-between gap-3 sm:gap-5">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewImage(getStudentPhoto(student))}
                  className="group relative block rounded-2xl focus:outline-none cursor-pointer"
                  title="Klik untuk lihat & unduh foto siswa"
                >
                  <img 
                    src={getStudentPhoto(student)} 
                    alt={student.name} 
                    onError={(e) => {
                      const fallback = getDefaultStudentAvatar(student.gender);
                      if (!e.currentTarget.src.endsWith(fallback)) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/40 shadow-md group-hover:opacity-90 transition" 
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition">
                    Lihat Foto
                  </span>
                </button>
                {student.totalPoints < 0 && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-yellow-400 text-yellow-900 p-1 rounded-full shadow-md border-2 border-white">
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getStatusBadgeClasses(getStudentStatus(student))}`}>
                    {getStudentStatus(student)}
                  </span>
                  <span className="text-xs font-semibold text-indigo-100">
                    {student.class} &bull; No. Absen {student.absenNumber || '-'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight leading-snug text-white mt-1 break-words">
                  {student.name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-indigo-100/95">
                  <span className="font-mono">NIS {student.nis}</span>
                  <span className="text-white/40">&bull;</span>
                  <span className="font-mono">NISN {student.nisn || '-'}</span>
                  <span className="text-white/40">&bull;</span>
                  <span>{student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-2.5 shrink-0">
              <div className="bg-white text-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-md text-center min-w-[78px] sm:min-w-[92px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Poin</p>
                <p className={`text-xl sm:text-2xl font-extrabold tabular-nums leading-tight ${student.totalPoints > 50 ? 'text-red-600' : student.totalPoints < 0 ? 'text-emerald-600' : 'text-indigo-700'}`}>
                  {student.totalPoints}
                </p>
              </div>
              <button
                onClick={onClose}
                className="bg-white/15 hover:bg-white/25 p-2 rounded-xl transition-colors cursor-pointer"
                title="Tutup"
                aria-label="Tutup detail siswa"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Toolbar Strip (Hidden on Print) */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Ekspor &amp; Cetak Laporan Siswa</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <button 
              type="button"
              onClick={handleDownloadXls} 
              className="bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              title="Unduh biodata dan riwayat ke file XLS"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Unduh XLS
            </button>
            <button 
              type="button"
              onClick={() => setShowPrePrintPanel((v) => !v)} 
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer whitespace-nowrap ${
                showPrePrintPanel
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Atur Kop Surat, Spasi, TTD & Font sebelum Pratinjau atau Cetak"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" /> Atur Kop &amp; TTD
            </button>
            <button 
              type="button"
              onClick={handleDirectDownloadPdf} 
              className="bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              title="Unduh langsung laporan ke PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-600" /> Unduh PDF
            </button>
            <button 
              type="button"
              onClick={handlePrint} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
          </div>
        </div>

        {/* ALARM KETERLAMBATAN BANNER DALAM MODAL (Hidden on Print) */}
        {tardinessInfo.isAlarm && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-4 px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md print:hidden border-b border-red-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl animate-pulse shadow-inner flex-shrink-0">
                <BellRing className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-yellow-400 text-red-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                    🚨 Alarm Keterlambatan Aktif ({tardinessInfo.count}x)
                  </span>
                  <span className="font-extrabold text-sm text-white">
                    {tardinessInfo.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-rose-100 mt-0.5 font-medium">
                  Rekomendasi Tindakan: <span className="font-bold underline">{tardinessInfo.actionRequired}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  playAlarmSound();
                  toast.info("Memutar nada alarm keterlambatan.");
                }}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-white/20"
                title="Bunyikan Alarm"
              >
                <Volume2 className="w-3.5 h-3.5 text-yellow-300" /> Nada Alarm
              </button>
              <button
                onClick={handlePrintTardinessLetter}
                className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-black transition shadow-md flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-red-600" /> Cetak Surat Panggilan Ortu
              </button>
            </div>
          </div>
        )}

        {/* KOP SURAT (Visible only on print) */}
        <div className="hidden print:block p-8">
          <KopSurat appConfig={appConfig} showBorder={true} printSettings={draftPrintSettings} />
        </div>

        {/* Print Content Header */}
        <div className="hidden print:block px-8 mb-4">
          <div className="text-center mb-8">
             <h2 className="text-2xl font-black uppercase">LAPORAN RIWAYAT PELANGGARAN & PRESTASI SISWA</h2>
          </div>
          
          <div className="flex justify-between items-start mb-6">
             <div className="space-y-1">
                <h3 className="text-lg font-bold mb-2">BIODATA SISWA</h3>
                <table className="text-sm font-medium">
                   <tbody>
                      <tr>
                         <td className="w-36 py-0.5">Nama Lengkap</td>
                         <td className="w-4">:</td>
                         <td className="uppercase font-bold">{student.name}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">Kelas</td>
                         <td>:</td>
                         <td>{student.class} ({student.gender === 'L' ? 'Laki-laki' : 'Perempuan'})</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">Wali Kelas</td>
                         <td>:</td>
                         <td>{student.waliKelas || '-'}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">Guru BK</td>
                         <td>:</td>
                         <td>{student.guruBk || '-'}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">NIS / NISN</td>
                         <td>:</td>
                         <td className="font-mono">{student.nis} / {student.nisn || '-'}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">No. Absen / Status</td>
                         <td>:</td>
                         <td>{student.absenNumber || '-'} ({getStudentStatus(student)})</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">Tempat, Tgl Lahir</td>
                         <td>:</td>
                         <td>{formatBirthPlaceDate(student.birthPlace, student.birthDate)}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">No. HP / Email</td>
                         <td>:</td>
                         <td>{getStudentPhone(student) || '-'} / {student.email || '-'}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">Alamat</td>
                         <td>:</td>
                         <td>{student.address || '-'}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
             {appConfig.printSettings?.showPoints !== false && (
               <div className="text-right">
                  <div className="text-xl font-black bg-slate-100 p-4 border-2 border-black rounded-lg">
                     TOTAL POIN : {student.totalPoints}
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50/80 flex-1 space-y-5 print:bg-white print:p-8 print:overflow-visible">
          {/* Pre-Print Settings Panel (Shown before clicking Pratinjau / Cetak / Unduh PDF) */}
          {showPrePrintPanel && (
            <div className="mb-6 bg-white rounded-2xl border border-indigo-200 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 shadow-sm print:hidden">
              <div className="lg:col-span-5">
                <PrintSettingsPanel
                  settings={draftPrintSettings}
                  onChange={setDraftPrintSettings}
                  appConfig={appConfig}
                  currentUser={currentUser}
                  users={users}
                  onSaveDefaultSettings={onSavePrintSettings}
                  showFooterActions
                  className="rounded-xl border border-slate-200 max-h-[430px]"
                />
              </div>
              <div className="lg:col-span-7 flex flex-col justify-between gap-3">
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 overflow-x-auto space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Pratinjau Kop Surat, Spasi &amp; TTD Sebelum Cetak
                  </div>
                  {draftPrintSettings.showKop ? (
                    <div className="min-w-[480px] sm:min-w-0">
                      <KopSurat appConfig={appConfig} printSettings={draftPrintSettings} showBorder />
                    </div>
                  ) : (
                    <div className="py-3 text-center text-xs text-slate-400">Kop Surat dinonaktifkan.</div>
                  )}
                  <SignatureLayoutEditor
                    compact
                    settings={draftPrintSettings}
                    onChange={setDraftPrintSettings}
                    appConfig={appConfig}
                    currentUser={currentUser}
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleDirectDownloadPdf}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Unduh PDF
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Buka Pratinjau &amp; Cetak
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Structured Biodata Card (Screen Only - Clean Single-Elevation Grid) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:hidden">
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Biodata Lengkap Siswa
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-6 gap-y-3.5 text-xs">
              <div className="lg:col-span-4">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Wali Kelas
                </div>
                <div className="font-semibold text-slate-800 mt-0.5">{student.waliKelas || '-'}</div>
              </div>
              <div className="lg:col-span-4">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Guru BK
                </div>
                <div className="font-semibold text-slate-800 mt-0.5">{student.guruBk || '-'}</div>
              </div>
              <div className="lg:col-span-4">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Tempat, Tanggal Lahir
                </div>
                <div className="font-semibold text-slate-800 mt-0.5">{formatBirthPlaceDate(student.birthPlace, student.birthDate)}</div>
              </div>

              <div className="lg:col-span-3 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> No. HP / WhatsApp
                </div>
                <div className="font-mono font-semibold text-slate-800 mt-0.5 tabular-nums">{getStudentPhone(student) || '-'}</div>
              </div>
              <div className="lg:col-span-5 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </div>
                <div className="font-medium text-slate-800 mt-0.5 break-all">{student.email || '-'}</div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Alamat Lengkap
                </div>
                <div className="font-medium text-slate-800 mt-0.5 leading-relaxed">{student.address || '-'}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3.5 print:hidden">
              <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> Riwayat Catatan Siswa
              </h3>

              {/* Filter Toggle */}
              <div className="flex bg-slate-200/80 p-1 rounded-xl">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Catatan ({allStudentRecords.length})
                </button>
                <button
                  onClick={() => setActiveFilter('tardiness')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeFilter === 'tardiness' 
                      ? 'bg-rose-600 text-white shadow-sm' 
                      : tardinessInfo.isAlarm 
                      ? 'text-red-600 font-extrabold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Keterlambatan ({tardinessInfo.count})
                </button>
              </div>
            </div>

            {studentRecords.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-slate-200 border-dashed print:border-black">
                 <p className="text-sm text-slate-400 print:text-black">
                   {activeFilter === 'tardiness' 
                     ? 'Siswa ini tidak memiliki catatan keterlambatan (Tertib).' 
                     : 'Belum ada catatan pelanggaran atau prestasi.'}
                 </p>
              </div>
            ) : (
              <div className="space-y-3 print:space-y-0">
                 {/* Print Table Header */}
                 <div className="hidden print:grid grid-cols-12 gap-2 font-bold text-sm border-b-2 border-black pb-2 mb-2">
                    <div className="col-span-2">Tanggal</div>
                    <div className="col-span-2">Kategori</div>
                    <div className={appConfig.printSettings?.showPoints !== false ? 'col-span-6' : 'col-span-8'}>Deskripsi Kejadian</div>
                    {appConfig.printSettings?.showPoints !== false && <div className="col-span-2 text-right">Poin</div>}
                 </div>

                 {studentRecords.map((record) => (
                   <div 
                      key={record.id} 
                      className={`bg-white p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center transition-colors hover:border-slate-300 print:shadow-none print:rounded-none print:border-0 print:border-b print:border-black/50 print:p-2 print:grid print:grid-cols-12 print:gap-2 print:items-start
                        ${record.category === ViolationCategory.PRESTASI ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'}
                      `}
                   >
                      {/* Screen View: Date */}
                      <div className="flex sm:flex-col items-baseline sm:items-center gap-2 sm:gap-0 flex-shrink-0 sm:w-20 sm:border-r sm:border-slate-100 sm:pr-4 text-left sm:text-center print:hidden tabular-nums">
                         <span className="text-xs font-bold text-slate-500 uppercase order-2 sm:order-1">
                           {new Date(record.date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                         </span>
                         <span className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight order-1 sm:order-2">
                           {new Date(record.date).getDate()}
                         </span>
                         <span className="text-[11px] text-slate-400 order-3">
                           {new Date(record.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>

                       {/* Print View: Date */}
                      <div className="hidden print:block col-span-2 text-sm text-black">
                         {new Date(record.date).toLocaleDateString('id-ID')}
                      </div>

                      <div className="flex-1 min-w-0 print:col-span-8 print:grid print:grid-cols-8 print:gap-2">
                         {/* Category + Reporter */}
                         <div className="flex flex-wrap items-center gap-2 mb-1.5 print:col-span-2 print:mb-0">
                            {record.category === ViolationCategory.PRESTASI ? (
                               <span className="w-fit bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 print:border-0 print:p-0 print:bg-white print:text-black">
                                  <Award className="w-3 h-3 print:hidden" /> PRESTASI
                               </span>
                            ) : (
                               <span className={`w-fit px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 border print:border-0 print:p-0 print:bg-white print:text-black
                                  ${record.category === ViolationCategory.RINGAN ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    record.category === ViolationCategory.SEDANG ? 'bg-orange-50 text-orange-800 border-orange-200' :
                                    'bg-rose-50 text-rose-800 border-rose-200'}
                               `}>
                                  <AlertTriangle className="w-3 h-3 print:hidden" /> {record.category.toUpperCase()}
                               </span>
                            )}
                            <span className="text-xs text-slate-500 print:hidden">Oleh: {record.reporterName}</span>
                         </div>
                         
                         {/* Description */}
                         <div className="print:col-span-6">
                           <p className="text-sm text-slate-900 font-medium leading-snug print:text-sm print:font-normal">{record.description}</p>
                           
                           <div className="flex flex-wrap items-center gap-2 mt-2 empty:hidden">
                             {/* Explicit Label for Reward reducing points */}
                             {record.category === ViolationCategory.PRESTASI && (
                                 <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200 print:border-black print:text-black print:bg-white">
                                    <ArrowDownCircle className="w-3 h-3" /> Mengurangi Poin Pelanggaran
                                 </div>
                             )}

                             {/* Tardiness Badge */}
                             {isTardinessRecord(record) && (
                                 <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded border border-rose-200 print:border-black print:text-black print:bg-white">
                                    <Clock className="w-3 h-3 text-rose-600" /> Keterlambatan Masuk Sekolah
                                 </div>
                             )}

                             {record.evidenceUrl && (
                               <button 
                                 type="button"
                                 onClick={() => setPreviewImage(record.evidenceUrl!)} 
                                 className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition cursor-pointer print:hidden"
                                 title="Klik untuk lihat & unduh bukti foto"
                               >
                                 <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                 Lihat &amp; Unduh Bukti Foto
                               </button>
                             )}
                           </div>
                         </div>
                      </div>

                      <div className={`flex-shrink-0 flex sm:block items-center justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 text-right print:col-span-2 ${appConfig.printSettings?.showPoints === false ? 'print:hidden' : ''}`}>
                         <span className="text-xs font-medium text-slate-400 sm:hidden">Poin</span>
                         <span className={`text-lg font-extrabold tabular-nums print:text-sm ${record.category === ViolationCategory.PRESTASI ? 'text-emerald-600' : 'text-rose-600'} print:text-black`}>
                            {record.category === ViolationCategory.PRESTASI ? '' : '+'}{record.points}
                         </span>
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200 text-center text-xs text-slate-500 print:hidden">
          Catatan: Prestasi (Poin Negatif) akan mengurangi total poin pelanggaran siswa.
        </div>

        {/* Print Footer / Signature */}
        <div className="hidden print:flex justify-between items-start mt-12 px-12 pb-12 w-full">
           <div className="text-center w-64">
              <p className="mb-24 font-medium">
                 Mengetahui,<br/>Orang Tua / Wali
              </p>
              <p className="font-bold uppercase pb-1">( ........................................ )</p>
           </div>
           <div className="text-center w-64">
              <p className="mb-24 font-medium">
                 Kudus, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br/>
                 {currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK'}
              </p>
              <div>
                 <p className="font-bold uppercase">{currentUser.name}</p>
                 {currentUser.nip && <p className="text-xs">NIP. {currentUser.nip}</p>}
              </div>
           </div>
        </div>

      </div>

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={printModalMode !== null}
        title={
          printModalMode === 'tardinessLetter'
            ? `Surat Panggilan Orang Tua — ${student.name}`
            : `Pratinjau & Cetak Riwayat — ${student.name}`
        }
        fileNamePrefix={
          printModalMode === 'tardinessLetter'
            ? `Surat_Panggilan_${student.name.replace(/\s+/g, '_')}`
            : `SIPERSIS_Siswa_${student.name.replace(/\s+/g, '_')}`
        }
        appConfig={appConfig}
        currentUser={currentUser}
        users={users}
        onClose={() => setPrintModalMode(null)}
        onSaveDefaultSettings={onSavePrintSettings}
        defaultOverrides={draftPrintSettings}
        onSettingsChange={setDraftPrintSettings}
        buildPdfDoc={async (settings) => {
          if (printModalMode === 'tardinessLetter') {
            return buildTardinessLetterPdfDoc(student, tardinessInfo, appConfig, currentUser, settings);
          }
          return buildStudentDetailPdfDoc(settings);
        }}
      />
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 print:hidden" 
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">Bukti Foto / Gambar</h4>
                  <p className="text-[11px] text-slate-400">Siswa: {student.name} ({student.class})</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(previewImage)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-blue-900/30"
                  title="Unduh File Gambar Ini"
                >
                  <ArrowDownCircle className="w-4 h-4" /> Unduh Gambar
                </button>
                <button
                  onClick={() => window.open(previewImage, '_blank')}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition"
                  title="Buka di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl transition"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img 
                src={previewImage} 
                alt="Bukti Foto" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl" 
              />
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-between px-6">
              <span>Format: PNG, JPG, JPEG, WebP</span>
              <button 
                onClick={() => handleDownloadImage(previewImage)}
                className="text-blue-400 hover:underline font-semibold flex items-center gap-1"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" /> Simpan Gambar ke Komputer / HP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetailModal;