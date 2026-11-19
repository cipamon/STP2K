import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AppConfig,
  AppTheme,
  PrintDocumentSettings,
  Student,
  User,
  ViolationCategory,
  ViolationRecord,
} from '../types';
import { CLASS_LIST } from '../constants';
import {
  Calendar,
  Camera,
  CheckSquare,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers,
  Printer,
  RotateCcw,
  Search,
  Square,
  UserCheck,
  Users,
  Clock,
  Award,
  AlertTriangle,
} from 'lucide-react';
import PrintPreviewModal from './PrintPreviewModal';
import { drawPdfKopSurat, drawPdfSignatures, resolvePrintSettings } from '../utils/pdfKop';
import { loadEvidencePdfPhoto, loadStudentPdfPhoto, PdfImageAsset } from '../utils/pdfImages';
import {
  formatBirthPlaceDate,
  getStatusBadgeClasses,
  getStudentPhone,
  getStudentPhoto,
  getStudentStatus,
} from '../utils/studentHelpers';
import { getDefaultStudentAvatar } from '../utils/avatarHelpers';
import { getAllTardinessSummary, isTardinessRecord } from '../utils/tardiness';
import { exportRowsToSpreadsheet } from '../utils/exportHelpers';

export type ReportTemplateType =
  | 'combined_dossier'
  | 'combined_table'
  | 'student_directory_photo'
  | 'tardiness_photo';

interface ReportCenterProps {
  students: Student[];
  violations: ViolationRecord[];
  appConfig: AppConfig;
  currentUser: User;
  users?: User[];
  theme: AppTheme;
  onViewStudent?: (student: Student) => void;
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

const REPORT_TEMPLATES: Array<{
  id: ReportTemplateType;
  title: string;
  desc: string;
  defaultOrientation: 'portrait' | 'landscape';
  badge: string;
}> = [
  {
    id: 'combined_dossier',
    title: 'Laporan Terpadu Siswa + Foto',
    desc: 'Biodata lengkap & foto siswa jadi satu dengan tabel riwayat pelanggaran/prestasi dan lampiran foto bukti.',
    defaultOrientation: 'portrait',
    badge: 'Rekomendasi',
  },
  {
    id: 'combined_table',
    title: 'Tabel Gabungan Data & Foto',
    desc: 'Rekap baris per kejadian dalam 1 tabel lengkap berisi foto profil siswa, identitas siswa, detail kasus & foto bukti.',
    defaultOrientation: 'landscape',
    badge: '1 Tabel Lengkap',
  },
  {
    id: 'student_directory_photo',
    title: 'Direktori Biodata + Foto Siswa',
    desc: 'Daftar biodata lengkap seluruh siswa terpilih beserta foto profil resmi masing-masing siswa.',
    defaultOrientation: 'landscape',
    badge: 'Biodata + Foto',
  },
  {
    id: 'tardiness_photo',
    title: 'Rekap Keterlambatan + Foto Siswa',
    desc: 'Laporan siswa terlambat, frekuensi, status SP/alarm, dan tindak lanjut dilengkapi foto profil siswa.',
    defaultOrientation: 'portrait',
    badge: 'Kedisiplinan',
  },
];

export const ReportCenter: React.FC<ReportCenterProps> = ({
  students,
  violations,
  appConfig,
  currentUser,
  users = [],
  theme,
  onViewStudent,
  onSavePrintSettings,
}) => {
  const [reportType, setReportType] = useState<ReportTemplateType>('combined_dossier');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterStudentId, setFilterStudentId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyWithViolations, setOnlyWithViolations] = useState<boolean>(false);

  // Photo & Points Inclusion Controls
  const [includeStudentPhoto, setIncludeStudentPhoto] = useState<boolean>(true);
  const [includeEvidencePhoto, setIncludeEvidencePhoto] = useState<boolean>(true);
  const [includePoints, setIncludePoints] = useState<boolean>(
    () => resolvePrintSettings(appConfig, currentUser, users).showPoints !== false
  );

  // Manual student checkbox selection (optional subset)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isPreparingDownload, setIsPreparingDownload] = useState<boolean>(false);

  const handleChangeReportType = (nextType: ReportTemplateType) => {
    setReportType(nextType);
    const meta = REPORT_TEMPLATES.find((t) => t.id === nextType);
    if (meta) setOrientation(meta.defaultOrientation);
  };

  // Filtered Violations according to category & date range
  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (categoryFilter === 'VIOLATIONS_ONLY' && v.category === ViolationCategory.PRESTASI) {
        return false;
      }
      if (categoryFilter === 'TARDINESS' && !isTardinessRecord(v)) {
        return false;
      }
      if (
        categoryFilter !== 'ALL' &&
        categoryFilter !== 'VIOLATIONS_ONLY' &&
        categoryFilter !== 'TARDINESS' &&
        v.category !== categoryFilter
      ) {
        return false;
      }

      if (startDate || endDate) {
        const recDate = v.date ? v.date.slice(0, 10) : '';
        if (startDate && recDate < startDate) return false;
        if (endDate && recDate > endDate) return false;
      }

      return true;
    });
  }, [violations, categoryFilter, startDate, endDate]);

  // Map studentId -> filtered violations
  const violationsByStudent = useMemo(() => {
    const map = new Map<string, ViolationRecord[]>();
    filteredViolations.forEach((v) => {
      const list = map.get(v.studentId) || [];
      list.push(v);
      map.set(v.studentId, list);
    });
    // Sort newest first inside each student
    map.forEach((list) =>
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    return map;
  }, [filteredViolations]);

  // Filtered Students list
  const matchingStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (filterClass && s.class !== filterClass) return false;
        if (filterStudentId && s.id !== filterStudentId) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const hit =
            s.name.toLowerCase().includes(q) ||
            s.nis.toLowerCase().includes(q) ||
            (s.nisn || '').toLowerCase().includes(q) ||
            s.class.toLowerCase().includes(q);
          if (!hit) return false;
        }
        const stuViolations = violationsByStudent.get(s.id) || [];
        if (onlyWithViolations && stuViolations.length === 0) return false;
        if (categoryFilter !== 'ALL' && reportType !== 'student_directory_photo' && stuViolations.length === 0) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const clsCmp = a.class.localeCompare(b.class);
        if (clsCmp !== 0) return clsCmp;
        return a.name.localeCompare(b.name);
      });
  }, [
    students,
    filterClass,
    filterStudentId,
    searchQuery,
    onlyWithViolations,
    categoryFilter,
    reportType,
    violationsByStudent,
  ]);

  // Effective students included in printout (if manual selection > 0, use intersection)
  const targetStudents = useMemo(() => {
    if (selectedStudentIds.length === 0) return matchingStudents;
    const pickedSet = new Set(selectedStudentIds);
    const picked = matchingStudents.filter((s) => pickedSet.has(s.id));
    return picked.length > 0 ? picked : matchingStudents;
  }, [matchingStudents, selectedStudentIds]);

  const targetStudentIdSet = useMemo(
    () => new Set(targetStudents.map((s) => s.id)),
    [targetStudents]
  );

  // Violations belonging to targetStudents (sorted by date desc)
  const targetViolations = useMemo(() => {
    return filteredViolations
      .filter((v) => targetStudentIdSet.has(v.studentId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredViolations, targetStudentIdSet]);

  // Tardiness list scoped to targetStudents
  const targetTardinessList = useMemo(() => {
    return getAllTardinessSummary(targetStudents, filteredViolations);
  }, [targetStudents, filteredViolations]);

  // Pre-compute student dropdown choices matching class filter
  const studentDropdownChoices = useMemo(() => {
    return students
      .filter((s) => !filterClass || s.class === filterClass)
      .sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
  }, [students, filterClass]);

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllStudents = () => {
    if (
      matchingStudents.length > 0 &&
      matchingStudents.every((s) => selectedStudentIds.includes(s.id))
    ) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(matchingStudents.map((s) => s.id));
    }
  };

  const handleResetFilters = () => {
    setFilterClass('');
    setFilterStudentId('');
    setCategoryFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setOnlyWithViolations(false);
    setSelectedStudentIds([]);
    setIncludeStudentPhoto(true);
    setIncludeEvidencePhoto(true);
    setIncludePoints(resolvePrintSettings(appConfig, currentUser, users).showPoints !== false);
  };

  // Preload photos safely for jsPDF
  const preloadAssets = async (
    stuList: Student[],
    recList: ViolationRecord[]
  ): Promise<{
    studentPhotos: Map<string, PdfImageAsset | null>;
    evidencePhotos: Map<string, PdfImageAsset | null>;
  }> => {
    const studentPhotos = new Map<string, PdfImageAsset | null>();
    const evidencePhotos = new Map<string, PdfImageAsset | null>();

    if (includeStudentPhoto) {
      await Promise.all(
        stuList.map(async (s) => {
          const asset = await loadStudentPdfPhoto(s);
          studentPhotos.set(s.id, asset);
        })
      );
    }

    if (includeEvidencePhoto) {
      await Promise.all(
        recList
          .filter((r) => Boolean(r.evidenceUrl))
          .map(async (r) => {
            const asset = await loadEvidencePdfPhoto(r);
            evidencePhotos.set(r.id, asset);
          })
      );
    }

    return { studentPhotos, evidencePhotos };
  };

  // Master PDF Builder supporting Kop, TTD, Font, Student Photos, Evidence Photos, and optional Points
  const buildReportPdfDoc = async (customSettings?: PrintDocumentSettings): Promise<jsPDF> => {
    const settings =
      customSettings ||
      resolvePrintSettings(appConfig, currentUser, users, { showPoints: includePoints });
    const showPoints = settings.showPoints !== false;
    const font = settings.documentFontFamily || 'helvetica';
    const doc = new jsPDF({ orientation });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 15;
    const rightMargin = pageWidth - 15;
    const usableWidth = rightMargin - leftMargin;

    // 1. Kop Surat
    let curY = await drawPdfKopSurat(doc, appConfig, 8, settings);

    const periodText =
      startDate || endDate
        ? `Periode: ${startDate || 'Awal'} s.d. ${endDate || 'Sekarang'}`
        : `Tahun Ajaran: ${appConfig.academicYear}`;
    const classText = filterClass ? `Kelas: ${filterClass}` : 'Semua Kelas';

    const { studentPhotos, evidencePhotos } = await preloadAssets(targetStudents, targetViolations);
    const studentById = new Map<string, Student>(students.map((s) => [s.id, s]));

    const drawHeaderTitle = (mainTitle: string, subTitle: string) => {
      doc.setFont(font, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(mainTitle, pageWidth / 2, curY + 5, { align: 'center' });

      doc.setFont(font, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(subTitle, pageWidth / 2, curY + 10.5, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      curY += 15;
    };

    // ==================== MODE 1: LAPORAN TERPADU SISWA + FOTO ====================
    if (reportType === 'combined_dossier') {
      drawHeaderTitle(
        'LAPORAN TERPADU DATA SISWA, KEDISIPLINAN & DOKUMENTASI FOTO',
        `${classText} • ${periodText} • Total ${targetStudents.length} Siswa`
      );

      for (let idx = 0; idx < targetStudents.length; idx++) {
        const stu = targetStudents[idx];
        const stuRecs = violationsByStudent.get(stu.id) || [];
        const stuAsset = studentPhotos.get(stu.id) || null;
        const recsWithPhotos = includeEvidencePhoto
          ? stuRecs.filter((r) => Boolean(r.evidenceUrl) && evidencePhotos.get(r.id))
          : [];

        // Check if header box fits (~44mm needed)
        if (curY + 46 > pageHeight - 16) {
          doc.addPage();
          curY = 16;
        }

        // Student Profile Box
        const boxHeight = 36;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.35);
        doc.roundedRect(leftMargin, curY, usableWidth, boxHeight, 2, 2, 'FD');

        // Student Number & Badge Header Stripe
        doc.setFillColor(30, 58, 138);
        doc.roundedRect(leftMargin, curY, usableWidth, 6.5, 1.5, 1.5, 'F');
        doc.setFont(font, 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(
          `${idx + 1}. ${stu.name.toUpperCase()} (${stu.class})`,
          leftMargin + 3,
          curY + 4.5
        );
        doc.text(
          showPoints
            ? `Poin: ${stu.totalPoints} • Status: ${getStudentStatus(stu)}`
            : `Status: ${getStudentStatus(stu)}`,
          rightMargin - 3,
          curY + 4.5,
          { align: 'right' }
        );
        doc.setTextColor(0, 0, 0);

        let infoStartX = leftMargin + 4;
        if (includeStudentPhoto) {
          const photoW = 21;
          const photoH = 26;
          const photoX = leftMargin + 3.5;
          const photoY = curY + 8.5;
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(148, 163, 184);
          doc.rect(photoX, photoY, photoW, photoH, 'FD');
          if (stuAsset) {
            try {
              doc.addImage(
                stuAsset.dataUrl,
                stuAsset.format,
                photoX + 0.5,
                photoY + 0.5,
                photoW - 1,
                photoH - 1
              );
            } catch {
              // ignore image draw glitch
            }
          }
          infoStartX = photoX + photoW + 4.5;
        }

        const colSpan = (rightMargin - infoStartX - 4) / 2;
        const leftColX = infoStartX;
        const rightColX = infoStartX + colSpan + 2;
        const detailY = curY + 11.5;

        doc.setFontSize(7.8);
        const drawKV = (x: number, yPos: number, label: string, val: string) => {
          doc.setFont(font, 'bold');
          doc.setTextColor(71, 85, 105);
          doc.text(label, x, yPos);
          doc.setFont(font, 'normal');
          doc.setTextColor(15, 23, 42);
          const clipped = doc.splitTextToSize(val || '-', colSpan - 25) as string[];
          doc.text(clipped[0] || '-', x + 24, yPos);
        };

        drawKV(leftColX, detailY, 'NIS / NISN', `: ${stu.nis} / ${stu.nisn || '-'}`);
        drawKV(leftColX, detailY + 4.8, 'Kelas / Absen', `: ${stu.class} / No. ${stu.absenNumber || '-'}`);
        drawKV(leftColX, detailY + 9.6, 'Jenis Kelamin', `: ${stu.gender === 'P' ? 'Perempuan (P)' : 'Laki-laki (L)'}`);
        drawKV(leftColX, detailY + 14.4, 'Tempat, Tgl Lhr', `: ${formatBirthPlaceDate(stu.birthPlace, stu.birthDate, true)}`);
        drawKV(leftColX, detailY + 19.2, 'Tahun Ajaran', `: ${stu.academicYear || appConfig.academicYear}`);

        drawKV(rightColX, detailY, 'No. HP / WA', `: ${getStudentPhone(stu) || '-'}`);
        drawKV(rightColX, detailY + 4.8, 'Email', `: ${stu.email || '-'}`);
        drawKV(rightColX, detailY + 9.6, 'Status Siswa', `: ${getStudentStatus(stu)}`);
        drawKV(rightColX, detailY + 14.4, 'Jml Catatan', `: ${stuRecs.length} Kejadian (${recsWithPhotos.length} Bukti Foto)`);
        drawKV(rightColX, detailY + 19.2, 'Alamat', `: ${stu.address || '-'}`);

        curY += boxHeight + 3;

        // Violations / Achievements Subtable for this student
        if (stuRecs.length > 0) {
          const dossierHead = showPoints
            ? [['No', 'Tanggal', 'Kategori', 'Deskripsi Kejadian', 'Poin', 'Pelapor']]
            : [['No', 'Tanggal', 'Kategori', 'Deskripsi Kejadian', 'Pelapor']];
          const dossierBody = stuRecs.map((v, rIdx) =>
            showPoints
              ? [
                  rIdx + 1,
                  v.date ? new Date(v.date).toLocaleDateString('id-ID') : '-',
                  v.category,
                  v.description,
                  v.points > 0 ? `+${v.points}` : v.points,
                  v.reporterName || '-',
                ]
              : [
                  rIdx + 1,
                  v.date ? new Date(v.date).toLocaleDateString('id-ID') : '-',
                  v.category,
                  v.description,
                  v.reporterName || '-',
                ]
          );
          const dossierColStyles: Record<number, any> = showPoints
            ? {
                0: { cellWidth: 9, halign: 'center' },
                1: { cellWidth: 22, halign: 'center' },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
                5: { cellWidth: 28 },
              }
            : {
                0: { cellWidth: 9, halign: 'center' },
                1: { cellWidth: 22, halign: 'center' },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 30 },
              };

          autoTable(doc, {
            startY: curY,
            margin: { left: leftMargin, right: leftMargin },
            head: dossierHead,
            body: dossierBody,
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', font },
            headStyles: { fillColor: [51, 65, 85], textColor: 255, halign: 'center', font },
            columnStyles: dossierColStyles,
          });
          curY = ((doc as any).lastAutoTable?.finalY || curY + 14) + 3;
        } else {
          doc.setFont(font, 'italic');
          doc.setFontSize(7.8);
          doc.setTextColor(100, 116, 139);
          doc.text(
            '• Belum ada catatan pelanggaran maupun penghargaan pada periode/filter yang dipilih.',
            leftMargin + 3,
            curY + 3.5
          );
          doc.setTextColor(0, 0, 0);
          curY += 7;
        }

        // Evidence Photo Grid attached directly under the student's dossier
        if (recsWithPhotos.length > 0) {
          const cols = orientation === 'landscape' ? 4 : 3;
          const gap = 4;
          const cardW = (usableWidth - gap * (cols - 1)) / cols;
          const imgH = 26;
          const cardH = imgH + 11;

          // Subheader
          if (curY + cardH + 8 > pageHeight - 14) {
            doc.addPage();
            curY = 16;
          }
          doc.setFont(font, 'bold');
          doc.setFontSize(7.8);
          doc.setTextColor(51, 65, 85);
          doc.text(`Lampiran Foto Bukti (${stu.name}):`, leftMargin, curY + 3);
          curY += 5;

          for (let i = 0; i < recsWithPhotos.length; i += cols) {
            if (curY + cardH > pageHeight - 14) {
              doc.addPage();
              curY = 16;
            }
            const rowChunk = recsWithPhotos.slice(i, i + cols);
            rowChunk.forEach((rec, cIdx) => {
              const x = leftMargin + cIdx * (cardW + gap);
              const asset = evidencePhotos.get(rec.id);

              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(203, 213, 225);
              doc.roundedRect(x, curY, cardW, cardH, 1.5, 1.5, 'FD');

              if (asset) {
                try {
                  doc.addImage(asset.dataUrl, asset.format, x + 1.5, curY + 1.5, cardW - 3, imgH);
                } catch {
                  // skip corrupt draw
                }
              }

              const dateTxt = rec.date ? new Date(rec.date).toLocaleDateString('id-ID') : '-';
              doc.setFont(font, 'bold');
              doc.setFontSize(6.8);
              doc.setTextColor(30, 41, 59);
              doc.text(`${dateTxt} • ${rec.category}`, x + 2, curY + imgH + 4.8);

              doc.setFont(font, 'normal');
              doc.setFontSize(6.5);
              doc.setTextColor(71, 85, 105);
              const descLines = doc.splitTextToSize(rec.description, cardW - 4) as string[];
              doc.text(descLines[0] || '', x + 2, curY + imgH + 8.5);
            });
            curY += cardH + 3;
          }
        }

        curY += 4;
      }

      drawPdfSignatures(doc, settings, appConfig, curY + 4);
      return doc;
    }

    // ==================== MODE 2: TABEL GABUNGAN DATA SISWA + FOTO ====================
    if (reportType === 'combined_table') {
      drawHeaderTitle(
        'LAPORAN REKAPITULASI GABUNGAN DATA SISWA, KEJADIAN & BUKTI FOTO',
        `${classText} • ${periodText} • Total ${targetViolations.length} Catatan`
      );

      const colIndexStudentPhoto = includeStudentPhoto ? 1 : -1;
      const colIndexEvidencePhoto = includeEvidencePhoto
        ? includeStudentPhoto
          ? 6
          : 5
        : -1;

      const headRow: string[] = ['No'];
      if (includeStudentPhoto) headRow.push('Foto Siswa');
      headRow.push(
        'Identitas Lengkap Siswa',
        'Tanggal & Pelapor',
        showPoints ? 'Kategori & Poin' : 'Kategori',
        'Deskripsi Kejadian'
      );
      if (includeEvidencePhoto) headRow.push('Foto Bukti');

      const bodyRows = targetViolations.map((rec, idx) => {
        const stu = studentById.get(rec.studentId);
        const studentSummary = stu
          ? `${stu.name}\nNIS: ${stu.nis} | Kelas: ${stu.class}\nStatus: ${getStudentStatus(stu)}${
              showPoints ? ` | Total: ${stu.totalPoints} Poin` : ''
            }`
          : `${rec.studentName}\nKelas: ${rec.studentClass}`;
        const dateReport = `${rec.date ? new Date(rec.date).toLocaleDateString('id-ID') : '-'}\nPelapor: ${rec.reporterName || 'Petugas'}`;
        const catPoint = showPoints
          ? `${rec.category}\n(${rec.points > 0 ? `+${rec.points}` : rec.points} Poin)`
          : `${rec.category}`;

        const row: any[] = [idx + 1];
        if (includeStudentPhoto) row.push('');
        row.push(studentSummary, dateReport, catPoint, rec.description);
        if (includeEvidencePhoto) row.push(rec.evidenceUrl ? '' : 'Tidak ada');
        return row;
      });

      const columnStyles: Record<number, any> = {
        0: { cellWidth: 10, halign: 'center' },
      };
      let c = 1;
      if (includeStudentPhoto) {
        columnStyles[c++] = { cellWidth: 20, halign: 'center' };
      }
      columnStyles[c++] = { cellWidth: 58 };
      columnStyles[c++] = { cellWidth: 32 };
      columnStyles[c++] = { cellWidth: 24, halign: 'center', fontStyle: 'bold' };
      columnStyles[c++] = { cellWidth: 'auto' };
      if (includeEvidencePhoto) {
        columnStyles[c++] = { cellWidth: 28, halign: 'center' };
      }

      const minRowH = includeStudentPhoto || includeEvidencePhoto ? 22 : 10;

      autoTable(doc, {
        startY: curY,
        margin: { left: leftMargin, right: leftMargin },
        head: [headRow],
        body: bodyRows,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: 'middle',
          minCellHeight: minRowH,
          font,
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          halign: 'center',
          minCellHeight: 8,
          font,
        },
        columnStyles,
        didDrawCell: (data) => {
          if (data.section !== 'body') return;
          const rec = targetViolations[data.row.index];
          if (!rec) return;

          if (includeStudentPhoto && data.column.index === colIndexStudentPhoto) {
            const stuAsset = studentPhotos.get(rec.studentId);
            if (stuAsset) {
              const boxW = Math.min(14, data.cell.width - 3);
              const boxH = Math.min(18, data.cell.height - 3);
              const x = data.cell.x + (data.cell.width - boxW) / 2;
              const y = data.cell.y + (data.cell.height - boxH) / 2;
              try {
                doc.addImage(stuAsset.dataUrl, stuAsset.format, x, y, boxW, boxH);
              } catch {
                // ignore
              }
            }
          }

          if (includeEvidencePhoto && data.column.index === colIndexEvidencePhoto) {
            const evAsset = evidencePhotos.get(rec.id);
            if (evAsset) {
              const boxW = Math.min(23, data.cell.width - 3);
              const boxH = Math.min(18, data.cell.height - 3);
              const x = data.cell.x + (data.cell.width - boxW) / 2;
              const y = data.cell.y + (data.cell.height - boxH) / 2;
              try {
                doc.addImage(evAsset.dataUrl, evAsset.format, x, y, boxW, boxH);
              } catch {
                // ignore
              }
            }
          }
        },
      });

      const finalY = ((doc as any).lastAutoTable?.finalY || curY + 25) + 10;
      drawPdfSignatures(doc, settings, appConfig, finalY);
      return doc;
    }

    // ==================== MODE 3: DIREKTORI BIODATA + FOTO SISWA ====================
    if (reportType === 'student_directory_photo') {
      drawHeaderTitle(
        'DIREKTORI BIODATA & FOTO RESMI SISWA',
        `${classText} • Tahun Ajaran: ${appConfig.academicYear} • Total ${targetStudents.length} Siswa`
      );

      const photoColIdx = includeStudentPhoto ? 1 : -1;
      const headRow: string[] = ['Absen'];
      if (includeStudentPhoto) headRow.push('Foto');
      headRow.push(
        'NIS / NISN',
        'Nama Lengkap & L/P',
        'Kelas',
        'Tempat, Tgl Lahir',
        'Kontak & Alamat',
        showPoints ? 'Status & Poin' : 'Status'
      );

      const bodyRows = targetStudents.map((s, idx) => {
        const row: any[] = [s.absenNumber || idx + 1];
        if (includeStudentPhoto) row.push('');
        row.push(
          `${s.nis}\n${s.nisn || '-'}`,
          `${s.name}\n(${s.gender === 'P' ? 'Perempuan' : 'Laki-laki'})`,
          s.class,
          formatBirthPlaceDate(s.birthPlace, s.birthDate, true),
          `${getStudentPhone(s) || '-'}${s.email ? `\n${s.email}` : ''}${s.address ? `\n${s.address}` : ''}`,
          showPoints ? `${getStudentStatus(s)}\nPoin: ${s.totalPoints}` : getStudentStatus(s)
        );
        return row;
      });

      const columnStyles: Record<number, any> = {
        0: { cellWidth: 13, halign: 'center' },
      };
      let c = 1;
      if (includeStudentPhoto) {
        columnStyles[c++] = { cellWidth: 20, halign: 'center' };
      }
      columnStyles[c++] = { cellWidth: 26 };
      columnStyles[c++] = { cellWidth: 42, fontStyle: 'bold' };
      columnStyles[c++] = { cellWidth: 17, halign: 'center' };
      columnStyles[c++] = { cellWidth: 34 };
      columnStyles[c++] = { cellWidth: 'auto' };
      columnStyles[c++] = { cellWidth: 22, halign: 'center', fontStyle: 'bold' };

      autoTable(doc, {
        startY: curY,
        margin: { left: leftMargin, right: leftMargin },
        head: [headRow],
        body: bodyRows,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: 'middle',
          minCellHeight: includeStudentPhoto ? 22 : 9,
          font,
        },
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: 255,
          halign: 'center',
          minCellHeight: 8,
          font,
        },
        columnStyles,
        didDrawCell: (data) => {
          if (
            data.section === 'body' &&
            includeStudentPhoto &&
            data.column.index === photoColIdx
          ) {
            const stu = targetStudents[data.row.index];
            const stuAsset = stu ? studentPhotos.get(stu.id) : null;
            if (stuAsset) {
              const boxW = Math.min(14, data.cell.width - 3);
              const boxH = Math.min(18, data.cell.height - 3);
              const x = data.cell.x + (data.cell.width - boxW) / 2;
              const y = data.cell.y + (data.cell.height - boxH) / 2;
              try {
                doc.addImage(stuAsset.dataUrl, stuAsset.format, x, y, boxW, boxH);
              } catch {
                // ignore
              }
            }
          }
        },
      });

      const finalY = ((doc as any).lastAutoTable?.finalY || curY + 25) + 10;
      drawPdfSignatures(doc, settings, appConfig, finalY);
      return doc;
    }

    // ==================== MODE 4: REKAP KETERLAMBATAN + FOTO SISWA ====================
    drawHeaderTitle(
      'REKAPITULASI KETERLAMBATAN & TINDAK LANJUT (+ FOTO SISWA)',
      `${classText} • ${periodText} • Total ${targetTardinessList.length} Siswa Terlambat`
    );

    const tPhotoIdx = includeStudentPhoto ? 1 : -1;
    const tHead: string[] = ['No'];
    if (includeStudentPhoto) tHead.push('Foto');
    tHead.push('Nama Siswa & NIS', 'Kelas', 'Terlambat', 'Status', 'Tgl Terakhir', 'Tindakan');

    const tBody = targetTardinessList.map((item, idx) => {
      const stu = studentById.get(item.studentId);
      const row: any[] = [idx + 1];
      if (includeStudentPhoto) row.push('');
      row.push(
        `${item.studentName}\nNIS: ${stu?.nis || '-'}`,
        item.studentClass,
        `${item.count}x`,
        item.statusLabel,
        item.lastDate ? new Date(item.lastDate).toLocaleDateString('id-ID') : '-',
        item.actionRequired
      );
      return row;
    });

    const tColStyles: Record<number, any> = {
      0: { cellWidth: 10, halign: 'center' },
    };
    let tc = 1;
    if (includeStudentPhoto) {
      tColStyles[tc++] = { cellWidth: 19, halign: 'center' };
    }
    tColStyles[tc++] = { cellWidth: 44, fontStyle: 'bold' };
    tColStyles[tc++] = { cellWidth: 18, halign: 'center' };
    tColStyles[tc++] = { cellWidth: 18, halign: 'center', fontStyle: 'bold' };
    tColStyles[tc++] = { cellWidth: 28, halign: 'center' };
    tColStyles[tc++] = { cellWidth: 22, halign: 'center' };
    tColStyles[tc++] = { cellWidth: 'auto' };

    autoTable(doc, {
      startY: curY,
      margin: { left: leftMargin, right: leftMargin },
      head: [tHead],
      body: tBody,
      theme: 'grid',
      styles: {
        fontSize: 7.8,
        cellPadding: 2,
        valign: 'middle',
        minCellHeight: includeStudentPhoto ? 21 : 9,
        font,
      },
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: 255,
        halign: 'center',
        minCellHeight: 8,
        font,
      },
      columnStyles: tColStyles,
      didDrawCell: (data) => {
        if (
          data.section === 'body' &&
          includeStudentPhoto &&
          data.column.index === tPhotoIdx
        ) {
          const item = targetTardinessList[data.row.index];
          const stuAsset = item ? studentPhotos.get(item.studentId) : null;
          if (stuAsset) {
            const boxW = Math.min(13.5, data.cell.width - 3);
            const boxH = Math.min(17, data.cell.height - 3);
            const x = data.cell.x + (data.cell.width - boxW) / 2;
            const y = data.cell.y + (data.cell.height - boxH) / 2;
            try {
              doc.addImage(stuAsset.dataUrl, stuAsset.format, x, y, boxW, boxH);
            } catch {
              // ignore
            }
          }
        }
      },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || curY + 25) + 10;
    drawPdfSignatures(doc, settings, appConfig, finalY);
    return doc;
  };

  const hasPrintableData =
    reportType === 'combined_table'
      ? targetViolations.length > 0
      : reportType === 'tardiness_photo'
      ? targetTardinessList.length > 0
      : targetStudents.length > 0;

  const handleOpenPrintPreview = () => {
    if (!hasPrintableData) {
      toast.error('Tidak ada data yang sesuai dengan filter untuk dicetak.');
      return;
    }
    setIsPrintModalOpen(true);
  };

  const handleDirectDownloadPdf = async () => {
    if (!hasPrintableData) {
      toast.error('Tidak ada data yang sesuai dengan filter untuk diunduh.');
      return;
    }
    setIsPreparingDownload(true);
    try {
      toast.info('Menyiapkan laporan PDF beserta foto...');
      const settings = resolvePrintSettings(appConfig, currentUser, users, {
        showPoints: includePoints,
      });
      const doc = await buildReportPdfDoc(settings);
      doc.save(
        `Laporan_Terpadu_${reportType}_${filterClass || 'Semua'}_${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
      toast.success('Laporan PDF beserta foto berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat laporan PDF.');
    } finally {
      setIsPreparingDownload(false);
    }
  };

  const handleExportExcel = () => {
    if (!hasPrintableData) {
      toast.error('Tidak ada data untuk diunduh ke Excel.');
      return;
    }

    if (reportType === 'student_directory_photo') {
      const rows = targetStudents.map((s, idx) => ({
        No: idx + 1,
        NIS: s.nis,
        NISN: s.nisn || '-',
        'Nama Lengkap': s.name,
        Kelas: s.class,
        'No Absen': s.absenNumber || '-',
        JK: s.gender,
        'Tempat, Tgl Lahir': formatBirthPlaceDate(s.birthPlace, s.birthDate, false),
        'No HP': getStudentPhone(s) || '-',
        Email: s.email || '-',
        Alamat: s.address || '-',
        Status: getStudentStatus(s),
        'Total Poin': s.totalPoints,
        'Link Foto Siswa': getStudentPhoto(s),
      }));
      exportRowsToSpreadsheet(
        rows,
        'Direktori Siswa',
        `Laporan_Direktori_Siswa_${new Date().toISOString().slice(0, 10)}`,
        [6, 12, 14, 26, 12, 10, 6, 22, 16, 22, 30, 12, 10, 32],
        'xls'
      );
      toast.success(`Berhasil mengunduh ${rows.length} baris data (.xls)!`);
      return;
    }

    if (reportType === 'tardiness_photo') {
      const rows = targetTardinessList.map((item, idx) => ({
        No: idx + 1,
        'Nama Siswa': item.studentName,
        Kelas: item.studentClass,
        'Frekuensi Terlambat': item.count,
        Status: item.statusLabel,
        'Tanggal Terakhir': item.lastDate
          ? new Date(item.lastDate).toLocaleDateString('id-ID')
          : '-',
        Tindakan: item.actionRequired,
      }));
      exportRowsToSpreadsheet(
        rows,
        'Rekap Terlambat',
        `Laporan_Keterlambatan_${new Date().toISOString().slice(0, 10)}`,
        [6, 26, 12, 18, 22, 16, 36],
        'xls'
      );
      toast.success(`Berhasil mengunduh ${rows.length} baris keterlambatan (.xls)!`);
      return;
    }

    // Combined export
    const stuMap = new Map<string, Student>(students.map((s) => [s.id, s]));
    const rows = targetViolations.map((v, idx) => {
      const s = stuMap.get(v.studentId);
      return {
        No: idx + 1,
        Tanggal: v.date ? new Date(v.date).toLocaleDateString('id-ID') : '-',
        NIS: s?.nis || '-',
        'Nama Siswa': v.studentName,
        Kelas: v.studentClass,
        Status: s ? getStudentStatus(s) : 'Aktif',
        Kategori: v.category,
        Deskripsi: v.description,
        'Poin Kejadian': v.points,
        'Total Poin Siswa': s?.totalPoints ?? v.points,
        Pelapor: v.reporterName || '-',
        'Foto Siswa': s ? getStudentPhoto(s) : '-',
        'Bukti Foto': v.evidenceUrl || '-',
      };
    });

    exportRowsToSpreadsheet(
      rows,
      'Laporan Terpadu',
      `Laporan_Terpadu_Siswa_Foto_${new Date().toISOString().slice(0, 10)}`,
      [6, 14, 12, 24, 12, 12, 14, 38, 12, 14, 18, 28, 28],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${rows.length} baris laporan terpadu (.xls)!`);
  };

  const totalEvidenceAttached = useMemo(
    () => targetViolations.filter((v) => Boolean(v.evidenceUrl)).length,
    [targetViolations]
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-7 shadow-sm border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-5 relative overflow-hidden">
        <div
          className={`absolute right-0 top-0 w-96 h-96 bg-gradient-to-br ${theme.gradient} opacity-10 rounded-full blur-3xl pointer-events-none`}
        />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-wider mb-2.5 border border-indigo-200">
            <Printer className="w-3.5 h-3.5" /> Pusat Cetak Laporan Resmi
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Cetak Laporan Terpadu Data Siswa &amp; Foto
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            Cetak laporan resmi dalam satu dokumen lengkap yang menyatukan{' '}
            <strong className="text-slate-700">Biodata &amp; Foto Profil Siswa</strong> bersama{' '}
            <strong className="text-slate-700">Catatan Pelanggaran/Prestasi dan Foto Bukti</strong>,
            lengkap dengan pengaturan Kop Surat, TTD, posisi, dan Font sebelum dicetak.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3.5">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              {targetStudents.length} Siswa Siap Cetak
            </span>
            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              {targetViolations.length} Catatan
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              {totalEvidenceAttached} Foto Bukti Terlampir
            </span>
          </div>
        </div>

        {/* Main Print / Export Buttons */}
        <div className="relative z-10 flex flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!hasPrintableData}
            className="px-4 py-3 bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Unduh XLS
          </button>

          <button
            type="button"
            onClick={handleDirectDownloadPdf}
            disabled={!hasPrintableData || isPreparingDownload}
            className="px-4 py-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FileDown className="w-4 h-4" />
            {isPreparingDownload ? 'Menyiapkan PDF...' : 'Unduh PDF'}
          </button>

          <button
            type="button"
            onClick={handleOpenPrintPreview}
            disabled={!hasPrintableData}
            className={`px-5 py-3 bg-gradient-to-r ${theme.gradient} hover:opacity-95 text-white rounded-2xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer`}
          >
            <Printer className="w-4 h-4" /> Pratinjau, Atur Kop/TTD &amp; Cetak
          </button>
        </div>
      </div>

      {/* Step 1: Pilih Jenis Laporan */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> 1. Pilih Format Laporan
          </h3>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Portrait (Tegak)
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Landscape (Melebar)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {REPORT_TEMPLATES.map((tpl) => {
            const active = reportType === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleChangeReportType(tpl.id)}
                className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                    : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tpl.badge}
                    </span>
                    {active && <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </div>
                  <h4 className="font-black text-xs sm:text-sm text-slate-900">{tpl.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{tpl.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Filter Data & Opsi Foto */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" /> 2. Filter Data &amp; Penyertaan Foto
          </h3>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Cari Siswa
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama / NIS / NISN..."
                className="w-full pl-8 pr-2.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Kelas
            </label>
            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setFilterStudentId('');
                setSelectedStudentIds([]);
              }}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Kelas</option>
              {CLASS_LIST.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Pilih Siswa Tertentu
            </label>
            <select
              value={filterStudentId}
              onChange={(e) => {
                setFilterStudentId(e.target.value);
                setSelectedStudentIds([]);
              }}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Siswa ({studentDropdownChoices.length})</option>
              {studentDropdownChoices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.class})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Kategori Catatan
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Catatan</option>
              <option value="VIOLATIONS_ONLY">Hanya Pelanggaran</option>
              <option value="TARDINESS">Khusus Keterlambatan</option>
              <option value={ViolationCategory.RINGAN}>Pelanggaran Ringan</option>
              <option value={ViolationCategory.SEDANG}>Pelanggaran Sedang</option>
              <option value={ViolationCategory.BERAT}>Pelanggaran Berat</option>
              <option value={ViolationCategory.PRESTASI}>Prestasi &amp; Reward</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Dari Tanggal
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Sampai Tanggal
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Toggles for Photos */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/60 text-xs font-bold text-indigo-900 cursor-pointer">
            <input
              type="checkbox"
              checked={includeStudentPhoto}
              onChange={(e) => setIncludeStudentPhoto(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
            />
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            Sertakan Foto Profil Siswa di Laporan
          </label>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs font-bold text-emerald-900 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEvidencePhoto}
              onChange={(e) => setIncludeEvidencePhoto(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            Sertakan Foto Bukti Kejadian / Prestasi
          </label>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50/70 text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={includePoints}
              onChange={(e) => setIncludePoints(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
            />
            Tampilkan Poin di Cetak / PDF
          </label>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithViolations}
              onChange={(e) => setOnlyWithViolations(e.target.checked)}
              className="rounded text-slate-700 focus:ring-slate-500 w-4 h-4 cursor-pointer"
            />
            Hanya Siswa Yang Memiliki Catatan
          </label>
        </div>
      </div>

      {/* Step 3: Pratinjau Daftar Siswa & Foto Yang Akan Dicetak */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAllStudents}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              {matchingStudents.length > 0 &&
              matchingStudents.every((s) => selectedStudentIds.includes(s.id)) ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              {selectedStudentIds.length > 0
                ? `${selectedStudentIds.length} Siswa Dipilih`
                : `Semua Siswa Tampil (${matchingStudents.length})`}
            </button>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-600 font-medium">
              Centang siswa tertentu bila ingin mencetak sebagian siswa saja.
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenPrintPreview}
            disabled={!hasPrintableData}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" /> Pratinjau &amp; Cetak ({targetStudents.length} Siswa)
          </button>
        </div>

        {matchingStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-sm">
              Tidak ada siswa atau laporan yang sesuai filter
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Sesuaikan filter kelas, kategori, atau tanggal di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
            {matchingStudents.map((stu) => {
              const stuRecs = violationsByStudent.get(stu.id) || [];
              const evidenceRecs = stuRecs.filter((r) => Boolean(r.evidenceUrl));
              const isSelected = selectedStudentIds.includes(stu.id);

              return (
                <div
                  key={stu.id}
                  className={`p-4 sm:p-5 transition-colors ${
                    isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Left: Checkbox + Student Photo + Biodata */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelectStudent(stu.id)}
                        className="mt-1 shrink-0 cursor-pointer"
                        title="Pilih siswa ini untuk cetak khusus"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                        )}
                      </button>

                      {includeStudentPhoto && (
                        <img
                          src={getStudentPhoto(stu)}
                          alt={stu.name}
                          onError={(e) => {
                            const fb = getDefaultStudentAvatar(stu.gender);
                            if (!e.currentTarget.src.endsWith(fb)) {
                              e.currentTarget.src = fb;
                            }
                          }}
                          className="w-16 h-20 rounded-xl object-cover border-2 border-white shadow-md shrink-0 bg-slate-100"
                          referrerPolicy="no-referrer"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onViewStudent && onViewStudent(stu)}
                            className="font-black text-sm sm:text-base text-slate-900 hover:text-indigo-600 transition text-left cursor-pointer"
                          >
                            {stu.name}
                          </button>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                            {stu.class} {stu.absenNumber ? `• Absen ${stu.absenNumber}` : ''}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeClasses(
                              stu.status
                            )}`}
                          >
                            {getStudentStatus(stu)}
                          </span>
                          {includePoints && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                                stu.totalPoints > 50
                                  ? 'bg-rose-100 text-rose-700'
                                  : stu.totalPoints < 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {stu.totalPoints} Poin
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                          <div>
                            <span className="font-semibold text-slate-700">NIS / NISN:</span>{' '}
                            {stu.nis} / {stu.nisn || '-'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">TTL:</span>{' '}
                            {formatBirthPlaceDate(stu.birthPlace, stu.birthDate, true)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-700">Kontak:</span>{' '}
                            {getStudentPhone(stu) || '-'}
                          </div>
                          <div className="truncate" title={stu.address || '-'}>
                            <span className="font-semibold text-slate-700">Alamat:</span>{' '}
                            {stu.address || '-'}
                          </div>
                        </div>

                        {/* Latest violation snippets */}
                        {stuRecs.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {stuRecs.slice(0, 3).map((rec) => (
                              <span
                                key={rec.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  rec.category === ViolationCategory.PRESTASI
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : rec.category === ViolationCategory.BERAT
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {rec.category === ViolationCategory.PRESTASI ? (
                                  <Award className="w-3 h-3" />
                                ) : isTardinessRecord(rec) ? (
                                  <Clock className="w-3 h-3" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                <span className="truncate max-w-[200px]">{rec.description}</span>
                                {includePoints && (
                                  <span>({rec.points > 0 ? `+${rec.points}` : rec.points})</span>
                                )}
                              </span>
                            ))}
                            {stuRecs.length > 3 && (
                              <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5">
                                +{stuRecs.length - 3} catatan lagi
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Evidence Photo Thumbnails for this student */}
                    {includeEvidencePhoto && evidenceRecs.length > 0 && (
                      <div className="lg:w-72 shrink-0 flex flex-col justify-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                          <Camera className="w-3 h-3 text-emerald-600" />
                          {evidenceRecs.length} Foto Bukti Terlampir
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {evidenceRecs.slice(0, 4).map((ev) => (
                            <div
                              key={ev.id}
                              className="w-16 h-14 rounded-lg overflow-hidden border border-slate-200 shadow-2xs shrink-0 relative bg-slate-100"
                              title={`${ev.date.slice(0, 10)} • ${ev.description}`}
                            >
                              <img
                                src={ev.evidenceUrl}
                                alt={ev.description}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ))}
                          {evidenceRecs.length > 4 && (
                            <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-600 shrink-0">
                              +{evidenceRecs.length - 4}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print Preview & Kop/TTD/Font Config Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        title="Pratinjau & Pengaturan Cetak Laporan Terpadu (Data Siswa + Foto)"
        fileNamePrefix={`Laporan_Terpadu_${reportType}_${filterClass || 'Semua'}`}
        appConfig={appConfig}
        currentUser={currentUser}
        users={users}
        onClose={() => setIsPrintModalOpen(false)}
        buildPdfDoc={buildReportPdfDoc}
        onSaveDefaultSettings={onSavePrintSettings}
        defaultOverrides={{ showPoints: includePoints }}
      />
    </div>
  );
};

export default ReportCenter;
