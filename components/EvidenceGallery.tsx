import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { ViolationRecord, Student, ViolationCategory, AppConfig, User, PrintDocumentSettings } from '../types';
import { CLASS_LIST } from '../constants';
import { 
  Images, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  Award, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
  ExternalLink, 
  ArrowDownCircle, 
  Maximize2, 
  X, 
  Sparkles, 
  Clock, 
  BellRing, 
  FileArchive, 
  LayoutGrid, 
  Table as TableIcon,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  FileDown,
  Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmModal from './ConfirmModal';
import PrintPreviewModal from './PrintPreviewModal';
import { 
  getEvidenceImageForViolation, 
  downloadImageFile, 
  downloadMultipleImagesAsZip 
} from '../utils/evidenceImages';
import { drawPdfKopSurat, drawPdfSignatures, resolvePrintSettings } from '../utils/pdfKop';
import { exportRowsToSpreadsheet } from '../utils/exportHelpers';

interface EvidenceGalleryProps {
  violations: ViolationRecord[];
  students: Student[];
  appConfig: AppConfig;
  currentUser: User;
  users?: User[];
  onViewStudent: (student: Student) => void;
  onSeedSampleData?: () => void;
  onDeleteViolation?: (id: string) => void;
  onBulkDeleteViolations?: (ids: string[]) => void;
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

export const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({
  violations,
  students,
  appConfig,
  currentUser,
  users = [],
  onViewStudent,
  onSeedSampleData,
  onDeleteViolation,
  onBulkDeleteViolations,
  onSavePrintSettings
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('');
  const [tardinessOnly, setTardinessOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewRecord, setPreviewRecord] = useState<ViolationRecord | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ percent: number; text: string } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ViolationRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Only include records that have actual evidence photo attached
  const recordsWithEvidence = useMemo(() => {
    return violations.filter(v => Boolean(v.evidenceUrl));
  }, [violations]);

  // Apply search and filters
  const filteredRecords = useMemo(() => {
    return recordsWithEvidence.filter(record => {
      // Category filter
      if (categoryFilter !== 'all' && record.category !== categoryFilter) {
        return false;
      }

      // Class filter
      if (classFilter && record.studentClass !== classFilter) {
        return false;
      }

      // Tardiness only filter
      if (tardinessOnly) {
        const desc = record.description.toLowerCase();
        const isLate = desc.includes('terlambat') || desc.includes('telat') || desc.includes('kesiangan');
        if (!isLate) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = record.studentName.toLowerCase().includes(term);
        const matchClass = record.studentClass.toLowerCase().includes(term);
        const matchDesc = record.description.toLowerCase().includes(term);
        const matchReporter = (record.reporterName || '').toLowerCase().includes(term);
        if (!matchName && !matchClass && !matchDesc && !matchReporter) {
          return false;
        }
      }

      return true;
    });
  }, [recordsWithEvidence, categoryFilter, classFilter, tardinessOnly, searchTerm]);

  // Select / Deselect all
  const handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Download Single Image
  const handleDownloadSingle = async (record: ViolationRecord) => {
    const url = record.evidenceUrl || getEvidenceImageForViolation(record.description, record.category);
    const dateStr = record.date ? record.date.split('T')[0] : 'tanggal';
    const cleanStudent = record.studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCategory = record.category.toLowerCase();
    const filename = `bukti_${cleanCategory}_${cleanStudent}_${dateStr}.jpg`;

    toast.info(`Mengunduh foto bukti ${record.studentName}...`);
    const success = await downloadImageFile(url, filename);
    if (success) {
      toast.success(`Foto bukti berhasil diunduh.`);
    }
  };

  // Download Bulk ZIP
  const handleDownloadZip = async (targetRecords: ViolationRecord[], zipName: string) => {
    if (targetRecords.length === 0) {
      toast.error('Tidak ada foto bukti yang dipilih.');
      return;
    }

    setIsZipping(true);
    setZipProgress({ percent: 5, text: 'Mempersiapkan berkas bukti...' });

    const items = targetRecords.map(r => {
      const url = r.evidenceUrl || getEvidenceImageForViolation(r.description, r.category);
      const dateStr = r.date ? r.date.split('T')[0] : 'tanggal';
      const cleanStudent = r.studentName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${dateStr}_${r.studentClass}_${cleanStudent}_${r.id.slice(-4)}.jpg`;
      const label = `${r.studentName} (${r.studentClass}) - ${r.description}`;
      return { url, filename, label };
    });

    try {
      await downloadMultipleImagesAsZip(items, zipName, (percent, text) => {
        setZipProgress({ percent, text });
      });
      toast.success(`Berhasil mengunduh ${targetRecords.length} foto bukti dalam file ZIP.`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat file ZIP bukti foto.');
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  const handleDownloadSelectedZip = () => {
    const targets = recordsWithEvidence.filter(r => selectedIds.includes(r.id));
    handleDownloadZip(targets, `bukti_foto_terpilih_${Date.now()}.zip`);
  };

  const handleDownloadAllFilteredZip = () => {
    handleDownloadZip(filteredRecords, `semua_bukti_foto_${Date.now()}.zip`);
  };

  const handleDownloadXls = () => {
    if (filteredRecords.length === 0) {
      toast.error('Tidak ada data laporan bukti foto untuk diunduh.');
      return;
    }
    const rows = filteredRecords.map((r, idx) => ({
      No: idx + 1,
      Tanggal: r.date ? new Date(r.date).toLocaleDateString('id-ID') : '-',
      'Nama Siswa': r.studentName,
      Kelas: r.studentClass,
      Kategori: r.category,
      Deskripsi: r.description,
      Poin: r.points,
      Pelapor: r.reporterName || 'Petugas',
      'Tahun Ajaran': r.academicYear || appConfig.academicYear,
    }));
    exportRowsToSpreadsheet(
      rows,
      'Bukti Foto Laporan',
      `Daftar_Bukti_Foto_${new Date().toISOString().slice(0, 10)}`,
      [6, 14, 26, 12, 14, 42, 8, 20, 14],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${rows.length} data bukti foto (.xls)!`);
  };

  const buildEvidencePdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || resolvePrintSettings(appConfig, currentUser, users);
    const font = settings.documentFontFamily || 'helvetica';
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentY = await drawPdfKopSurat(doc, appConfig, 8, settings);

    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    doc.text('REKAPITULASI DOKUMENTASI BUKTI FOTO SISWA', pageWidth / 2, currentY + 6, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(`Tahun Ajaran: ${appConfig.academicYear} • Total ${filteredRecords.length} Dokumentasi`, pageWidth / 2, currentY + 11, { align: 'center' });

    autoTable(doc, {
      startY: currentY + 17,
      head: [['No', 'Tanggal', 'Nama Siswa', 'Kelas', 'Kategori', 'Deskripsi Kejadian', 'Poin', 'Pelapor']],
      body: filteredRecords.map((r, idx) => [
        idx + 1,
        r.date ? new Date(r.date).toLocaleDateString('id-ID') : '-',
        r.studentName,
        r.studentClass,
        r.category,
        r.description,
        r.points > 0 ? `+${r.points}` : r.points,
        r.reporterName || 'Petugas',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle', font },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, halign: 'center', font },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 42, fontStyle: 'bold' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 32 },
      },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || currentY + 30) + 12;
    drawPdfSignatures(doc, settings, appConfig, finalY);

    return doc;
  };

  const handleDirectDownloadPdf = async () => {
    if (filteredRecords.length === 0) {
      toast.error('Tidak ada data bukti foto untuk diunduh.');
      return;
    }
    try {
      const settings = resolvePrintSettings(appConfig, currentUser, users);
      const doc = await buildEvidencePdfDoc(settings);
      doc.save(`Daftar_Bukti_Foto_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('File PDF daftar bukti foto berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh PDF bukti foto.');
    }
  };

  const handlePrintPdf = () => {
    if (filteredRecords.length === 0) {
      toast.error('Tidak ada data bukti foto untuk dicetak.');
      return;
    }
    setIsPrintModalOpen(true);
  };

  const handleExecuteBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (onBulkDeleteViolations) {
      onBulkDeleteViolations(selectedIds);
    } else if (onDeleteViolation) {
      selectedIds.forEach(id => onDeleteViolation(id));
    }
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  };

  const handleExecuteSingleDelete = () => {
    if (!recordToDelete) return;
    const idToDelete = recordToDelete.id;
    if (onDeleteViolation) {
      onDeleteViolation(idToDelete);
    } else if (onBulkDeleteViolations) {
      onBulkDeleteViolations([idToDelete]);
    }
    setSelectedIds(prev => prev.filter(id => id !== idToDelete));
    if (previewRecord?.id === idToDelete) {
      setPreviewRecord(null);
    }
    setRecordToDelete(null);
  };

  // Statistics
  const totalCount = recordsWithEvidence.length;
  const countPrestasi = recordsWithEvidence.filter(r => r.category === ViolationCategory.PRESTASI).length;
  const countPelanggaran = totalCount - countPrestasi;
  const countTardiness = recordsWithEvidence.filter(r => {
    const desc = r.description.toLowerCase();
    return desc.includes('terlambat') || desc.includes('telat') || desc.includes('kesiangan');
  }).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <Images className="w-3.5 h-3.5" /> Galeri & Pusat Unduh Bukti Foto
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Unduh Berkas Bukti Foto
          </h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Setiap laporan pelanggaran dan penghargaan siswa dilengkapi bukti dokumentasi foto resmi. Anda dapat mengunduh foto satuan atau mengekspor semuanya sekaligus ke dalam file ZIP.
          </p>

          {/* Quick Summary Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-indigo-600" />
              TA {appConfig.academicYear}
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5">
              <Images className="w-3 h-3 text-slate-500" />
              Total {totalCount} Foto Bukti
            </span>
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              {countPelanggaran} Pelanggaran
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-500" />
              {countTardiness} Keterlambatan
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
              <Award className="w-3 h-3 text-emerald-500" />
              {countPrestasi} Bukti Prestasi
            </span>
          </div>
        </div>

        {/* Global Export Buttons */}
        <div className="relative z-10 flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={handleDownloadXls}
            disabled={filteredRecords.length === 0}
            className="px-4 py-3 bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Unduh daftar laporan bukti foto ke format Excel (.xls)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Unduh XLS
          </button>

          <button
            onClick={handleDirectDownloadPdf}
            disabled={filteredRecords.length === 0}
            className="px-4 py-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Unduh langsung daftar laporan bukti foto ke PDF"
          >
            <FileDown className="w-4 h-4" />
            Unduh PDF
          </button>

          <button
            onClick={handlePrintPdf}
            disabled={filteredRecords.length === 0}
            className="px-4 py-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Pratinjau & Cetak PDF"
          >
            <Printer className="w-4 h-4" />
            Cetak PDF
          </button>

          <button
            onClick={handleDownloadAllFilteredZip}
            disabled={isZipping || filteredRecords.length === 0}
            className="px-5 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Unduh semua foto yang tampil dalam file ZIP"
          >
            <FileArchive className="w-4 h-4" />
            {isZipping ? 'Mengompresi ZIP...' : `Unduh Semua (${filteredRecords.length}) ZIP`}
          </button>

          {onSeedSampleData && totalCount < 3 && (
            <button
              onClick={onSeedSampleData}
              className="px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              title="Tambahkan contoh laporan berbukti foto lengkap"
            >
              <RefreshCw className="w-4 h-4 text-amber-600" />
              Muat Sampel Foto
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar if Zipping */}
      {zipProgress && (
        <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 animate-bounce text-indigo-300" />
              {zipProgress.text}
            </span>
            <span>{zipProgress.percent}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-indigo-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${zipProgress.percent}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Filter and View Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari siswa, kelas, jenis pelanggaran, pelapor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Kategori</option>
            <option value={ViolationCategory.RINGAN}>Pelanggaran Ringan</option>
            <option value={ViolationCategory.SEDANG}>Pelanggaran Sedang</option>
            <option value={ViolationCategory.BERAT}>Pelanggaran Berat</option>
            <option value={ViolationCategory.PRESTASI}>Prestasi & Reward</option>
          </select>

          {/* Class Select */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">Semua Kelas</option>
            {CLASS_LIST.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          {/* Tardiness quick filter */}
          <button
            onClick={() => setTardinessOnly(!tardinessOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              tardinessOnly
                ? 'bg-red-600 text-white border-red-700 shadow-sm'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
            title="Saring foto bukti keterlambatan saja"
          >
            <Clock className="w-3.5 h-3.5" />
            Terlambat ({countTardiness})
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' 
                  ? 'bg-white text-indigo-600 shadow-xs font-bold' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Tampilan Grid Galeri"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' 
                  ? 'bg-white text-indigo-600 shadow-xs font-bold' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Tampilan Tabel Rinci"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Select Actions Bar */}
      {filteredRecords.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-800 transition"
            >
              {selectedIds.length === filteredRecords.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              {selectedIds.length === filteredRecords.length ? 'Batalkan Pilih Semua' : 'Pilih Semua'}
            </button>
            <span>
              Menampilkan <strong>{filteredRecords.length}</strong> foto bukti
            </span>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                {selectedIds.length} foto dipilih
              </span>
              <button
                onClick={handleDownloadSelectedZip}
                disabled={isZipping}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Unduh file bukti terpilih dalam format ZIP"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" /> Unduh Terpilih (.ZIP)
              </button>
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Hapus data & bukti foto yang dipilih"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredRecords.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4">
            <Images className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Tidak ada foto bukti yang sesuai</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Silakan ubah kata kunci pencarian atau sesuaikan filter kategori / kelas Anda.
          </p>
          {onSeedSampleData && totalCount < 3 && (
            <button
              onClick={onSeedSampleData}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Muat Sampel Laporan & Foto
            </button>
          )}
        </div>
      )}

      {/* View Mode: GRID */}
      {viewMode === 'grid' && filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredRecords.map((record) => {
            const isSelected = selectedIds.includes(record.id);
            const imageUrl = record.evidenceUrl || getEvidenceImageForViolation(record.description, record.category);
            const studentObj = students.find(s => s.id === record.studentId);
            const isTardiness = record.description.toLowerCase().includes('terlambat') || 
                                record.description.toLowerCase().includes('telat') ||
                                record.description.toLowerCase().includes('kesiangan');

            return (
              <div
                key={record.id}
                className={`group bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col shadow-sm hover:shadow-xl ${
                  isSelected 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* Image Container with Overlay Controls */}
                <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={record.description}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Top Overlay Badges */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(record.id);
                      }}
                      className="p-1 rounded-md bg-black/60 backdrop-blur-xs text-white hover:bg-black/80 transition"
                      title={isSelected ? 'Batalkan pilihan' : 'Pilih foto'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-white/80" />
                      )}
                    </button>

                    {/* Category Tag */}
                    <div className="flex items-center gap-1">
                      {isTardiness && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-600 text-white shadow-xs">
                          Terlambat
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black shadow-xs ${
                          record.category === ViolationCategory.PRESTASI
                            ? 'bg-emerald-600 text-white'
                            : record.category === ViolationCategory.BERAT
                            ? 'bg-red-700 text-white'
                            : record.category === ViolationCategory.SEDANG
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {record.category}
                      </span>
                    </div>
                  </div>

                  {/* Points Badge */}
                  <div className="absolute bottom-2 left-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-black backdrop-blur-xs shadow-xs ${
                        record.points < 0
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {record.points > 0 ? `+${record.points} Poin` : `${record.points} Poin`}
                    </span>
                  </div>

                  {/* Zoom Preview Button on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewRecord(record)}
                      className="p-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-800 shadow-lg font-bold text-xs flex items-center gap-1 transition scale-95 group-hover:scale-100"
                      title="Lihat Pratinjau Besar"
                    >
                      <Maximize2 className="w-4 h-4" /> Perbesar
                    </button>
                    <button
                      onClick={() => handleDownloadSingle(record)}
                      className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg font-bold text-xs flex items-center gap-1 transition scale-95 group-hover:scale-100"
                      title="Unduh File Gambar"
                    >
                      <Download className="w-4 h-4" /> Unduh
                    </button>
                  </div>
                </div>

                {/* Content Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Student Info */}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <button
                        onClick={() => studentObj && onViewStudent(studentObj)}
                        className="text-sm font-black text-slate-900 hover:text-indigo-600 transition text-left truncate leading-tight"
                        title={record.studentName}
                      >
                        {record.studentName}
                      </button>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md shrink-0">
                        {record.studentClass}
                      </span>
                    </div>

                    {/* Violation Description */}
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed" title={record.description}>
                      {record.description}
                    </p>
                  </div>

                  {/* Footer Meta & Action */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 truncate max-w-[110px]" title={record.reporterName || 'Petugas'}>
                      <UserIcon className="w-3 h-3 text-slate-400" />
                      {record.reporterName || 'Petugas'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownloadSingle(record)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition hover:underline cursor-pointer"
                        title="Unduh file gambar ini"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" /> Unduh
                      </button>
                      <button
                        onClick={() => setRecordToDelete(record)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus data & bukti foto ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode: TABLE */}
      {viewMode === 'table' && filteredRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-black border-b border-slate-200">
                <tr>
                  <th className="p-4 w-10">
                    <button onClick={handleSelectAll}>
                      {selectedIds.length === filteredRecords.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">Foto Bukti</th>
                  <th className="p-4">Siswa & Kelas</th>
                  <th className="p-4">Kategori & Poin</th>
                  <th className="p-4">Deskripsi Pelanggaran / Bukti</th>
                  <th className="p-4">Tanggal & Pelapor</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const isSelected = selectedIds.includes(record.id);
                  const imageUrl = record.evidenceUrl || getEvidenceImageForViolation(record.description, record.category);
                  const studentObj = students.find(s => s.id === record.studentId);

                  return (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="p-4">
                        <button onClick={() => toggleSelect(record.id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div 
                          className="w-16 h-12 rounded-lg bg-slate-900 overflow-hidden cursor-pointer relative group border border-slate-200 shadow-xs"
                          onClick={() => setPreviewRecord(record)}
                          title="Klik untuk perbesar foto"
                        >
                          <img src={imageUrl} alt="Bukti" className="w-full h-full object-cover group-hover:opacity-90 transition" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => studentObj && onViewStudent(studentObj)}
                          className="font-bold text-slate-900 hover:text-indigo-600 transition text-left block"
                        >
                          {record.studentName}
                        </button>
                        <span className="text-xs text-slate-500 font-semibold">{record.studentClass}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          record.category === ViolationCategory.PRESTASI
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.category === ViolationCategory.BERAT
                            ? 'bg-red-100 text-red-800'
                            : record.category === ViolationCategory.SEDANG
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {record.category}
                        </span>
                        <div className="text-xs font-bold text-slate-700 mt-0.5">
                          {record.points > 0 ? `+${record.points} Poin` : `${record.points} Poin`}
                        </div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-xs text-slate-700 line-clamp-2">{record.description}</p>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        <div className="font-semibold text-slate-700">{record.date.split('T')[0]}</div>
                        <div className="text-[11px]">{record.reporterName || 'Petugas'}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewRecord(record)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Perbesar Pratinjau"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadSingle(record)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Unduh File Foto"
                          >
                            <Download className="w-3.5 h-3.5" /> Unduh
                          </button>
                          <button
                            onClick={() => setRecordToDelete(record)}
                            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="Hapus Catatan & Bukti Foto Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Large Image Preview Modal */}
      {previewRecord && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewRecord(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <Images className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">
                    {previewRecord.studentName} ({previewRecord.studentClass})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {previewRecord.category} • {previewRecord.points > 0 ? `+${previewRecord.points}` : previewRecord.points} Poin • {previewRecord.date.split('T')[0]}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSingle(previewRecord)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-blue-900/30 cursor-pointer"
                  title="Unduh File Gambar Ini"
                >
                  <ArrowDownCircle className="w-4 h-4" /> Unduh Gambar
                </button>
                <button
                  onClick={() => setRecordToDelete(previewRecord)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-rose-900/30"
                  title="Hapus Catatan & Bukti Foto Ini"
                >
                  <Trash2 className="w-4 h-4" /> Hapus
                </button>
                <button
                  onClick={() => {
                    const url = previewRecord.evidenceUrl || getEvidenceImageForViolation(previewRecord.description, previewRecord.category);
                    window.open(url, '_blank');
                  }}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition"
                  title="Buka Gambar Asli di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setPreviewRecord(null)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl transition"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image View */}
            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto max-h-[70vh]">
              <img 
                src={previewRecord.evidenceUrl || getEvidenceImageForViolation(previewRecord.description, previewRecord.category)} 
                alt={previewRecord.description} 
                className="max-w-full max-h-[66vh] object-contain rounded-lg shadow-xl" 
              />
            </div>

            {/* Modal Footer Description */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Keterangan: </span>
                <span className="text-white font-semibold">{previewRecord.description}</span>
                <span className="text-slate-400 ml-2 font-medium">(Pelapor: {previewRecord.reporterName || 'Petugas Piket'})</span>
              </div>

              <button 
                onClick={() => handleDownloadSingle(previewRecord)}
                className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 shrink-0"
              >
                <ArrowDownCircle className="w-4 h-4" /> Simpan Gambar ke Komputer / HP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete Modal */}
      <ConfirmModal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleExecuteBulkDelete}
        title="Hapus Data Terpilih"
        message={
          <div>
            <p className="mb-2">
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.length}</strong> data laporan dan foto bukti yang dipilih?
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 mb-2 max-h-36 overflow-y-auto divide-y divide-slate-100">
              {recordsWithEvidence.filter(r => selectedIds.includes(r.id)).slice(0, 5).map(r => (
                <div key={r.id} className="py-1">
                  <span className="font-bold text-slate-800">{r.studentName} ({r.studentClass})</span> - {r.description}
                </div>
              ))}
              {selectedIds.length > 5 && (
                <div className="py-1 italic text-slate-400">...dan {selectedIds.length - 5} data lainnya</div>
              )}
            </div>
            <p className="text-rose-600 text-xs font-semibold">
              Catatan laporan akan dihapus secara permanen dari sistem dan Cloud Firestore. Poin akumulasi masing-masing siswa yang bersangkutan akan dikalkulasi ulang secara otomatis.
            </p>
          </div>
        }
        confirmText={`Ya, Hapus (${selectedIds.length}) Data`}
        variant="danger"
      />

      {/* Confirm Single Delete Modal */}
      <ConfirmModal
        isOpen={!!recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleExecuteSingleDelete}
        title="Hapus Data & Bukti Foto"
        message={
          <div>
            <p className="mb-2">Apakah Anda yakin ingin menghapus laporan dan bukti foto ini?</p>
            {recordToDelete && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 mb-2">
                <div><strong>Siswa:</strong> {recordToDelete.studentName} ({recordToDelete.studentClass})</div>
                <div><strong>Kategori:</strong> {recordToDelete.category} ({recordToDelete.points > 0 ? `+${recordToDelete.points}` : recordToDelete.points} Poin)</div>
                <div><strong>Keterangan:</strong> {recordToDelete.description}</div>
                <div><strong>Tanggal:</strong> {recordToDelete.date?.split('T')[0]}</div>
              </div>
            )}
            <p className="text-rose-600 text-xs font-semibold">
              Catatan laporan akan dihapus secara permanen dan poin siswa akan dikalkulasi ulang secara otomatis.
            </p>
          </div>
        }
        confirmText="Ya, Hapus Data"
        variant="danger"
      />

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        title="Pratinjau & Pengaturan Cetak Dokumentasi Bukti Foto"
        fileNamePrefix="Daftar_Bukti_Foto"
        appConfig={appConfig}
        currentUser={currentUser}
        users={users}
        onClose={() => setIsPrintModalOpen(false)}
        buildPdfDoc={buildEvidencePdfDoc}
        onSaveDefaultSettings={onSavePrintSettings}
      />
    </div>
  );
};

export default EvidenceGallery;
