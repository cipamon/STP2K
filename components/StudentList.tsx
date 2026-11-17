import React, { useState } from 'react';
import { toast } from 'sonner';
import { Student, User, AppConfig, ViolationCategory, ViolationRecord } from '../types';
import { CLASS_LIST, PROVINSI_LOGO_URL } from '../constants';
import { UserPlus, X, Camera, Save, User as UserIcon, Upload as UploadIcon, Pencil, Trash2, ChevronDown, ChevronUp, ExternalLink, FileDown, Printer, ArrowDownCircle, Clock, BellRing, AlertTriangle, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStudentTardinessInfo, playAlarmSound } from '../utils/tardiness';
import ConfirmModal from './ConfirmModal';
import { KopSurat } from './KopSurat';
import { drawPdfKopSurat } from '../utils/pdfKop';

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
  currentUser 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterAlarmOnly, setFilterAlarmOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

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
  
  // Form States
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L'); // New State for Gender
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Bulk Upload State
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);

  // Pagination / View All Logic
  const INITIAL_LIMIT = 5;
  
  // Count students with active tardiness alarm
  const alarmStudentsCount = students.filter(s => {
    const info = getStudentTardinessInfo(s.id, s.name, s.class, violations);
    return info.isAlarm;
  }).length;

  // Filter students by class and optional alarm
  const filteredStudents = students.filter(s => {
    if (filterClass && s.class !== filterClass) return false;
    if (filterAlarmOnly) {
      const info = getStudentTardinessInfo(s.id, s.name, s.class, violations);
      return info.isAlarm;
    }
    return true;
  });
    
  const displayedStudents = showAll ? filteredStudents : filteredStudents.slice(0, INITIAL_LIMIT);

  const openAddModal = () => {
    setEditingStudent(null);
    setNis('');
    setNisn('');
    setName('');
    setClassName('');
    setGender('L'); // Default
    setPhotoPreview(null);
    setIsUploadMode(false);
    setSelectedExcelFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNis(student.nis);
    setNisn(student.nisn);
    setName(student.name);
    setClassName(student.class);
    setGender(student.gender);
    setPhotoPreview(student.photoUrl || null);
    setIsUploadMode(false);
    setSelectedExcelFile(null);
    setIsModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    // Define headers
    const headers = [['NIS', 'NISN', 'Nama Lengkap', 'Kelas', 'L/P']];
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    // Set column width for better UX
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 5 }];

    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa_SiPerSis.xlsx");
  };

  const handlePrint = async () => {
    if (filteredStudents.length === 0) {
      toast.error("Tidak ada data untuk dicetak.");
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Kop Surat Resmi
      const currentY = await drawPdfKopSurat(doc, appConfig, 8);

      // Title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`DATA DIREKTORI SISWA ${filterClass ? `KELAS ${filterClass}` : ''}`, pageWidth / 2, currentY + 6, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tahun Ajaran: ${appConfig.academicYear}`, pageWidth / 2, currentY + 11, { align: 'center' });

      // Table
      const headers = [["No", "NIS / NISN", "Nama Lengkap", "L/P", "Kelas", "Poin"]];
      const body = filteredStudents.map((s, index) => [
        index + 1,
        `${s.nis}${s.nisn ? ` / ${s.nisn}` : ''}`,
        s.name,
        s.gender,
        s.class,
        s.totalPoints
      ]);

      autoTable(doc, {
        startY: currentY + 18,
        head: headers,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }
        }
      });

      // Signature
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      const location = 'Kudus';
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      doc.setFontSize(9);
      doc.text(`${location}, ${today}`, pageWidth - 15, finalY, { align: 'right' });
      doc.text(currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK', pageWidth - 15, finalY + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(currentUser.name, pageWidth - 15, finalY + 35, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      if (currentUser.nip) {
        doc.text(`NIP. ${currentUser.nip}`, pageWidth - 15, finalY + 39, { align: 'right' });
      }

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      toast.info("Pratinjau PDF telah dibuat.");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Gagal membuat PDF. Silakan coba lagi.");
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement('a');
    link.href = pdfPreviewUrl;
    link.download = `Data_Siswa_${filterClass || 'Semua'}_${new Date().getTime()}.pdf`;
    link.click();
    toast.success("PDF berhasil diunduh.");
  };

  const closePreview = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfPreviewUrl(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedExcelFile(file);
      // Reset input value to allow re-selecting the same file if needed
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
        console.error("Excel Read Error:", err);
        toast.error("Gagal membaca file Excel. Pastikan file tidak rusak.");
      } finally {
        setIsSyncing(false);
      }
    };
    reader.onerror = () => {
      toast.error("Terjadi masalah saat membaca file.");
      setIsSyncing(false);
    };
    reader.readAsArrayBuffer(selectedExcelFile);
  };

  const processWorkbook = (workbook: XLSX.WorkBook) => {
    try {
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        toast.error("File tidak valid atau kosong.");
        return;
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const rows = jsonData.slice(1);
      
      const newStudents: Student[] = [];
      let incompleteRows = 0;

      rows.forEach((row: any, index) => {
         // Map columns: 0=NIS, 1=NISN, 2=Nama, 3=Kelas, 4=L/P
         const snis = row[0]?.toString().trim();
         const snisn = row[1]?.toString().trim();
         const sname = row[2]?.toString().trim();
         const sclass = row[3]?.toString().trim();
         let sgender = row[4]?.toString().trim().toUpperCase();

         if (sgender !== 'L' && sgender !== 'P') sgender = 'L';

         // NIS, Nama, and Kelas are strictly required. NISN is highly recommended.
         if (snis && sname && sclass) {
            newStudents.push({
               id: Date.now().toString() + index + Math.random().toString(36).substr(2, 5),
               nis: snis,
               nisn: snisn || '-',
               name: sname,
               class: sclass,
               gender: sgender as 'L' | 'P',
               totalPoints: 0
            });
         } else if (snis || sname || sclass) {
            // If row is not completely empty but lacks mandatory fields
            incompleteRows++;
         }
      });

      if (newStudents.length > 0) {
        onBulkUpload(newStudents);
        setIsModalOpen(false);
        setGoogleSheetUrl('');
        setSelectedExcelFile(null);
      } else {
        toast.error('Gagal membaca data. Pastikan format tabel sesuai: \nKolom 1: NIS\nKolom 2: NISN\nKolom 3: Nama Lengkap\nKolom 4: Kelas\nKolom 5: L/P');
      }
    } catch (error) {
      console.error("Process Workbook Error:", error);
      toast.error("Terjadi kesalahan teknis saat memproses data.");
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
      if (!response.ok) throw new Error('Gagal mengambil data. Pastikan Sheet diatur ke "Siapa saja yang memiliki link dapat melihat".');
      
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
    if (!nis || !nisn || !name || !className) {
      toast.error('Mohon lengkapi NIS, NISN, Nama, dan Kelas.');
      return;
    }

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        nis,
        nisn,
        name,
        class: className,
        gender,
        photoUrl: photoPreview || undefined,
      });
    } else {
      const newStudent: Student = {
        id: Date.now().toString(),
        nis,
        nisn,
        name,
        class: className,
        gender,
        totalPoints: 0,
        photoUrl: photoPreview || undefined,
      };
      onAddStudent(newStudent);
    }
    
    setIsModalOpen(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === displayedStudents.length && displayedStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Trigger Individual Delete
  const triggerDeleteStudent = (student: Student) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Data Siswa',
      message: (
        <div>
          <p className="mb-2">Apakah Anda yakin ingin menghapus data siswa berikut?</p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 text-sm">{student.name}</div>
            <div className="text-xs text-slate-500">NIS: {student.nis} {student.nisn ? `| NISN: ${student.nisn}` : ''}</div>
            <div className="text-xs text-slate-500">Kelas: {student.class} | Total Poin: {student.totalPoints}</div>
          </div>
          <p className="mt-2 text-rose-600 text-xs font-semibold">Data siswa akan dihapus secara permanen dari basis data dan cloud penyimpanan.</p>
        </div>
      ),
      variant: 'danger',
      confirmText: 'Ya, Hapus Siswa',
      action: () => {
        onDeleteStudent(student.id);
        setSelectedIds(prev => prev.filter(i => i !== student.id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Trigger Bulk Delete Selected
  const triggerBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Siswa Terpilih',
      message: (
        <div>
          <p>Apakah Anda yakin ingin menghapus <strong className="text-rose-600">{selectedIds.length} data siswa</strong> yang telah dipilih?</p>
          <p className="mt-2 text-slate-500 text-xs">Seluruh data siswa terpilih beserta akumulasi poin akan dihapus secara permanen dari sistem.</p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus ${selectedIds.length} Siswa`,
      action: () => {
        onBulkDeleteStudents(selectedIds);
        setSelectedIds([]);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Trigger Delete By Class
  const triggerDeleteByClass = (className: string) => {
    const classStudents = students.filter(s => s.class === className);
    if (classStudents.length === 0) {
      toast.info(`Tidak ada siswa di kelas ${className}.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Hapus Siswa Kelas ${className}`,
      message: (
        <div>
          <p>Anda akan menghapus seluruh data siswa di <strong className="text-rose-600">Kelas {className}</strong> sebanyak <strong>{classStudents.length} siswa</strong>.</p>
          <p className="mt-2 text-slate-500 text-xs">Tindakan ini berguna saat kelulusan atau perombakan rombel kelas.</p>
          <p className="mt-2 text-rose-600 text-xs font-semibold">Lanjutkan penghapusan seluruh siswa kelas ini?</p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus Semua Siswa ${className}`,
      action: () => {
        if (onDeleteStudentsByClass) {
          onDeleteStudentsByClass(className);
        } else {
          onBulkDeleteStudents(classStudents.map(s => s.id));
        }
        setSelectedIds(prev => prev.filter(id => !classStudents.some(s => s.id === id)));
        setIsDeleteClassModalOpen(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Trigger Delete All Students
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
          onBulkDeleteStudents(students.map(s => s.id));
        }
        setSelectedIds([]);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <>
      {/* KOP SURAT (Only Visible on Print) */}
      <div className="hidden print:block p-8">
        <KopSurat appConfig={appConfig} showBorder={true} />
        <div className="text-center my-6">
          <h2 className="text-2xl font-black uppercase">DATA DIREKTORI SISWA {filterClass ? `KELAS ${filterClass}` : ''}</h2>
          <p className="text-sm font-medium">Tahun Ajaran: {appConfig.academicYear}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden print:shadow-none print:border-none">
        {/* Colorful Header */}
        <div className="p-6 border-b border-emerald-50 flex justify-between items-center flex-wrap gap-4 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-4">
            <h4 className="font-bold text-lg text-emerald-900 flex items-center gap-2">
               <span className="bg-emerald-100 p-2 rounded-lg"><UserIcon className="w-5 h-5 text-emerald-600" /></span>
               Data Siswa
            </h4>
            
            {/* Class Filter */}
            <div className="flex items-center gap-2 flex-wrap">
               <select 
                 value={filterClass}
                 onChange={(e) => {
                   setFilterClass(e.target.value);
                   setSelectedIds([]); // Clear selection when filter changes
                 }}
                 className="text-xs font-bold bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
               >
                 <option value="">Semua Kelas</option>
                 {CLASS_LIST.map(c => (
                   <option key={c} value={c}>{c}</option>
                 ))}
               </select>

               {alarmStudentsCount > 0 && (
                 <button
                   onClick={() => {
                     setFilterAlarmOnly(prev => !prev);
                     setSelectedIds([]);
                   }}
                   className={`text-xs font-black px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 border ${
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
            </div>

            {selectedIds.length > 0 && (
              <button 
                onClick={triggerBulkDelete}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition animate-in fade-in zoom-in duration-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedIds.length})
              </button>
            )}

            {filteredStudents.length > INITIAL_LIMIT && (
              <button 
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
              >
                {showAll ? (
                  <>Ciutkan <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Lihat Semua <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Menu Hapus Data Siswa */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                className="flex items-center gap-1.5 bg-white text-rose-600 px-3.5 py-2 rounded-xl text-xs sm:text-sm hover:bg-rose-50 transition border border-rose-200 font-bold shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Menu Hapus Siswa</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDeleteMenu ? 'rotate-180' : ''}`} />
              </button>

              {showDeleteMenu && (
                <div 
                  className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
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
                      setSelectedClassToDelete(filterClass || CLASS_LIST[0]);
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
              onClick={handlePrint}
              className="flex items-center gap-2 bg-white text-emerald-600 px-3.5 py-2 rounded-xl text-xs sm:text-sm hover:bg-emerald-50 transition border border-emerald-200 font-bold shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak PDF
            </button>
            <button 
              onClick={() => { setIsUploadMode(true); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-white text-emerald-600 px-3.5 py-2 rounded-xl text-xs sm:text-sm hover:bg-emerald-50 transition border border-emerald-200 font-bold shadow-xs cursor-pointer"
            >
              <UploadIcon className="w-4 h-4" /> Import Excel
            </button>
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm hover:from-emerald-600 hover:to-teal-600 transition shadow-md shadow-emerald-200 font-bold cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Tambah Siswa
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-emerald-50/50 text-emerald-900 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl w-10">
                   <input 
                     type="checkbox" 
                     className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                     checked={selectedIds.length === displayedStudents.length && displayedStudents.length > 0}
                     onChange={toggleSelectAll}
                   />
                </th>
                <th className="px-6 py-4">Siswa</th>
                <th className="px-6 py-4">L/P</th>
                <th className="px-6 py-4">NIS / NISN</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Total Poin</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right rounded-tr-xl">Aksi</th>
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
                      <h4 className="text-base font-bold text-slate-700 mb-1">Data Siswa Kosong</h4>
                      <p className="text-xs text-slate-400 mb-4">
                        {filterClass 
                          ? `Tidak ada data siswa untuk kelas ${filterClass}.` 
                          : 'Seluruh data siswa telah dikosongkan dan siap untuk diperbarui.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setIsUploadMode(true); setIsModalOpen(true); }}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          <UploadIcon className="w-3.5 h-3.5" /> Import Excel / Sinkronisasi
                        </button>
                        <button
                          onClick={openAddModal}
                          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Tambah Manual
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {displayedStudents.map((student) => (
                <tr key={student.id} className={`hover:bg-emerald-50/30 transition-colors group ${selectedIds.includes(student.id) ? 'bg-emerald-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => toggleSelect(student.id)}
                    />
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                     <button 
                       onClick={() => onViewStudent(student)}
                       className="flex items-center gap-3 hover:text-emerald-600 text-left"
                       title="Klik untuk melihat detail"
                     >
                       {student.photoUrl ? (
                          <img src={student.photoUrl} alt={student.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm group-hover:border-emerald-300 transition-colors" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-white shadow-sm group-hover:bg-emerald-100 group-hover:text-emerald-500 transition-colors">
                            <UserIcon className="w-5 h-5" />
                          </div>
                        )}
                        <span className="group-hover:underline decoration-emerald-300 underline-offset-2 flex items-center gap-1">
                          {student.name} <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-emerald-400" />
                        </span>
                     </button>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-1 rounded text-xs font-bold ${student.gender === 'L' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {student.gender}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-mono text-slate-900 font-medium">{student.nis}</span>
                      <span className="text-[10px] text-slate-400">NISN: {student.nisn || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold text-xs">{student.class}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{student.totalPoints}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {student.totalPoints > 50 ? (
                        <span className="text-red-700 font-bold text-xs bg-red-100 px-2 py-0.5 rounded border border-red-200 shadow-sm w-fit">SP 1</span>
                      ) : student.totalPoints < 0 ? (
                        <span className="text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 shadow-sm w-fit">Berprestasi</span>
                      ) : (
                        <span className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">Aman</span>
                      )}

                      {(() => {
                        const tardinessInfo = getStudentTardinessInfo(student.id, student.name, student.class, violations);
                        if (tardinessInfo.isAlarm) {
                          return (
                            <span 
                              className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 w-fit shadow-xs animate-pulse"
                              title={`Terlambat ${tardinessInfo.count}x (${tardinessInfo.statusLabel}) - ${tardinessInfo.actionRequired}`}
                            >
                              <BellRing className="w-2.5 h-2.5 text-red-600" />
                              🚨 {tardinessInfo.count}x Terlambat
                            </span>
                          );
                        }
                        if (tardinessInfo.count > 0) {
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              {tardinessInfo.count}x Terlambat
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => openEditModal(student)} className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer" title="Edit Data Siswa">
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
              ))}
            </tbody>
          </table>
          {!showAll && filteredStudents.length > INITIAL_LIMIT && (
             <div className="p-3 text-center border-t border-emerald-50 bg-emerald-50/20">
                <span className="text-xs text-emerald-600 font-medium italic">Menampilkan {INITIAL_LIMIT} dari {filteredStudents.length} siswa. Klik "Lihat Semua" untuk data lengkap.</span>
             </div>
          )}
        </div>
      </div>

      {/* Print Signature Section */}
      <div className="hidden print:flex justify-end items-start mt-8 pr-12 page-break-inside-avoid">
          <div className="text-center w-64">
             <p className="mb-20 font-medium">
                Kudus, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br/>
                {currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK'}
             </p>
             <div>
                <p className="font-bold border-b border-black uppercase pb-1">{currentUser.name}</p>
                {currentUser.nip && <p className="text-sm mt-1">NIP. {currentUser.nip}</p>}
             </div>
          </div>
      </div>

      {/* Modal Handling */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {isUploadMode ? 'Upload Data Siswa (Excel)' : (editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {isUploadMode ? (
              <div className="p-8 space-y-6">
                 <div className="border-2 border-dashed border-emerald-200 rounded-2xl p-8 bg-emerald-50/30 hover:bg-emerald-50 transition-colors text-center group">
                    <UploadIcon className="w-12 h-12 text-emerald-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-sm text-slate-600 mb-4 font-medium">Upload file Excel (.xlsx / .xls)</p>
                    <div className="flex flex-col items-center gap-4">
                       <label className="cursor-pointer bg-emerald-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-emerald-700 transition">
                          {selectedExcelFile ? 'Ganti File' : 'Pilih File'}
                          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="hidden" />
                       </label>
                       {selectedExcelFile && (
                          <div className="w-full">
                             <div className="bg-white border border-emerald-100 p-3 rounded-xl mb-4 flex items-center justify-between shadow-sm">
                                <span className="text-sm text-slate-700 truncate font-medium">{selectedExcelFile.name}</span>
                                <button onClick={() => setSelectedExcelFile(null)} className="text-red-400 hover:text-red-600">
                                   <X className="w-4 h-4" />
                                </button>
                             </div>
                             <button 
                                onClick={execUploadExcel}
                                disabled={isSyncing}
                                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:bg-slate-300"
                             >
                                {isSyncing ? 'Memproses...' : 'Proses Upload'}
                             </button>
                          </div>
                       )}
                    </div>
                 </div>
                 
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sinkronisasi Google Sheet</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         className="flex-1 text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                         placeholder="Paste link Google Sheet di sini..."
                         value={googleSheetUrl}
                         onChange={(e) => setGoogleSheetUrl(e.target.value)}
                       />
                       <button 
                         onClick={handleGoogleSheetSync}
                         disabled={isSyncing || !googleSheetUrl}
                         className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition shrink-0"
                       >
                          {isSyncing ? 'Syncing...' : 'Sync'}
                       </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 italic px-1">
                      Urutan Kolom: <strong>NIS | NISN | Nama Lengkap | Kelas | L/P</strong>. 
                      Pastikan Sheet diset ke "Public/Anyone with link can view".
                    </p>
                 </div>

                 <div className="border-t border-slate-100 pt-4">
                     <button 
                       onClick={handleDownloadTemplate}
                       className="w-full flex items-center justify-center gap-2 text-sm font-bold text-emerald-600 bg-white border border-emerald-200 py-3 rounded-xl hover:bg-emerald-50 transition shadow-sm"
                     >
                        <FileDown className="w-4 h-4" /> Unduh Template Excel
                     </button>
                 </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Photo Upload */}
                <div className="flex justify-center mb-2">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden hover:shadow-2xl transition-shadow">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handlePhotoUpload}
                    />
                    <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 text-white shadow-md border-2 border-white">
                       <Camera className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">NIS</label>
                        <input
                          type="text"
                          required
                          value={nis}
                          onChange={(e) => setNis(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 transition-colors"
                          placeholder="NIS"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">NISN</label>
                        <input
                          type="text"
                          required
                          value={nisn}
                          onChange={(e) => setNisn(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 transition-colors"
                          placeholder="NISN"
                        />
                      </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 transition-colors"
                      placeholder="Nama Siswa"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Kelas</label>
                        <select
                          required
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 transition-colors"
                        >
                          <option value="">-- Pilih --</option>
                          {CLASS_LIST.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Jenis Kelamin</label>
                        <select
                          required
                          value={gender}
                          onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 transition-colors"
                        >
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                     </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Simpan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-700">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-white shrink-0">
               <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
                     <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none">Pratinjau Data Siswa</h3>
                    <p className="text-xs text-slate-400 mt-1">Silakan periksa daftar siswa sebelum mengunduh</p>
                  </div>
               </div>
               <div className="flex gap-2">
                 <button 
                   onClick={handleDownloadPdf}
                   className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-900/20"
                 >
                   <ArrowDownCircle className="w-4 h-4" /> Unduh PDF
                 </button>
                 <button 
                   onClick={closePreview}
                   className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-xl transition"
                 >
                   <X className="w-6 h-6" />
                 </button>
               </div>
            </div>
            <div className="flex-1 bg-slate-800 relative">
               <iframe 
                 src={pdfPreviewUrl} 
                 className="w-full h-full border-0"
                 title="PDF Preview"
               />
               <div className="absolute inset-0 flex items-center justify-center -z-10 text-slate-400">
                  Memuat Pratinjau PDF...
               </div>
            </div>
            <div className="p-4 bg-slate-900 text-center text-xs text-slate-500 border-t border-slate-800">
              Gunakan kontrol di dalam preview PDF untuk mencetak langsung jika didukung oleh browser Anda.
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pilih Kelas Sasaran</label>
                <select
                  value={selectedClassToDelete}
                  onChange={e => setSelectedClassToDelete(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {CLASS_LIST.map(c => {
                    const count = students.filter(s => s.class === c).length;
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
                  Total siswa di <strong>Kelas {selectedClassToDelete}</strong> saat ini: <strong>{students.filter(s => s.class === selectedClassToDelete).length} siswa</strong>.
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
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
