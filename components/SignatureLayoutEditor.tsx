import React, { useEffect, useRef, useState } from 'react';
import {
  AppConfig,
  PrintDocumentSettings,
  SignatureBlockLayout,
  User,
} from '../types';
import { DEFAULT_KEPSEK_LAYOUT, DEFAULT_STAFF_LAYOUT } from '../constants';
import {
  clampSignatureLayout,
  getCssFontFamily,
  positionToXPercent,
  xPercentToPosition,
} from '../utils/pdfKop';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  GripVertical,
  Maximize2,
  Move,
  RotateCcw,
} from 'lucide-react';

interface SignatureLayoutEditorProps {
  settings: PrintDocumentSettings;
  onChange: React.Dispatch<React.SetStateAction<PrintDocumentSettings>>;
  appConfig: AppConfig;
  currentUser: User;
  usableWidthMm?: number; // 180mm (A4 portrait) or 267mm (A4 landscape)
  compact?: boolean;
}

type BlockTarget = 'kepsek' | 'staff';
type DragMode = 'move' | 'resize-w' | 'resize-h' | 'resize-wh';

interface DragState {
  target: BlockTarget;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startLayout: SignatureBlockLayout;
  canvasWidthPx: number;
}

const PX_PER_MM_Y = 1.45;
const PX_PER_MM_H = 1.3;

export const SignatureLayoutEditor: React.FC<SignatureLayoutEditorProps> = ({
  settings,
  onChange,
  appConfig,
  currentUser,
  usableWidthMm = 180,
  compact = false,
}) => {
  const showKepsek = settings.showKepsekSignature;
  const showStaff = settings.showStaffSignature;

  const [selectedTarget, setSelectedTarget] = useState<BlockTarget>(() =>
    showKepsek ? 'kepsek' : 'staff'
  );
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Ensure selectedTarget always points to an enabled signature block
  useEffect(() => {
    if (selectedTarget === 'kepsek' && !showKepsek && showStaff) {
      setSelectedTarget('staff');
    } else if (selectedTarget === 'staff' && !showStaff && showKepsek) {
      setSelectedTarget('kepsek');
    }
  }, [selectedTarget, showKepsek, showStaff]);

  const kepsekLayout = clampSignatureLayout(settings.kepsekLayout, {
    ...DEFAULT_KEPSEK_LAYOUT,
    xPercent: positionToXPercent(settings.kepsekPosition),
    heightMm: settings.signatureStyle.spacingHeight ?? DEFAULT_KEPSEK_LAYOUT.heightMm,
  });

  const staffLayout = clampSignatureLayout(settings.staffLayout, {
    ...DEFAULT_STAFF_LAYOUT,
    xPercent: positionToXPercent(settings.staffPosition),
    heightMm: settings.signatureStyle.spacingHeight ?? DEFAULT_STAFF_LAYOUT.heightMm,
  });

  const updateBlockLayout = (
    target: BlockTarget,
    updater: (prev: SignatureBlockLayout) => SignatureBlockLayout
  ) => {
    onChange((prev) => {
      const currentRaw =
        target === 'kepsek'
          ? clampSignatureLayout(prev.kepsekLayout, {
              ...DEFAULT_KEPSEK_LAYOUT,
              xPercent: positionToXPercent(prev.kepsekPosition),
              heightMm: prev.signatureStyle.spacingHeight ?? DEFAULT_KEPSEK_LAYOUT.heightMm,
            })
          : clampSignatureLayout(prev.staffLayout, {
              ...DEFAULT_STAFF_LAYOUT,
              xPercent: positionToXPercent(prev.staffPosition),
              heightMm: prev.signatureStyle.spacingHeight ?? DEFAULT_STAFF_LAYOUT.heightMm,
            });
      const fallback = target === 'kepsek' ? DEFAULT_KEPSEK_LAYOUT : DEFAULT_STAFF_LAYOUT;
      const nextLayout = clampSignatureLayout(updater(currentRaw), fallback);

      if (target === 'kepsek') {
        return {
          ...prev,
          kepsekLayout: nextLayout,
          kepsekPosition: xPercentToPosition(nextLayout.xPercent),
        };
      }
      return {
        ...prev,
        staffLayout: nextLayout,
        staffPosition: xPercentToPosition(nextLayout.xPercent),
      };
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const pxPerMmX = drag.canvasWidthPx / Math.max(120, usableWidthMm);

      if (drag.mode === 'move') {
        const widthRatio = Math.min(0.92, drag.startLayout.widthMm / Math.max(120, usableWidthMm));
        const travelPx = Math.max(24, drag.canvasWidthPx * (1 - widthRatio));
        let nextX = drag.startLayout.xPercent + (dx / travelPx) * 100;
        let snappedX: number | null = null;

        // Magnetic horizontal snap to Left (0%), Center (50%), Right (100%)
        for (const anchor of [0, 50, 100]) {
          if (Math.abs(nextX - anchor) <= 2.8) {
            nextX = anchor;
            snappedX = anchor;
            break;
          }
        }
        setSnapGuide(snappedX);

        let nextY = drag.startLayout.yOffsetMm + dy / PX_PER_MM_Y;
        if (Math.abs(nextY) <= 1.5) nextY = 0;

        updateBlockLayout(drag.target, (prev) => ({
          ...prev,
          xPercent: nextX,
          yOffsetMm: nextY,
        }));
      } else {
        setSnapGuide(null);
        updateBlockLayout(drag.target, (prev) => {
          const updated = { ...prev };
          if (drag.mode === 'resize-w' || drag.mode === 'resize-wh') {
            updated.widthMm = drag.startLayout.widthMm + dx / Math.max(1.2, pxPerMmX);
          }
          if (drag.mode === 'resize-h' || drag.mode === 'resize-wh') {
            updated.heightMm = drag.startLayout.heightMm + dy / PX_PER_MM_H;
          }
          return updated;
        });
      }
    };

    const handlePointerUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setSnapGuide(null);
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usableWidthMm]);

  const startDrag = (
    e: React.PointerEvent,
    target: BlockTarget,
    mode: DragMode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTarget(target);
    const rect = canvasRef.current?.getBoundingClientRect();
    const layout = target === 'kepsek' ? kepsekLayout : staffLayout;
    dragRef.current = {
      target,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLayout: { ...layout },
      canvasWidthPx: rect?.width || 480,
    };
    setIsDragging(true);
  };

  if (!showKepsek && !showStaff) {
    return (
      <div className="py-4 px-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
        Kedua blok Tanda Tangan sedang dinonaktifkan. Aktifkan di panel kiri untuk mengatur posisi TTD.
      </div>
    );
  }

  const activeLayout = selectedTarget === 'kepsek' ? kepsekLayout : staffLayout;

  const applyPreset = (preset: 'lr' | 'swap' | 'center-pair' | 'stack-right' | 'reset') => {
    onChange((prev) => {
      const curK = clampSignatureLayout(prev.kepsekLayout, DEFAULT_KEPSEK_LAYOUT);
      const curS = clampSignatureLayout(prev.staffLayout, DEFAULT_STAFF_LAYOUT);

      if (preset === 'swap') {
        return {
          ...prev,
          kepsekLayout: curS,
          staffLayout: curK,
          kepsekPosition: xPercentToPosition(curS.xPercent),
          staffPosition: xPercentToPosition(curK.xPercent),
        };
      }
      if (preset === 'lr') {
        const nextK = { ...curK, xPercent: 0, yOffsetMm: 0 };
        const nextS = { ...curS, xPercent: 100, yOffsetMm: 0 };
        return {
          ...prev,
          kepsekLayout: nextK,
          staffLayout: nextS,
          kepsekPosition: 'left',
          staffPosition: 'right',
        };
      }
      if (preset === 'center-pair') {
        const nextK = { ...curK, xPercent: 18, yOffsetMm: 0 };
        const nextS = { ...curS, xPercent: 82, yOffsetMm: 0 };
        return {
          ...prev,
          kepsekLayout: nextK,
          staffLayout: nextS,
          kepsekPosition: 'left',
          staffPosition: 'right',
        };
      }
      if (preset === 'stack-right') {
        const nextK = { ...curK, xPercent: 100, yOffsetMm: 0 };
        const nextS = { ...curS, xPercent: 100, yOffsetMm: 36 };
        return {
          ...prev,
          kepsekLayout: nextK,
          staffLayout: nextS,
          kepsekPosition: 'right',
          staffPosition: 'right',
        };
      }
      return {
        ...prev,
        kepsekLayout: { ...DEFAULT_KEPSEK_LAYOUT },
        staffLayout: { ...DEFAULT_STAFF_LAYOUT },
        kepsekPosition: 'left',
        staffPosition: 'right',
        signatureStyle: {
          ...prev.signatureStyle,
          spacingHeight: DEFAULT_KEPSEK_LAYOUT.heightMm,
        },
      };
    });
  };

  const sig = settings.signatureStyle;
  const alignStyle = sig.align || 'left';
  const headerCss: React.CSSProperties = {
    fontWeight: sig.boldHeader ? 700 : 400,
    fontStyle: sig.italicHeader ? 'italic' : 'normal',
    textDecoration: sig.underlineHeader ? 'underline' : 'none',
  };
  const nameCss: React.CSSProperties = {
    fontWeight: sig.boldName ? 700 : 400,
    fontStyle: sig.italicName ? 'italic' : 'normal',
    textDecoration: sig.underlineName ? 'underline' : 'none',
  };
  const nipCss: React.CSSProperties = {
    fontWeight: sig.boldNip ? 700 : 400,
    fontStyle: sig.italicNip ? 'italic' : 'normal',
    textDecoration: sig.underlineNip ? 'underline' : 'none',
  };

  const city = settings.cityLabel?.trim() || 'Kudus';
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const renderBlockBox = (target: BlockTarget, layout: SignatureBlockLayout) => {
    const isSelected = selectedTarget === target;
    const isKepsek = target === 'kepsek';

    const widthPct = Math.min(92, (layout.widthMm / Math.max(120, usableWidthMm)) * 100);
    const leftPct = (100 - widthPct) * (layout.xPercent / 100);
    const topPx = 22 + Math.max(-15, layout.yOffsetMm) * PX_PER_MM_Y;
    const spacePx = Math.max(12, Math.round(layout.heightMm * PX_PER_MM_H));

    return (
      <div
        key={target}
        onPointerDown={(e) => startDrag(e, target, 'move')}
        style={{
          left: `${leftPct}%`,
          top: `${topPx}px`,
          width: `${widthPct}%`,
          fontFamily: getCssFontFamily(settings.documentFontFamily),
          textAlign: alignStyle,
          zIndex: isSelected ? 20 : 10,
        }}
        className={`absolute rounded-lg p-2 select-none touch-none transition-shadow cursor-grab active:cursor-grabbing ${
          isSelected
            ? isKepsek
              ? 'bg-indigo-50/90 border-2 border-indigo-500 shadow-md ring-2 ring-indigo-200/70'
              : 'bg-emerald-50/90 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-200/70'
            : 'bg-slate-50/85 border border-dashed border-slate-300 hover:border-indigo-400'
        }`}
        title="Seret untuk menggeser posisi TTD, atau tarik tepi kanan/bawah untuk ubah ukuran"
      >
        {/* Block Badge Pill */}
        <div className="flex items-center justify-between gap-1 mb-1 border-b border-slate-200/70 pb-0.5 text-[9px] font-sans">
          <span
            className={`font-extrabold uppercase tracking-wider flex items-center gap-0.5 truncate ${
              isKepsek ? 'text-indigo-700' : 'text-emerald-700'
            }`}
          >
            <GripVertical className="w-2.5 h-2.5 shrink-0" />
            {isKepsek ? 'TTD Kepsek' : 'TTD Guru / Admin'}
          </span>
          <span className="font-mono text-[9px] text-slate-500 shrink-0">
            {Math.round(layout.widthMm)}×{Math.round(layout.heightMm)}mm
          </span>
        </div>

        {/* Rendered Preview Text */}
        <div
          className="text-slate-800 leading-snug"
          style={{ fontSize: `${Math.max(9.5, Math.min(13, (sig.fontSize || 9) + 1))}px` }}
        >
          <div style={headerCss}>
            <div className="truncate">{isKepsek ? 'Mengetahui,' : `${city}, ${todayStr}`}</div>
            <div className="truncate">
              {isKepsek
                ? settings.kepsekTitle || 'Kepala Sekolah'
                : settings.staffRoleTitle || 'Guru BK / Admin'}
            </div>
          </div>

          {/* Adjustable Signature Space */}
          <div
            style={{ height: `${spacePx}px` }}
            className="my-0.5 rounded border border-dashed border-slate-300/80 flex items-center justify-center text-[9px] font-sans text-slate-400 bg-white/40"
          >
            Ruang TTD ({Math.round(layout.heightMm)} mm)
          </div>

          <div style={nameCss} className="truncate">
            {isKepsek
              ? appConfig.principalName || 'Kepala Sekolah'
              : settings.staffName || currentUser.name}
          </div>
          {(isKepsek ? appConfig.principalNip : settings.staffNip) && (
            <div style={nipCss} className="text-[10px] text-slate-600 truncate">
              NIP. {isKepsek ? appConfig.principalNip : settings.staffNip}
            </div>
          )}
        </div>

        {/* Right Edge Width Resize Handle */}
        <div
          onPointerDown={(e) => startDrag(e, target, 'resize-w')}
          title="Tarik ke kiri/kanan untuk ubah lebar blok TTD"
          className="absolute top-2 bottom-2 -right-1.5 w-3 flex items-center justify-center cursor-ew-resize touch-none group"
        >
          <div className="w-1 h-7 rounded-full bg-indigo-400/70 group-hover:bg-indigo-600 group-hover:scale-y-110 transition" />
        </div>

        {/* Bottom Edge Height Resize Handle */}
        <div
          onPointerDown={(e) => startDrag(e, target, 'resize-h')}
          title="Tarik ke atas/bawah untuk atur tinggi ruang tanda tangan"
          className="absolute left-3 right-3 -bottom-1.5 h-3 flex items-center justify-center cursor-ns-resize touch-none group"
        >
          <div className="h-1 w-8 rounded-full bg-emerald-400/70 group-hover:bg-emerald-600 group-hover:scale-x-110 transition" />
        </div>

        {/* Corner Both-Axis Resize Handle */}
        <div
          onPointerDown={(e) => startDrag(e, target, 'resize-wh')}
          title="Tarik pojok untuk ubah lebar & tinggi ruang TTD sekaligus"
          className={`absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full border-2 border-white shadow cursor-nwse-resize touch-none flex items-center justify-center ${
            isKepsek ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          <Maximize2 className="w-2 h-2 text-white" />
        </div>
      </div>
    );
  };

  // Dynamic paper canvas height so dragged blocks always stay inside cleanly
  const computeBottomPx = (layout: SignatureBlockLayout) =>
    22 + Math.max(-15, layout.yOffsetMm) * PX_PER_MM_Y + Math.round(layout.heightMm * PX_PER_MM_H) + 88;

  const canvasHeightPx = Math.max(
    compact ? 175 : 200,
    showKepsek ? computeBottomPx(kepsekLayout) : 0,
    showStaff ? computeBottomPx(staffLayout) : 0
  );

  return (
    <div className="space-y-2.5">
      {/* Fast Shift + Quick Presets Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-extrabold text-slate-700">
              Atur Posisi &amp; Ukuran TTD (Geser / Tarik Bebas)
            </span>
          </div>

          {/* Target Selector */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            {showKepsek && (
              <button
                type="button"
                onClick={() => setSelectedTarget('kepsek')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  selectedTarget === 'kepsek'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Blok Kepsek
              </button>
            )}
            {showStaff && (
              <button
                type="button"
                onClick={() => setSelectedTarget('staff')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  selectedTarget === 'staff'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Blok Guru/Admin
              </button>
            )}
          </div>
        </div>

        {/* Geser Cepat Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase mr-0.5">Geser Cepat:</span>
          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, xPercent: 0 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-md text-[10px] font-bold cursor-pointer"
            title="Tempel tepi kiri (0%)"
          >
            ⏮ Kiri
          </button>
          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, xPercent: p.xPercent - 5 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-md text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            title="Geser cepat ke kiri 5%"
          >
            <ArrowLeft className="w-3 h-3" /> -5%
          </button>
          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, xPercent: 50 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-md text-[10px] font-bold cursor-pointer"
            title="Posisikan tepat di tengah (50%)"
          >
            ↔ Tengah
          </button>
          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, xPercent: p.xPercent + 5 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-md text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            title="Geser cepat ke kanan 5%"
          >
            +5% <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, xPercent: 100 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-md text-[10px] font-bold cursor-pointer"
            title="Tempel tepi kanan (100%)"
          >
            Kanan ⏭
          </button>

          <span className="text-slate-300 mx-0.5">|</span>

          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, yOffsetMm: p.yOffsetMm - 3 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            title="Geser naik 3 mm"
          >
            <ArrowUp className="w-3 h-3" /> Naik
          </button>
          <button
            type="button"
            onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, yOffsetMm: p.yOffsetMm + 3 }))}
            className="px-2 py-1 bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
            title="Geser turun 3 mm"
          >
            <ArrowDown className="w-3 h-3" /> Turun
          </button>
        </div>

        {/* Size Controls + Presets Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
              <span className="font-bold text-slate-500">Lebar:</span>
              <button
                type="button"
                onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, widthMm: p.widthMm - 5 }))}
                className="px-1 font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
              >
                -
              </button>
              <span className="font-mono font-bold text-slate-800 w-10 text-center">
                {Math.round(activeLayout.widthMm)}mm
              </span>
              <button
                type="button"
                onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, widthMm: p.widthMm + 5 }))}
                className="px-1 font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
              <span className="font-bold text-slate-500">Ruang TTD:</span>
              <button
                type="button"
                onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, heightMm: p.heightMm - 3 }))}
                className="px-1 font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
              >
                -
              </button>
              <span className="font-mono font-bold text-slate-800 w-10 text-center">
                {Math.round(activeLayout.heightMm)}mm
              </span>
              <button
                type="button"
                onClick={() => updateBlockLayout(selectedTarget, (p) => ({ ...p, heightMm: p.heightMm + 3 }))}
                className="px-1 font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
              >
                +
              </button>
            </div>

            <span className="font-mono text-[10px] text-slate-500">
              X:{Math.round(activeLayout.xPercent)}% Y:{activeLayout.yOffsetMm > 0 ? `+${Math.round(activeLayout.yOffsetMm)}` : Math.round(activeLayout.yOffsetMm)}mm
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {showKepsek && showStaff && (
              <>
                <button
                  type="button"
                  onClick={() => applyPreset('lr')}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold cursor-pointer"
                >
                  Kiri–Kanan
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('swap')}
                  className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-2.5 h-2.5" /> Tukar
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('center-pair')}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold cursor-pointer"
                >
                  Sejajar Tengah
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('stack-right')}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold cursor-pointer"
                >
                  Vertikal Kanan
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => applyPreset('reset')}
              className="px-2 py-0.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Kembalikan posisi dan ukuran TTD ke bawaan"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Paper Canvas */}
      <div
        ref={canvasRef}
        style={{ height: `${canvasHeightPx}px` }}
        className={`relative w-full rounded-xl border bg-white overflow-hidden transition-colors ${
          isDragging ? 'border-indigo-400 shadow-inner' : 'border-slate-200'
        }`}
      >
        {/* Subtle Paper Margin Guide Lines */}
        <div
          className={`absolute inset-y-0 left-0 w-px pointer-events-none ${
            snapGuide === 0 ? 'bg-indigo-500 w-0.5' : 'bg-slate-200/70'
          }`}
        />
        <div
          className={`absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none border-l border-dashed ${
            snapGuide === 50 ? 'border-indigo-500 border-solid w-0.5' : 'border-slate-200'
          }`}
        />
        <div
          className={`absolute inset-y-0 right-0 w-px pointer-events-none ${
            snapGuide === 100 ? 'bg-indigo-500 w-0.5' : 'bg-slate-200/70'
          }`}
        />

        <div className="px-2.5 pt-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider flex justify-between pointer-events-none">
          <span>Margin Kiri</span>
          <span>Tengah Kertas</span>
          <span>Margin Kanan</span>
        </div>

        {showKepsek && renderBlockBox('kepsek', kepsekLayout)}
        {showStaff && renderBlockBox('staff', staffLayout)}
      </div>
    </div>
  );
};

export default SignatureLayoutEditor;
