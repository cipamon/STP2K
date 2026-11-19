import React from 'react';
import { AppConfig, PrintDocumentSettings, TextFormatStyle } from '../types';
import { PROVINSI_LOGO_URL, DEFAULT_KOP_STYLE } from '../constants';
import { getCssFontFamily } from '../utils/pdfKop';

interface KopSuratProps {
  appConfig: AppConfig;
  className?: string;
  showBorder?: boolean;
  printSettings?: PrintDocumentSettings;
}

const getLineInlineStyle = (
  style: TextFormatStyle | undefined,
  fallback: TextFormatStyle,
  fontFamilyCss: string
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
    line1: { ...DEFAULT_KOP_STYLE.line1, ...(effectiveSettings?.kopStyle?.line1 || {}) },
    line2: { ...DEFAULT_KOP_STYLE.line2, ...(effectiveSettings?.kopStyle?.line2 || {}) },
    line3: { ...DEFAULT_KOP_STYLE.line3, ...(effectiveSettings?.kopStyle?.line3 || {}) },
    line4: { ...DEFAULT_KOP_STYLE.line4, ...(effectiveSettings?.kopStyle?.line4 || {}) },
    line5: { ...DEFAULT_KOP_STYLE.line5, ...(effectiveSettings?.kopStyle?.line5 || {}) },
    line6: { ...DEFAULT_KOP_STYLE.line6, ...(effectiveSettings?.kopStyle?.line6 || {}) },
  };

  const fontCss = getCssFontFamily(kopStyle.fontFamily);

  const govHeader = appConfig.governmentHeader || 'PEMERINTAH PROVINSI JAWA TENGAH';
  const deptHeader = appConfig.departmentHeader || 'DINAS PENDIDIKAN';

  let formalSchoolName = appConfig.schoolName;
  if (!formalSchoolName || formalSchoolName.trim().toUpperCase() === 'SMA NEGERI 1 KUDUS') {
    formalSchoolName = 'SEKOLAH MENENGAH ATAS NEGERI 1 KUDUS';
  }

  const address = appConfig.address || 'Jalan Pramuka Nomor 41, Kota Kudus, Kabupaten Kudus, Jawa Tengah,';
  const postalCode = appConfig.postalCode || '59319';
  const phone = appConfig.phone || '0291-431368';
  const fax = appConfig.fax || '0291-431368';
  const website = appConfig.website || 'http://sma1kudus.sch.id';
  const email = appConfig.email || 'sma1kds@yahoo.co.id';
  const provLogo = appConfig.provinsiLogoUrl || PROVINSI_LOGO_URL;
  const schoolLogo = appConfig.logoUrl || '/logo.png';

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
        <div className="flex-1 px-1 sm:px-2 leading-snug">
          <h3
            className="uppercase tracking-wider text-black"
            style={getLineInlineStyle(kopStyle.line1, DEFAULT_KOP_STYLE.line1, fontCss)}
          >
            {govHeader}
          </h3>
          <h2
            className="uppercase tracking-wide text-black mt-0.5"
            style={getLineInlineStyle(kopStyle.line2, DEFAULT_KOP_STYLE.line2, fontCss)}
          >
            {deptHeader}
          </h2>
          <h1
            className="uppercase tracking-tight text-black mt-0.5"
            style={getLineInlineStyle(kopStyle.line3, DEFAULT_KOP_STYLE.line3, fontCss)}
          >
            {formalSchoolName}
          </h1>
          <p
            className="text-black mt-1.5 leading-snug"
            style={getLineInlineStyle(kopStyle.line4, DEFAULT_KOP_STYLE.line4, fontCss)}
          >
            {address}
          </p>
          <p
            className="text-black leading-snug"
            style={getLineInlineStyle(kopStyle.line5, DEFAULT_KOP_STYLE.line5, fontCss)}
          >
            Kode Pos {postalCode} Telepon {phone}, Faksimile {fax},
          </p>
          <p
            className="text-black leading-snug"
            style={getLineInlineStyle(kopStyle.line6, DEFAULT_KOP_STYLE.line6, fontCss)}
          >
            Laman <span className="text-blue-700 underline">{website}</span> Pos-el{' '}
            <span className="text-black">{email}</span>
          </p>
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
        <div className="mt-1.5 pb-2">
          <div className="w-full h-[3.5px] bg-black"></div>
          <div className="w-full h-[1px] bg-black mt-[2px]"></div>
        </div>
      )}
    </div>
  );
};

export default KopSurat;
