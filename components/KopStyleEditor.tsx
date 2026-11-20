import React from 'react';
import { AppConfig, KopSuratStyleConfig, PrintFontFamily, PrintTextAlign, TextFormatStyle } from '../types';
import { DEFAULT_APP_CONFIG, DEFAULT_KOP_STYLE } from '../constants';
import { getDefaultKopLines, PRINT_FONT_OPTIONS } from '../utils/pdfKop';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  RotateCcw,
  Type,
  Minus,
  Plus,
} from 'lucide-react';

interface KopStyleEditorProps {
  kopStyle: KopSuratStyleConfig;
  onChange: (updated: KopSuratStyleConfig) => void;
  appConfig?: AppConfig;
  compact?: boolean;
}

type KopLineKey = 'line1' | 'line2' | 'line3' | 'line4' | 'line5' | 'line6';

const KOP_LINE_META: Array<{
  key: KopLineKey;
  label: string;
  hint: string;
}> = [
  { key: 'line1', label: 'Baris 1 • Pemerintah', hint: 'Contoh: PEMERINTAH PROVINSI JAWA TENGAH' },
  { key: 'line2', label: 'Baris 2 • Dinas / Instansi', hint: 'Contoh: DINAS PENDIDIKAN' },
  { key: 'line3', label: 'Baris 3 • Nama Sekolah', hint: 'Contoh: SMA NEGERI 1 KUDUS' },
  { key: 'line4', label: 'Baris 4 • Alamat Lengkap', hint: 'Jalan, kota, kabupaten, provinsi' },
  { key: 'line5', label: 'Baris 5 • Kode Pos, Telp, Fax', hint: 'Kode Pos, Telepon, Faksimile' },
  { key: 'line6', label: 'Baris 6 • Laman & Email', hint: 'Website dan Pos-el resmi' },
];

const SANS_FONTS = PRINT_FONT_OPTIONS.filter((f) => f.category === 'sans');
const SERIF_FONTS = PRINT_FONT_OPTIONS.filter((f) => f.category === 'serif');
const MONO_FONTS = PRINT_FONT_OPTIONS.filter((f) => f.category === 'mono');

export const KopStyleEditor: React.FC<KopStyleEditorProps> = ({
  kopStyle,
  onChange,
  appConfig,
  compact = false,
}) => {
  const defaultLines = getDefaultKopLines(appConfig || DEFAULT_APP_CONFIG);
  const lineSpacing = kopStyle.lineSpacing ?? DEFAULT_KOP_STYLE.lineSpacing ?? 1.0;
  const bottomSpacing = kopStyle.bottomSpacing ?? DEFAULT_KOP_STYLE.bottomSpacing ?? 6;

  const updateLine = (
    key: KopLineKey,
    patch: Partial<TextFormatStyle>
  ) => {
    const currentLine = { ...DEFAULT_KOP_STYLE[key], ...(kopStyle[key] || {}) };
    onChange({
      ...kopStyle,
      [key]: { ...currentLine, ...patch },
    });
  };

  const handleReset = () => {
    onChange({
      fontFamily: DEFAULT_KOP_STYLE.fontFamily,
      lineSpacing: DEFAULT_KOP_STYLE.lineSpacing,
      bottomSpacing: DEFAULT_KOP_STYLE.bottomSpacing,
      line1: { ...DEFAULT_KOP_STYLE.line1 },
      line2: { ...DEFAULT_KOP_STYLE.line2 },
      line3: { ...DEFAULT_KOP_STYLE.line3 },
      line4: { ...DEFAULT_KOP_STYLE.line4 },
      line5: { ...DEFAULT_KOP_STYLE.line5 },
      line6: { ...DEFAULT_KOP_STYLE.line6 },
    });
  };

  return (
    <div className="space-y-3">
      {/* Font Selector + Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="flex-1">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Type className="w-3.5 h-3.5 text-indigo-600" /> Jenis Tulisan / Font Kop Surat
          </label>
          <select
            value={kopStyle.fontFamily || 'helvetica'}
            onChange={(e) =>
              onChange({ ...kopStyle, fontFamily: e.target.value as PrintFontFamily })
            }
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <optgroup label="Sans-Serif Persuratan Modern">
              {SANS_FONTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Serif Surat Dinas Resmi">
              {SERIF_FONTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Monospace / Arsip">
              {MONO_FONTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer shrink-0 self-end"
          title="Kembalikan ukuran, spasi & gaya kop ke default"
        >
          <RotateCcw className="w-3 h-3" /> Reset Gaya Kop
        </button>
      </div>

      {/* Pengaturan Spasi Kop Surat */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'sm:grid-cols-2'} gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3`}>
        <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800">Spasi Antar Baris Kop</div>
            <div className="text-[10px] text-slate-400">Renggang / rapat teks kop (0.7x - 1.8x)</div>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...kopStyle,
                  lineSpacing: Math.max(0.7, Number((lineSpacing - 0.05).toFixed(2))),
                })
              }
              className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
              title="Rapatkan spasi baris kop"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={0.7}
              max={1.8}
              step={0.05}
              value={lineSpacing}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  onChange({
                    ...kopStyle,
                    lineSpacing: Math.min(1.8, Math.max(0.7, Number(val.toFixed(2)))),
                  });
                }
              }}
              className="w-11 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            />
            <span className="text-[10px] font-bold text-slate-400 pr-0.5">x</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...kopStyle,
                  lineSpacing: Math.min(1.8, Number((lineSpacing + 0.05).toFixed(2))),
                })
              }
              className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
              title="Renggangkan spasi baris kop"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800">Jarak Bawah Garis Kop</div>
            <div className="text-[10px] text-slate-400">Jarak garis ganda ke isi surat (mm)</div>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...kopStyle,
                  bottomSpacing: Math.max(2, Math.round(bottomSpacing - 1)),
                })
              }
              className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
              title="Kurangi jarak bawah kop"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={2}
              max={20}
              step={1}
              value={bottomSpacing}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  onChange({
                    ...kopStyle,
                    bottomSpacing: Math.min(20, Math.max(2, Math.round(val))),
                  });
                }
              }}
              className="w-10 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            />
            <span className="text-[10px] font-bold text-slate-400 pr-0.5">mm</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...kopStyle,
                  bottomSpacing: Math.min(20, Math.round(bottomSpacing + 1)),
                })
              }
              className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
              title="Tambah jarak bawah kop"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Per-line Editor */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-2'} gap-2.5`}>
        {KOP_LINE_META.map((item) => {
          const line = { ...DEFAULT_KOP_STYLE[item.key], ...(kopStyle[item.key] || {}) };
          const fontSize = line.fontSize ?? 10;
          const align: PrintTextAlign = line.align || 'center';
          const defaultText = defaultLines[item.key];
          const isOverridden = line.text !== undefined;
          const displayText = isOverridden ? (line.text ?? '') : defaultText;

          return (
            <div
              key={item.key}
              className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{item.label}</div>
                  {!compact && (
                    <div className="text-[10px] text-slate-400 truncate">{item.hint}</div>
                  )}
                </div>

                {/* Font size stepper */}
                <div className="flex items-center gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateLine(item.key, {
                        fontSize: Math.max(6, Number((fontSize - 0.5).toFixed(1))),
                      })
                    }
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                    title="Perkecil huruf"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={6}
                    max={28}
                    step={0.5}
                    value={fontSize}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateLine(item.key, { fontSize: Math.min(28, Math.max(6, val)) });
                      }
                    }}
                    className="w-11 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-slate-400 pr-0.5">pt</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateLine(item.key, {
                        fontSize: Math.min(28, Number((fontSize + 0.5).toFixed(1))),
                      })
                    }
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                    title="Perbesar huruf"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Editable Line Text Input */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={displayText}
                  onChange={(e) => updateLine(item.key, { text: e.target.value })}
                  placeholder={defaultText || item.hint}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isOverridden && (
                  <button
                    type="button"
                    onClick={() => {
                      const { text: _removed, ...rest } = {
                        ...DEFAULT_KOP_STYLE[item.key],
                        ...(kopStyle[item.key] || {}),
                      };
                      onChange({
                        ...kopStyle,
                        [item.key]: rest,
                      });
                    }}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                    title="Kembalikan isi teks baris ini ke pengaturan sekolah"
                  >
                    Default
                  </button>
                )}
              </div>

              {/* Formatting Toolbar: B / I / U + Left / Center / Right / Justify */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateLine(item.key, { bold: !line.bold })}
                    className={`p-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      line.bold
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Tebal (Bold)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLine(item.key, { italic: !line.italic })}
                    className={`p-1.5 rounded-lg text-xs border transition cursor-pointer ${
                      line.italic
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Miring (Italic)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLine(item.key, { underline: !line.underline })}
                    className={`p-1.5 rounded-lg text-xs border transition cursor-pointer ${
                      line.underline
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Garis Bawah (Underline)"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'left', icon: AlignLeft, title: 'Rata Kiri (Left)' },
                      { id: 'center', icon: AlignCenter, title: 'Tengah (Center)' },
                      { id: 'right', icon: AlignRight, title: 'Rata Kanan (Right)' },
                      { id: 'justify', icon: AlignJustify, title: 'Rata Kiri-Kanan (Justify)' },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = align === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateLine(item.key, { align: opt.id })}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={opt.title}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KopStyleEditor;
