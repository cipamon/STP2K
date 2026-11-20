import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import {
  AppConfig,
  PrintDocumentSettings,
  User,
} from '../types';
import { resolvePrintSettings } from '../utils/pdfKop';
import PrintSettingsPanel from './PrintSettingsPanel';
import {
  ArrowDownCircle,
  Check,
  Printer,
  RefreshCw,
  Save,
  Sliders,
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
  onSettingsChange?: (settings: PrintDocumentSettings) => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  title,
  subtitle = 'Atur Kop Surat, Spasi, Tanda Tangan, Posisi, dan Jenis Font sebelum mencetak atau mengunduh PDF',
  fileNamePrefix,
  appConfig,
  currentUser,
  users = [],
  onClose,
  buildPdfDoc,
  onSaveDefaultSettings,
  defaultOverrides,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(appConfig, currentUser, users, defaultOverrides)
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSavingDefault, setIsSavingDefault] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [showControlsOnMobile, setShowControlsOnMobile] = useState<boolean>(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const buildPdfRef = useRef(buildPdfDoc);
  buildPdfRef.current = buildPdfDoc;
  const onSettingsChangeRef = useRef(onSettingsChange);
  onSettingsChangeRef.current = onSettingsChange;

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

  // Sync edits back to parent pre-print panel if callback provided
  const handleSettingsUpdate: React.Dispatch<React.SetStateAction<PrintDocumentSettings>> = (updater) => {
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (onSettingsChangeRef.current) {
        onSettingsChangeRef.current(next);
      }
      return next;
    });
  };

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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-md p-1.5 sm:p-4 animate-in fade-in duration-200 print:hidden">
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[96dvh] sm:h-[94dvh] flex flex-col overflow-hidden border border-slate-700">
        {/* Modal Header */}
        <div className="px-3 py-2.5 sm:px-5 sm:py-3.5 bg-slate-800 border-b border-slate-700 flex flex-wrap justify-between items-center gap-2 sm:gap-3 text-white shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400 shrink-0">
              <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-base leading-tight truncate">{title}</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowControlsOnMobile((v) => !v)}
              className="lg:hidden bg-slate-700 hover:bg-slate-600 text-white px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showControlsOnMobile ? 'Tutup Pengaturan' : 'Atur Kop & TTD'}
            </button>

            {onSaveDefaultSettings && (
              <button
                type="button"
                onClick={handleSaveAsDefault}
                disabled={isSavingDefault}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-60"
                title="Simpan pengaturan Kop, Spasi, TTD, dan Font ini sebagai default di Cloud"
              >
                {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isSavingDefault ? 'Menyimpan...' : savedNotice ? 'Tersimpan!' : 'Simpan Default'}</span>
                <span className="sm:hidden">{savedNotice ? 'OK' : 'Simpan'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintIframe}
              disabled={!pdfUrl}
              className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              <ArrowDownCircle className="w-4 h-4" /> <span className="hidden sm:inline">Unduh PDF</span><span className="sm:hidden">PDF</span>
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
          <PrintSettingsPanel
            settings={settings}
            onChange={handleSettingsUpdate}
            appConfig={appConfig}
            currentUser={currentUser}
            users={users}
            className={`${
              showControlsOnMobile ? 'flex' : 'hidden lg:flex'
            } w-full lg:w-[420px] xl:w-[450px] border-b lg:border-b-0 lg:border-r border-slate-300 max-h-[50dvh] lg:max-h-none shrink-0`}
          />

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
