import React, { useState } from 'react';
import { AppConfig, PrintDocumentSettings, User, UserRole, ViolationType, ViolationCategory } from '../types';
import { DEFAULT_APP_CONFIG } from '../constants';
import {
  Plus,
  Trash2,
  Tag,
  Save,
  X,
  Pencil,
  Upload,
  FileSpreadsheet,
  FileDown,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmModal from './ConfirmModal';
import PrintPreviewModal from './PrintPreviewModal';
import { drawPdfKopSurat, drawPdfSignatures, resolvePrintSettings } from '../utils/pdfKop';
import { exportAoaToSpreadsheet, exportRowsToSpreadsheet } from '../utils/exportHelpers';

interface ViolationTypeManagementProps {
  types: ViolationType[];
  onAddType: (type: ViolationType) => void;
  onUpdateType: (type: ViolationType) => void;
  onDeleteType: (id: string) => void;
  onBulkAddTypes?: (types: ViolationType[]) => void;
  appConfig?: AppConfig;
  currentUser?: User;
  users?: User[];
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

const parseCategory = (raw: string): ViolationCategory => {
  const val = (raw || '').toLowerCase();
  if (val.includes('prestasi') || val.includes('reward')) return ViolationCategory.PRESTASI;
  if (val.includes('berat')) return ViolationCategory.BERAT;
  if (val.includes('sedang')) return ViolationCategory.SEDANG;
  return ViolationCategory.RINGAN;
};

const ViolationTypeManagement: React.FC<ViolationTypeManagementProps> = ({
  types,
  onAddType,
  onUpdateType,
  onDeleteType,
  onBulkAddTypes,
  appConfig,
  currentUser,
  users = [],
  onSavePrintSettings,
}) => {
  const effectiveAppConfig = appConfig || DEFAULT_APP_CONFIG;
  const effectiveCurrentUser: User = currentUser || users[0] || {
    id: 'admin',
    name: 'Administrator',
    username: 'admin',
    password: '',
    role: UserRole.ADMIN,
  };
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<ViolationType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [points, setPoints] = useState(5);
  const [category, setCategory] = useState<ViolationCategory>(ViolationCategory.RINGAN);

  const handleAddNew = () => {
    setEditingId(null);
    setLabel('');
    setPoints(5);
    setCategory(ViolationCategory.RINGAN);
    setIsFormOpen(true);
  };

  const handleEdit = (type: ViolationType) => {
    setEditingId(type.id);
    setLabel(type.label);
    setPoints(type.points);
    setCategory(type.category);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdateType({
        id: editingId,
        label,
        points,
        category,
      });
    } else {
      onAddType({
        id: Date.now().toString(),
        label,
        points,
        category,
      });
    }
    setIsFormOpen(false);
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ['Nama Pelanggaran / Reward', 'Kategori (Ringan/Sedang/Berat/Prestasi)', 'Poin'],
      ['Terlambat masuk sekolah', 'Ringan', 5],
      ['Juara Lomba Tingkat Kabupaten', 'Prestasi', -25],
    ];
    exportAoaToSpreadsheet(
      rows,
      'Jenis Pelanggaran',
      'Template_Jenis_Pelanggaran_SiPerSis',
      [38, 34, 10],
      'xls'
    );
    toast.success('Template XLS jenis pelanggaran berhasil diunduh.');
  };

  const handleExportXls = () => {
    if (types.length === 0) {
      toast.error('Tidak ada data jenis pelanggaran untuk diunduh.');
      return;
    }
    const rows = types.map((t, idx) => ({
      No: idx + 1,
      'Nama Pelanggaran / Reward': t.label,
      Kategori: t.category,
      Poin: t.points,
    }));
    exportRowsToSpreadsheet(
      rows,
      'Jenis Pelanggaran',
      `Master_Jenis_Pelanggaran_${new Date().toISOString().slice(0, 10)}`,
      [6, 42, 18, 10],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${types.length} jenis pelanggaran (.xls)!`);
  };

  const buildPdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || resolvePrintSettings(effectiveAppConfig, effectiveCurrentUser, users);
    const font = settings.documentFontFamily || 'helvetica';
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentY = await drawPdfKopSurat(doc, effectiveAppConfig, 8, settings);
    const startY = currentY + 6;

    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    doc.text('MASTER DATA JENIS PELANGGARAN & REWARD', pageWidth / 2, startY, { align: 'center' });

    autoTable(doc, {
      startY: startY + 8,
      head: [['No', 'Nama Pelanggaran / Reward', 'Kategori', 'Poin']],
      body: types.map((t, idx) => [
        idx + 1,
        t.label,
        t.category,
        t.points > 0 ? `+${t.points}` : t.points,
      ]),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'middle', font },
      headStyles: { fillColor: [2, 132, 199], textColor: 255, halign: 'center', font },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 32, halign: 'center' },
        3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || startY + 25) + 12;
    drawPdfSignatures(doc, settings, effectiveAppConfig, finalY);

    return doc;
  };

  const handlePrintPdf = () => {
    if (types.length === 0) {
      toast.error('Tidak ada data untuk dicetak.');
      return;
    }
    setIsPrintModalOpen(true);
  };

  const handleDirectDownloadPdf = async () => {
    if (types.length === 0) {
      toast.error('Tidak ada data untuk diunduh.');
      return;
    }
    try {
      const settings = resolvePrintSettings(effectiveAppConfig, effectiveCurrentUser, users);
      const doc = await buildPdfDoc(settings);
      doc.save(`Master_Jenis_Pelanggaran_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('File PDF master jenis pelanggaran berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh PDF.');
    }
  };

  const handleExecImport = () => {
    if (!selectedImportFile) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rows.length < 2) {
          toast.error('File tidak memiliki baris data.');
          return;
        }
        const imported: ViolationType[] = [];
        rows.slice(1).forEach((row, idx) => {
          if (!Array.isArray(row) || row.every((c) => !String(c || '').trim())) return;
          const rowLabel = String(row[0] ?? '').trim();
          const rowCat = parseCategory(String(row[1] ?? ''));
          const rowPoints = Number(row[2]);
          if (rowLabel && !isNaN(rowPoints)) {
            imported.push({
              id: `vt-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              label: rowLabel,
              category: rowCat,
              points: rowPoints,
            });
          }
        });

        if (imported.length === 0) {
          toast.error('Tidak ada data valid yang dapat diimpor.');
          return;
        }

        if (onBulkAddTypes) {
          onBulkAddTypes(imported);
        } else {
          imported.forEach((t) => onAddType(t));
          toast.success(`${imported.length} jenis pelanggaran berhasil diimpor!`);
        }
        setSelectedImportFile(null);
        setIsImportModalOpen(false);
      } catch (err) {
        console.error(err);
        toast.error('Gagal membaca file Excel/XLS.');
      }
    };
    reader.readAsArrayBuffer(selectedImportFile);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-sky-100 overflow-hidden">
        <div className="p-6 border-b border-sky-100 flex flex-col gap-3 bg-gradient-to-r from-sky-50 to-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h4 className="font-bold text-lg flex items-center gap-2 text-sky-900">
              <Tag className="w-5 h-5 text-sky-600" /> Master Data Jenis Pelanggaran
            </h4>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-sky-700 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Baru
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportXls}
              className="flex items-center gap-1.5 bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Unduh master jenis pelanggaran ke XLS"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh XLS
            </button>
            <button
              type="button"
              onClick={handleDirectDownloadPdf}
              className="flex items-center gap-1.5 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Unduh langsung file PDF"
            >
              <FileDown className="w-3.5 h-3.5" /> Unduh PDF
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Pratinjau & Cetak PDF"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Impor jenis pelanggaran dari Excel / XLS"
            >
              <Upload className="w-3.5 h-3.5" /> Import Excel
            </button>
          </div>
        </div>

        {isFormOpen && (
          <div className="p-4 bg-sky-50 border-b border-sky-100 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-bold uppercase text-sky-600 tracking-wide">
                {editingId ? 'Edit Data' : 'Tambah Data Baru'}
              </h5>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-sky-700 mb-1">
                  Nama Pelanggaran / Reward
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full p-2 border border-sky-200 rounded-lg text-sm bg-white text-black"
                  placeholder="Contoh: Merusak fasilitas..."
                />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-xs font-semibold text-sky-700 mb-1">Poin</label>
                <input
                  type="number"
                  required
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="w-full p-2 border border-sky-200 rounded-lg text-sm bg-white text-black"
                />
                <span className="text-[10px] text-sky-500">*Gunakan minus (-) untuk Reward</span>
              </div>
              <div className="w-full md:w-40">
                <label className="block text-xs font-semibold text-sky-700 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ViolationCategory)}
                  className="w-full p-2 border border-sky-200 rounded-lg text-sm bg-white text-black"
                >
                  {Object.values(ViolationCategory).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm cursor-pointer"
                  title="Simpan"
                >
                  <Save className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition cursor-pointer"
                  title="Batal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-sky-50 text-sky-800 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider">
                  Nama Pelanggaran / Reward
                </th>
                <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider">Poin</th>
                <th className="px-6 py-3 font-bold text-xs uppercase tracking-wider text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-700">{type.label}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        type.category === ViolationCategory.RINGAN
                          ? 'bg-yellow-100 text-yellow-800'
                          : type.category === ViolationCategory.SEDANG
                          ? 'bg-orange-100 text-orange-800'
                          : type.category === ViolationCategory.BERAT
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {type.category}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono font-bold">
                    <span className={type.points < 0 ? 'text-green-600' : 'text-red-600'}>
                      {type.points > 0 ? `+${type.points}` : type.points}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(type)}
                        className="p-1.5 rounded bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTypeToDelete(type)}
                        className="p-1.5 rounded bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" /> Import Jenis Pelanggaran (Excel/XLS)
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-sky-200 rounded-2xl p-6 bg-sky-50/30 text-center">
                <Upload className="w-9 h-9 text-sky-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 mb-3">
                  Pilih file Excel (.xlsx, .xls, .csv) berisi daftar pelanggaran / reward
                </p>
                <label className="cursor-pointer bg-sky-600 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-sky-700 transition inline-block">
                  {selectedImportFile ? 'Ganti File' : 'Pilih File Excel'}
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setSelectedImportFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {selectedImportFile && (
                  <div className="mt-4 space-y-2">
                    <div className="bg-white border border-sky-100 px-3 py-2 rounded-xl text-xs text-slate-700 font-medium flex justify-between items-center">
                      <span className="truncate">{selectedImportFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedImportFile(null)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleExecImport}
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Proses Import Data
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-sky-700 bg-white border border-sky-200 py-2.5 rounded-xl hover:bg-sky-50 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4" /> Unduh Template XLS Jenis Pelanggaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        title="Pratinjau & Pengaturan Cetak Master Jenis Pelanggaran"
        fileNamePrefix="Master_Jenis_Pelanggaran"
        appConfig={effectiveAppConfig}
        currentUser={effectiveCurrentUser}
        users={users}
        onClose={() => setIsPrintModalOpen(false)}
        buildPdfDoc={buildPdfDoc}
        onSaveDefaultSettings={onSavePrintSettings}
      />

      {/* Delete ConfirmModal */}
      <ConfirmModal
        isOpen={!!typeToDelete}
        onClose={() => setTypeToDelete(null)}
        onConfirm={() => {
          if (typeToDelete) {
            onDeleteType(typeToDelete.id);
            setTypeToDelete(null);
          }
        }}
        title="Hapus Jenis Pelanggaran"
        message={
          <div>
            <p className="mb-2">Apakah Anda yakin ingin menghapus jenis pelanggaran ini?</p>
            {typeToDelete && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-800">{typeToDelete.label}</div>
                <div className="text-slate-500 mt-0.5">
                  Kategori: {typeToDelete.category} • Poin: {typeToDelete.points}
                </div>
              </div>
            )}
          </div>
        }
        variant="danger"
        confirmText="Ya, Hapus"
      />
    </>
  );
};

export default ViolationTypeManagement;