import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { ViolationRecord, Student, ViolationCategory, AppTheme, AppConfig, User, UserActivityLog, UserRole, PrintDocumentSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FileSpreadsheet, Trash2, Printer, Filter, X, Image as ImageIcon, ExternalLink, AlertCircle, TrendingUp, Users, AlertTriangle, List, User as UserIcon, School, Calendar, ArrowDownCircle, Bell, BellRing, Clock, FileText, Volume2, ShieldAlert, Activity, ChevronRight, ShieldCheck, FileDown, Sliders } from 'lucide-react';
import { CLASS_LIST } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAllTardinessSummary, buildTardinessLetterPdfDoc, buildAllTardinessRecapPdfDoc, StudentTardinessInfo, playAlarmSound, isTardinessRecord } from '../utils/tardiness';
import { downloadImageFile } from '../utils/evidenceImages';
import { UserActivityHistory } from './UserActivityHistory';
import { formatRelativeTime, getActionLabel } from '../utils/activityLogger';
import ConfirmModal from './ConfirmModal';
import { KopSurat } from './KopSurat';
import { SignatureLayoutEditor } from './SignatureLayoutEditor';
import { drawPdfKopSurat, drawPdfSignatures, getPdfFontFamily, resolvePrintSettings } from '../utils/pdfKop';
import PrintPreviewModal from './PrintPreviewModal';
import PrintSettingsPanel from './PrintSettingsPanel';
import { exportRowsToSpreadsheet } from '../utils/exportHelpers';
import { getDefaultUserAvatar, getUserAvatar } from '../utils/avatarHelpers';
import { loadStudentPdfPhoto, PdfImageAsset } from '../utils/pdfImages';
import { StudentAvatar } from './StudentAvatar';

interface DashboardProps {
  violations: ViolationRecord[];
  students: Student[];
  onDelete: (id: string) => void;
  onViewStudent: (student: Student) => void;
  theme: AppTheme;
  appConfig: AppConfig;
  currentUser: User;
  onNavigateTab?: (tab: 'dashboard' | 'input' | 'students' | 'evidence' | 'reports' | 'settings') => void;
  activities?: UserActivityLog[];
  onClearActivities?: () => void;
  users?: User[];
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

type RecapMode = 'all' | 'class' | 'student';

const Dashboard: React.FC<DashboardProps> = ({ 
  violations, 
  students, 
  onDelete, 
  onViewStudent, 
  theme, 
  appConfig, 
  currentUser, 
  onNavigateTab,
  activities = [],
  onClearActivities,
  users = [],
  onSavePrintSettings
}) => {
  // Admin Sub-Tab State: 'overview' (rekap/grafik) or 'activities' (log riwayat aktivitas)
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'activities'>('overview');

  // Recap Mode State
  const [recapMode, setRecapMode] = useState<RecapMode>('all');

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStudentName, setFilterStudentName] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; studentId?: string; studentName: string; violationName: string } | null>(null);

  // Tardiness Monitoring State
  const [showTardinessSection, setShowTardinessSection] = useState(false);
  const [tardinessFilterOnlyAlarm, setTardinessFilterOnlyAlarm] = useState(false);

  // Pre-Print Configuration State (Kop, Spasi, TTD & Font before Pratinjau & Cetak)
  const [showPrePrintPanel, setShowPrePrintPanel] = useState(false);
  const [showTardinessPrePrintPanel, setShowTardinessPrePrintPanel] = useState(false);
  const [draftPrintSettings, setDraftPrintSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(appConfig, currentUser, users)
  );

  useEffect(() => {
    setDraftPrintSettings(resolvePrintSettings(appConfig, currentUser, users));
  }, [appConfig, currentUser, users]);

  // Compute all students tardiness summary
  const allTardiness = useMemo(() => {
    return getAllTardinessSummary(students, violations);
  }, [students, violations]);

  const alarmTardiness = useMemo(() => {
    return allTardiness.filter(t => t.isAlarm);
  }, [allTardiness]);

  const displayedTardiness = useMemo(() => {
    if (tardinessFilterOnlyAlarm) {
      return allTardiness.filter(t => t.isAlarm);
    }
    return allTardiness;
  }, [allTardiness, tardinessFilterOnlyAlarm]);

  // Auto-switch mode logic when manual filters are used
  useEffect(() => {
     if (filterStudentName && recapMode !== 'student') setRecapMode('student');
     else if (filterClass && !filterStudentName && recapMode !== 'class') setRecapMode('class');
     else if (!filterClass && !filterStudentName && recapMode !== 'all') setRecapMode('all');
  }, [filterClass, filterStudentName]);

  // Handle Mode Change (Resets filters accordingly)
  const handleModeChange = (mode: RecapMode) => {
    setRecapMode(mode);
    if (mode === 'all') {
      setFilterClass('');
      setFilterStudentName('');
    } else if (mode === 'class') {
      setFilterStudentName('');
      if (!filterClass) setFilterClass(CLASS_LIST[0]); // Default to first class
    } else if (mode === 'student') {
      setFilterClass(''); // Allow searching across all classes
      // Keep existing student name or leave blank
    }
  };

  // Filter Logic
  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      const vDate = new Date(v.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && vDate < start) return false;
      if (end) {
         const endOfDay = new Date(end);
         endOfDay.setHours(23, 59, 59, 999);
         if (vDate > endOfDay) return false;
      }
      if (filterClass && v.studentClass !== filterClass) return false;
      if (filterCategory && v.category !== filterCategory) return false;
      if (filterStudentName && !v.studentName.toLowerCase().includes(filterStudentName.toLowerCase())) return false;

      return true;
    });
  }, [violations, startDate, endDate, filterClass, filterCategory, filterStudentName]);

  
  // Stats & Data for Specific Modes
  const totalViolations = filteredViolations.length;
  const totalPoints = filteredViolations.reduce((acc, curr) => acc + curr.points, 0);
  
  // Specific Data for Print Header
  const selectedStudentData = recapMode === 'student' && filterStudentName 
    ? students.find(s => s.name.toLowerCase().includes(filterStudentName.toLowerCase())) 
    : null;

  const mostViolatedClass = filteredViolations.length > 0 
    ? Object.entries(filteredViolations.reduce((acc: Record<string, number>, v) => ({...acc, [v.studentClass]: (acc[v.studentClass] || 0) + 1}), {} as Record<string, number>))
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] 
    : '-';

  // Chart Data: Trend
  const violationsByDate = filteredViolations.reduce((acc: Record<string, number>, curr) => {
    const date = new Date(curr.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(violationsByDate).map(date => ({
    date,
    count: violationsByDate[date]
  }));

  // Chart Data: Student Point Distribution (Global Context)
  const distributionData = [
    { name: 'Berprestasi (<0)', count: students.filter(s => s.totalPoints < 0).length, fill: '#10b981' }, // Emerald
    { name: 'Sangat Baik (0)', count: students.filter(s => s.totalPoints === 0).length, fill: '#3b82f6' }, // Blue
    { name: 'Perlu Perhatian (1-25)', count: students.filter(s => s.totalPoints > 0 && s.totalPoints <= 25).length, fill: '#facc15' }, // Yellow
    { name: 'Waspada (26-50)', count: students.filter(s => s.totalPoints > 25 && s.totalPoints <= 50).length, fill: '#f97316' }, // Orange
    { name: 'Bahaya / SP (>50)', count: students.filter(s => s.totalPoints > 50).length, fill: '#ef4444' }, // Red
  ];

  // Handlers
  const handleDownloadExcel = () => {
    if (filteredViolations.length === 0) {
      toast.error("Tidak ada data untuk diunduh.");
      return;
    }

    const dataToExport = filteredViolations.map(v => {
      const student = students.find(s => s.id === v.studentId);
      return {
        "Tahun Ajaran": v.academicYear || appConfig.academicYear,
        "Tanggal": new Date(v.date).toLocaleDateString('id-ID'),
        "Waktu": new Date(v.date).toLocaleTimeString('id-ID'),
        "Nama Siswa": v.studentName,
        "JK": student ? student.gender : '-',
        "Kelas": v.studentClass,
        "Kategori": v.category,
        "Deskripsi": v.description,
        "Poin": v.points,
        "Pelapor": v.reporterName,
        "Ada Bukti": v.evidenceUrl ? 'Ya' : 'Tidak'
      };
    });

    exportRowsToSpreadsheet(
      dataToExport,
      "Laporan Pelanggaran",
      `Rekap_Pelanggaran_${new Date().toISOString().split('T')[0]}`,
      [16, 12, 10, 24, 6, 12, 16, 40, 8, 18, 10],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${dataToExport.length} data rekap (.xls)!`);
  };

  const handleDownloadTardinessXls = () => {
    if (displayedTardiness.length === 0) {
      toast.error("Tidak ada data keterlambatan untuk diunduh.");
      return;
    }
    const rows = displayedTardiness.map((item, idx) => ({
      No: idx + 1,
      "Nama Siswa": item.studentName,
      Kelas: item.studentClass,
      "Frekuensi Terlambat": item.count,
      Status: item.statusLabel,
      "Terakhir Terlambat": item.lastDate ? new Date(item.lastDate).toLocaleDateString('id-ID') : '-',
      "Tindakan Rekomendasi": item.actionRequired,
    }));
    exportRowsToSpreadsheet(
      rows,
      "Rekap Keterlambatan",
      `Rekap_Keterlambatan_${new Date().toISOString().split('T')[0]}`,
      [6, 26, 12, 18, 22, 18, 38],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${rows.length} data keterlambatan (.xls)!`);
  };

  const handleDirectDownloadTardinessPdf = async () => {
    if (allTardiness.length === 0) {
      toast.error("Tidak ada data keterlambatan untuk diunduh.");
      return;
    }
    try {
      toast.info("Mengunduh PDF Rekapitulasi Keterlambatan...");
      const doc = await buildAllTardinessRecapPdfDoc(allTardiness, appConfig, currentUser, draftPrintSettings, students);
      doc.save(`Rekap_Keterlambatan_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF Rekapitulasi Keterlambatan berhasil diunduh.");
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengunduh PDF rekapitulasi keterlambatan.");
    }
  };

  type PrintModalMode =
    | null
    | { type: 'recap' }
    | { type: 'tardinessRecap' }
    | { type: 'tardinessLetter'; info: StudentTardinessInfo; student: Student };

  const [printModalMode, setPrintModalMode] = useState<PrintModalMode>(null);

  const handlePrintTardinessLetter = (info: StudentTardinessInfo) => {
    const student = students.find(s => s.id === info.studentId);
    if (!student) {
      toast.error("Data siswa tidak ditemukan.");
      return;
    }
    setPrintModalMode({ type: 'tardinessLetter', info, student });
  };

  const handlePrintAllTardinessRecap = () => {
    if (allTardiness.length === 0) {
      toast.error("Tidak ada data keterlambatan untuk dicetak.");
      return;
    }
    setPrintModalMode({ type: 'tardinessRecap' });
  };

  const defaultShowPoints = draftPrintSettings.showPoints !== false;

  const buildRecapPdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || draftPrintSettings;
    const showPoints = settings.showPoints !== false;
    const font = getPdfFontFamily(settings.documentFontFamily);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Kop Surat Resmi
    const currentY = await drawPdfKopSurat(doc, appConfig, 8, settings);

    // Title
    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    let title = "LAPORAN REKAPITULASI KESELURUHAN";
    if (recapMode === 'student') title = "LAPORAN KEDISIPLINAN SISWA (INDIVIDU)";
    else if (recapMode === 'class') title = `LAPORAN REKAPITULASI KELAS ${filterClass}`;
    doc.text(title, pageWidth / 2, currentY + 6, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    const periodeStr = (startDate || endDate) 
      ? `Periode: ${startDate ? new Date(startDate).toLocaleDateString('id-ID') : 'Awal'} s/d ${endDate ? new Date(endDate).toLocaleDateString('id-ID') : 'Sekarang'}`
      : `Tahun Ajaran: ${appConfig.academicYear}`;
    doc.text(periodeStr, pageWidth / 2, currentY + 11, { align: 'center' });

    // Individual Data
    let tableStartY = currentY + 18;
    if (recapMode === 'student' && selectedStudentData) {
      const selectedPhoto = await loadStudentPdfPhoto(selectedStudentData);
      doc.setFontSize(10);
      doc.setFont(font, 'bold');
      doc.text("BIODATA SISWA", 15, tableStartY);

      const bioX = selectedPhoto ? 39 : 15;
      if (selectedPhoto) {
        const photoX = 15;
        const photoY = tableStartY + 3.5;
        const photoW = 19;
        const photoH = 24;
        try {
          doc.setFillColor(248, 250, 252);
          doc.rect(photoX - 0.5, photoY - 0.5, photoW + 1, photoH + 1, 'F');
          doc.addImage(selectedPhoto.dataUrl, selectedPhoto.format, photoX, photoY, photoW, photoH);
          doc.setDrawColor(203, 213, 225);
          doc.rect(photoX - 0.5, photoY - 0.5, photoW + 1, photoH + 1, 'S');
        } catch {
          // ignore
        }
      }

      const bioMaxW = pageWidth - bioX - (showPoints ? 50 : 15);
      doc.setFont(font, 'normal');
      doc.setFontSize(9);
      doc.text(`Nama Lengkap  : ${selectedStudentData.name}`, bioX, tableStartY + 7, { maxWidth: bioMaxW });
      doc.text(`NIS / NISN    : ${selectedStudentData.nis} / ${selectedStudentData.nisn || '-'}`, bioX, tableStartY + 12, { maxWidth: bioMaxW });
      doc.text(`Kelas / Absen : ${selectedStudentData.class} (No. Absen: ${selectedStudentData.absenNumber || '-'}) | Status: ${selectedStudentData.status || 'Aktif'}`, bioX, tableStartY + 17, { maxWidth: pageWidth - bioX - 15 });
      doc.text(`Wali Kelas    : ${selectedStudentData.waliKelas || '-'} | Guru BK: ${selectedStudentData.guruBk || '-'}`, bioX, tableStartY + 22, { maxWidth: pageWidth - bioX - 15 });
      
      if (showPoints) {
        doc.setFont(font, 'bold');
        doc.text(`TOTAL POIN : ${selectedStudentData.totalPoints}`, pageWidth - 15, tableStartY + 7, { align: 'right' });
      }
      
      tableStartY += 32;
    }

    if (recapMode === 'student') {
      const headers = showPoints
        ? ["Tanggal", "Kategori & Deskripsi", "Poin"]
        : ["Tanggal", "Kategori & Deskripsi"];
      const body = filteredViolations.map(v => {
        const row: any[] = [
          new Date(v.date).toLocaleDateString('id-ID'),
          `${v.category}\n${v.description}`,
        ];
        if (showPoints) {
          row.push(v.points > 0 ? `+${v.points}` : v.points);
        }
        return row;
      });
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 'auto' },
      };
      if (showPoints) {
        columnStyles[2] = { cellWidth: 16, halign: 'center', fontStyle: 'bold' };
      }

      autoTable(doc, {
        startY: tableStartY,
        head: [headers],
        body,
        theme: 'grid',
        styles: { font, fontSize: 8, cellPadding: 3 },
        headStyles: { font, fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles,
      });
    } else {
      const studentMap = new Map<string, Student>();
      students.forEach(s => studentMap.set(s.id, s));
      const photoMap = new Map<string, PdfImageAsset | null>();
      await Promise.all(
        filteredViolations.map(async (v) => {
          if (!photoMap.has(v.studentId)) {
            const stu = studentMap.get(v.studentId);
            const asset = await loadStudentPdfPhoto(stu || { gender: 'L' });
            photoMap.set(v.studentId, asset);
          }
        })
      );

      const headers = showPoints
        ? ["Tanggal", "Foto", "Siswa", "Kelas", "Kategori & Deskripsi", "Poin"]
        : ["Tanggal", "Foto", "Siswa", "Kelas", "Kategori & Deskripsi"];
      const body = filteredViolations.map(v => {
        const row: any[] = [
          new Date(v.date).toLocaleDateString('id-ID'),
          '',
          v.studentName,
          v.studentClass,
          `${v.category}\n${v.description}`,
        ];
        if (showPoints) {
          row.push(v.points > 0 ? `+${v.points}` : v.points);
        }
        return row;
      });

      const columnStyles: Record<number, any> = {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 34, fontStyle: 'bold' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 'auto' },
      };
      if (showPoints) {
        columnStyles[5] = { cellWidth: 14, halign: 'center', fontStyle: 'bold' };
      }

      autoTable(doc, {
        startY: tableStartY,
        head: [headers],
        body,
        theme: 'grid',
        styles: { font, fontSize: 8, cellPadding: 2, valign: 'middle', minCellHeight: 16 },
        headStyles: { font, fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', halign: 'center', minCellHeight: 8 },
        columnStyles,
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 1) return;
          const v = filteredViolations[data.row.index];
          if (!v) return;
          const asset = photoMap.get(v.studentId);
          if (!asset) return;
          const boxW = Math.min(10, data.cell.width - 3);
          const boxH = Math.min(13, data.cell.height - 2.5);
          const x = data.cell.x + (data.cell.width - boxW) / 2;
          const y = data.cell.y + (data.cell.height - boxH) / 2;
          try {
            doc.addImage(asset.dataUrl, asset.format, x, y, boxW, boxH);
          } catch {
            // ignore
          }
        },
      });
    }

    // Footer / Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 14;
    drawPdfSignatures(doc, settings, appConfig, finalY);

    return doc;
  };

  const handlePrint = () => {
    setPrintModalMode({ type: 'recap' });
  };

  const handleDirectDownloadPdf = async () => {
    if (filteredViolations.length === 0) {
      toast.error("Tidak ada data untuk diunduh.");
      return;
    }
    try {
      const doc = await buildRecapPdfDoc(draftPrintSettings);
      doc.save(`SIPERSIS_Rekap_${recapMode}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF rekapitulasi berhasil diunduh.");
    } catch (error) {
      console.error("PDF download failed:", error);
      toast.error("Gagal mengunduh PDF. Silakan coba lagi.");
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterClass('');
    setFilterCategory('');
    setFilterStudentName('');
    setRecapMode('all');
  };

  const isExternalLink = (url: string | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('http') || url.startsWith('www');
  };

  const getStudentById = (id: string) => students.find(s => s.id === id);

  const handleDownloadImage = async (url: string) => {
    try {
      await downloadImageFile(url, `bukti-pelanggaran-${Date.now()}.jpg`);
      toast.success("Foto berhasil diunduh ke komputer / HP!");
    } catch (err) {
      console.error(err);
      window.open(url, '_blank');
      toast.info("Gambar dibuka di tab baru.");
    }
  };

  const handleEvidenceClick = (url: string) => {
    setPreviewImage(url);
  };

  return (
    <div className="space-y-6 print:space-y-4 print:w-full">
      {/* KOP SURAT (Only Visible on Print) */}
      {draftPrintSettings.showKop && (
        <div className="hidden print:block p-8">
          <KopSurat appConfig={appConfig} printSettings={draftPrintSettings} showBorder={true} />
        </div>
      )}

      {/* ALARM KETERLAMBATAN BANNER (Hidden on Print) */}
      {alarmTardiness.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-red-500/30 print:hidden animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-sm animate-pulse flex-shrink-0 shadow-inner">
              <BellRing className="w-7 h-7 text-yellow-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-yellow-400 text-red-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  🚨 Alarm Kedisiplinan Aktif
                </span>
                <span className="font-black text-lg text-white drop-shadow-sm">
                  {alarmTardiness.length} Siswa Terlambat ≥3x / Kelipatannya
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-1 max-w-2xl leading-relaxed">
                Terdeteksi siswa yang telah melampaui batas toleransi keterlambatan 3x atau kelipatannya (3x, 6x, 9x+). Diperlukan tindakan pemanggilan orang tua dan pembinaan konseling BK.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <button
              onClick={() => {
                playAlarmSound();
                toast.info("Memutar nada peringatan keterlambatan.");
              }}
              className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold flex items-center gap-2 transition border border-white/20 shadow-sm"
              title="Uji Bunyi Alarm Keterlambatan"
            >
              <Volume2 className="w-4 h-4 text-yellow-300" /> Bunyi Alarm
            </button>
            <button
              onClick={() => setShowTardinessSection(prev => !prev)}
              className="px-4 py-2.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-md"
            >
              <Clock className="w-4 h-4 text-red-600" /> {showTardinessSection ? 'Tutup Riwayat' : 'Lihat Riwayat Terlambat'}
            </button>
          </div>
        </div>
      )}

      {/* ADMIN DASHBOARD VIEW TOGGLE (Only for Admin) */}
      {currentUser.role === UserRole.ADMIN && (
        <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 print:hidden">
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setDashboardSubTab('overview')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all ${
                dashboardSubTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Statistik &amp; Rekap</span>
            </button>
            <button
              onClick={() => setDashboardSubTab('activities')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all ${
                dashboardSubTab === 'activities'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                  : 'text-slate-500 hover:text-purple-700'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span className="truncate">Log Aktivitas</span>
              {activities.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black shrink-0 ${
                  dashboardSubTab === 'activities' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}>
                  {activities.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 px-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Mode Admin Aktif
            </span>
            <span className="text-slate-300 hidden md:inline">•</span>
            <span className="text-[11px] text-slate-400 font-medium">
              {activities.length} total aksi terlacak
            </span>
          </div>
        </div>
      )}

      {currentUser.role === UserRole.ADMIN && dashboardSubTab === 'activities' ? (
        <UserActivityHistory 
          activities={activities}
          onClearActivities={onClearActivities}
          theme={theme}
          currentUser={currentUser}
          users={users}
          appConfig={appConfig}
          onSavePrintSettings={onSavePrintSettings}
        />
      ) : (
        <>
      {/* FILTER & MODE SELECTION (Hidden on Print) */}
      <div className={`bg-white p-4 sm:p-6 rounded-2xl shadow-lg border ${theme.sidebar} print:hidden`}>
        {/* Mode Selector Tabs */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center mb-5 sm:mb-6 gap-3.5 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 bg-gradient-to-br ${theme.gradient} rounded-lg shadow-sm shrink-0`}>
               <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-800 text-base sm:text-lg">Filter &amp; Format Data</h4>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  TA {appConfig.academicYear}
                </span>
              </div>
              <p className="text-xs text-slate-500">Pilih mode tampilan untuk cetak laporan</p>
            </div>
          </div>
          
          <div className="w-full lg:w-auto grid grid-cols-3 lg:flex bg-slate-100 p-1 rounded-xl gap-1">
             <button 
                onClick={() => handleModeChange('all')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${recapMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <List className="w-4 h-4 shrink-0" /> <span className="truncate">Semua</span>
             </button>
             <button 
                onClick={() => handleModeChange('class')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${recapMode === 'class' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <School className="w-4 h-4 shrink-0" /> <span className="truncate">Per Kelas</span>
             </button>
             <button 
                onClick={() => handleModeChange('student')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${recapMode === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                <UserIcon className="w-4 h-4 shrink-0" /> <span className="truncate">Individu</span>
             </button>
          </div>
        </div>

        {/* Dynamic Filters based on Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div>
             <label className="block text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Dari Tanggal</label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <input 
                  type="date" 
                  className="w-full text-sm pl-9 p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-blue-50 text-blue-900 font-semibold shadow-sm cursor-pointer hover:bg-blue-100 transition-colors"
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                />
             </div>
          </div>
          <div>
             <label className="block text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Sampai Tanggal</label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <input 
                  type="date" 
                  className="w-full text-sm pl-9 p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-blue-50 text-blue-900 font-semibold shadow-sm cursor-pointer hover:bg-blue-100 transition-colors"
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                />
             </div>
          </div>
          
          {/* Class Filter - Highlighted if Mode is Class */}
          <div className={recapMode === 'class' ? 'relative' : ''}>
             {recapMode === 'class' && <span className="absolute -top-2 right-0 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse">Wajib Pilih</span>}
             <label className={`block text-xs font-bold uppercase tracking-wide mb-1 ${recapMode === 'class' ? 'text-blue-600' : 'text-slate-500'}`}>Kelas</label>
             <select 
                className={`w-full text-sm p-3 border rounded-xl focus:ring-2 transition-colors ${recapMode === 'class' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100 font-semibold text-blue-900' : 'border-slate-200 bg-slate-50'}`} 
                value={filterClass} 
                onChange={e => setFilterClass(e.target.value)}
             >
               <option value="">{recapMode === 'class' ? '-- Pilih Kelas --' : 'Semua Kelas'}</option>
               {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          
          {/* Category Filter */}
          <div>
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Kategori</label>
             <select className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-300 bg-slate-50 text-slate-900" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
               <option value="">Semua Kategori</option>
               {Object.values(ViolationCategory).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          
          {/* Student Filter - Highlighted if Mode is Student */}
          <div className={recapMode === 'student' ? 'relative' : ''}>
             {recapMode === 'student' && <span className="absolute -top-2 right-0 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse">Wajib Isi</span>}
             <label className={`block text-xs font-bold uppercase tracking-wide mb-1 ${recapMode === 'student' ? 'text-blue-600' : 'text-slate-500'}`}>Nama Siswa</label>
             <input 
                type="text" 
                list="student-suggestions"
                placeholder="Cari nama..." 
                className={`w-full text-sm p-3 border rounded-xl focus:ring-2 transition-colors ${recapMode === 'student' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100 font-semibold text-blue-900' : 'border-slate-200 bg-slate-50'}`} 
                value={filterStudentName} 
                onChange={e => setFilterStudentName(e.target.value)} 
             />
             <datalist id="student-suggestions">
                {students.map(s => (
                  <option key={s.id} value={s.name}>{s.class} - {s.nis}</option>
                ))}
             </datalist>
             {filterStudentName.trim() && (() => {
               const matched = selectedStudentData || students.find(s => s.name.toLowerCase().includes(filterStudentName.trim().toLowerCase()));
               if (!matched) return null;
               return (
                 <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
                   <StudentAvatar student={matched} sizeClass="w-6 h-6" />
                   <div className="min-w-0 leading-tight">
                     <div className="text-[11px] font-bold text-blue-900 truncate">{matched.name}</div>
                     <div className="text-[10px] text-blue-600">{matched.class} • NIS {matched.nis}</div>
                   </div>
                 </div>
               );
             })()}
          </div>
        </div>
        
        {/* Reset Button */}
        {(startDate || endDate || filterClass || filterCategory || filterStudentName) && (
            <div className="mt-4 flex justify-end">
               <button onClick={clearFilters} className="text-xs text-rose-500 flex items-center gap-1 hover:underline font-bold bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 transition-colors">
                 <X className="w-3 h-3" /> Reset Filter & Mode
               </button>
            </div>
        )}
      </div>

      {/* Stats Cards - Hidden on Print */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 print:hidden">
        <div className={`bg-gradient-to-br ${theme.gradient} p-5 sm:p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform`}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <FileSpreadsheet className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <span className="p-2 bg-white/20 rounded-lg"><TrendingUp className="w-4 h-4 text-white" /></span>
               <p className="text-white/80 text-sm font-bold uppercase tracking-wide">Total Laporan</p>
            </div>
            <h3 className="text-4xl font-black">{totalViolations}</h3>
            <p className="text-xs text-white/80 mt-2 opacity-80">Pelanggaran & Prestasi tercatat</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <AlertTriangle className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <span className="p-2 bg-white/20 rounded-lg"><AlertCircle className="w-4 h-4 text-white" /></span>
               <p className="text-violet-100 text-sm font-bold uppercase tracking-wide">Poin Terakumulasi</p>
            </div>
            <h3 className="text-4xl font-black">{totalPoints}</h3>
            <p className="text-xs text-violet-100 mt-2 opacity-80">Total poin pelanggaran aktif</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Users className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <span className="p-2 bg-white/20 rounded-lg"><Users className="w-4 h-4 text-white" /></span>
               <p className="text-amber-100 text-sm font-bold uppercase tracking-wide">Kelas Terbanyak</p>
            </div>
            <h3 className="text-4xl font-black">{mostViolatedClass}</h3>
            <p className="text-xs text-amber-100 mt-2 opacity-80">Kelas dengan laporan tertinggi</p>
          </div>
        </div>

        <div 
          onClick={() => setShowTardinessSection(true)}
          className={`p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer ${
            alarmTardiness.length > 0 
              ? 'bg-gradient-to-br from-red-600 to-rose-700 ring-2 ring-red-400/50' 
              : 'bg-gradient-to-br from-slate-600 to-slate-700'
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Clock className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-2">
               <div className="flex items-center gap-2">
                 <span className={`p-2 rounded-lg ${alarmTardiness.length > 0 ? 'bg-white/20 text-yellow-300 animate-pulse' : 'bg-white/20 text-white'}`}>
                   <BellRing className="w-4 h-4" />
                 </span>
                 <p className="text-white/90 text-sm font-bold uppercase tracking-wide">Alarm Terlambat</p>
               </div>
               {alarmTardiness.length > 0 && (
                 <span className="text-[10px] font-black bg-yellow-400 text-red-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                   Aktif
                 </span>
               )}
            </div>
            <h3 className="text-4xl font-black flex items-baseline gap-2">
              {alarmTardiness.length}
              <span className="text-xs font-normal opacity-80">siswa (≥3x)</span>
            </h3>
            <p className="text-xs text-white/80 mt-2 flex items-center justify-between">
              <span>{allTardiness.length} siswa pernah telat</span>
              <span className="underline font-bold text-white group-hover:translate-x-0.5 transition-transform">Detail &rarr;</span>
            </p>
          </div>
        </div>
      </div>

      {/* Charts - Hidden on Print */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:hidden">
         {/* Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <h4 className="font-bold text-slate-800 mb-6 text-lg flex items-center gap-2">
            <span className={`w-1 h-6 bg-${theme.primary}-500 rounded-full`}></span> Tren Pelanggaran (Harian)
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#64748b'}} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={12} tick={{fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="url(#colorGradient)" />
                   ))}
                </Bar>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Distribution Chart (NEW) */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <h4 className="font-bold text-slate-800 mb-6 text-lg flex items-center gap-2">
             <span className={`w-1 h-6 bg-${theme.secondary}-500 rounded-full`}></span> Distribusi Kondisi Siswa
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis dataKey="name" type="category" width={140} fontSize={11} tick={{fill: '#475569', fontWeight: 600}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={36}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RIWAYAT SISWA SERING TERLAMBAT & SISTEM ALARM (Hidden on Print) */}
      <div id="tardiness-section" className="bg-white rounded-2xl shadow-xl border border-rose-100 overflow-hidden print:hidden transition-all">
        <div className="p-4 sm:p-6 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-red-50/50 to-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${alarmTardiness.length > 0 ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-200' : 'bg-rose-100 text-rose-600'}`}>
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                  Riwayat Siswa Sering Terlambat & Sistem Alarm
                </h4>
                {alarmTardiness.length > 0 && (
                  <span className="bg-red-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full shadow-sm animate-bounce">
                    {alarmTardiness.length} ALARM AKTIF
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring khusus siswa terlambat. Sistem memicu alarm dan tindakan khusus untuk siswa yang mencapai 3x, 6x, 9x, atau lebih.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => setTardinessFilterOnlyAlarm(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                tardinessFilterOnlyAlarm 
                  ? 'bg-red-600 text-white border-red-700 shadow-sm' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {tardinessFilterOnlyAlarm ? 'Tampilkan Semua' : 'Filter Alarm (≥3x) Saja'}
            </button>
            <button
              onClick={handleDownloadTardinessXls}
              className="px-3.5 py-2 bg-white hover:bg-teal-50 border border-teal-200 text-teal-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Unduh rekap keterlambatan dalam format Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh XLS
            </button>
            <button
              type="button"
              onClick={() => setShowTardinessPrePrintPanel((v) => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5 cursor-pointer ${
                showTardinessPrePrintPanel
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200'
              }`}
              title="Atur Kop Surat, Spasi, TTD & Font sebelum Pratinjau atau Cetak"
            >
              <Sliders className="w-3.5 h-3.5" /> Atur Kop, Spasi &amp; TTD
            </button>
            <button
              onClick={handleDirectDownloadTardinessPdf}
              className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Unduh langsung PDF Rekap Keterlambatan"
            >
              <FileDown className="w-3.5 h-3.5" /> Unduh PDF
            </button>
            <button
              onClick={handlePrintAllTardinessRecap}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" /> Cetak Rekap Keterlambatan
            </button>
            <button
              onClick={() => {
                playAlarmSound();
                toast.info("Memutar nada alarm...");
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Uji Nada Alarm"
            >
              <Volume2 className="w-3.5 h-3.5 text-rose-600" /> Uji Alarm
            </button>
          </div>
        </div>

        {/* Inline Pre-Print Kop, Spasi & TTD Settings Panel (Tardiness) */}
        {showTardinessPrePrintPanel && (
          <div className="border-b border-indigo-100 bg-slate-50/80 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
            <div className="lg:col-span-5">
              <PrintSettingsPanel
                settings={draftPrintSettings}
                onChange={setDraftPrintSettings}
                appConfig={appConfig}
                currentUser={currentUser}
                users={users}
                onSaveDefaultSettings={onSavePrintSettings}
                showFooterActions
                className="rounded-2xl border border-slate-200 max-h-[500px]"
              />
            </div>
            <div className="lg:col-span-7 flex flex-col justify-between gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs overflow-x-auto space-y-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Pratinjau Kop Surat &amp; TTD Sebelum Cetak Keterlambatan
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Spasi: {(draftPrintSettings.kopStyle.lineSpacing ?? 1).toFixed(1)}x • Bawah: {draftPrintSettings.kopStyle.bottomSpacing ?? 6} mm
                  </span>
                </div>
                {draftPrintSettings.showKop ? (
                  <div className="min-w-[480px] sm:min-w-0">
                    <KopSurat appConfig={appConfig} printSettings={draftPrintSettings} showBorder />
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Kop Surat dinonaktifkan pada dokumen ini.
                  </div>
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
                  onClick={handleDirectDownloadTardinessPdf}
                  className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" /> Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrintAllTardinessRecap}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Pratinjau Lengkap &amp; Cetak PDF
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {displayedTardiness.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h5 className="font-bold text-slate-700 text-base">Tidak Ada Siswa Terkena Alarm</h5>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {tardinessFilterOnlyAlarm 
                  ? 'Tidak ada siswa yang telah mencapai batas alarm keterlambatan (≥3x).'
                  : 'Belum ada catatan keterlambatan siswa di sistem SiPerSis.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5 rounded-tl-xl w-12 text-center">No</th>
                    <th className="px-4 py-3.5">Nama Siswa</th>
                    <th className="px-4 py-3.5">Kelas</th>
                    <th className="px-4 py-3.5 text-center">Frekuensi Terlambat</th>
                    <th className="px-4 py-3.5">Status & Alarm</th>
                    <th className="px-4 py-3.5">Terakhir Terlambat</th>
                    <th className="px-4 py-3.5">Tindakan Rekomendasi</th>
                    <th className="px-4 py-3.5 text-right rounded-tr-xl">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedTardiness.map((item, idx) => {
                    const student = students.find(s => s.id === item.studentId);
                    return (
                      <tr 
                        key={item.studentId} 
                        className={`hover:bg-rose-50/40 transition-colors ${
                          item.isMultipleOfThree ? 'bg-red-50/50' : item.isAlarm ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-semibold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          <button
                            onClick={() => {
                              if (student) onViewStudent(student);
                            }}
                            className="flex items-center gap-2.5 hover:text-red-600 transition-colors text-left group"
                          >
                            <StudentAvatar student={student} name={item.studentName} sizeClass="w-8 h-8" />
                            <span>{item.studentName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-red-500 transition-opacity" />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                            {item.studentClass}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-sm ${
                            item.count >= 9 
                              ? 'bg-red-600 text-white animate-pulse' 
                              : item.count >= 6
                              ? 'bg-rose-600 text-white'
                              : item.count >= 3
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            {item.count} Kali
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.isAlarm ? (
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-md w-fit ${
                                item.stage === 3 
                                  ? 'bg-red-100 text-red-800 border border-red-200' 
                                  : item.stage === 2
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                <AlertTriangle className="w-3 h-3 text-red-600 animate-spin" />
                                {item.statusLabel}
                              </span>
                              {item.isMultipleOfThree && (
                                <span className="text-[10px] font-extrabold text-red-600">
                                  ★ Kelipatan 3x (Wajib Panggilan Ortu)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-500">
                              Waspada (&lt;3x)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.lastDate ? new Date(item.lastDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-xs leading-relaxed">
                          {item.actionRequired}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.isAlarm && (
                              <button
                                onClick={() => handlePrintTardinessLetter(item)}
                                className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1"
                                title="Cetak Surat Panggilan Orang Tua untuk Keterlambatan"
                              >
                                <FileText className="w-3 h-3" /> Surat Panggilan
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (student) onViewStudent(student);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                            >
                              Lihat Riwayat
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden print:shadow-none print:border-none">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3.5 print:hidden bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-lg sm:text-xl text-slate-800">Rekapitulasi Data</h4>
            {recapMode !== 'all' && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold uppercase">
                Mode: {recapMode === 'class' ? 'Per Kelas' : 'Individu'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full lg:w-auto">
            {onNavigateTab && (
              <button 
                onClick={() => onNavigateTab('evidence')}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3.5 py-2 rounded-xl text-xs sm:text-sm transition shadow-xs font-bold"
                title="Buka Galeri Bukti Foto untuk melihat dan mengunduh semua berkas bukti"
              >
                <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" /> <span className="truncate">Unduh Bukti Foto ({violations.filter(v => v.evidenceUrl).length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrePrintPanel((v) => !v)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm transition shadow-sm font-bold cursor-pointer border ${
                showPrePrintPanel
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
              }`}
              title="Atur Kop Surat, Spasi, TTD & Font sebelum Pratinjau atau Cetak"
            >
              <Sliders className="w-4 h-4 shrink-0" /> <span className="truncate">Atur Kop &amp; TTD</span>
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs sm:text-sm hover:bg-slate-50 transition shadow-sm font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" /> Cetak PDF
            </button>
            <button 
              onClick={handleDirectDownloadPdf}
              className="flex items-center justify-center gap-1.5 sm:gap-2 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm transition shadow-md font-bold cursor-pointer"
              title="Unduh langsung laporan rekapitulasi dalam format PDF"
            >
              <FileDown className="w-4 h-4 shrink-0" /> Unduh PDF
            </button>
            <button 
              onClick={handleDownloadExcel}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r ${theme.button} text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm transition shadow-md font-bold cursor-pointer`}
              title="Unduh laporan rekapitulasi dalam format Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" /> Unduh XLS
            </button>
          </div>
        </div>

        {/* Inline Pre-Print Kop, Spasi & TTD Settings Panel (Rekapitulasi) */}
        {showPrePrintPanel && (
          <div className="border-b border-indigo-100 bg-slate-50/80 p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
            <div className="lg:col-span-5">
              <PrintSettingsPanel
                settings={draftPrintSettings}
                onChange={setDraftPrintSettings}
                appConfig={appConfig}
                currentUser={currentUser}
                users={users}
                onSaveDefaultSettings={onSavePrintSettings}
                showFooterActions
                className="rounded-2xl border border-slate-200 max-h-[500px]"
              />
            </div>
            <div className="lg:col-span-7 flex flex-col justify-between gap-3 min-w-0">
              <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs overflow-x-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Pratinjau Kop Surat &amp; TTD Sebelum Cetak Rekapitulasi
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Spasi: {(draftPrintSettings.kopStyle.lineSpacing ?? 1).toFixed(1)}x • Bawah: {draftPrintSettings.kopStyle.bottomSpacing ?? 6} mm
                  </span>
                </div>
                {draftPrintSettings.showKop ? (
                  <div className="overflow-x-auto pb-1">
                    <div className="min-w-[480px] sm:min-w-0">
                      <KopSurat appConfig={appConfig} printSettings={draftPrintSettings} showBorder />
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Kop Surat dinonaktifkan pada dokumen ini.
                  </div>
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
                  className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" /> Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Pratinjau Lengkap &amp; Cetak PDF
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* DYNAMIC PRINT HEADER BASED ON RECAP MODE */}
        <div className="hidden print:block p-4 mb-4">
          <div className="text-center border-b border-black pb-4 mb-4">
            <h2 className="text-xl font-bold uppercase tracking-wider text-black underline">
              {recapMode === 'student' && filterStudentName 
                ? "LAPORAN KEDISIPLINAN SISWA (INDIVIDU)" 
                : recapMode === 'class' && filterClass 
                  ? `LAPORAN REKAPITULASI KELAS ${filterClass}` 
                  : "LAPORAN REKAPITULASI KESELURUHAN"
              }
            </h2>
            <p className="text-sm text-black mt-2 font-medium">Periode Cetak: {new Date().toLocaleDateString('id-ID', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
          </div>

          {/* Sub-Header for Student Mode (Biodata Style) */}
          {recapMode === 'student' && selectedStudentData && (
             <div className="mb-6 border-b border-dashed border-black pb-4 flex items-start gap-4">
                <StudentAvatar student={selectedStudentData} sizeClass="w-16 h-16" className="rounded-lg border-slate-400 shrink-0" />
                <table className="w-full text-sm font-medium flex-1">
                   <tbody>
                      <tr>
                         <td className="w-32 py-1">Nama Lengkap</td>
                         <td className="w-4">:</td>
                         <td className="font-bold">{selectedStudentData.name}</td>
                         {defaultShowPoints ? (
                           <>
                             <td className="w-32 text-right">Total Poin</td>
                             <td className="w-4 text-center">:</td>
                             <td className={`font-black w-24 text-right ${selectedStudentData.totalPoints >= 50 ? 'text-red-600' : ''}`}>{selectedStudentData.totalPoints}</td>
                           </>
                         ) : (
                           <td colSpan={3}></td>
                         )}
                      </tr>
                      <tr>
                         <td className="py-1">NIS / NISN</td>
                         <td>:</td>
                         <td>{selectedStudentData.nis} / {selectedStudentData.nisn || '-'}</td>
                         <td className="text-right">Jenis Kelamin</td>
                         <td className="text-center">:</td>
                         <td className="text-right">{selectedStudentData.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                      </tr>
                      <tr>
                         <td className="py-1">Kelas / Absen</td>
                         <td>:</td>
                         <td>{selectedStudentData.class} (Absen: {selectedStudentData.absenNumber || '-'})</td>
                         <td className="text-right">Status Siswa</td>
                         <td className="text-center">:</td>
                         <td className="text-right font-bold">{selectedStudentData.status || 'Aktif'}</td>
                      </tr>
                      <tr>
                         <td className="py-1">Wali Kelas</td>
                         <td>:</td>
                         <td>{selectedStudentData.waliKelas || '-'}</td>
                         <td className="text-right">Guru BK</td>
                         <td className="text-center">:</td>
                         <td className="text-right">{selectedStudentData.guruBk || '-'}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
          )}

          {/* Sub-Header for Class Mode */}
          {recapMode === 'class' && filterClass && (
             <div className="mb-6 flex justify-between items-center bg-slate-50 p-2 border border-slate-200">
                <div className="text-sm font-bold">
                   Kelas: <span className="text-lg">{filterClass}</span>
                </div>
                <div className="text-sm">
                   Total Pelanggaran Tercatat: <span className="font-bold">{filteredViolations.length}</span>
                </div>
             </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left print:text-xs">
            <thead className="bg-slate-50/50 text-slate-700 border-b border-slate-200 print:bg-white print:border-black print:border-b-2 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 print:px-2 print:py-2">Tanggal</th>
                {/* Hide Student & Class Columns in Individual Mode Print */}
                <th className={`px-6 py-4 print:px-2 print:py-2 ${recapMode === 'student' ? 'print:hidden' : ''}`}>Siswa</th>
                <th className={`px-6 py-4 print:px-2 print:py-2 ${recapMode === 'student' ? 'print:hidden' : ''}`}>Kelas</th>
                <th className="px-6 py-4 print:px-2 print:py-2">Kategori &amp; Deskripsi</th>
                <th className={`px-6 py-4 text-center print:px-2 print:py-2 ${!defaultShowPoints ? 'print:hidden' : ''}`}>Poin</th>
                <th className="px-6 py-4 text-center print:hidden">Bukti</th>
                <th className="px-6 py-4 text-right print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-black/50">
              {filteredViolations.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic bg-white">Tidak ada data yang cocok dengan filter</td></tr>
              ) : (
                filteredViolations.map((v) => (
                  <tr key={v.id} className="bg-white hover:bg-blue-50/60 transition-colors group print:hover:bg-transparent border-b border-slate-50 last:border-0">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 align-top font-medium print:px-2 print:py-2 print:text-black">
                       {new Date(v.date).toLocaleDateString('id-ID')}
                    </td>
                    
                    {/* Hide Name in Student Mode Print */}
                    <td className={`px-6 py-4 font-bold text-slate-800 align-top print:px-2 print:py-2 print:text-black ${recapMode === 'student' ? 'print:hidden' : ''}`}>
                       <button
                         onClick={() => {
                           const s = getStudentById(v.studentId);
                           if (s) onViewStudent(s);
                         }}
                         className="flex items-center gap-2.5 hover:text-blue-600 hover:underline decoration-blue-300 underline-offset-4 transition-all text-left group/name"
                         title="Lihat Riwayat Siswa"
                       >
                         <StudentAvatar student={getStudentById(v.studentId)} name={v.studentName} sizeClass="w-8 h-8" />
                         <span>{v.studentName}</span>
                         <ExternalLink className="w-3 h-3 text-blue-400 opacity-0 group-hover/name:opacity-100 transition-opacity print:hidden" />
                       </button>
                    </td>

                    {/* Hide Class in Student Mode Print */}
                    <td className={`px-6 py-4 text-slate-600 align-top print:px-2 print:py-2 print:text-black ${recapMode === 'student' ? 'print:hidden' : ''}`}>
                       <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold print:bg-transparent print:p-0">{v.studentClass}</span>
                    </td>
                    
                    <td className="px-6 py-4 max-w-sm align-top print:px-2 print:py-2 print:max-w-none">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`w-fit px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border shadow-sm print:shadow-none print:border print:border-black print:text-black print:bg-transparent
                            ${v.category === ViolationCategory.RINGAN ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              v.category === ViolationCategory.SEDANG ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              v.category === ViolationCategory.BERAT ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-green-50 text-green-700 border-green-200' // Distinct for Prestasi
                            }
                          `}>
                            {v.category}
                          </span>
                          {isTardinessRecord(v) && (
                            <span className="w-fit px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 shadow-sm">
                              <Clock className="w-3 h-3 text-rose-600" /> Keterlambatan
                            </span>
                          )}
                        </div>
                        <span className="text-slate-700 font-medium leading-relaxed print:text-black">{v.description}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-center align-top print:px-2 print:py-2 ${!defaultShowPoints ? 'print:hidden' : ''}`}>
                      <span className={`font-black text-lg print:text-sm print:text-black
                         ${v.points < 0 ? 'text-green-500' : 'text-rose-500'}
                      `}>
                         {v.points > 0 ? `+${v.points}` : v.points}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center align-top print:hidden">
                       {v.evidenceUrl ? (
                         <div className="flex flex-col items-center gap-1">
                           <button 
                             onClick={() => handleEvidenceClick(v.evidenceUrl!)}
                             className="group relative w-11 h-11 rounded-xl overflow-hidden border border-slate-200 shadow-xs hover:ring-2 hover:ring-blue-500 transition-all block"
                             title="Klik untuk melihat foto bukti dalam ukuran penuh"
                           >
                              <img 
                                src={v.evidenceUrl} 
                                alt="Bukti" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="w-3.5 h-3.5 text-white" />
                              </div>
                           </button>
                           <button
                             onClick={() => handleDownloadImage(v.evidenceUrl!)}
                             className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
                             title="Unduh foto bukti ini langsung"
                           >
                             <ArrowDownCircle className="w-3 h-3" /> Unduh
                           </button>
                         </div>
                       ) : (
                         <span className="text-slate-300 text-xs">-</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right print:hidden align-top">
                      <button 
                        onClick={() => setReportToDelete({ id: v.id, studentId: v.studentId, studentName: v.studentName, violationName: v.violationName })} 
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" 
                        title="Hapus Laporan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK PREVIEW WIDGET: RECENT USER ACTIVITIES (Admin only) */}
      {currentUser.role === UserRole.ADMIN && activities.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Riwayat Aktivitas Pengguna Terbaru</h4>
                <p className="text-[11px] text-slate-400">Ringkasan tindakan pengguna terbaru dalam sistem SiPerSis</p>
              </div>
            </div>

            <button
              onClick={() => setDashboardSubTab('activities')}
              className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline"
            >
              Buka Semua Log Aktivitas ({activities.length}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activities.slice(0, 3).map((act) => {
              const badge = getActionLabel(act.action);
              return (
                <div key={act.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-purple-50/40 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        {(() => {
                          const matchedUser = users.find(u => u.id === act.userId);
                          const fallbackUser = matchedUser || { role: act.userRole, name: act.userName, username: '' };
                          const avatarSrc = getUserAvatar({ ...fallbackUser, avatar: act.userAvatar || matchedUser?.avatar });
                          return (
                            <img
                              src={avatarSrc}
                              alt={act.userName}
                              onError={(e) => {
                                const fb = getDefaultUserAvatar(fallbackUser);
                                if (!e.currentTarget.src.endsWith(fb)) {
                                  e.currentTarget.src = fb;
                                }
                              }}
                              className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                          );
                        })()}
                        <span className="text-xs font-bold text-slate-800 truncate">{act.userName}</span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold border shrink-0 ${badge.bg} ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 line-clamp-1">{act.title}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{act.details}</p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatRelativeTime(act.timestamp)}
                    </span>
                    <span className="font-mono text-[9px] truncate max-w-[110px]">{act.device || 'Web Browser'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </>
      )}

       {/* Print Signature Section */}
       <div className="hidden print:flex justify-end items-start mt-8 pr-12 page-break-inside-avoid">
           <div className="text-center w-64">
              <p className="mb-20 font-medium">
                 Kudus, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br/>
                 Mengetahui,<br/>
                 {recapMode === 'student' ? 'Orang Tua / Wali' : (currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK')}
              </p>
              <p className="border-b border-black font-bold uppercase pb-1">
                {recapMode === 'student' ? '( ........................................ )' : currentUser.name}
              </p>
              {recapMode !== 'student' && currentUser.nip && <p className="text-sm mt-1">NIP. {currentUser.nip}</p>}
           </div>
       </div>

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={printModalMode !== null}
        title={
          printModalMode?.type === 'tardinessLetter'
            ? `Surat Panggilan Ortu — ${printModalMode.student.name}`
            : printModalMode?.type === 'tardinessRecap'
            ? 'Pratinjau Rekapitulasi Keterlambatan'
            : 'Pratinjau & Pengaturan Cetak Laporan'
        }
        fileNamePrefix={
          printModalMode?.type === 'tardinessLetter'
            ? `Surat_Panggilan_${printModalMode.student.name.replace(/\s+/g, '_')}`
            : printModalMode?.type === 'tardinessRecap'
            ? 'Rekap_Keterlambatan'
            : `SIPERSIS_Rekap_${recapMode}`
        }
        appConfig={appConfig}
        currentUser={currentUser}
        users={users}
        onClose={() => setPrintModalMode(null)}
        onSaveDefaultSettings={onSavePrintSettings}
        defaultOverrides={draftPrintSettings}
        onSettingsChange={setDraftPrintSettings}
        buildPdfDoc={async (settings) => {
          if (printModalMode?.type === 'tardinessLetter') {
            return buildTardinessLetterPdfDoc(
              printModalMode.student,
              printModalMode.info,
              appConfig,
              currentUser,
              settings
            );
          }
          if (printModalMode?.type === 'tardinessRecap') {
            return buildAllTardinessRecapPdfDoc(allTardiness, appConfig, currentUser, settings, students);
          }
          return buildRecapPdfDoc(settings);
        }}
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 print:hidden" onClick={() => setPreviewImage(null)}>
           <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight">Bukti Foto Pelanggaran / Dokumen</h4>
                    <p className="text-[11px] text-slate-400">Klik tombol unduh untuk menyimpan gambar ke perangkat Anda</p>
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
                  alt="Bukti Pelanggaran" 
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

      {/* Confirm Delete Violation Modal */}
      <ConfirmModal
        isOpen={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        onConfirm={() => {
          if (reportToDelete) {
            onDelete(reportToDelete.id);
            setReportToDelete(null);
          }
        }}
        title="Hapus Laporan / Catatan"
        message={
          <div>
            <p className="mb-2">Apakah Anda yakin ingin menghapus catatan pelanggaran / apresiasi ini?</p>
            {reportToDelete && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                <StudentAvatar
                  student={reportToDelete.studentId ? getStudentById(reportToDelete.studentId) : students.find(s => s.name === reportToDelete.studentName)}
                  name={reportToDelete.studentName}
                  sizeClass="w-9 h-9"
                />
                <div className="min-w-0">
                  <div><strong>Siswa:</strong> {reportToDelete.studentName}</div>
                  <div><strong>Pelanggaran/Kebaikan:</strong> {reportToDelete.violationName}</div>
                </div>
              </div>
            )}
            <p className="mt-2 text-rose-600 text-xs font-semibold">Poin siswa akan dikalkulasi ulang secara otomatis dan tersinkronisasi ke database cloud.</p>
          </div>
        }
        variant="danger"
        confirmText="Ya, Hapus Laporan"
      />
    </div>
  );
};

export default Dashboard;