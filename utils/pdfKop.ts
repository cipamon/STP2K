import jsPDF from 'jspdf';
import { AppConfig } from '../types';
import { PROVINSI_LOGO_URL } from '../constants';

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

/**
 * Draws an authentic official Indonesian government letterhead (Kop Surat)
 * on a jsPDF document matching the official layout:
 * - Left: Provinsi Jawa Tengah Coat of Arms
 * - Right: SMA Negeri 1 Kudus Emblem
 * - Center: Hierarchy of Government, Department, School Name, Address & Contacts
 * - Bottom: Official double separator line (thick top, thin bottom)
 * 
 * Returns the Y coordinate where following document content should start.
 */
export const drawPdfKopSurat = async (
  doc: jsPDF,
  appConfig: AppConfig,
  startY: number = 8
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 15;
  const rightMargin = pageWidth - 15;
  const centerX = pageWidth / 2;

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

  // Load images in parallel
  const [provImg, schoolImg] = await Promise.all([
    loadImageElement(provLogoUrl),
    loadImageElement(schoolLogoUrl)
  ]);

  const logoSize = 25; // 25mm
  const logoY = startY + 1;

  if (provImg) {
    try {
      doc.addImage(provImg, 'PNG', leftMargin, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Failed to add prov logo to doc', e);
    }
  }

  if (schoolImg) {
    try {
      doc.addImage(schoolImg, 'PNG', rightMargin - logoSize, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Failed to add school logo to doc', e);
    }
  }

  // Draw Kop Text
  let textY = startY + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(govHeader, centerX, textY, { align: 'center' });

  textY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(deptHeader, centerX, textY, { align: 'center' });

  textY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text(schoolName, centerX, textY, { align: 'center' });

  textY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(address, centerX, textY, { align: 'center' });

  textY += 4;
  doc.text(`Kode Pos ${postalCode} Telepon ${phone}, Faksimile ${fax},`, centerX, textY, { align: 'center' });

  textY += 4;
  doc.text(`Laman ${website} Pos-el ${email}`, centerX, textY, { align: 'center' });

  // Double Line Separator
  const lineY = Math.max(textY + 3, logoY + logoSize + 2);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.9); // Garis tebal
  doc.line(leftMargin, lineY, rightMargin, lineY);

  doc.setLineWidth(0.3); // Garis tipis
  doc.line(leftMargin, lineY + 1.2, rightMargin, lineY + 1.2);

  return lineY + 6; // Content begins below separator
};
