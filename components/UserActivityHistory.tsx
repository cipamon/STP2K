import React, { useState, useMemo, useEffect } from 'react';
import { UserActivityLog, UserRole, AppTheme, User, AppConfig, PrintDocumentSettings } from '../types';
import { DEFAULT_APP_CONFIG } from '../constants';
import { 
  Activity, 
  Search, 
  Download, 
  Trash2, 
  LogIn, 
  LogOut, 
  FileText, 
  Users, 
  Settings, 
  Upload, 
  Calendar, 
  Clock, 
  UserCheck, 
  ShieldAlert, 
  Printer, 
  FileSpreadsheet,
  FileDown,
  Sliders
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getActionLabel, formatRelativeTime, exportActivitiesToExcel } from '../utils/activityLogger';
import { drawPdfKopSurat, drawPdfSignatures, getPdfFontFamily, resolvePrintSettings } from '../utils/pdfKop';
import PrintPreviewModal from './PrintPreviewModal';
import PrintSettingsPanel from './PrintSettingsPanel';
import { KopSurat } from './KopSurat';
import { SignatureLayoutEditor } from './SignatureLayoutEditor';
import { getDefaultUserAvatar, getUserAvatar } from '../utils/avatarHelpers';
import { toast } from 'sonner';

interface UserActivityHistoryProps {
  activities: UserActivityLog[];
  onClearActivities?: () => void;
  theme: AppTheme;
  currentUser: User;
  users?: User[];
  appConfig?: AppConfig;
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

export const UserActivityHistory: React.FC<UserActivityHistoryProps> = ({
  activities,
  onClearActivities,
  theme,
  currentUser,
  users = [],
  appConfig,
  onSavePrintSettings
}) => {
  const effectiveAppConfig = appConfig || DEFAULT_APP_CONFIG;
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showPrePrintPanel, setShowPrePrintPanel] = useState(false);
  const [draftPrintSettings, setDraftPrintSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(effectiveAppConfig, currentUser, users)
  );
  useEffect(() => {
    setDraftPrintSettings(resolvePrintSettings(effectiveAppConfig, currentUser, users));
  }, [effectiveAppConfig, currentUser, users]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionCategory, setSelectedActionCategory] = useState<string>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'ALL' | 'TODAY' | 'WEEK'>('ALL');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  // Filter logic
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // Search
      const matchesSearch = 
        act.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (act.device && act.device.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Action category filter
      if (selectedActionCategory !== 'ALL') {
        if (selectedActionCategory === 'AUTH' && !(act.action === 'LOGIN' || act.action === 'LOGOUT')) return false;
        if (selectedActionCategory === 'VIOLATION' && !(act.action === 'ADD_VIOLATION' || act.action === 'DELETE_VIOLATION')) return false;
        if (selectedActionCategory === 'STUDENTS' && !(act.action === 'ADD_STUDENT' || act.action === 'UPDATE_STUDENT' || act.action === 'DELETE_STUDENT' || act.action === 'BULK_IMPORT')) return false;
        if (selectedActionCategory === 'SETTINGS' && !(act.action === 'SETTINGS_UPDATE' || act.action === 'USER_MANAGEMENT' || act.action === 'DATABASE_RESET')) return false;
        if (selectedActionCategory === 'EXPORT' && act.action !== 'EXPORT_DATA') return false;
      }

      // User filter
      if (selectedUserFilter !== 'ALL' && act.userId !== selectedUserFilter && act.userName !== selectedUserFilter) {
        return false;
      }

      // Timeframe filter
      if (selectedTimeframe !== 'ALL') {
        const actDate = new Date(act.timestamp);
        const now = new Date();
        if (selectedTimeframe === 'TODAY') {
          const isToday = 
            actDate.getDate() === now.getDate() &&
            actDate.getMonth() === now.getMonth() &&
            actDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (selectedTimeframe === 'WEEK') {
          const diffTime = Math.abs(now.getTime() - actDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return false;
        }
      }

      return true;
    });
  }, [activities, searchQuery, selectedActionCategory, selectedUserFilter, selectedTimeframe]);

  // Summary Metrics
  const todayCount = useMemo(() => {
    const now = new Date();
    return activities.filter(act => {
      const d = new Date(act.timestamp);
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [activities]);

  const mostActiveTeacher = useMemo(() => {
    const counts: Record<string, number> = {};
    activities.forEach(act => {
      if (act.userRole === UserRole.GURU) {
        counts[act.userName] = (counts[act.userName] || 0) + 1;
      }
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [activities]);

  const reportCount = useMemo(() => {
    return activities.filter(a => a.action === 'ADD_VIOLATION' || a.action === 'DELETE_VIOLATION').length;
  }, [activities]);

  const handleExportExcel = () => {
    if (filteredActivities.length === 0) {
      toast.error('Tidak ada data riwayat untuk diekspor.');
      return;
    }
    exportActivitiesToExcel(filteredActivities, undefined, 'xls');
    toast.success('Log aktivitas berhasil diunduh (.xls)!');
  };

  const buildActivityPdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || resolvePrintSettings(effectiveAppConfig, currentUser, users);
    const font = getPdfFontFamily(settings.documentFontFamily);
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentY = await drawPdfKopSurat(doc, effectiveAppConfig, 8, settings);
    const startY = currentY + 6;

    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    doc.text('RIWAYAT AKTIVITAS PENGGUNA (AUDIT TRAIL)', pageWidth / 2, startY, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(`Total Log: ${filteredActivities.length} Kejadian`, pageWidth / 2, startY + 5, { align: 'center' });

    autoTable(doc, {
      startY: startY + 11,
      head: [['No', 'Waktu', 'Pengguna', 'Role', 'Aksi', 'Judul & Keterangan', 'Perangkat']],
      body: filteredActivities.map((act, idx) => [
        idx + 1,
        new Date(act.timestamp).toLocaleString('id-ID'),
        act.userName,
        act.userRole,
        getActionLabel(act.action).label,
        `${act.title}\n${act.details}`,
        act.device || 'Web Browser',
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle', font },
      headStyles: { fillColor: [126, 34, 206], textColor: 255, halign: 'center', font },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 34 },
        2: { cellWidth: 38, fontStyle: 'bold' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 26 },
      },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || startY + 25) + 12;
    drawPdfSignatures(doc, settings, effectiveAppConfig, finalY);

    return doc;
  };

  const handleDirectDownloadPdf = async () => {
    if (filteredActivities.length === 0) {
      toast.error('Tidak ada data riwayat untuk diunduh.');
      return;
    }
    try {
      const doc = await buildActivityPdfDoc(draftPrintSettings);
      doc.save(`Log_Aktivitas_SiPerSis_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('File PDF log aktivitas berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh PDF log aktivitas.');
    }
  };

  const handlePrint = () => {
    if (filteredActivities.length === 0) {
      toast.error('Tidak ada data riwayat untuk dicetak.');
      return;
    }
    setIsPrintModalOpen(true);
  };

  const renderActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return <LogIn className="w-4 h-4 text-blue-600" />;
      case 'LOGOUT':
        return <LogOut className="w-4 h-4 text-slate-500" />;
      case 'ADD_VIOLATION':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'DELETE_VIOLATION':
        return <Trash2 className="w-4 h-4 text-rose-600" />;
      case 'ADD_STUDENT':
      case 'UPDATE_STUDENT':
      case 'DELETE_STUDENT':
        return <Users className="w-4 h-4 text-emerald-600" />;
      case 'BULK_IMPORT':
        return <Upload className="w-4 h-4 text-sky-600" />;
      case 'USER_MANAGEMENT':
        return <UserCheck className="w-4 h-4 text-purple-600" />;
      case 'EXPORT_DATA':
        return <Download className="w-4 h-4 text-indigo-600" />;
      case 'SETTINGS_UPDATE':
        return <Settings className="w-4 h-4 text-teal-600" />;
      case 'DATABASE_RESET':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Riwayat Aktivitas Pengguna (Audit Trail)</h3>
            <span className="bg-purple-100 text-purple-800 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin Exclusive
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Mencatat setiap tindakan penting pengguna, login dewan guru, pencatatan pelanggaran, modifikasi data siswa, hingga perubahan pengaturan secara kronologis.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-emerald-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Unduh XLS
          </button>
          <button
            type="button"
            onClick={() => setShowPrePrintPanel((v) => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm border cursor-pointer ${
              showPrePrintPanel
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
            }`}
            title="Atur Kop Surat, Spasi, TTD & Font sebelum Pratinjau atau Cetak"
          >
            <Sliders className="w-4 h-4" /> Atur Kop, Spasi &amp; TTD
          </button>
          <button
            onClick={handleDirectDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Unduh PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak PDF
          </button>
          {onClearActivities && (
            <button
              onClick={() => {
                if (window.confirm('PERINGATAN: Apakah Anda yakin ingin mengosongkan riwayat log aktivitas pengguna?')) {
                  onClearActivities();
                  toast.success('Riwayat aktivitas telah dibersihkan.');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Bersihkan
            </button>
          )}
        </div>
      </div>

      {/* Inline Pre-Print Kop, Spasi & TTD Settings Panel */}
      {showPrePrintPanel && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5">
            <PrintSettingsPanel
              settings={draftPrintSettings}
              onChange={setDraftPrintSettings}
              appConfig={effectiveAppConfig}
              currentUser={currentUser}
              users={users}
              onSaveDefaultSettings={onSavePrintSettings}
              showFooterActions
              className="rounded-2xl border border-slate-200 max-h-[500px]"
            />
          </div>
          <div className="lg:col-span-7 flex flex-col justify-between gap-3">
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 overflow-x-auto space-y-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                  Pratinjau Kop Surat &amp; TTD Sebelum Cetak Log Aktivitas
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  Spasi: {(draftPrintSettings.kopStyle.lineSpacing ?? 1).toFixed(1)}x • Bawah: {draftPrintSettings.kopStyle.bottomSpacing ?? 6} mm
                </span>
              </div>
              {draftPrintSettings.showKop ? (
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <KopSurat appConfig={effectiveAppConfig} printSettings={draftPrintSettings} showBorder />
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white">
                  Kop Surat dinonaktifkan pada dokumen ini.
                </div>
              )}
              <SignatureLayoutEditor
                compact
                settings={draftPrintSettings}
                onChange={setDraftPrintSettings}
                appConfig={effectiveAppConfig}
                currentUser={currentUser}
                usableWidthMm={267}
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
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Pratinjau Lengkap &amp; Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Aktivitas</p>
            <h4 className="text-xl font-black text-slate-800">{activities.length} <span className="text-xs font-medium text-slate-500">kejadian</span></h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aktivitas Hari Ini</p>
            <h4 className="text-xl font-black text-purple-700">{todayCount} <span className="text-xs font-medium text-purple-500">tindakan</span></h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Input & Hapus Laporan</p>
            <h4 className="text-xl font-black text-emerald-700">{reportCount} <span className="text-xs font-medium text-emerald-500">entri</span></h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Guru Paling Aktif</p>
            <h4 className="text-sm font-black text-slate-800 truncate" title={mostActiveTeacher?.name || '-'}>
              {mostActiveTeacher ? mostActiveTeacher.name.split(',')[0] : 'Belum Ada'}
            </h4>
            <p className="text-[10px] text-slate-500">{mostActiveTeacher ? `${mostActiveTeacher.count} kali aktivitas` : 'Tidak ada aktivitas guru'}</p>
          </div>
        </div>
      </div>

      {/* Filter and View Controls */}
      <div className="bg-white rounded-2xl p-4.5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari guru, aksi, judul, atau siswa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600">
                ×
              </button>
            )}
          </div>

          {/* User selector & Timeframe */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <select
              value={selectedUserFilter}
              onChange={e => setSelectedUserFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Semua Pengguna</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            <select
              value={selectedTimeframe}
              onChange={e => setSelectedTimeframe(e.target.value as any)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Semua Waktu</option>
              <option value="TODAY">Hari Ini Saja</option>
              <option value="WEEK">7 Hari Terakhir</option>
            </select>

            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${viewMode === 'timeline' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${viewMode === 'table' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Tabel Audit
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] shrink-0">Kategori:</span>
          {[
            { id: 'ALL', label: 'Semua Aksi' },
            { id: 'AUTH', label: 'Login & Sesi' },
            { id: 'VIOLATION', label: 'Laporan & Reward' },
            { id: 'STUDENTS', label: 'Data Siswa' },
            { id: 'SETTINGS', label: 'Konfigurasi & User' },
            { id: 'EXPORT', label: 'Ekspor Data' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedActionCategory(cat.id)}
              className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
                selectedActionCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400 font-semibold shrink-0">
            Menampilkan <strong className="text-slate-700">{filteredActivities.length}</strong> dari {activities.length} log
          </span>
        </div>
      </div>

      {/* Main List Display: Timeline View or Table View */}
      {viewMode === 'timeline' ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          {filteredActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Activity className="w-10 h-10 mx-auto text-slate-300 mb-2 opacity-60" />
              <p className="font-bold text-slate-600">Tidak ada riwayat aktivitas yang sesuai</p>
              <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau filter kategori di atas.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {filteredActivities.map((act) => {
                const actionBadge = getActionLabel(act.action);
                return (
                  <div key={act.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-purple-500 shadow-xs flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    </div>

                    {/* Activity Item Card */}
                    <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4 transition-all duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
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
                                className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                            );
                          })()}
                          <span className="text-sm font-bold text-slate-800">{act.userName}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            act.userRole === UserRole.ADMIN 
                              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {act.userRole}
                          </span>

                          <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold border ${actionBadge.bg} ${actionBadge.color} flex items-center gap-1`}>
                            {renderActionIcon(act.action)}
                            {actionBadge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatRelativeTime(act.timestamp)}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(act.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="pl-9.5">
                        <h5 className="font-bold text-slate-800 text-sm">{act.title}</h5>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.details}</p>
                        {act.device && (
                          <div className="mt-2.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <span className="font-medium">Perangkat:</span>
                            <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500 font-mono text-[10px]">
                              {act.device}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Waktu</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Pengguna & Role</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Aksi</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Judul & Detail Tindakan</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Perangkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.map((act) => {
                  const actionBadge = getActionLabel(act.action);
                  return (
                    <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        <div className="font-bold text-slate-800">{formatRelativeTime(act.timestamp)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(act.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
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
                                className="w-6 h-6 rounded-full object-cover border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                            );
                          })()}
                          <div>
                            <p className="font-bold text-slate-800 leading-tight">{act.userName}</p>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              act.userRole === UserRole.ADMIN ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {act.userRole}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-semibold border ${actionBadge.bg} ${actionBadge.color}`}>
                          {renderActionIcon(act.action)}
                          {actionBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{act.title}</p>
                        <p className="text-slate-600 mt-0.5 line-clamp-2">{act.details}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {act.device || '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredActivities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada catatan aktivitas yang sesuai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        title="Pratinjau & Pengaturan Cetak Log Aktivitas Pengguna"
        fileNamePrefix="Log_Aktivitas_SiPerSis"
        appConfig={effectiveAppConfig}
        currentUser={currentUser}
        users={users}
        onClose={() => setIsPrintModalOpen(false)}
        buildPdfDoc={buildActivityPdfDoc}
        onSaveDefaultSettings={onSavePrintSettings}
        defaultOverrides={draftPrintSettings}
        onSettingsChange={setDraftPrintSettings}
      />
    </div>
  );
};
export default UserActivityHistory;
