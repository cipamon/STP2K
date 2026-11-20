import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Student, User, AppConfig, ViolationRecord, PrintDocumentSettings } from '../types';
import { CLASS_LIST } from '../constants';
import {
  UserPlus,
  X,
  Camera,
  Save,
  User as UserIcon,
  Upload as UploadIcon,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileDown,
  Printer,
  Clock,
  BellRing,
  AlertTriangle,
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Eye,
  FileSpreadsheet,
  Sliders,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStudentTardinessInfo } from '../utils/tardiness';
import ConfirmModal from './ConfirmModal';
import { KopSurat } from './KopSurat';
import { SignatureLayoutEditor } from './SignatureLayoutEditor';
import { drawPdfKopSurat, drawPdfSignatures, getPdfFontFamily, resolvePrintSettings } from '../utils/pdfKop';
import PrintPreviewModal from './PrintPreviewModal';
import PrintSettingsPanel from './PrintSettingsPanel';
import {
  STUDENT_STATUS_OPTIONS,
  compressStudentPhoto,
  formatBirthPlaceDate,
  getRawStudentPhoto,
  getStatusBadgeClasses,
  getStudentPhone,
  getStudentPhoto,
  getStudentStatus,
  normalizeGender,
  normalizeStudentStatus,
  parseBirthDateInput,
} from '../utils/studentHelpers';
import { getDefaultStudentAvatar, normalizePhotoUrl } from '../utils/avatarHelpers';
import { exportAoaToSpreadsheet, exportRowsToSpreadsheet } from '../utils/exportHelpers';
import { loadStudentPdfPhoto, PdfImageAsset } from '../utils/pdfImages';
import { StudentAvatar } from './StudentAvatar';

interface StudentListProps {
  students: Student[];
  violations?: ViolationRecord[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBulkUpload: (students: Student[]) => void;
  onBulkDeleteStudents: (ids: string[]) => void;
  onDeleteAllStudents?: () => void;
  onDeleteStudentsByClass?: (className: string) => void;
  onViewStudent: (student: Student) => void;
  appConfig: AppConfig;
  currentUser: User;
  activeAcademicYear?: string;
  users?: User[];
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  violations = [],
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkUpload,
  onBulkDeleteStudents,
  onDeleteAllStudents,
  onDeleteStudentsByClass,
  onViewStudent,
  appConfig,
  currentUser,
  activeAcademicYear,
  users = [],
  onSavePrintSettings,
}) => {
  const targetAcademicYear = activeAcademicYear || appConfig.academicYear;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAlarmOnly, setFilterAlarmOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showPrePrintPanel, setShowPrePrintPanel] = useState(false);
  const [draftPrintSettings, setDraftPrintSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(appConfig, currentUser, users)
  );

  useEffect(() => {
    setDraftPrintSettings(resolvePrintSettings(appConfig, currentUser, users));
  }, [appConfig, currentUser, users]);

  // Delete Menu and Dialog States
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [isDeleteClassModalOpen, setIsDeleteClassModalOpen] = useState(false);
  const [selectedClassToDelete, setSelectedClassToDelete] = useState('');

  // In-app ConfirmModal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    action: () => void;
    variant: 'danger' | 'warning';
    confirmText: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    variant: 'danger',
    confirmText: 'Hapus',
  });

  // Form States (15 structured fields)
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [absenNumber, setAbsenNumber] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [status, setStatus] = useState<string>('Aktif');
  const [waliKelas, setWaliKelas] = useState('');
  const [guruBk, setGuruBk] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');

  // Bulk Upload State
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);

  const teacherSuggestions = useMemo(() => {
    const names = new Set<string>();
    users.forEach((u) => {
      if (u.name) names.add(u.name);
    });
    students.forEach((s) => {
      if (s.waliKelas) names.add(s.waliKelas);
      if (s.guruBk) names.add(s.guruBk);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'id'));
  }, [users, students]);

  const INITIAL_LIMIT = 10;

  // Count students with active tardiness alarm
  const alarmStudentsCount = useMemo(
    () =>
      students.filter((s) => {
        const info = getStudentTardinessInfo(s.id, s.name, s.class, violations);
        return info.isAlarm;
      }).length,
    [students, violations]
  );

  // Collect all distinct classes (standard + custom imported classes)
  const classOptions = useMemo(() => {
    const set = new Set<string>(CLASS_LIST);
    students.forEach((s) => {
      if (s.class) set.add(s.class);
    });
    return Array.from(set);
  }, [students]);

  // Filter & sort students neatly by class and absenNumber/name
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students
      .filter((s) => {
        if (filterClass && s.class !== filterClass) return false;
        if (filterStatus && getStudentStatus(s) !== filterStatus) return false;
        if (filterAlarmOnly) {
          const info = getStudentTardinessInfo(s.id, s.name, s.class, violations);
          if (!info.isAlarm) return false;
        }
        if (q) {
          const phoneVal = getStudentPhone(s).toLowerCase();
          const haystack = [
            s.nis,
            s.nisn,
            s.name,
            s.class,
            s.absenNumber,
            s.birthPlace,
            s.email,
            s.address,
            phoneVal,
            s.waliKelas,
            s.guruBk,
            getStudentStatus(s),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.class !== b.class) return a.class.localeCompare(b.class, 'id');
        const absA = parseInt(a.absenNumber || '', 10);
        const absB = parseInt(b.absenNumber || '', 10);
        if (!isNaN(absA) && !isNaN(absB) && absA !== absB) return absA - absB;
        return a.name.localeCompare(b.name, 'id');
      });
  }, [students, filterClass, filterStatus, filterAlarmOnly, searchQuery, violations]);

  const displayedStudents = showAll ? filteredStudents : filteredStudents.slice(0, INITIAL_LIMIT);

  const openAddModal = () => {
    setEditingStudent(null);
    setNis('');
    setNisn('');
    setName('');
    setClassName('');
    setAbsenNumber('');
    setBirthPlace('');
    setBirthDate('');
    setEmail('');
    setAddress('');
    setPhone('');
    setGender('L');
    setStatus('Aktif');
    setWaliKelas('');
    setGuruBk('');
    setPhotoPreview('');
    setIsUploadMode(false);
    setSelectedExcelFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNis(student.nis || '');
    setNisn(student.nisn || '');
    setName(student.name || '');
    setClassName(student.class || '');
    setAbsenNumber(student.absenNumber || '');
    setBirthPlace(student.birthPlace || '');
    setBirthDate(parseBirthDateInput(student.birthDate));
    setEmail(student.email || '');
    setAddress(student.address || '');
    setPhone(getStudentPhone(student));
    setGender(student.gender || 'L');
    setStatus(getStudentStatus(student));
    setWaliKelas(student.waliKelas || '');
    setGuruBk(student.guruBk || '');
    setPhotoPreview(getRawStudentPhoto(student));
    setIsUploadMode(false);
    setSelectedExcelFile(null);
    setIsModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      [
        'NIS',
        'NISN',
        'Nama',
        'Kelas',
        'No Absen',
        'Tempat',
        'Tanggal Lahir',
        'Email',
        'Foto',
        'ALAMAT',
        'NO_HP',
        'JENIS_KELAMIN',
        'Status',
        'Wali Kelas',
        'Guru BK',
      ],
      [
        '102401',
        '0071234567',
        'Contoh Nama Siswa',
        'X E 1',
        '01',
        'Kudus',
        '2010-05-14',
        'siswa@sma1kudus.sch.id',
        '',
        'Jl. Pramuka No. 41, Kudus',
        '081234567890',
        'L',
        'Aktif',
        'Drs. Budi Santoso',
        'Palupi Etikawati, S.Pd',
      ],
    ];
    exportAoaToSpreadsheet(
      headers,
      'Data Siswa',
      'Template_Import_Siswa_SiPerSis',
      [12, 14, 28, 12, 10, 16, 15, 26, 24, 32, 15, 14, 12, 24, 24],
      'xls'
    );
    toast.success('Template XLS lengkap (15 kolom) berhasil diunduh.');
  };

  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      toast.error('Tidak ada data siswa untuk diekspor.');
      return;
    }
    const rows = filteredStudents.map((s) => ({
      NIS: s.nis || '-',
      NISN: s.nisn || '-',
      Nama: s.name,
      Kelas: s.class,
      'No Absen': s.absenNumber || '-',
      Tempat: s.birthPlace || '-',
      'Tanggal Lahir': s.birthDate || '-',
      Email: s.email || '-',
      Foto: getRawStudentPhoto(s),
      ALAMAT: s.address || '-',
      NO_HP: getStudentPhone(s) || '-',
      JENIS_KELAMIN: s.gender,
      Status: getStudentStatus(s),
      'Wali Kelas': s.waliKelas || '-',
      'Guru BK': s.guruBk || '-',
      'Total Poin': s.totalPoints,
      'Tahun Ajaran': s.academicYear || appConfig.academicYear,
    }));
    exportRowsToSpreadsheet(
      rows,
      'Data Siswa',
      `Data_Siswa_${filterClass || 'Semua'}_${new Date().toISOString().slice(0, 10)}`,
      [12, 14, 26, 12, 10, 15, 15, 26, 24, 32, 15, 14, 12, 24, 24, 12, 14],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${filteredStudents.length} data siswa (.xls)!`);
  };

  const buildStudentPdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || resolvePrintSettings(appConfig, currentUser, users);
    const showPoints = settings.showPoints !== false;
    const font = getPdfFontFamily(settings.documentFontFamily);
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Kop Surat Resmi
    const currentY = await drawPdfKopSurat(doc, appConfig, 8, settings);

    // Title
    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    doc.text(
      `DATA DIREKTORI SISWA ${filterClass ? `KELAS ${filterClass}` : ''}`,
      pageWidth / 2,
      currentY + 6,
      { align: 'center' }
    );

    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(`Tahun Ajaran: ${appConfig.academicYear}`, pageWidth / 2, currentY + 11, {
      align: 'center',
    });

    const studentPhotos = new Map<string, PdfImageAsset | null>();
    await Promise.all(
      filteredStudents.map(async (s) => {
        const asset = await loadStudentPdfPhoto(s);
        studentPhotos.set(s.id, asset);
      })
    );

    const baseHeaders = [
      'Absen',
      'Foto',
      'NIS / NISN',
      'Nama Lengkap',
      'Kelas & Pembina',
      'L/P',
      'Tempat, Tgl Lahir',
      'No. HP & Email',
      'Alamat',
      'Status',
    ];
    if (showPoints) baseHeaders.push('Poin');

    const body = filteredStudents.map((s, index) => {
      const row: any[] = [
        s.absenNumber || index + 1,
        '',
        `${s.nis}\n${s.nisn || '-'}`,
        s.name,
        `${s.class}\nWali: ${s.waliKelas || '-'}\nBK: ${s.guruBk || '-'}`,
        s.gender,
        formatBirthPlaceDate(s.birthPlace, s.birthDate, true),
        `${getStudentPhone(s) || '-'}\n${s.email || '-'}`,
        s.address || '-',
        getStudentStatus(s),
      ];
      if (showPoints) row.push(s.totalPoints);
      return row;
    });

    const columnStyles: Record<number, any> = {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 25 },
      3: { cellWidth: 34, fontStyle: 'bold' },
      4: { cellWidth: 33 },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 30 },
      7: { cellWidth: 38 },
      8: { cellWidth: 'auto' },
      9: { cellWidth: 18, halign: 'center' },
    };
    if (showPoints) {
      columnStyles[10] = { cellWidth: 13, halign: 'center', fontStyle: 'bold' };
    }

    autoTable(doc, {
      startY: currentY + 17,
      head: [baseHeaders],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', minCellHeight: 17, font },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, halign: 'center', minCellHeight: 8, font },
      columnStyles,
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 1) return;
        const stu = filteredStudents[data.row.index];
        if (!stu) return;
        const asset = studentPhotos.get(stu.id);
        if (!asset) return;
        const boxW = Math.min(11, data.cell.width - 3);
        const boxH = Math.min(14, data.cell.height - 2.5);
        const x = data.cell.x + (data.cell.width - boxW) / 2;
        const y = data.cell.y + (data.cell.height - boxH) / 2;
        try {
          doc.addImage(asset.dataUrl, asset.format, x, y, boxW, boxH);
        } catch {
          // ignore
        }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    drawPdfSignatures(doc, settings, appConfig, finalY);

    return doc;
  };

  const handlePrint = () => {
    if (filteredStudents.length === 0) {
      toast.error('Tidak ada data untuk dicetak.');
      return;
    }
    setIsPrintModalOpen(true);
  };

  const handleDirectDownloadPdf = async () => {
    if (filteredStudents.length === 0) {
      toast.error('Tidak ada data untuk diunduh.');
      return;
    }

    try {
      const doc = await buildStudentPdfDoc(draftPrintSettings);
      doc.save(`Data_Siswa_${filterClass || 'Semua'}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('File PDF data siswa berhasil diunduh!');
    } catch (error) {
      console.error('PDF download failed:', error);
      toast.error('Gagal mengunduh PDF. Silakan coba lagi.');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressStudentPhoto(file);
      setPhotoPreview(compressed);
      toast.success('Foto siswa siap disimpan.');
    } catch {
      toast.error('Gagal memproses gambar.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedExcelFile(file);
      e.target.value = '';
    }
  };

  const execUploadExcel = () => {
    if (!selectedExcelFile) return;

    setIsSyncing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        processWorkbook(workbook);
      } catch (err) {
        console.error('Excel Read Error:', err);
        toast.error('Gagal membaca file Excel. Pastikan file tidak rusak.');
      } finally {
        setIsSyncing(false);
      }
    };
    reader.onerror = () => {
      toast.error('Terjadi masalah saat membaca file.');
      setIsSyncing(false);
    };
    reader.readAsArrayBuffer(selectedExcelFile);
  };

  const processWorkbook = (workbook: XLSX.WorkBook) => {
    try {
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        toast.error('File tidak valid atau kosong.');
        return;
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      if (jsonData.length < 2) {
        toast.error('File tidak memiliki baris data siswa.');
        return;
      }

      const headerRow = (jsonData[0] || []).map((h) =>
        String(h || '')
          .trim()
          .toUpperCase()
          .replace(/[\s_]+/g, '_')
      );

      // Detect column indices by header name
      const findCol = (aliases: string[]) =>
        headerRow.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));

      const colIdx = {
        nis: findCol(['NIS']),
        nisn: findCol(['NISN']),
        name: findCol(['NAMA', 'NAMA_LENGKAP', 'NAMA_SISWA']),
        class: findCol(['KELAS', 'ROMBEL']),
        absen: findCol(['NO_ABSEN', 'ABSEN', 'NO._ABSEN', 'NOMOR_ABSEN']),
        birthPlace: findCol(['TEMPAT', 'TEMPAT_LAHIR', 'TMP_LAHIR']),
        birthDate: findCol(['TANGGAL_LAHIR', 'TGL_LAHIR', 'LAHIR']),
        email: findCol(['EMAIL', 'E-MAIL', 'SUREL']),
        photo: findCol(['FOTO', 'PHOTO', 'URL_FOTO', 'PHOTO_URL']),
        address: findCol(['ALAMAT', 'ADDRESS']),
        phone: findCol(['NO_HP', 'HP', 'NO_TELEPON', 'TELEPON', 'WA', 'NO_WA']),
        gender: findCol(['JENIS_KELAMIN', 'L/P', 'JK', 'GENDER', 'KELAMIN']),
        status: findCol(['STATUS', 'STATUS_SISWA']),
        waliKelas: findCol(['WALI_KELAS', 'WALI', 'WALIKELAS']),
        guruBk: findCol(['GURU_BK', 'BK', 'KONSELOR', 'PEMBIMBING_BK']),
      };

      // Fix NIS matching NISN if NIS column came after or NISN matched first
      if (colIdx.nis === colIdx.nisn) {
        const exactNis = headerRow.findIndex((h) => h === 'NIS');
        const exactNisn = headerRow.findIndex((h) => h === 'NISN');
        if (exactNis !== -1) colIdx.nis = exactNis;
        if (exactNisn !== -1) colIdx.nisn = exactNisn;
      }

      const hasFullHeader = colIdx.nis !== -1 && colIdx.name !== -1 && colIdx.class !== -1;

      const rows = jsonData.slice(1);
      const newStudents: Student[] = [];

      rows.forEach((row: any, index) => {
        if (!Array.isArray(row) || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
          return;
        }

        const cell = (idx: number) => (idx >= 0 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '');

        let snis = '';
        let snisn = '';
        let sname = '';
        let sclass = '';
        let sabsen = '';
        let sbirthPlace = '';
        let sbirthDate = '';
        let semail = '';
        let sphoto = '';
        let saddress = '';
        let sphone = '';
        let sgenderRaw = '';
        let sstatusRaw = '';
        let swaliKelas = '';
        let sguruBk = '';

        if (hasFullHeader) {
          snis = cell(colIdx.nis);
          snisn = cell(colIdx.nisn);
          sname = cell(colIdx.name);
          sclass = cell(colIdx.class);
          sabsen = cell(colIdx.absen);
          sbirthPlace = cell(colIdx.birthPlace);
          sbirthDate = colIdx.birthDate >= 0 ? parseBirthDateInput(row[colIdx.birthDate]) : '';
          semail = cell(colIdx.email);
          sphoto = cell(colIdx.photo);
          saddress = cell(colIdx.address);
          sphone = cell(colIdx.phone);
          sgenderRaw = cell(colIdx.gender);
          sstatusRaw = cell(colIdx.status);
          swaliKelas = cell(colIdx.waliKelas);
          sguruBk = cell(colIdx.guruBk);
        } else {
          // Positional fallback: support both 5-column legacy format and 13/15-column format
          snis = cell(0);
          snisn = cell(1);
          sname = cell(2);
          sclass = cell(3);
          const col4 = cell(4).toUpperCase();
          if (row.length <= 6 && (col4 === 'L' || col4 === 'P' || col4 === 'LAKI-LAKI' || col4 === 'PEREMPUAN')) {
            sgenderRaw = col4;
          } else {
            sabsen = cell(4);
            sbirthPlace = cell(5);
            sbirthDate = parseBirthDateInput(row[6]);
            semail = cell(7);
            sphoto = cell(8);
            saddress = cell(9);
            sphone = cell(10);
            sgenderRaw = cell(11);
            sstatusRaw = cell(12);
            swaliKelas = cell(13);
            sguruBk = cell(14);
          }
        }

        if (snis && sname && sclass) {
          newStudents.push({
            id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
            nis: snis,
            nisn: snisn || '-',
            name: sname,
            class: sclass,
            absenNumber: sabsen || undefined,
            birthPlace: sbirthPlace || undefined,
            birthDate: sbirthDate || undefined,
            email: semail || undefined,
            photoUrl: sphoto || undefined,
            address: saddress || undefined,
            phone: sphone || undefined,
            parentPhone: sphone || undefined,
            gender: normalizeGender(sgenderRaw),
            status: normalizeStudentStatus(sstatusRaw),
            waliKelas: swaliKelas || undefined,
            guruBk: sguruBk || undefined,
            totalPoints: 0,
            academicYear: targetAcademicYear,
          });
        }
      });

      if (newStudents.length > 0) {
        onBulkUpload(newStudents);
        setIsModalOpen(false);
        setGoogleSheetUrl('');
        setSelectedExcelFile(null);
      } else {
        toast.error(
          'Gagal membaca data. Pastikan kolom minimal berisi NIS, Nama, dan Kelas sesuai Template Excel.'
        );
      }
    } catch (error) {
      console.error('Process Workbook Error:', error);
      toast.error('Terjadi kesalahan teknis saat memproses data.');
    }
  };

  const handleGoogleSheetSync = async () => {
    if (!googleSheetUrl) {
      toast.error('Masukkan URL Google Sheet terlebih dahulu.');
      return;
    }

    const sheetIdMatch = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      toast.error('URL Google Sheet tidak valid.');
      return;
    }

    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    setIsSyncing(true);
    try {
      const response = await fetch(csvUrl);
      if (!response.ok)
        throw new Error('Gagal mengambil data. Pastikan Sheet diatur ke "Siapa saja yang memiliki link dapat melihat".');

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      processWorkbook(workbook);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nis.trim() || !nisn.trim() || !name.trim() || !className.trim()) {
      toast.error('Mohon lengkapi NIS, NISN, Nama, dan Kelas.');
      return;
    }

    const cleanPhoto = normalizePhotoUrl(photoPreview) || undefined;
    const cleanPhone = phone.trim() || undefined;
    const cleanWaliKelas = waliKelas.trim() || undefined;
    const cleanGuruBk = guruBk.trim() || undefined;

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        nis: nis.trim(),
        nisn: nisn.trim(),
        name: name.trim(),
        class: className.trim(),
        absenNumber: absenNumber.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        phone: cleanPhone,
        parentPhone: cleanPhone || editingStudent.parentPhone,
        gender,
        status: status.trim() || 'Aktif',
        waliKelas: cleanWaliKelas,
        guruBk: cleanGuruBk,
        photoUrl: cleanPhoto,
        avatar: cleanPhoto,
        academicYear: editingStudent.academicYear || targetAcademicYear,
      });
    } else {
      const newStudent: Student = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nis: nis.trim(),
        nisn: nisn.trim(),
        name: name.trim(),
        class: className.trim(),
        absenNumber: absenNumber.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        phone: cleanPhone,
        parentPhone: cleanPhone,
        gender,
        status: status.trim() || 'Aktif',
        waliKelas: cleanWaliKelas,
        guruBk: cleanGuruBk,
        totalPoints: 0,
        photoUrl: cleanPhoto,
        academicYear: targetAcademicYear,
      };
      onAddStudent(newStudent);
    }

    setIsModalOpen(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === displayedStudents.length && displayedStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedStudents.map((s) => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const triggerDeleteStudent = (student: Student) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Data Siswa',
      message: (
        <div>
          <p className="mb-2">Apakah Anda yakin ingin menghapus data siswa berikut?</p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
            <StudentAvatar student={student} sizeClass="w-11 h-11" />
            <div className="min-w-0">
              <div className="font-bold text-slate-800 text-sm truncate">{student.name}</div>
              <div className="text-xs text-slate-500">
                NIS: {student.nis} {student.nisn ? `| NISN: ${student.nisn}` : ''}
              </div>
              <div className="text-xs text-slate-500">
                Kelas: {student.class} | Absen: {student.absenNumber || '-'} | Status: {getStudentStatus(student)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-rose-600 text-xs font-semibold">
            Data siswa akan dihapus secara permanen dari basis data dan cloud penyimpanan.
          </p>
        </div>
      ),
      variant: 'danger',
      confirmText: 'Ya, Hapus Siswa',
      action: () => {
        onDeleteStudent(student.id);
        setSelectedIds((prev) => prev.filter((i) => i !== student.id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const triggerBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const selectedStudentsPreview = students.filter((s) => selectedIds.includes(s.id));
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Siswa Terpilih',
      message: (
        <div>
          <p>
            Apakah Anda yakin ingin menghapus <strong className="text-rose-600">{selectedIds.length} data siswa</strong> yang telah dipilih?
          </p>
          {selectedStudentsPreview.length > 0 && (
            <div className="mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap gap-1.5">
              {selectedStudentsPreview.slice(0, 4).map((stu) => (
                <div key={stu.id} className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
                  <StudentAvatar student={stu} sizeClass="w-5 h-5" />
                  <span>{stu.name}</span>
                </div>
              ))}
              {selectedStudentsPreview.length > 4 && (
                <span className="text-xs text-slate-500 self-center px-1">+{selectedStudentsPreview.length - 4} siswa lain</span>
              )}
            </div>
          )}
          <p className="mt-2 text-slate-500 text-xs">
            Seluruh data siswa terpilih beserta akumulasi poin akan dihapus secara permanen dari sistem.
          </p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus ${selectedIds.length} Siswa`,
      action: () => {
        onBulkDeleteStudents(selectedIds);
        setSelectedIds([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const triggerDeleteByClass = (targetClass: string) => {
    const classStudents = students.filter((s) => s.class === targetClass);
    if (classStudents.length === 0) {
      toast.info(`Tidak ada siswa di kelas ${targetClass}.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Hapus Siswa Kelas ${targetClass}`,
      message: (
        <div>
          <p>
            Anda akan menghapus seluruh data siswa di <strong className="text-rose-600">Kelas {targetClass}</strong> sebanyak{' '}
            <strong>{classStudents.length} siswa</strong>.
          </p>
          <p className="mt-2 text-slate-500 text-xs">Tindakan ini berguna saat kelulusan atau perombakan rombel kelas.</p>
          <p className="mt-2 text-rose-600 text-xs font-semibold">Lanjutkan penghapusan seluruh siswa kelas ini?</p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus Semua Siswa ${targetClass}`,
      action: () => {
        if (onDeleteStudentsByClass) {
          onDeleteStudentsByClass(targetClass);
        } else {
          onBulkDeleteStudents(classStudents.map((s) => s.id));
        }
        setSelectedIds((prev) => prev.filter((id) => !classStudents.some((s) => s.id === id)));
        setIsDeleteClassModalOpen(false);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const triggerDeleteAllStudents = () => {
    if (students.length === 0) {
      toast.info('Database siswa sudah kosong.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus SEMUA Data Siswa',
      message: (
        <div>
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl mb-3 text-rose-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>PERINGATAN KRUSIAL:</strong> Anda akan menghapus <strong>seluruh {students.length} data siswa</strong> dari sistem dan Cloud Firestore!
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Seluruh direktori siswa akan dikosongkan secara total. Pastikan Anda telah mengunduh atau mengekspor rekap cadangan jika diperlukan.
          </p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Ya, Kosongkan Semua (${students.length} Siswa)`,
      action: () => {
        if (onDeleteAllStudents) {
          onDeleteAllStudents();
        } else {
          onBulkDeleteStudents(students.map((s) => s.id));
        }
        setSelectedIds([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <>
      {/* KOP SURAT (Only Visible on Print) */}
      <div className="hidden print:block p-8">
        <KopSurat appConfig={appConfig} showBorder={true} printSettings={draftPrintSettings} />
        <div className="text-center my-6">
          <h2 className="text-2xl font-black uppercase">
            DATA DIREKTORI SISWA {filterClass ? `KELAS ${filterClass}` : ''}
          </h2>
          <p className="text-sm font-medium">Tahun Ajaran: {appConfig.academicYear}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden print:shadow-none print:border-none">
        {/* Header & Action Bar */}
        <div className="p-4 sm:p-6 border-b border-emerald-100 space-y-3.5 sm:space-y-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white print:hidden">
          <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-3.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="font-bold text-base sm:text-lg text-emerald-950 flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-100 p-2 rounded-xl border border-emerald-200/60">
                  <UserIcon className="w-5 h-5 text-emerald-700" />
                </span>
                <span>Data Siswa</span>
                <span className="text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {appConfig.academicYear}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  ({filteredStudents.length} dari {students.length} siswa)
                </span>
              </h4>

              {selectedIds.length > 0 && (
                <button
                  onClick={triggerBulkDelete}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition animate-in fade-in zoom-in duration-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedIds.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center sm:flex-wrap gap-2 w-full xl:w-auto">
              {/* Menu Hapus Data Siswa */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white text-rose-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-50 transition border border-rose-200 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hapus</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDeleteMenu ? 'rotate-180' : ''}`} />
                </button>

                {showDeleteMenu && (
                  <div
                    className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                    onClick={() => setShowDeleteMenu(false)}
                  >
                    <button
                      onClick={triggerBulkDelete}
                      disabled={selectedIds.length === 0}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Hapus Siswa Terpilih ({selectedIds.length})</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedClassToDelete(filterClass || classOptions[0] || '');
                        setIsDeleteClassModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span>Hapus Siswa Berdasarkan Kelas...</span>
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={triggerDeleteAllStudents}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>Hapus SEMUA Data Siswa ({students.length})</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-1.5 bg-white text-teal-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-teal-50 transition border border-teal-200 shadow-xs cursor-pointer"
                title="Unduh data siswa lengkap ke Excel (.xls)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> Unduh XLS
              </button>
              <button
                type="button"
                onClick={() => setShowPrePrintPanel((v) => !v)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border shadow-xs cursor-pointer ${
                  showPrePrintPanel
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                }`}
                title="Atur Kop Surat, Spasi, TTD & Font sebelum Pratinjau atau Cetak"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Atur Kop &amp; TTD</span>
              </button>
              <button
                onClick={handleDirectDownloadPdf}
                className="flex items-center justify-center gap-1.5 bg-white text-rose-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-rose-50 transition border border-rose-200 shadow-xs cursor-pointer"
                title="Unduh langsung data siswa dalam format PDF"
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" /> Unduh PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 bg-white text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-emerald-50 transition border border-emerald-200 shadow-xs cursor-pointer"
                title="Pratinjau & Cetak PDF dengan Kop Surat"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" /> Cetak PDF
              </button>
              <button
                onClick={() => {
                  setIsUploadMode(true);
                  setIsModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 bg-white text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-emerald-50 transition border border-emerald-200 shadow-xs cursor-pointer"
              >
                <UploadIcon className="w-3.5 h-3.5 shrink-0" /> Import Excel
              </button>
              <button
                onClick={openAddModal}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 transition shadow-md shadow-emerald-200 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 shrink-0" /> Tambah Siswa
              </button>
            </div>
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1">
            <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIS, NISN, wali kelas, guru BK, email, alamat..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 text-xs font-medium bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                setSelectedIds([]);
              }}
              className="flex-1 sm:flex-none text-xs font-bold bg-white border border-emerald-200 text-emerald-800 px-3 py-2.5 sm:py-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Kelas</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Kelas {c}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setSelectedIds([]);
              }}
              className="flex-1 sm:flex-none text-xs font-bold bg-white border border-emerald-200 text-slate-700 px-3 py-2.5 sm:py-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Semua Status</option>
              {STUDENT_STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  Status: {st}
                </option>
              ))}
            </select>

            {alarmStudentsCount > 0 && (
              <button
                onClick={() => {
                  setFilterAlarmOnly((prev) => !prev);
                  setSelectedIds([]);
                }}
                className={`text-xs font-black px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 border cursor-pointer ${
                  filterAlarmOnly
                    ? 'bg-red-600 text-white border-red-700 shadow-sm'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
                title="Filter siswa dengan Alarm Keterlambatan (≥3x)"
              >
                <BellRing className="w-3.5 h-3.5 text-current animate-pulse" />
                Alarm Terlambat ({alarmStudentsCount})
              </button>
            )}

            {filteredStudents.length > INITIAL_LIMIT && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                {showAll ? (
                  <>
                    Ciutkan <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Lihat Semua ({filteredStudents.length}) <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Inline Pre-Print Kop, Spasi & TTD Settings Panel */}
        {showPrePrintPanel && (
          <div className="border-b border-indigo-100 bg-slate-50/80 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
            <div className="lg:col-span-5">
              <PrintSettingsPanel
                settings={draftPrintSettings}
                onChange={setDraftPrintSettings}
                appConfig={appConfig}
                currentUser={currentUser}
                users={users}
                onSaveDefaultSettings={onSavePrintSettings}
                showFooterActions
                className="rounded-2xl border border-slate-200 max-h-[500px]"
              />
            </div>
            <div className="lg:col-span-7 flex flex-col justify-between gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs overflow-x-auto space-y-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Pratinjau Kop Surat &amp; TTD Sebelum Cetak Data Siswa
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Spasi: {(draftPrintSettings.kopStyle.lineSpacing ?? 1).toFixed(1)}x • Bawah: {draftPrintSettings.kopStyle.bottomSpacing ?? 6} mm
                  </span>
                </div>
                {draftPrintSettings.showKop ? (
                  <div className="min-w-[480px] sm:min-w-0">
                    <KopSurat appConfig={appConfig} printSettings={draftPrintSettings} showBorder />
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Kop Surat dinonaktifkan pada dokumen ini.
                  </div>
                )}
                <SignatureLayoutEditor
                  compact
                  settings={draftPrintSettings}
                  onChange={setDraftPrintSettings}
                  appConfig={appConfig}
                  currentUser={currentUser}
                  usableWidthMm={267}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDirectDownloadPdf}
                  className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" /> Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Pratinjau Lengkap &amp; Cetak PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Organized Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-emerald-50/70 text-emerald-950 uppercase text-[11px] font-bold tracking-wider border-b border-emerald-100">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    checked={selectedIds.length === displayedStudents.length && displayedStudents.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-3.5 text-center w-16">Absen</th>
                <th className="px-4 py-3.5 min-w-[240px]">Identitas Siswa (Foto, Nama, NIS / NISN)</th>
                <th className="px-3 py-3.5 min-w-[160px]">Kelas, JK &amp; Pembina</th>
                <th className="px-3 py-3.5 min-w-[165px]">Tempat, Tgl Lahir</th>
                <th className="px-4 py-3.5 min-w-[230px]">Kontak (No. HP, Email) &amp; Alamat</th>
                <th className="px-3 py-3.5 min-w-[155px]">Status &amp; Poin</th>
                <th className="px-4 py-3.5 text-right w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {displayedStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                        <UserIcon className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-slate-700 mb-1">Data Siswa Tidak Ditemukan</h4>
                      <p className="text-xs text-slate-400 mb-4">
                        {searchQuery || filterClass || filterStatus
                          ? 'Tidak ada data siswa yang cocok dengan pencarian atau filter yang dipilih.'
                          : 'Belum ada data siswa pada tahun ajaran ini. Silakan impor Excel atau tambah manual.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsUploadMode(true);
                            setIsModalOpen(true);
                          }}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <UploadIcon className="w-3.5 h-3.5" /> Import Excel / Sheet
                        </button>
                        <button
                          onClick={openAddModal}
                          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Tambah Manual
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {displayedStudents.map((student) => {
                const photo = getStudentPhoto(student);
                const phoneVal = getStudentPhone(student);
                const studentStatus = getStudentStatus(student);
                const ttl = formatBirthPlaceDate(student.birthPlace, student.birthDate, true);
                const tardinessInfo = getStudentTardinessInfo(student.id, student.name, student.class, violations);

                return (
                  <tr
                    key={student.id}
                    className={`hover:bg-emerald-50/40 transition-colors group align-top ${
                      selectedIds.includes(student.id) ? 'bg-emerald-50/60' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 pt-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        checked={selectedIds.includes(student.id)}
                        onChange={() => toggleSelect(student.id)}
                      />
                    </td>

                    {/* No Absen */}
                    <td className="px-3 py-3.5 text-center pt-4">
                      <span className="inline-flex items-center justify-center min-w-[30px] h-7 px-2 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200">
                        {student.absenNumber || '-'}
                      </span>
                    </td>

                    {/* Foto, Nama, NIS, NISN */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onViewStudent(student)}
                        className="flex items-center gap-3 text-left group/name cursor-pointer"
                        title="Klik untuk melihat biodata lengkap & riwayat"
                      >
                        <img
                          src={photo}
                          alt={student.name}
                          onError={(e) => {
                            const fallback = getDefaultStudentAvatar(student.gender);
                            if (!e.currentTarget.src.endsWith(fallback)) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                          className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm group-hover/name:border-emerald-400 transition-colors shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 group-hover/name:text-emerald-700 group-hover/name:underline flex items-center gap-1 truncate">
                            <span className="truncate">{student.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-300 group-hover/name:text-emerald-500 shrink-0" />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5 font-mono">
                            <span>
                              NIS: <strong className="text-slate-700">{student.nis}</strong>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span>NISN: {student.nisn || '-'}</span>
                          </div>
                        </div>
                      </button>
                    </td>

                    {/* Kelas, Jenis Kelamin & Pembina */}
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-md font-bold text-xs border border-slate-200/80">
                          {student.class}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            student.gender === 'L'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-pink-50 text-pink-700 border border-pink-200'
                          }`}
                        >
                          {student.gender === 'L' ? 'L (Laki-laki)' : 'P (Perempuan)'}
                        </span>
                        {(student.waliKelas || student.guruBk) && (
                          <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5">
                            {student.waliKelas && (
                              <div className="truncate max-w-[180px]" title={`Wali Kelas: ${student.waliKelas}`}>
                                <span className="font-bold text-slate-700">Wali:</span> {student.waliKelas}
                              </div>
                            )}
                            {student.guruBk && (
                              <div className="truncate max-w-[180px]" title={`Guru BK: ${student.guruBk}`}>
                                <span className="font-bold text-indigo-700">BK:</span> {student.guruBk}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Tempat, Tanggal Lahir */}
                    <td className="px-3 py-3.5 text-xs text-slate-700">
                      <div className="flex items-start gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="font-medium leading-snug">{ttl}</span>
                      </div>
                    </td>

                    {/* Kontak (No HP, Email) & Alamat */}
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="space-y-1 max-w-[260px]">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="font-mono">{phoneVal || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 truncate" title={student.email || '-'}>
                          <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate">{student.email || '-'}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-500" title={student.address || '-'}>
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-snug">{student.address || '-'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Status Siswa & Status Poin */}
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${getStatusBadgeClasses(
                            studentStatus
                          )}`}
                        >
                          {studentStatus}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-700">
                            Poin: <span className="text-slate-900">{student.totalPoints}</span>
                          </span>
                          {student.totalPoints > 50 ? (
                            <span className="text-red-700 font-bold text-[10px] bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                              SP 1
                            </span>
                          ) : student.totalPoints < 0 ? (
                            <span className="text-emerald-700 font-bold text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                              Prestasi
                            </span>
                          ) : null}
                        </div>

                        {tardinessInfo.isAlarm ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 w-fit animate-pulse"
                            title={`Terlambat ${tardinessInfo.count}x (${tardinessInfo.statusLabel})`}
                          >
                            <BellRing className="w-2.5 h-2.5 text-red-600" />
                            {tardinessInfo.count}x Terlambat
                          </span>
                        ) : tardinessInfo.count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            {tardinessInfo.count}x Terlambat
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => onViewStudent(student)}
                          className="p-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                          title="Lihat Biodata Lengkap"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="Edit Data Siswa"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerDeleteStudent(student)}
                          className="p-2 rounded-lg text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Hapus Data Siswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!showAll && filteredStudents.length > INITIAL_LIMIT && (
            <div className="p-3.5 text-center border-t border-emerald-50 bg-emerald-50/20 flex items-center justify-center gap-3">
              <span className="text-xs text-emerald-700 font-medium">
                Menampilkan {INITIAL_LIMIT} dari {filteredStudents.length} siswa.
              </span>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
              >
                Tampilkan Semua
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Print Signature Section */}
      <div className="hidden print:flex justify-end items-start mt-8 pr-12 page-break-inside-avoid">
        <div className="text-center w-64">
          <p className="mb-20 font-medium">
            Kudus, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            <br />
            {currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK'}
          </p>
          <div>
            <p className="font-bold border-b border-black uppercase pb-1">{currentUser.name}</p>
            {currentUser.nip && <p className="text-sm mt-1">NIP. {currentUser.nip}</p>}
          </div>
        </div>
      </div>

      {/* Modal Handling: Import OR Add/Edit Full Student Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div
            className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden transform transition-all flex flex-col max-h-[92vh] ${
              isUploadMode ? 'max-w-lg' : 'max-w-2xl'
            }`}
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {isUploadMode
                    ? 'Import Data Siswa (Excel / Google Sheet)'
                    : editingStudent
                    ? 'Edit Biodata Siswa'
                    : 'Tambah Siswa Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tahun Ajaran: <strong className="text-emerald-700">{targetAcademicYear}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isUploadMode ? (
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="border-2 border-dashed border-emerald-200 rounded-2xl p-6 bg-emerald-50/30 hover:bg-emerald-50 transition-colors text-center group">
                  <UploadIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm text-slate-700 mb-3 font-semibold">Upload file Excel (.xlsx / .xls / .csv)</p>
                  <div className="flex flex-col items-center gap-3">
                    <label className="cursor-pointer bg-emerald-600 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-emerald-700 transition">
                      {selectedExcelFile ? 'Ganti File' : 'Pilih File Excel'}
                      <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="hidden" />
                    </label>
                    {selectedExcelFile && (
                      <div className="w-full">
                        <div className="bg-white border border-emerald-100 p-3 rounded-xl mb-3 flex items-center justify-between shadow-sm">
                          <span className="text-xs text-slate-700 truncate font-medium">{selectedExcelFile.name}</span>
                          <button onClick={() => setSelectedExcelFile(null)} className="text-red-400 hover:text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={execUploadExcel}
                          disabled={isSyncing}
                          className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-md disabled:bg-slate-300 cursor-pointer"
                        >
                          {isSyncing ? 'Memproses...' : 'Proses Upload Data Siswa'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                    Sinkronisasi Google Sheet
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                      placeholder="Paste link Google Sheet di sini..."
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    />
                    <button
                      onClick={handleGoogleSheetSync}
                      disabled={isSyncing || !googleSheetUrl}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition shrink-0 cursor-pointer"
                    >
                      {isSyncing ? 'Sync...' : 'Sync'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                    <strong>Kolom yang didukung (otomatis terdeteksi):</strong>{' '}
                    NIS, NISN, Nama, Kelas, No Absen, Tempat, Tanggal Lahir, Email, Foto, ALAMAT, NO_HP, JENIS_KELAMIN, Status, Wali Kelas, Guru BK.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 py-3 rounded-xl hover:bg-emerald-50 transition shadow-xs cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" /> Unduh Template Excel Lengkap (15 Kolom)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                {/* Foto Siswa Section */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="relative group cursor-pointer shrink-0">
                    <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                      <img
                        src={normalizePhotoUrl(photoPreview) || getDefaultStudentAvatar(gender)}
                        alt="Preview"
                        onError={(e) => {
                          const fallback = getDefaultStudentAvatar(gender);
                          if (!e.currentTarget.src.endsWith(fallback)) {
                            e.currentTarget.src = fallback;
                          }
                        }}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handlePhotoUpload}
                      title="Upload foto siswa"
                    />
                    <div className="absolute bottom-0 right-0 bg-emerald-600 rounded-full p-1.5 text-white shadow-md border-2 border-white">
                      <Camera className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                      Foto Siswa (Upload / Link Google Drive / URL Foto)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={photoPreview}
                        onChange={(e) => setPhotoPreview(e.target.value)}
                        placeholder="https://drive.google.com/... atau kosongkan untuk avatar bawaan"
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      {photoPreview && (
                        <button
                          type="button"
                          onClick={() => setPhotoPreview('')}
                          className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 cursor-pointer"
                        >
                          Reset Avatar
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Jika belum ada link foto dari Google Drive atau unggahan, sistem otomatis menampilkan avatar Siswa {gender === 'P' ? 'Perempuan' : 'Laki-laki'}.
                    </p>
                  </div>
                </div>

                {/* Identitas Akademik */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-3">
                    1. Identitas &amp; Status Akademik
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">NIS *</label>
                      <input
                        type="text"
                        required
                        value={nis}
                        onChange={(e) => setNis(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Contoh: 102401"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">NISN *</label>
                      <input
                        type="text"
                        required
                        value={nisn}
                        onChange={(e) => setNisn(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Contoh: 0071234567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">No. Absen</label>
                      <input
                        type="text"
                        value={absenNumber}
                        onChange={(e) => setAbsenNumber(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Contoh: 01"
                      />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                      placeholder="Nama Lengkap Siswa"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Kelas *</label>
                      <select
                        required
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {classOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Kelamin *</label>
                      <select
                        required
                        value={gender}
                        onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                      >
                        <option value="L">L (Laki-laki)</option>
                        <option value="P">P (Perempuan)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Status Siswa</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900 font-semibold"
                      >
                        {STUDENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Wali Kelas</label>
                      <input
                        type="text"
                        list="teacher-advisor-suggestions"
                        value={waliKelas}
                        onChange={(e) => setWaliKelas(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Pilih atau ketik nama Wali Kelas"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Guru BK</label>
                      <input
                        type="text"
                        list="teacher-advisor-suggestions"
                        value={guruBk}
                        onChange={(e) => setGuruBk(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Pilih atau ketik nama Guru BK"
                      />
                    </div>
                    <datalist id="teacher-advisor-suggestions">
                      {teacherSuggestions.map((tName) => (
                        <option key={tName} value={tName} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Kelahiran & Kontak */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 mb-3">
                    2. Data Kelahiran &amp; Kontak
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tempat Lahir</label>
                      <input
                        type="text"
                        value={birthPlace}
                        onChange={(e) => setBirthPlace(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Contoh: Kudus"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Lahir</label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="nama@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">No. HP / WhatsApp</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                        placeholder="Contoh: 081234567890"
                      />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Alamat Lengkap</label>
                    <textarea
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900"
                      placeholder="Contoh: Jl. Pramuka No. 41, Kec. Kota, Kab. Kudus"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold text-sm transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-bold text-sm shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> Simpan Data Siswa
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        title={`Pratinjau & Pengaturan Cetak Data Siswa ${filterClass ? `(${filterClass})` : ''}`}
        fileNamePrefix={`Data_Siswa_${filterClass || 'Semua'}`}
        appConfig={appConfig}
        currentUser={currentUser}
        users={users}
        onClose={() => setIsPrintModalOpen(false)}
        buildPdfDoc={buildStudentPdfDoc}
        onSaveDefaultSettings={onSavePrintSettings}
        defaultOverrides={draftPrintSettings}
        onSettingsChange={setDraftPrintSettings}
      />

      {/* Delete By Class Modal */}
      {isDeleteClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-800">Hapus Siswa Berdasarkan Kelas</h3>
              </div>
              <button
                onClick={() => setIsDeleteClassModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Pilih rombongan belajar (kelas) yang ingin dihapus. Semua siswa di kelas terpilih akan dihapus dari sistem.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Kelas Sasaran
                </label>
                <select
                  value={selectedClassToDelete}
                  onChange={(e) => setSelectedClassToDelete(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {classOptions.map((c) => {
                    const count = students.filter((s) => s.class === c).length;
                    return (
                      <option key={c} value={c}>
                        Kelas {c} ({count} siswa)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedClassToDelete && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800">
                  Total siswa di <strong>Kelas {selectedClassToDelete}</strong> saat ini:{' '}
                  <strong>{students.filter((s) => s.class === selectedClassToDelete).length} siswa</strong>.
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteClassModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => triggerDeleteByClass(selectedClassToDelete)}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Lanjut Hapus Siswa Kelas Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />
    </>
  );
};

export default StudentList;
