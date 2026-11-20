import jsPDF from 'jspdf';
import {
  AppConfig,
  KopSuratStyleConfig,
  PrintDocumentSettings,
  PrintFontFamily,
  PrintTextAlign,
  SignatureBlockLayout,
  SignatureBoxPosition,
  TextFormatStyle,
  User,
  UserRole,
} from '../types';
import {
  DEFAULT_KEPSEK_LAYOUT,
  DEFAULT_KOP_STYLE,
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_SIGNATURE_STYLE,
  DEFAULT_STAFF_LAYOUT,
  PROVINSI_LOGO_URL,
} from '../constants';
import { getUserPosition } from './avatarHelpers';

export const STAFF_ROLE_PRESETS = [
  'Admin',
  'Guru BK',
  'Koordinator Guru BK',
  'Wali Kelas',
  'Guru Piket',
  'Guru Mapel',
  'Staff Tata Usaha (TU)',
  'Waka Kesiswaan',
  'Orang Tua / Wali',
];

export interface PrintFontOption {
  value: PrintFontFamily;
  label: string;
  category: 'sans' | 'serif' | 'mono';
  pdfFallback: 'helvetica' | 'times' | 'courier';
}

export const PRINT_FONT_OPTIONS: PrintFontOption[] = [
  // Sans-Serif Persuratan Modern
  { value: 'arial', label: 'Arial (Standar Surat Resmi)', category: 'sans', pdfFallback: 'helvetica' },
  { value: 'tahoma', label: 'Tahoma (Rapi & Padat)', category: 'sans', pdfFallback: 'helvetica' },
  { value: 'verdana', label: 'Verdana (Jelas & Lebar)', category: 'sans', pdfFallback: 'helvetica' },
  { value: 'calibri', label: 'Calibri (Office Modern)', category: 'sans', pdfFallback: 'helvetica' },
  { value: 'trebuchet', label: 'Trebuchet MS (Bersih & Elegan)', category: 'sans', pdfFallback: 'helvetica' },
  { value: 'segoe', label: 'Segoe UI (Modern Kontemporer)', category: 'sans', pdfFallback: 'helvetica' },
  { value: 'helvetica', label: 'Helvetica (Standar Cetak PDF)', category: 'sans', pdfFallback: 'helvetica' },
  // Serif Surat Dinas Resmi
  { value: 'times', label: 'Times New Roman (Dinas Klasik)', category: 'serif', pdfFallback: 'times' },
  { value: 'cambria', label: 'Cambria (Dinas Modern)', category: 'serif', pdfFallback: 'times' },
  { value: 'georgia', label: 'Georgia (Formal Klasik)', category: 'serif', pdfFallback: 'times' },
  { value: 'garamond', label: 'Garamond (Piagam & Surat Resmi)', category: 'serif', pdfFallback: 'times' },
  { value: 'palatino', label: 'Palatino Linotype (Akademik)', category: 'serif', pdfFallback: 'times' },
  // Monospace
  { value: 'courier', label: 'Courier New (Ketikan Mesin / Arsip)', category: 'mono', pdfFallback: 'courier' },
];

export const getPdfFontFamily = (font?: PrintFontFamily): 'helvetica' | 'times' | 'courier' => {
  switch (font) {
    case 'times':
    case 'cambria':
    case 'georgia':
    case 'garamond':
    case 'palatino':
      return 'times';
    case 'courier':
      return 'courier';
    default:
      return 'helvetica';
  }
};

export const getCssFontFamily = (font?: PrintFontFamily): string => {
  switch (font) {
    case 'arial':
      return 'Arial, "Arimo", "Liberation Sans", sans-serif';
    case 'tahoma':
      return 'Tahoma, Geneva, Verdana, "Arimo", sans-serif';
    case 'verdana':
      return 'Verdana, Geneva, Tahoma, sans-serif';
    case 'calibri':
      return 'Calibri, "Carlito", Candara, Segoe, "Segoe UI", sans-serif';
    case 'trebuchet':
      return '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", sans-serif';
    case 'segoe':
      return '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    case 'times':
      return '"Times New Roman", "Tinos", Times, serif';
    case 'cambria':
      return 'Cambria, "Caladea", Georgia, serif';
    case 'georgia':
      return 'Georgia, Cambria, "Times New Roman", serif';
    case 'garamond':
      return 'Garamond, "EB Garamond", "Times New Roman", serif';
    case 'palatino':
      return '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
    case 'courier':
      return '"Courier New", Courier, monospace';
    case 'helvetica':
    default:
      return '"Helvetica Neue", Helvetica, Arial, "Arimo", sans-serif';
  }
};

export const positionToXPercent = (pos?: SignatureBoxPosition): number => {
  if (pos === 'center') return 50;
  if (pos === 'right') return 100;
  return 0;
};

export const xPercentToPosition = (xPercent: number): SignatureBoxPosition => {
  if (xPercent < 25) return 'left';
  if (xPercent <= 75) return 'center';
  return 'right';
};

export const clampSignatureLayout = (
  layout: Partial<SignatureBlockLayout> | undefined,
  fallback: SignatureBlockLayout
): SignatureBlockLayout => {
  const x = typeof layout?.xPercent === 'number' && !Number.isNaN(layout.xPercent) ? layout.xPercent : fallback.xPercent;
  const y = typeof layout?.yOffsetMm === 'number' && !Number.isNaN(layout.yOffsetMm) ? layout.yOffsetMm : fallback.yOffsetMm;
  const w = typeof layout?.widthMm === 'number' && !Number.isNaN(layout.widthMm) ? layout.widthMm : fallback.widthMm;
  const h = typeof layout?.heightMm === 'number' && !Number.isNaN(layout.heightMm) ? layout.heightMm : fallback.heightMm;
  return {
    xPercent: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
    yOffsetMm: Math.min(60, Math.max(-15, Math.round(y * 10) / 10)),
    widthMm: Math.min(130, Math.max(42, Math.round(w))),
    heightMm: Math.min(55, Math.max(8, Math.round(h))),
  };
};

export interface ResolvedKopLines {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
  line6: string;
}

export const getDefaultKopLines = (appConfig: AppConfig): ResolvedKopLines => {
  let formalSchoolName = appConfig.schoolName;
  if (!formalSchoolName || formalSchoolName.trim().toUpperCase() === 'SMA NEGERI 1 KUDUS') {
    formalSchoolName = 'SEKOLAH MENENGAH ATAS NEGERI 1 KUDUS';
  } else {
    formalSchoolName = formalSchoolName.toUpperCase();
  }

  const address = appConfig.address || 'Jalan Pramuka Nomor 41, Kota Kudus, Kabupaten Kudus, Jawa Tengah,';
  const postalCode = appConfig.postalCode || '59319';
  const phone = appConfig.phone || '0291-431368';
  const fax = appConfig.fax || '0291-431368';
  const website = appConfig.website || 'http://sma1kudus.sch.id';
  const email = appConfig.email || 'sma1kds@yahoo.co.id';

  return {
    line1: (appConfig.governmentHeader || 'PEMERINTAH PROVINSI JAWA TENGAH').toUpperCase(),
    line2: (appConfig.departmentHeader || 'DINAS PENDIDIKAN').toUpperCase(),
    line3: formalSchoolName,
    line4: address,
    line5: `Kode Pos ${postalCode} Telepon ${phone}, Faksimile ${fax},`,
    line6: `Laman ${website} Pos-el ${email}`,
  };
};

export const getResolvedKopLines = (
  appConfig: AppConfig,
  kopStyle?: Partial<KopSuratStyleConfig>
): ResolvedKopLines => {
  const defaults = getDefaultKopLines(appConfig);
  return {
    line1: kopStyle?.line1?.text !== undefined ? kopStyle.line1.text : defaults.line1,
    line2: kopStyle?.line2?.text !== undefined ? kopStyle.line2.text : defaults.line2,
    line3: kopStyle?.line3?.text !== undefined ? kopStyle.line3.text : defaults.line3,
    line4: kopStyle?.line4?.text !== undefined ? kopStyle.line4.text : defaults.line4,
    line5: kopStyle?.line5?.text !== undefined ? kopStyle.line5.text : defaults.line5,
    line6: kopStyle?.line6?.text !== undefined ? kopStyle.line6.text : defaults.line6,
  };
};

export const getDefaultStaffRoleTitle = (user?: Pick<User, 'role' | 'position' | 'name' | 'username'> | null): string => {
  if (!user) return 'Guru BK / Admin';
  const pos = getUserPosition(user);
  if (pos === 'TU') return 'Staff Tata Usaha (TU)';
  if (pos === 'ADMIN' || user.role === UserRole.ADMIN) return 'Admin';
  return 'Guru BK';
};

export const resolvePrintSettings = (
  appConfig: AppConfig,
  currentUser?: User | null,
  users?: User[],
  overrides?: Partial<PrintDocumentSettings>
): PrintDocumentSettings => {
  const saved = appConfig.printSettings;

  const kopStyle = {
    fontFamily: overrides?.kopStyle?.fontFamily || saved?.kopStyle?.fontFamily || DEFAULT_KOP_STYLE.fontFamily,
    lineSpacing: overrides?.kopStyle?.lineSpacing ?? saved?.kopStyle?.lineSpacing ?? DEFAULT_KOP_STYLE.lineSpacing,
    bottomSpacing: overrides?.kopStyle?.bottomSpacing ?? saved?.kopStyle?.bottomSpacing ?? DEFAULT_KOP_STYLE.bottomSpacing,
    line1: { ...DEFAULT_KOP_STYLE.line1, ...(saved?.kopStyle?.line1 || {}), ...(overrides?.kopStyle?.line1 || {}) },
    line2: { ...DEFAULT_KOP_STYLE.line2, ...(saved?.kopStyle?.line2 || {}), ...(overrides?.kopStyle?.line2 || {}) },
    line3: { ...DEFAULT_KOP_STYLE.line3, ...(saved?.kopStyle?.line3 || {}), ...(overrides?.kopStyle?.line3 || {}) },
    line4: { ...DEFAULT_KOP_STYLE.line4, ...(saved?.kopStyle?.line4 || {}), ...(overrides?.kopStyle?.line4 || {}) },
    line5: { ...DEFAULT_KOP_STYLE.line5, ...(saved?.kopStyle?.line5 || {}), ...(overrides?.kopStyle?.line5 || {}) },
    line6: { ...DEFAULT_KOP_STYLE.line6, ...(saved?.kopStyle?.line6 || {}), ...(overrides?.kopStyle?.line6 || {}) },
  };

  const signatureStyle = {
    ...DEFAULT_SIGNATURE_STYLE,
    ...(saved?.signatureStyle || {}),
    ...(overrides?.signatureStyle || {}),
  };

  const mergedKepsekPos = overrides?.kepsekPosition || saved?.kepsekPosition || DEFAULT_PRINT_SETTINGS.kepsekPosition;
  const mergedStaffPos = overrides?.staffPosition || saved?.staffPosition || DEFAULT_PRINT_SETTINGS.staffPosition;

  const baseKepsekLayout: SignatureBlockLayout = {
    ...DEFAULT_KEPSEK_LAYOUT,
    xPercent: positionToXPercent(mergedKepsekPos),
    heightMm: signatureStyle.spacingHeight ?? DEFAULT_KEPSEK_LAYOUT.heightMm,
  };
  const baseStaffLayout: SignatureBlockLayout = {
    ...DEFAULT_STAFF_LAYOUT,
    xPercent: positionToXPercent(mergedStaffPos),
    heightMm: signatureStyle.spacingHeight ?? DEFAULT_STAFF_LAYOUT.heightMm,
  };

  const kepsekLayout = clampSignatureLayout(
    overrides?.kepsekLayout ||
      (overrides?.kepsekPosition
        ? { ...(saved?.kepsekLayout || {}), xPercent: positionToXPercent(overrides.kepsekPosition) }
        : saved?.kepsekLayout),
    baseKepsekLayout
  );

  const staffLayout = clampSignatureLayout(
    overrides?.staffLayout ||
      (overrides?.staffPosition
        ? { ...(saved?.staffLayout || {}), xPercent: positionToXPercent(overrides.staffPosition) }
        : saved?.staffLayout),
    baseStaffLayout
  );

  const merged: PrintDocumentSettings = {
    ...DEFAULT_PRINT_SETTINGS,
    ...(saved || {}),
    ...(overrides || {}),
    showPoints: overrides?.showPoints ?? saved?.showPoints ?? DEFAULT_PRINT_SETTINGS.showPoints,
    kepsekPosition: xPercentToPosition(kepsekLayout.xPercent),
    staffPosition: xPercentToPosition(staffLayout.xPercent),
    kepsekLayout,
    staffLayout,
    kopStyle,
    signatureStyle,
  };

  // Resolve staff signer identity
  const selectedUserId = merged.staffUserId || 'CURRENT_USER';
  let resolvedUser: User | null | undefined = undefined;
  if (selectedUserId === 'CURRENT_USER') {
    resolvedUser = currentUser;
  } else if (selectedUserId !== 'CUSTOM' && users && users.length > 0) {
    resolvedUser = users.find((u) => u.id === selectedUserId) || currentUser;
  }

  if (resolvedUser && selectedUserId !== 'CUSTOM') {
    if (!merged.staffName || merged.staffName.trim() === '') {
      merged.staffName = resolvedUser.name;
    }
    if (!merged.staffNip && resolvedUser.nip) {
      merged.staffNip = resolvedUser.nip;
    }
    if (!saved?.staffRoleTitle && !overrides?.staffRoleTitle) {
      merged.staffRoleTitle = getDefaultStaffRoleTitle(resolvedUser);
    }
  } else if (currentUser && !merged.staffName) {
    merged.staffName = currentUser.name;
    merged.staffNip = merged.staffNip || currentUser.nip || '';
  }

  return merged;
};

const loadImageElement = (url: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Could not load image for PDF:', url);
      resolve(null);
    };
    img.src = url;
  });
};

const getPdfFontStyle = (bold?: boolean, italic?: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' => {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
};

/**
 * Draws styled text inside a horizontal box [boxLeft, boxLeft + boxWidth]
 * supporting Bold, Italic, Underline, Font Size, Font Family, and Left / Center / Right / Justify alignment.
 * Returns the next Y coordinate below the rendered text.
 */
export const drawStyledPdfText = (
  doc: jsPDF,
  text: string,
  boxLeft: number,
  boxWidth: number,
  y: number,
  style: TextFormatStyle,
  fontFamily: PrintFontFamily = 'helvetica',
  lineSpacingMultiplier: number = 0.43
): number => {
  const safeText = text ?? '';
  const fontSize = style.fontSize || 9;
  const fontStyle = getPdfFontStyle(style.bold, style.italic);
  const align: PrintTextAlign = style.align || 'left';

  doc.setFont(getPdfFontFamily(fontFamily), fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);

  const paragraphs = String(safeText).split('\n');
  const wrappedLines: string[] = [];
  paragraphs.forEach((p) => {
    const split = doc.splitTextToSize(p, Math.max(10, boxWidth)) as string[];
    if (split.length === 0) wrappedLines.push('');
    else wrappedLines.push(...split);
  });

  const lineStep = Math.max(3.6, fontSize * lineSpacingMultiplier);
  let curY = y;

  wrappedLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      curY += lineStep;
      return;
    }

    const words = trimmed.split(/\s+/);
    const textWidth = doc.getTextWidth(trimmed);

    if (align === 'justify' && words.length >= 2 && textWidth < boxWidth) {
      const wordsWidth = words.reduce((acc, w) => acc + doc.getTextWidth(w), 0);
      const gap = (boxWidth - wordsWidth) / (words.length - 1);
      let cursorX = boxLeft;
      words.forEach((word) => {
        doc.text(word, cursorX, curY);
        cursorX += doc.getTextWidth(word) + gap;
      });
      if (style.underline) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(Math.max(0.2, fontSize * 0.025));
        doc.line(boxLeft, curY + 0.9, boxLeft + boxWidth, curY + 0.9);
      }
    } else if (align === 'center') {
      const cx = boxLeft + boxWidth / 2;
      doc.text(trimmed, cx, curY, { align: 'center' });
      if (style.underline) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(Math.max(0.2, fontSize * 0.025));
        doc.line(cx - textWidth / 2, curY + 0.9, cx + textWidth / 2, curY + 0.9);
      }
    } else if (align === 'right') {
      const rx = boxLeft + boxWidth;
      doc.text(trimmed, rx, curY, { align: 'right' });
      if (style.underline) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(Math.max(0.2, fontSize * 0.025));
        doc.line(rx - textWidth, curY + 0.9, rx, curY + 0.9);
      }
    } else {
      doc.text(trimmed, boxLeft, curY, { align: 'left' });
      if (style.underline) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(Math.max(0.2, fontSize * 0.025));
        doc.line(boxLeft, curY + 0.9, boxLeft + textWidth, curY + 0.9);
      }
    }

    curY += lineStep;
  });

  return curY;
};

/**
 * Draws an official Indonesian school letterhead (Kop Surat) on a jsPDF document
 * respecting showKop, font family, and per-line font size, B/I/U, and alignment.
 * Returns the Y coordinate where following document content should start.
 */
export const drawPdfKopSurat = async (
  doc: jsPDF,
  appConfig: AppConfig,
  startY: number = 8,
  printSettings?: PrintDocumentSettings
): Promise<number> => {
  const resolved = printSettings || resolvePrintSettings(appConfig);
  if (!resolved.showKop) {
    return startY + 4;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;

  const kopLines = getResolvedKopLines(appConfig, resolved.kopStyle);

  const provLogoUrl = appConfig.provinsiLogoUrl || PROVINSI_LOGO_URL;
  const schoolLogoUrl = appConfig.logoUrl || '/logo.png';

  const [provImg, schoolImg] = await Promise.all([
    loadImageElement(provLogoUrl),
    loadImageElement(schoolLogoUrl),
  ]);

  const logoSize = 25;
  const logoY = startY + 1;

  const getImageFormat = (url: string): 'PNG' | 'JPEG' | 'WEBP' => {
    if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'JPEG';
    if (url.startsWith('data:image/webp')) return 'WEBP';
    return 'PNG';
  };

  if (provImg) {
    try {
      doc.addImage(provImg, getImageFormat(provLogoUrl), leftMargin, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Failed to add prov logo to doc', e);
    }
  }

  if (schoolImg) {
    try {
      doc.addImage(schoolImg, getImageFormat(schoolLogoUrl), rightMargin - logoSize, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Failed to add school logo to doc', e);
    }
  }

  const textBoxLeft = leftMargin + logoSize + 3;
  const textBoxWidth = rightMargin - leftMargin - logoSize * 2 - 6;
  const kopFont = resolved.kopStyle.fontFamily || 'helvetica';
  const rawLineSpacing = Math.min(1.8, Math.max(0.7, resolved.kopStyle.lineSpacing ?? 1.0));
  const kopLineMult = 0.44 * rawLineSpacing;
  const kopSchoolMult = 0.45 * rawLineSpacing;
  const lineGapSmall = 0.5 * rawLineSpacing;
  const lineGapAddr = 1.0 * rawLineSpacing;
  const bottomSpacing = Math.min(20, Math.max(2, resolved.kopStyle.bottomSpacing ?? 6));

  let textY = startY + 5;
  if (kopLines.line1.trim()) {
    textY = drawStyledPdfText(doc, kopLines.line1, textBoxLeft, textBoxWidth, textY, resolved.kopStyle.line1, kopFont, kopLineMult);
  }
  if (kopLines.line2.trim()) {
    textY = drawStyledPdfText(doc, kopLines.line2, textBoxLeft, textBoxWidth, textY + lineGapSmall, resolved.kopStyle.line2, kopFont, kopLineMult);
  }
  if (kopLines.line3.trim()) {
    textY = drawStyledPdfText(doc, kopLines.line3, textBoxLeft, textBoxWidth, textY + lineGapSmall, resolved.kopStyle.line3, kopFont, kopSchoolMult);
  }
  if (kopLines.line4.trim()) {
    textY = drawStyledPdfText(doc, kopLines.line4, textBoxLeft, textBoxWidth, textY + lineGapAddr, resolved.kopStyle.line4, kopFont, kopLineMult);
  }
  if (kopLines.line5.trim()) {
    textY = drawStyledPdfText(
      doc,
      kopLines.line5,
      textBoxLeft,
      textBoxWidth,
      textY,
      resolved.kopStyle.line5,
      kopFont,
      kopLineMult
    );
  }
  if (kopLines.line6.trim()) {
    textY = drawStyledPdfText(
      doc,
      kopLines.line6,
      textBoxLeft,
      textBoxWidth,
      textY,
      resolved.kopStyle.line6,
      kopFont,
      kopLineMult
    );
  }

  // Double Line Separator
  const lineY = Math.max(textY + 1.5 * rawLineSpacing, logoY + logoSize + 2);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.9);
  doc.line(leftMargin, lineY, rightMargin, lineY);

  doc.setLineWidth(0.3);
  doc.line(leftMargin, lineY + 1.2, rightMargin, lineY + 1.2);

  // Restore document font after drawing Kop
  doc.setFont(getPdfFontFamily(resolved.documentFontFamily), 'normal');
  return lineY + bottomSpacing;
};

interface SignatureBlockContent {
  topLine: string;
  roleLine: string;
  nameLine: string;
  nipLine?: string;
}

const renderSignatureBlock = (
  doc: jsPDF,
  block: SignatureBlockContent,
  boxLeft: number,
  boxWidth: number,
  startY: number,
  settings: PrintDocumentSettings,
  blockHeightMm?: number
): number => {
  const sig = settings.signatureStyle;
  const font = settings.documentFontFamily || 'helvetica';
  const baseSize = sig.fontSize || 9;
  const align = sig.align || 'left';

  const headerStyle: TextFormatStyle = {
    fontSize: baseSize,
    bold: sig.boldHeader,
    italic: sig.italicHeader,
    underline: sig.underlineHeader,
    align,
  };
  const nameStyle: TextFormatStyle = {
    fontSize: baseSize,
    bold: sig.boldName,
    italic: sig.italicName,
    underline: sig.underlineName,
    align,
  };
  const nipStyle: TextFormatStyle = {
    fontSize: Math.max(7, baseSize - 0.5),
    bold: sig.boldNip,
    italic: sig.italicNip,
    underline: sig.underlineNip,
    align,
  };

  let curY = startY;
  curY = drawStyledPdfText(doc, block.topLine, boxLeft, boxWidth, curY, headerStyle, font, 0.48);
  curY = drawStyledPdfText(doc, block.roleLine, boxLeft, boxWidth, curY, headerStyle, font, 0.48);

  const spaceGap = blockHeightMm ?? sig.spacingHeight ?? 22;
  curY += Math.min(55, Math.max(8, spaceGap));

  curY = drawStyledPdfText(doc, block.nameLine, boxLeft, boxWidth, curY, nameStyle, font, 0.48);
  if (block.nipLine) {
    curY = drawStyledPdfText(doc, block.nipLine, boxLeft, boxWidth, curY, nipStyle, font, 0.48);
  }
  return curY;
};

/**
 * Draws Kepala Sekolah and/or Admin/Guru signature blocks onto jsPDF
 * supporting free X/Y drag offsets, custom width/height per block,
 * slot presets (left/center/right), text alignment, and B/I/U formatting.
 */
export const drawPdfSignatures = (
  doc: jsPDF,
  printSettings: PrintDocumentSettings,
  appConfig: AppConfig,
  startY: number
): number => {
  const showKepsek = printSettings.showKepsekSignature;
  const showStaff = printSettings.showStaffSignature;
  if (!showKepsek && !showStaff) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  const usableWidth = rightMargin - leftMargin;

  const kepsekLayout = clampSignatureLayout(printSettings.kepsekLayout, {
    ...DEFAULT_KEPSEK_LAYOUT,
    xPercent: positionToXPercent(printSettings.kepsekPosition),
    heightMm: printSettings.signatureStyle.spacingHeight ?? DEFAULT_KEPSEK_LAYOUT.heightMm,
  });

  const staffLayout = clampSignatureLayout(printSettings.staffLayout, {
    ...DEFAULT_STAFF_LAYOUT,
    xPercent: positionToXPercent(printSettings.staffPosition),
    heightMm: printSettings.signatureStyle.spacingHeight ?? DEFAULT_STAFF_LAYOUT.heightMm,
  });

  const calcBoxGeometry = (layout: SignatureBlockLayout) => {
    const widthMm = Math.min(usableWidth - 4, Math.max(42, layout.widthMm));
    const travel = Math.max(0, usableWidth - widthMm);
    const boxLeft = leftMargin + travel * (Math.min(100, Math.max(0, layout.xPercent)) / 100);
    return { widthMm, boxLeft, heightMm: layout.heightMm, yOffsetMm: layout.yOffsetMm };
  };

  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const city = printSettings.cityLabel?.trim() || 'Kudus';

  const kepsekBlock: SignatureBlockContent = {
    topLine: 'Mengetahui,',
    roleLine: printSettings.kepsekTitle?.trim() || 'Kepala Sekolah',
    nameLine: appConfig.principalName || 'Kepala Sekolah',
    nipLine: appConfig.principalNip ? `NIP. ${appConfig.principalNip}` : undefined,
  };

  const staffBlock: SignatureBlockContent = {
    topLine: `${city}, ${today}`,
    roleLine: printSettings.staffRoleTitle?.trim() || 'Guru BK / Admin',
    nameLine: printSettings.staffName?.trim() || '( ........................................ )',
    nipLine: printSettings.staffNip?.trim() ? `NIP. ${printSettings.staffNip.trim()}` : undefined,
  };

  const kGeom = calcBoxGeometry(kepsekLayout);
  const sGeom = calcBoxGeometry(staffLayout);

  const sameSpot =
    showKepsek &&
    showStaff &&
    Math.abs(kepsekLayout.xPercent - staffLayout.xPercent) < 8 &&
    Math.abs(kepsekLayout.yOffsetMm - staffLayout.yOffsetMm) < 12;

  const kHeight = 16 + kGeom.heightMm + 12;
  const sHeight = 16 + sGeom.heightMm + 12;
  const maxOffsetNeeded = sameSpot
    ? Math.max(0, kepsekLayout.yOffsetMm) + kHeight + sHeight + 6
    : Math.max(
        showKepsek ? Math.max(0, kepsekLayout.yOffsetMm) + kHeight : 0,
        showStaff ? Math.max(0, staffLayout.yOffsetMm) + sHeight : 0
      );

  let sigY = startY;
  if (sigY + maxOffsetNeeded > pageHeight - 10) {
    doc.addPage();
    sigY = 20;
  }

  if (sameSpot) {
    const yStart = Math.max(14, sigY + kGeom.yOffsetMm);
    const nextY = renderSignatureBlock(
      doc,
      kepsekBlock,
      kGeom.boxLeft,
      kGeom.widthMm,
      yStart,
      printSettings,
      kGeom.heightMm
    );
    return renderSignatureBlock(
      doc,
      staffBlock,
      sGeom.boxLeft,
      sGeom.widthMm,
      nextY + 6,
      printSettings,
      sGeom.heightMm
    );
  }

  let endY = sigY;
  if (showKepsek) {
    const kStartY = Math.max(14, Math.min(pageHeight - kHeight - 8, sigY + kGeom.yOffsetMm));
    const endK = renderSignatureBlock(
      doc,
      kepsekBlock,
      kGeom.boxLeft,
      kGeom.widthMm,
      kStartY,
      printSettings,
      kGeom.heightMm
    );
    endY = Math.max(endY, endK);
  }
  if (showStaff) {
    const sStartY = Math.max(14, Math.min(pageHeight - sHeight - 8, sigY + sGeom.yOffsetMm));
    const endS = renderSignatureBlock(
      doc,
      staffBlock,
      sGeom.boxLeft,
      sGeom.widthMm,
      sStartY,
      printSettings,
      sGeom.heightMm
    );
    endY = Math.max(endY, endS);
  }

  return endY;
};
