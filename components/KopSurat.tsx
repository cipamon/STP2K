import React from 'react';
import { AppConfig, PrintDocumentSettings, TextFormatStyle } from '../types';
import { PROVINSI_LOGO_URL, DEFAULT_KOP_STYLE } from '../constants';
import { getCssFontFamily, getResolvedKopLines } from '../utils/pdfKop';

interface KopSuratProps {
  appConfig: AppConfig;
  className?: string;
  showBorder?: boolean;
  printSettings?: PrintDocumentSettings;
}

const getLineInlineStyle = (
  style: TextFormatStyle | undefined,
  fallback: TextFormatStyle,
  fontFamilyCss: string,
  lineSpacing: number,
  marginTopPx: number = 0
): React.CSSProperties => {
  const merged = { ...fallback, ...(style || {}) };
  const align = merged.align || 'center';
  const ptSize = merged.fontSize || fallback.fontSize || 10;
  return {
    fontFamily: fontFamilyCss,
    fontSize: `${ptSize}pt`,
    fontWeight: merged.bold ? 700 : 400,
    fontStyle: merged.italic ? 'italic' : 'normal',
    textDecoration: merged.underline ? 'underline' : 'none',
    textAlign: align,
    lineHeight: Number((1.22 * lineSpacing).toFixed(2)),
    marginTop: marginTopPx ? `${marginTopPx}px` : undefined,
    ...(align === 'justify' ? { textAlignLast: 'justify' as const } : {}),
  };
};

export const KopSurat: React.FC<KopSuratProps> = ({
  appConfig,
  className = '',
  showBorder = true,
  printSettings,
}) => {
  const effectiveSettings = printSettings || appConfig.printSettings;
  if (effectiveSettings && effectiveSettings.showKop === false) {
    return null;
  }

  const kopStyle = {
    fontFamily: effectiveSettings?.kopStyle?.fontFamily || DEFAULT_KOP_STYLE.fontFamily,
    lineSpacing: effectiveSettings?.kopStyle?.lineSpacing ?? DEFAULT_KOP_STYLE.lineSpacing ?? 1.0,
    bottomSpacing: effectiveSettings?.kopStyle?.bottomSpacing ?? DEFAULT_KOP_STYLE.bottomSpacing ?? 6,
    line1: { ...DEFAULT_KOP_STYLE.line1, ...(effectiveSettings?.kopStyle?.line1 || {}) },
    line2: { ...DEFAULT_KOP_STYLE.line2, ...(effectiveSettings?.kopStyle?.line2 || {}) },
    line3: { ...DEFAULT_KOP_STYLE.line3, ...(effectiveSettings?.kopStyle?.line3 || {}) },
    line4: { ...DEFAULT_KOP_STYLE.line4, ...(effectiveSettings?.kopStyle?.line4 || {}) },
    line5: { ...DEFAULT_KOP_STYLE.line5, ...(effectiveSettings?.kopStyle?.line5 || {}) },
    line6: { ...DEFAULT_KOP_STYLE.line6, ...(effectiveSettings?.kopStyle?.line6 || {}) },
  };

  const fontCss = getCssFontFamily(kopStyle.fontFamily);
  const lineSpacing = Math.min(1.8, Math.max(0.7, kopStyle.lineSpacing));
  const bottomSpacingMm = Math.min(20, Math.max(2, kopStyle.bottomSpacing));

  const lines = getResolvedKopLines(appConfig, kopStyle);
  const website = appConfig.website || 'http://sma1kudus.sch.id';
  const email = appConfig.email || 'sma1kds@yahoo.co.id';
  const provLogo = appConfig.provinsiLogoUrl || PROVINSI_LOGO_URL;
  const schoolLogo = appConfig.logoUrl || '/logo.png';
  const isCustomLine6 = kopStyle.line6?.text !== undefined;

  return (
    <div className={`w-full text-black select-none bg-white ${className}`}>
      <div className="flex items-center justify-between gap-4 sm:gap-6 pb-2">
        {/* Logo Provinsi Jawa Tengah (Kiri) */}
        <div className="w-20 sm:w-28 shrink-0 flex items-center justify-center">
          <img
            src={provLogo}
            alt="Logo Provinsi Jawa Tengah"
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PROVINSI_LOGO_URL;
            }}
          />
        </div>

        {/* Kop Surat Header Text (Tengah) */}
        <div className="flex-1 px-1 sm:px-2">
          {lines.line1.trim() && (
            <h3
              className="tracking-wider text-black"
              style={getLineInlineStyle(kopStyle.line1, DEFAULT_KOP_STYLE.line1, fontCss, lineSpacing, 0)}
            >
              {lines.line1}
            </h3>
          )}
          {lines.line2.trim() && (
            <h2
              className="tracking-wide text-black"
              style={getLineInlineStyle(kopStyle.line2, DEFAULT_KOP_STYLE.line2, fontCss, lineSpacing, Math.round(2 * lineSpacing))}
            >
              {lines.line2}
            </h2>
          )}
          {lines.line3.trim() && (
            <h1
              className="tracking-tight text-black"
              style={getLineInlineStyle(kopStyle.line3, DEFAULT_KOP_STYLE.line3, fontCss, lineSpacing, Math.round(2 * lineSpacing))}
            >
              {lines.line3}
            </h1>
          )}
          {lines.line4.trim() && (
            <p
              className="text-black"
              style={getLineInlineStyle(kopStyle.line4, DEFAULT_KOP_STYLE.line4, fontCss, lineSpacing, Math.round(5 * lineSpacing))}
            >
              {lines.line4}
            </p>
          )}
          {lines.line5.trim() && (
            <p
              className="text-black"
              style={getLineInlineStyle(kopStyle.line5, DEFAULT_KOP_STYLE.line5, fontCss, lineSpacing, Math.round(1 * lineSpacing))}
            >
              {lines.line5}
            </p>
          )}
          {lines.line6.trim() && (
            <p
              className="text-black"
              style={getLineInlineStyle(kopStyle.line6, DEFAULT_KOP_STYLE.line6, fontCss, lineSpacing, Math.round(1 * lineSpacing))}
            >
              {isCustomLine6 ? (
                lines.line6
              ) : (
                <>
                  Laman <span className="text-blue-700 underline">{website}</span> Pos-el{' '}
                  <span className="text-black">{email}</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Logo Sekolah (Kanan) */}
        <div className="w-20 sm:w-28 shrink-0 flex items-center justify-center">
          <img
            src={schoolLogo}
            alt="Logo Sekolah"
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Garis Ganda Standar Surat Dinas */}
      {showBorder && (
        <div style={{ marginTop: `${Math.round(4 * lineSpacing)}px`, paddingBottom: `${Math.round(bottomSpacingMm * 2.2)}px` }}>
          <div className="w-full h-[3.5px] bg-black"></div>
          <div className="w-full h-[1px] bg-black mt-[2px]"></div>
        </div>
      )}
    </div>
  );
};

export default KopSurat;
