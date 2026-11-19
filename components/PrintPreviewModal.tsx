import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import {
  AppConfig,
  PrintDocumentSettings,
  PrintFontFamily,
  PrintTextAlign,
  SignatureBoxPosition,
  User,
} from '../types';
import {
  getDefaultStaffRoleTitle,
  resolvePrintSettings,
  STAFF_ROLE_PRESETS,
} from '../utils/pdfKop';
import { KopStyleEditor } from './KopStyleEditor';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownCircle,
  ArrowLeftRight,
  Bold,
  Check,
  FileText,
  Italic,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Sliders,
  Type,
  Underline,
  UserCheck,
  X,
} from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  fileNamePrefix: string;
  appConfig: AppConfig;
  currentUser: User;
  users?: User[];
  onClose: () => void;
  buildPdfDoc: (settings: PrintDocumentSettings) => Promise<jsPDF>;
  onSaveDefaultSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
  defaultOverrides?: Partial<PrintDocumentSettings>;
}

type SettingsTab = 'layout' | 'signature' | 'kop';

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  title,
  subtitle = 'Atur Kop Surat, Tanda Tangan, Posisi, dan Jenis Font sebelum mencetak atau mengunduh PDF',
  fileNamePrefix,
  appConfig,
  currentUser,
  users = [],
  onClose,
  buildPdfDoc,
  onSaveDefaultSettings,
  defaultOverrides,
}) => {
  const [settings, setSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(appConfig, currentUser, users, defaultOverrides)
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>('layout');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSavingDefault, setIsSavingDefault] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [showControlsOnMobile, setShowControlsOnMobile] = useState<boolean>(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const buildPdfRef = useRef(buildPdfDoc);
  buildPdfRef.current = buildPdfDoc;

  // Reset draft settings whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(resolvePrintSettings(appConfig, currentUser, users, defaultOverrides));
      setSavedNotice(false);
    } else {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
      setPdfUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Rebuild PDF preview smoothly when settings change
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsGenerating(true);

    const timer = window.setTimeout(async () => {
      try {
        const doc = await buildPdfRef.current(settings);
        if (cancelled) return;
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        if (lastUrlRef.current) {
          URL.revokeObjectURL(lastUrlRef.current);
        }
        lastUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        if (!cancelled) {
          console.error('Preview PDF build error:', err);
          toast.error('Gagal memperbarui pratinjau PDF.');
        }
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSelectSigner = (userId: string) => {
    if (userId === 'CURRENT_USER') {
      setSettings((prev) => ({
        ...prev,
        staffUserId: 'CURRENT_USER',
        staffName: currentUser.name,
        staffNip: currentUser.nip || '',
        staffRoleTitle: getDefaultStaffRoleTitle(currentUser),
      }));
      return;
    }
    if (userId === 'CUSTOM') {
      setSettings((prev) => ({
        ...prev,
        staffUserId: 'CUSTOM',
      }));
      return;
    }
    const found = users.find((u) => u.id === userId);
    if (found) {
      setSettings((prev) => ({
        ...prev,
        staffUserId: found.id,
        staffName: found.name,
        staffNip: found.nip || '',
        staffRoleTitle: getDefaultStaffRoleTitle(found),
      }));
    }
  };

  const handleSwapSignaturePositions = () => {
    setSettings((prev) => ({
      ...prev,
      kepsekPosition: prev.staffPosition,
      staffPosition: prev.kepsekPosition,
    }));
  };

  const handleDownloadPdf = async () => {
    try {
      const doc = await buildPdfRef.current(settings);
      doc.save(`${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('File PDF berhasil diunduh sesuai pengaturan cetak!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh PDF.');
    }
  };

  const handlePrintIframe = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Iframe print fallback:', err);
      }
    }
    toast.info('Gunakan tombol ikon Print di pratinjau PDF atau unduh PDF untuk mencetak.');
  };

  const handleSaveAsDefault = async () => {
    if (!onSaveDefaultSettings) return;
    setIsSavingDefault(true);
    try {
      await onSaveDefaultSettings(settings);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pengaturan default.');
    } finally {
      setIsSavingDefault(false);
    }
  };

  const sig = settings.signatureStyle;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200 print:hidden">
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-slate-700">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-800 border-b border-slate-700 flex flex-wrap justify-between items-center gap-3 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base leading-tight truncate">{title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowControlsOnMobile((v) => !v)}
              className="lg:hidden bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showControlsOnMobile ? 'Sembunyikan Pengaturan' : 'Atur Kop & TTD'}
            </button>

            {onSaveDefaultSettings && (
              <button
                type="button"
                onClick={handleSaveAsDefault}
                disabled={isSavingDefault}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-60"
                title="Simpan pengaturan Kop, TTD, dan Font ini sebagai default di Cloud"
              >
                {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {isSavingDefault ? 'Menyimpan...' : savedNotice ? 'Tersimpan!' : 'Simpan Default'}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintIframe}
              disabled={!pdfUrl}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              <ArrowDownCircle className="w-4 h-4" /> Unduh PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-xl transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Controls Panel + PDF Preview */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Settings Panel */}
          <div
            className={`${
              showControlsOnMobile ? 'flex' : 'hidden lg:flex'
            } w-full lg:w-[420px] xl:w-[450px] bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-300 flex-col max-h-[48vh] lg:max-h-none shrink-0 overflow-hidden`}
          >
            {/* Sub-Tabs */}
            <div className="p-2.5 bg-white border-b border-slate-200 grid grid-cols-3 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('layout')}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'layout'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Kop &amp; TTD
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('signature')}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'signature'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Format TTD &amp; Font
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('kop')}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'kop'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Baris Kop
              </button>
            </div>

            {/* Scrollable Controls */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-slate-800">
              {activeTab === 'layout' && (
                <>
                  {/* Tampilkan Kop Surat */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-slate-800">Tampilkan Kop Surat</div>
                      <div className="text-[11px] text-slate-500">
                        Sertakan logo &amp; identitas sekolah di bagian atas PDF
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.showKop}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, showKop: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                  </div>

                  {/* Tampilkan Poin */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-slate-800">Tampilkan Poin Laporan</div>
                      <div className="text-[11px] text-slate-500">
                        Sertakan kolom nilai poin &amp; total poin pada dokumen cetak / PDF
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.showPoints !== false}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, showPoints: e.target.checked }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                    </label>
                  </div>

                  {/* TTD Kepala Sekolah */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-slate-800">
                          TTD Kepala Sekolah
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[230px]">
                          {appConfig.principalName || 'Kepala Sekolah'}
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.showKepsekSignature}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              showKepsekSignature: e.target.checked,
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                      </label>
                    </div>

                    {settings.showKepsekSignature && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Posisi Blok TTD Kepala Sekolah
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: 'left', label: 'Kiri' },
                                { id: 'center', label: 'Tengah' },
                                { id: 'right', label: 'Kanan' },
                              ] as Array<{ id: SignatureBoxPosition; label: string }>
                            ).map((pos) => (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() =>
                                  setSettings((prev) => ({ ...prev, kepsekPosition: pos.id }))
                                }
                                className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  settings.kepsekPosition === pos.id
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Teks Jabatan Kepala Sekolah
                          </label>
                          <input
                            type="text"
                            value={settings.kepsekTitle}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, kepsekTitle: e.target.value }))
                            }
                            placeholder="Kepala Sekolah"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TTD Admin / Guru */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-slate-800">
                          TTD Admin / Guru / TU
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[230px]">
                          {settings.staffName || currentUser.name}
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.showStaffSignature}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              showStaffSignature: e.target.checked,
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                      </label>
                    </div>

                    {settings.showStaffSignature && (
                      <div className="pt-2 border-t border-slate-100 space-y-2.5">
                        {/* Pilih Penandatangan */}
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Pilih Akun Penandatangan (Guru / TU / Admin)
                          </label>
                          <select
                            value={settings.staffUserId || 'CURRENT_USER'}
                            onChange={(e) => handleSelectSigner(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="CURRENT_USER">
                              Akun Login Saat Ini ({currentUser.name})
                            </option>
                            {users
                              .filter((u) => u.id !== currentUser.id)
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.position || u.role})
                                </option>
                              ))}
                            <option value="CUSTOM">Input Manual / Khusus...</option>
                          </select>
                        </div>

                        {/* Pilih Jabatan / Posisi Penandatangan */}
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Jabatan / Keterangan Penandatangan
                          </label>
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {STAFF_ROLE_PRESETS.slice(0, 6).map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setSettings((prev) => ({ ...prev, staffRoleTitle: preset }))
                                }
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                  settings.staffRoleTitle === preset
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={settings.staffRoleTitle}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                staffRoleTitle: e.target.value,
                              }))
                            }
                            placeholder="Contoh: Guru BK / Wali Kelas / Admin"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Nama & NIP Penandatangan */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                              Nama Penandatangan
                            </label>
                            <input
                              type="text"
                              value={settings.staffName}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  staffUserId: 'CUSTOM',
                                  staffName: e.target.value,
                                }))
                              }
                              placeholder="Nama lengkap"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                              NIP (Opsional)
                            </label>
                            <input
                              type="text"
                              value={settings.staffNip}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  staffUserId: 'CUSTOM',
                                  staffNip: e.target.value,
                                }))
                              }
                              placeholder="Kosongkan jika tanpa NIP"
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Posisi Blok TTD Guru / Admin */}
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Posisi Blok TTD Guru / Admin
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: 'left', label: 'Kiri' },
                                { id: 'center', label: 'Tengah' },
                                { id: 'right', label: 'Kanan' },
                              ] as Array<{ id: SignatureBoxPosition; label: string }>
                            ).map((pos) => (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() =>
                                  setSettings((prev) => ({ ...prev, staffPosition: pos.id }))
                                }
                                className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                  settings.staffPosition === pos.id
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Swap + Kota */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5">
                    {settings.showKepsekSignature && settings.showStaffSignature && (
                      <button
                        type="button"
                        onClick={handleSwapSignaturePositions}
                        className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" /> Tukar Posisi Kepsek ↔ Guru/Admin
                      </button>
                    )}

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Kota / Tempat Surat
                      </label>
                      <input
                        type="text"
                        value={settings.cityLabel}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, cityLabel: e.target.value }))
                        }
                        placeholder="Kudus"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'signature' && (
                <>
                  {/* Font Family Dokumen & TTD */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-indigo-600" /> Jenis Tulisan / Font Dokumen &amp; TTD
                    </label>
                    <select
                      value={settings.documentFontFamily || 'helvetica'}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          documentFontFamily: e.target.value as PrintFontFamily,
                        }))
                      }
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="helvetica">Helvetica / Arial (Sans-Serif)</option>
                      <option value="times">Times New Roman (Serif Resmi)</option>
                      <option value="courier">Courier New (Monospace)</option>
                    </select>
                  </div>

                  {/* Perataan Teks TTD */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Perataan Teks di Dalam Blok TTD
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Default: Rata Kiri
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'left', label: 'Left', icon: AlignLeft },
                          { id: 'center', label: 'Center', icon: AlignCenter },
                          { id: 'right', label: 'Right', icon: AlignRight },
                          { id: 'justify', label: 'Justify', icon: AlignJustify },
                        ] as Array<{ id: PrintTextAlign; label: string; icon: any }>
                      ).map((al) => {
                        const Icon = al.icon;
                        const active = sig.align === al.id;
                        return (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                signatureStyle: { ...prev.signatureStyle, align: al.id },
                              }))
                            }
                            className={`py-2 px-1 rounded-lg text-[11px] font-bold border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{al.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ukuran Huruf & Ruang TTD */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Ukuran Huruf TTD (pt)
                      </label>
                      <input
                        type="number"
                        min={7}
                        max={14}
                        step={0.5}
                        value={sig.fontSize}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v)) {
                            setSettings((prev) => ({
                              ...prev,
                              signatureStyle: {
                                ...prev.signatureStyle,
                                fontSize: Math.min(14, Math.max(7, v)),
                              },
                            }));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Jarak Ruang TTD (mm)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={40}
                        step={2}
                        value={sig.spacingHeight}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v)) {
                            setSettings((prev) => ({
                              ...prev,
                              signatureStyle: {
                                ...prev.signatureStyle,
                                spacingHeight: Math.min(40, Math.max(10, v)),
                              },
                            }));
                          }
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50"
                      />
                    </div>
                  </div>

                  {/* B / I / U Per Bagian TTD */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Gaya Teks (B / I / U) Tanda Tangan
                    </div>

                    {/* Header / Jabatan */}
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-700">
                        Tanggal &amp; Jabatan
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                boldHeader: !p.signatureStyle.boldHeader,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.boldHeader
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Bold Header TTD"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                italicHeader: !p.signatureStyle.italicHeader,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.italicHeader
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Italic Header TTD"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                underlineHeader: !p.signatureStyle.underlineHeader,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.underlineHeader
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Underline Header TTD"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nama Penandatangan */}
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-700">
                        Nama Penandatangan
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                boldName: !p.signatureStyle.boldName,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.boldName
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Bold Nama"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                italicName: !p.signatureStyle.italicName,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.italicName
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Italic Nama"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                underlineName: !p.signatureStyle.underlineName,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.underlineName
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Underline Nama"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* NIP */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-semibold text-slate-700">Baris NIP</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                boldNip: !p.signatureStyle.boldNip,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.boldNip
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Bold NIP"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                italicNip: !p.signatureStyle.italicNip,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.italicNip
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Italic NIP"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((p) => ({
                              ...p,
                              signatureStyle: {
                                ...p.signatureStyle,
                                underlineNip: !p.signatureStyle.underlineNip,
                              },
                            }))
                          }
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            sig.underlineNip
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                          title="Underline NIP"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'kop' && (
                <KopStyleEditor
                  compact
                  kopStyle={settings.kopStyle}
                  onChange={(updatedKopStyle) =>
                    setSettings((prev) => ({ ...prev, kopStyle: updatedKopStyle }))
                  }
                />
              )}
            </div>
          </div>

          {/* Right PDF Live Preview */}
          <div className="flex-1 bg-slate-800 relative min-h-[300px]">
            {isGenerating && (
              <div className="absolute top-3 right-3 z-10 bg-slate-900/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700 shadow-lg">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                Memperbarui pratinjau...
              </div>
            )}

            {pdfUrl ? (
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                className="w-full h-full border-0"
                title="PDF Print Preview"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                Menyiapkan pratinjau dokumen PDF...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
