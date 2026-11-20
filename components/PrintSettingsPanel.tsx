import React, { useState } from 'react';
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
  DEFAULT_KEPSEK_LAYOUT,
  DEFAULT_STAFF_LAYOUT,
} from '../constants';
import {
  clampSignatureLayout,
  getDefaultStaffRoleTitle,
  positionToXPercent,
  PRINT_FONT_OPTIONS,
  resolvePrintSettings,
  STAFF_ROLE_PRESETS,
  xPercentToPosition,
} from '../utils/pdfKop';
import { KopStyleEditor } from './KopStyleEditor';
import { SignatureLayoutEditor } from './SignatureLayoutEditor';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  Bold,
  Check,
  FileText,
  Italic,
  RotateCcw,
  Save,
  Settings2,
  Type,
  Underline,
  UserCheck,
} from 'lucide-react';

export type PrintSettingsTab = 'layout' | 'signature' | 'kop';

interface PrintSettingsPanelProps {
  settings: PrintDocumentSettings;
  onChange: React.Dispatch<React.SetStateAction<PrintDocumentSettings>>;
  appConfig: AppConfig;
  currentUser: User;
  users?: User[];
  onSaveDefaultSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
  className?: string;
  scrollAreaClassName?: string;
  showFooterActions?: boolean;
}

export const PrintSettingsPanel: React.FC<PrintSettingsPanelProps> = ({
  settings,
  onChange,
  appConfig,
  currentUser,
  users = [],
  onSaveDefaultSettings,
  className = '',
  scrollAreaClassName = 'flex-1 overflow-y-auto p-3.5 space-y-3.5',
  showFooterActions = false,
}) => {
  const [activeTab, setActiveTab] = useState<PrintSettingsTab>('layout');
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSelectSigner = (userId: string) => {
    if (userId === 'CURRENT_USER') {
      onChange((prev) => ({
        ...prev,
        staffUserId: 'CURRENT_USER',
        staffName: currentUser.name,
        staffNip: currentUser.nip || '',
        staffRoleTitle: getDefaultStaffRoleTitle(currentUser),
      }));
      return;
    }
    if (userId === 'CUSTOM') {
      onChange((prev) => ({
        ...prev,
        staffUserId: 'CUSTOM',
      }));
      return;
    }
    const found = users.find((u) => u.id === userId);
    if (found) {
      onChange((prev) => ({
        ...prev,
        staffUserId: found.id,
        staffName: found.name,
        staffNip: found.nip || '',
        staffRoleTitle: getDefaultStaffRoleTitle(found),
      }));
    }
  };

  const handleSwapSignaturePositions = () => {
    onChange((prev) => {
      const kLayout = clampSignatureLayout(prev.kepsekLayout, {
        ...DEFAULT_KEPSEK_LAYOUT,
        xPercent: positionToXPercent(prev.kepsekPosition),
      });
      const sLayout = clampSignatureLayout(prev.staffLayout, {
        ...DEFAULT_STAFF_LAYOUT,
        xPercent: positionToXPercent(prev.staffPosition),
      });
      return {
        ...prev,
        kepsekPosition: xPercentToPosition(sLayout.xPercent),
        staffPosition: xPercentToPosition(kLayout.xPercent),
        kepsekLayout: sLayout,
        staffLayout: kLayout,
      };
    });
  };

  const handleSaveAsDefault = async () => {
    if (!onSaveDefaultSettings) return;
    setIsSavingDefault(true);
    try {
      await onSaveDefaultSettings(settings);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pengaturan default.');
    } finally {
      setIsSavingDefault(false);
    }
  };

  const handleResetToCloudDefault = () => {
    onChange(resolvePrintSettings(appConfig, currentUser, users));
    toast.info('Pengaturan cetak dikembalikan ke default tersimpan.');
  };

  const sig = settings.signatureStyle;

  return (
    <div className={`flex flex-col overflow-hidden bg-slate-100 ${className}`}>
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
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Kop &amp; TTD</span>
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
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Format TTD &amp; Font</span>
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
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Baris &amp; Spasi Kop</span>
        </button>
      </div>

      {/* Scrollable Controls */}
      <div className={`${scrollAreaClassName} text-slate-800`}>
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
                    onChange((prev) => ({ ...prev, showKop: e.target.checked }))
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
                    onChange((prev) => ({ ...prev, showPoints: e.target.checked }))
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
                      onChange((prev) => ({
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
                            onChange((prev) => {
                              const currentLayout = clampSignatureLayout(
                                prev.kepsekLayout,
                                DEFAULT_KEPSEK_LAYOUT
                              );
                              return {
                                ...prev,
                                kepsekPosition: pos.id,
                                kepsekLayout: {
                                  ...currentLayout,
                                  xPercent: positionToXPercent(pos.id),
                                },
                              };
                            })
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
                        onChange((prev) => ({ ...prev, kepsekTitle: e.target.value }))
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
                      onChange((prev) => ({
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
                            onChange((prev) => ({ ...prev, staffRoleTitle: preset }))
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
                        onChange((prev) => ({
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
                          onChange((prev) => ({
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
                          onChange((prev) => ({
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
                            onChange((prev) => {
                              const currentLayout = clampSignatureLayout(
                                prev.staffLayout,
                                DEFAULT_STAFF_LAYOUT
                              );
                              return {
                                ...prev,
                                staffPosition: pos.id,
                                staffLayout: {
                                  ...currentLayout,
                                  xPercent: positionToXPercent(pos.id),
                                },
                              };
                            })
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
                    onChange((prev) => ({ ...prev, cityLabel: e.target.value }))
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
                  onChange((prev) => ({
                    ...prev,
                    documentFontFamily: e.target.value as PrintFontFamily,
                  }))
                }
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <optgroup label="Sans-Serif Persuratan Modern">
                  {PRINT_FONT_OPTIONS.filter((f) => f.category === 'sans').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Serif Surat Dinas Resmi">
                  {PRINT_FONT_OPTIONS.filter((f) => f.category === 'serif').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Monospace / Arsip">
                  {PRINT_FONT_OPTIONS.filter((f) => f.category === 'mono').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Interactive Signature Drag, Resize & Fast-Shift Pad */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
              <SignatureLayoutEditor
                compact
                settings={settings}
                onChange={onChange}
                appConfig={appConfig}
                currentUser={currentUser}
              />
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
                        onChange((prev) => ({
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
                      onChange((prev) => ({
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
                  min={8}
                  max={55}
                  step={2}
                  value={sig.spacingHeight}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) {
                      const clampedH = Math.min(55, Math.max(8, v));
                      onChange((prev) => ({
                        ...prev,
                        signatureStyle: {
                          ...prev.signatureStyle,
                          spacingHeight: clampedH,
                        },
                        kepsekLayout: {
                          ...clampSignatureLayout(prev.kepsekLayout, DEFAULT_KEPSEK_LAYOUT),
                          heightMm: clampedH,
                        },
                        staffLayout: {
                          ...clampSignatureLayout(prev.staffLayout, DEFAULT_STAFF_LAYOUT),
                          heightMm: clampedH,
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
                      onChange((p) => ({
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
            appConfig={appConfig}
            kopStyle={settings.kopStyle}
            onChange={(updatedKopStyle) =>
              onChange((prev) => ({ ...prev, kopStyle: updatedKopStyle }))
            }
          />
        )}
      </div>

      {/* Optional footer action bar for inline pre-print usage */}
      {showFooterActions && (
        <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToCloudDefault}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset Default
          </button>

          {onSaveDefaultSettings && (
            <button
              type="button"
              onClick={handleSaveAsDefault}
              disabled={isSavingDefault}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
              title="Simpan pengaturan Kop, Spasi, TTD & Font ini sebagai default"
            >
              {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {isSavingDefault ? 'Menyimpan...' : savedNotice ? 'Tersimpan Default!' : 'Simpan Default'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PrintSettingsPanel;
