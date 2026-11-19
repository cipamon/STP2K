import jsPDF from 'jspdf';
import {
  AppConfig,
  PrintDocumentSettings,
  PrintFontFamily,
  PrintTextAlign,
  SignatureBoxPosition,
  TextFormatStyle,
  User,
  UserRole,
} from '../types';
import {
  DEFAULT_KOP_STYLE,
  DEFAULT_PRINT_SETTINGS,
  DEFAULT_SIGNATURE_STYLE,
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

export const getCssFontFamily = (font?: PrintFontFamily): string => {
  switch (font) {
    case 'times':
      return '"Times New Roman", Times, Georgia, serif';
    case 'courier':
      return '"Courier New", Courier, monospace';
    case 'helvetica':
    default:
      return 'Arial, Helvetica, "Liberation Sans", sans-serif';
  }
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

  const merged: PrintDocumentSettings = {
    ...DEFAULT_PRINT_SETTINGS,
    ...(saved || {}),
    ...(overrides || {}),
    showPoints: overrides?.showPoints ?? saved?.showPoints ?? DEFAULT_PRINT_SETTINGS.showPoints,
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

  doc.setFont(fontFamily, fontStyle);
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

  const govHeader = appConfig.governmentHeader || 'PEMERINTAH PROVINSI JAWA TENGAH';
  const deptHeader = appConfig.departmentHeader || 'DINAS PENDIDIKAN';

  let schoolName = appConfig.schoolName;
  if (!schoolName || schoolName.trim().toUpperCase() === 'SMA NEGERI 1 KUDUS') {
    schoolName = 'SEKOLAH MENENGAH ATAS NEGERI 1 KUDUS';
  } else {
    schoolName = schoolName.toUpperCase();
  }

  const address = appConfig.address || 'Jalan Pramuka Nomor 41, Kota Kudus, Kabupaten Kudus, Jawa Tengah,';
  const postalCode = appConfig.postalCode || '59319';
  const phone = appConfig.phone || '0291-431368';
  const fax = appConfig.fax || '0291-431368';
  const website = appConfig.website || 'http://sma1kudus.sch.id';
  const email = appConfig.email || 'sma1kds@yahoo.co.id';

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

  let textY = startY + 5;
  textY = drawStyledPdfText(doc, govHeader, textBoxLeft, textBoxWidth, textY, resolved.kopStyle.line1, kopFont, 0.44);
  textY = drawStyledPdfText(doc, deptHeader, textBoxLeft, textBoxWidth, textY + 0.5, resolved.kopStyle.line2, kopFont, 0.44);
  textY = drawStyledPdfText(doc, schoolName, textBoxLeft, textBoxWidth, textY + 0.5, resolved.kopStyle.line3, kopFont, 0.45);
  textY = drawStyledPdfText(doc, address, textBoxLeft, textBoxWidth, textY + 1, resolved.kopStyle.line4, kopFont, 0.44);
  textY = drawStyledPdfText(
    doc,
    `Kode Pos ${postalCode} Telepon ${phone}, Faksimile ${fax},`,
    textBoxLeft,
    textBoxWidth,
    textY,
    resolved.kopStyle.line5,
    kopFont,
    0.44
  );
  textY = drawStyledPdfText(
    doc,
    `Laman ${website} Pos-el ${email}`,
    textBoxLeft,
    textBoxWidth,
    textY,
    resolved.kopStyle.line6,
    kopFont,
    0.44
  );

  // Double Line Separator
  const lineY = Math.max(textY + 1.5, logoY + logoSize + 2);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.9);
  doc.line(leftMargin, lineY, rightMargin, lineY);

  doc.setLineWidth(0.3);
  doc.line(leftMargin, lineY + 1.2, rightMargin, lineY + 1.2);

  // Restore document font after drawing Kop
  doc.setFont(resolved.documentFontFamily || 'helvetica', 'normal');
  return lineY + 6;
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
  settings: PrintDocumentSettings
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

  curY += Math.max(8, sig.spacingHeight ?? 22);

  curY = drawStyledPdfText(doc, block.nameLine, boxLeft, boxWidth, curY, nameStyle, font, 0.48);
  if (block.nipLine) {
    curY = drawStyledPdfText(doc, block.nipLine, boxLeft, boxWidth, curY, nipStyle, font, 0.48);
  }
  return curY;
};

/**
 * Draws Kepala Sekolah and/or Admin/Guru signature blocks onto jsPDF
 * with configurable visibility, horizontal slot (left/center/right),
 * text alignment (default left-aligned & neat), and B/I/U formatting.
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
  const boxWidth = Math.min(72, Math.max(56, usableWidth * 0.36));

  const getSlotX = (pos: SignatureBoxPosition): number => {
    if (pos === 'center') return (pageWidth - boxWidth) / 2;
    if (pos === 'right') return rightMargin - boxWidth;
    return leftMargin;
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

  const sameSlot = showKepsek && showStaff && printSettings.kepsekPosition === printSettings.staffPosition;
  const singleBlockHeight = 16 + (printSettings.signatureStyle.spacingHeight ?? 22) + 12;
  const neededHeight = sameSlot ? singleBlockHeight * 2 + 6 : singleBlockHeight;

  let sigY = startY;
  if (sigY + neededHeight > pageHeight - 10) {
    doc.addPage();
    sigY = 20;
  }

  if (sameSlot) {
    const slotX = getSlotX(printSettings.kepsekPosition);
    const nextY = renderSignatureBlock(doc, kepsekBlock, slotX, boxWidth, sigY, printSettings);
    return renderSignatureBlock(doc, staffBlock, slotX, boxWidth, nextY + 6, printSettings);
  }

  let endY = sigY;
  if (showKepsek) {
    const endK = renderSignatureBlock(
      doc,
      kepsekBlock,
      getSlotX(printSettings.kepsekPosition),
      boxWidth,
      sigY,
      printSettings
    );
    endY = Math.max(endY, endK);
  }
  if (showStaff) {
    const endS = renderSignatureBlock(
      doc,
      staffBlock,
      getSlotX(printSettings.staffPosition),
      boxWidth,
      sigY,
      printSettings
    );
    endY = Math.max(endY, endS);
  }

  return endY;
};
