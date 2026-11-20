import React, { useEffect, useState } from 'react';
import { AppConfig, PrintDocumentSettings, User, UserPosition, UserRole } from '../types';
import { DEFAULT_APP_CONFIG } from '../constants';
import {
  UserPlus,
  Pencil,
  Trash2,
  X,
  Save,
  Shield,
  Key,
  User as UserIcon,
  Eye,
  EyeOff,
  Search,
  GraduationCap,
  ChevronDown,
  Users,
  Upload,
  FileSpreadsheet,
  FileDown,
  Printer,
  Camera,
  Briefcase,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmModal from './ConfirmModal';
import PrintPreviewModal from './PrintPreviewModal';
import PrintSettingsPanel from './PrintSettingsPanel';
import { KopSurat } from './KopSurat';
import { SignatureLayoutEditor } from './SignatureLayoutEditor';
import { drawPdfKopSurat, drawPdfSignatures, getPdfFontFamily, resolvePrintSettings } from '../utils/pdfKop';
import {
  getDefaultUserAvatar,
  getUserAvatar,
  getUserPosition,
  getUserPositionLabel,
  inferUserGender,
  normalizePhotoUrl,
} from '../utils/avatarHelpers';
import { compressStudentPhoto, normalizeGender } from '../utils/studentHelpers';
import { exportAoaToSpreadsheet, exportRowsToSpreadsheet } from '../utils/exportHelpers';

interface UserManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onBulkDeleteUsers?: (userIds: string[]) => void;
  onBulkAddUsers?: (users: User[]) => void;
  currentUser?: User;
  appConfig?: AppConfig;
  onSavePrintSettings?: (settings: PrintDocumentSettings) => Promise<void> | void;
}

const normalizeUserPosition = (raw?: string, fallbackRole: UserRole = UserRole.GURU): UserPosition => {
  const val = (raw || '').trim().toUpperCase();
  if (val.includes('TU') || val.includes('TATA USAHA') || val.includes('STAFF')) return 'TU';
  if (val.includes('ADMIN')) return 'ADMIN';
  if (val.includes('GURU')) return 'GURU';
  return fallbackRole === UserRole.ADMIN ? 'ADMIN' : 'GURU';
};

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onBulkDeleteUsers,
  onBulkAddUsers,
  currentUser,
  appConfig,
  onSavePrintSettings,
}) => {
  const effectiveAppConfig = appConfig || DEFAULT_APP_CONFIG;
  const effectiveCurrentUser: User = currentUser || users[0] || {
    id: 'admin',
    name: 'Administrator',
    username: 'admin',
    password: '',
    role: UserRole.ADMIN,
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole | 'TU'>('ALL');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showPrePrintPanel, setShowPrePrintPanel] = useState(false);
  const [draftPrintSettings, setDraftPrintSettings] = useState<PrintDocumentSettings>(() =>
    resolvePrintSettings(effectiveAppConfig, effectiveCurrentUser, users)
  );
  useEffect(() => {
    setDraftPrintSettings(resolvePrintSettings(effectiveAppConfig, effectiveCurrentUser, users));
  }, [effectiveAppConfig, effectiveCurrentUser, users]);

  // Selection & Delete Menu States
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

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

  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    password: string;
    nip: string;
    role: UserRole;
    position: UserPosition;
    gender: 'L' | 'P';
    avatar: string;
  }>({
    name: '',
    username: '',
    password: '',
    nip: '',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    avatar: '',
  });

  const handleOpenModal = (user?: User) => {
    setShowPassword(false);
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        username: user.username,
        password: user.password,
        nip: user.nip || '',
        role: user.role,
        position: getUserPosition(user),
        gender: inferUserGender(user),
        avatar: normalizePhotoUrl(user.avatar),
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        username: '',
        password: '',
        nip: '',
        role: UserRole.GURU,
        position: 'GURU',
        gender: 'L',
        avatar: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressStudentPhoto(file);
      setFormData((prev) => ({ ...prev, avatar: compressed }));
      toast.success('Foto profil siap disimpan.');
    } catch {
      toast.error('Gagal memproses file foto.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedAvatar = normalizePhotoUrl(formData.avatar) || undefined;
    const userPayload: User = {
      id: editingUser ? editingUser.id : `u-${Date.now()}`,
      name: formData.name.trim(),
      username: formData.username.trim().toLowerCase(),
      password: formData.password,
      nip: formData.nip.trim() || undefined,
      role: formData.role,
      position: formData.position,
      gender: formData.gender,
      avatar: cleanedAvatar,
    };

    if (editingUser) {
      onUpdateUser(userPayload);
    } else {
      onAddUser(userPayload);
    }
    setIsModalOpen(false);
  };

  const filteredUsers = users.filter((user) => {
    const pos = getUserPosition(user);
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.nip && user.nip.toLowerCase().includes(searchQuery.toLowerCase())) ||
      getUserPositionLabel(user).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'ALL'
        ? true
        : roleFilter === 'TU'
        ? pos === 'TU'
        : user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Export & Import Handlers
  const handleDownloadTemplate = () => {
    const rows = [
      ['Nama', 'NIP', 'Username', 'Password', 'Role (GURU/ADMIN)', 'Posisi (GURU/TU/ADMIN)', 'Jenis Kelamin (L/P)', 'Foto (URL Drive/Kosong)'],
      ['Palupi Etikawati, S.Pd', '19860412 201101 2 003', 'palupi', '123456', 'GURU', 'GURU', 'P', ''],
      ['Hendra Wijaya', '19900210 201502 1 001', 'hendra_tu', '123456', 'GURU', 'TU', 'L', ''],
    ];
    exportAoaToSpreadsheet(rows, 'Data Pengguna', 'Template_Import_Pengguna_SiPerSis', [28, 24, 16, 14, 18, 22, 18, 28], 'xls');
    toast.success('Template XLS data pengguna berhasil diunduh.');
  };

  const handleExportXls = () => {
    if (filteredUsers.length === 0) {
      toast.error('Tidak ada data pengguna untuk diunduh.');
      return;
    }
    const rows = filteredUsers.map((u, idx) => ({
      No: idx + 1,
      Nama: u.name,
      NIP: u.nip || '-',
      Username: u.username,
      Role: u.role,
      Posisi: getUserPositionLabel(u),
      'Jenis Kelamin': inferUserGender(u),
      Foto: normalizePhotoUrl(u.avatar),
    }));
    exportRowsToSpreadsheet(
      rows,
      'Data Pengguna',
      `Data_Pengguna_Guru_${new Date().toISOString().slice(0, 10)}`,
      [6, 28, 22, 16, 12, 14, 14, 28],
      'xls'
    );
    toast.success(`Berhasil mengunduh ${filteredUsers.length} data pengguna (.xls)!`);
  };

  const buildUsersPdfDoc = async (customSettings?: PrintDocumentSettings) => {
    const settings = customSettings || resolvePrintSettings(effectiveAppConfig, effectiveCurrentUser, users);
    const font = getPdfFontFamily(settings.documentFontFamily);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentY = await drawPdfKopSurat(doc, effectiveAppConfig, 8, settings);
    const startY = currentY + 6;

    doc.setFontSize(12);
    doc.setFont(font, 'bold');
    doc.text('DAFTAR PENGGUNA, DEWAN GURU & STAFF TU', pageWidth / 2, startY, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(
      `Total Terdaftar: ${filteredUsers.length} Akun${effectiveAppConfig?.academicYear ? ` • Tahun Ajaran ${effectiveAppConfig.academicYear}` : ''}`,
      pageWidth / 2,
      startY + 5,
      { align: 'center' }
    );

    autoTable(doc, {
      startY: startY + 11,
      head: [['No', 'Nama Lengkap & NIP', 'Username', 'Posisi / Jabatan', 'L/P', 'Hak Akses']],
      body: filteredUsers.map((u, idx) => [
        idx + 1,
        `${u.name}\nNIP: ${u.nip || '-'}`,
        `@${u.username}`,
        getUserPositionLabel(u),
        inferUserGender(u),
        u.role,
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle', font },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: 'center', font },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 30 },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
      },
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || startY + 25) + 12;
    drawPdfSignatures(doc, settings, effectiveAppConfig, finalY);

    return doc;
  };

  const handlePrintPdf = () => {
    if (filteredUsers.length === 0) {
      toast.error('Tidak ada data pengguna untuk dicetak.');
      return;
    }
    setIsPrintModalOpen(true);
  };

  const handleDirectDownloadPdf = async () => {
    if (filteredUsers.length === 0) {
      toast.error('Tidak ada data pengguna untuk diunduh.');
      return;
    }
    try {
      const doc = await buildUsersPdfDoc(draftPrintSettings);
      doc.save(`Data_Pengguna_Guru_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('File PDF data pengguna berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh PDF pengguna.');
    }
  };

  const handleExecImportUsers = () => {
    if (!selectedImportFile) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rows.length < 2) {
          toast.error('File tidak memiliki baris data pengguna.');
          return;
        }
        const headers = (rows[0] || []).map((h) => String(h || '').trim().toUpperCase());
        const colIdx = {
          name: headers.findIndex((h) => h.includes('NAMA')),
          nip: headers.findIndex((h) => h.includes('NIP')),
          username: headers.findIndex((h) => h.includes('USER')),
          password: headers.findIndex((h) => h.includes('PASS')),
          role: headers.findIndex((h) => h.includes('ROLE') || h.includes('AKSES')),
          position: headers.findIndex((h) => h.includes('POSISI') || h.includes('JABATAN')),
          gender: headers.findIndex((h) => h.includes('KELAMIN') || h === 'L/P' || h === 'JK' || h === 'GENDER'),
          avatar: headers.findIndex((h) => h.includes('FOTO') || h.includes('AVATAR')),
        };

        const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));
        const imported: User[] = [];

        rows.slice(1).forEach((row, idx) => {
          if (!Array.isArray(row) || row.every((c) => !String(c || '').trim())) return;
          const cell = (i: number, fallback: number) =>
            String(row[i >= 0 ? i : fallback] ?? '').trim();

          const name = cell(colIdx.name, 0);
          const nip = cell(colIdx.nip, 1);
          const username = cell(colIdx.username, 2).toLowerCase().replace(/\s+/g, '');
          const password = cell(colIdx.password, 3) || '123456';
          const roleRaw = cell(colIdx.role, 4).toUpperCase();
          const role = roleRaw.includes('ADMIN') ? UserRole.ADMIN : UserRole.GURU;
          const posRaw = cell(colIdx.position, 5);
          const position = normalizeUserPosition(posRaw || roleRaw, role);
          const genderRaw = cell(colIdx.gender, 6);
          const gender = normalizeGender(genderRaw);
          const avatarRaw = normalizePhotoUrl(cell(colIdx.avatar, 7));

          if (name && username && !existingUsernames.has(username)) {
            existingUsernames.add(username);
            imported.push({
              id: `u-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              name,
              nip: nip || undefined,
              username,
              password,
              role,
              position,
              gender,
              avatar: avatarRaw || undefined,
            });
          }
        });

        if (imported.length === 0) {
          toast.error('Tidak ada akun baru valid yang bisa diimpor (atau username sudah terdaftar).');
          return;
        }

        if (onBulkAddUsers) {
          onBulkAddUsers(imported);
        } else {
          imported.forEach((u) => onAddUser(u));
          toast.success(`${imported.length} akun pengguna berhasil diimpor!`);
        }
        setSelectedImportFile(null);
        setIsImportModalOpen(false);
      } catch (err) {
        console.error(err);
        toast.error('Gagal membaca file Excel/XLS pengguna.');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsArrayBuffer(selectedImportFile);
  };

  // Toggle single user selection
  const toggleSelect = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle select all filtered users
  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  // Trigger Individual Delete
  const triggerDeleteUser = (user: User) => {
    if (currentUser && user.id === currentUser.id) {
      toast.error('Anda tidak dapat menghapus akun Anda sendiri yang sedang digunakan saat ini.');
      return;
    }
    if (users.length <= 1) {
      toast.error('Sistem membutuhkan minimal 1 akun pengguna aktif.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengguna',
      message: (
        <div>
          <p className="mb-2">Apakah Anda yakin ingin menghapus akun pengguna berikut?</p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 text-sm">{user.name}</div>
            <div className="text-xs text-slate-500 font-mono">Username: @{user.username}</div>
            <div className="text-xs text-slate-500">
              Posisi: {getUserPositionLabel(user)} ({user.role})
            </div>
          </div>
          <p className="mt-2 text-rose-600 text-xs font-semibold">
            Tindakan ini akan menghapus akun secara permanen dari basis data dan tidak dapat dibatalkan.
          </p>
        </div>
      ),
      variant: 'danger',
      confirmText: 'Ya, Hapus Akun',
      action: () => {
        onDeleteUser(user.id);
        setSelectedUserIds((prev) => prev.filter((id) => id !== user.id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Trigger Bulk Delete Selected
  const triggerBulkDelete = () => {
    if (selectedUserIds.length === 0) return;

    const safeToDelete = selectedUserIds.filter((id) => !currentUser || id !== currentUser.id);
    if (safeToDelete.length === 0) {
      toast.error('Akun yang dipilih adalah akun Anda sendiri dan tidak dapat dihapus.');
      return;
    }

    if (users.length - safeToDelete.length < 1) {
      toast.error('Tidak dapat menghapus seluruh akun. Sisakan minimal 1 akun Administrator.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengguna Terpilih',
      message: (
        <div>
          <p>
            Apakah Anda yakin ingin menghapus{' '}
            <strong className="text-rose-600">{safeToDelete.length} akun pengguna</strong> yang dipilih?
          </p>
          {selectedUserIds.includes(currentUser?.id || '') && (
            <p className="mt-2 text-amber-600 bg-amber-50 p-2 rounded-lg text-xs font-medium">
              Catatan: Akun Anda yang sedang aktif tidak akan dihapus demi keamanan sesi login.
            </p>
          )}
          <p className="mt-2 text-slate-500 text-xs">
            Seluruh akun yang dipilih akan dihapus secara permanen dari sistem dan Cloud Firestore.
          </p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus ${safeToDelete.length} Pengguna`,
      action: () => {
        if (onBulkDeleteUsers) {
          onBulkDeleteUsers(safeToDelete);
        } else {
          safeToDelete.forEach((id) => onDeleteUser(id));
        }
        setSelectedUserIds([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Trigger Delete All Guru Accounts
  const triggerDeleteAllGuru = () => {
    const guruUsers = users.filter(
      (u) => u.role === UserRole.GURU && (!currentUser || u.id !== currentUser.id)
    );
    if (guruUsers.length === 0) {
      toast.info('Tidak ada akun guru yang dapat dihapus.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Semua Akun Guru',
      message: (
        <div>
          <p>
            Tindakan ini akan menghapus seluruh{' '}
            <strong className="text-rose-600">{guruUsers.length} akun Dewan Guru</strong> dari sistem.
          </p>
          <p className="mt-2 text-slate-600 bg-slate-100 p-2.5 rounded-lg text-xs">
            Akun Administrator tetap aman dan tidak akan terhapus.
          </p>
          <p className="mt-2 text-rose-600 text-xs font-semibold">
            Lanjutkan penghapusan seluruh akun guru?
          </p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus ${guruUsers.length} Akun Guru`,
      action: () => {
        const ids = guruUsers.map((g) => g.id);
        if (onBulkDeleteUsers) {
          onBulkDeleteUsers(ids);
        } else {
          ids.forEach((id) => onDeleteUser(id));
        }
        setSelectedUserIds((prev) => prev.filter((id) => !ids.includes(id)));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const previewAvatarSrc =
    normalizePhotoUrl(formData.avatar) ||
    getDefaultUserAvatar({
      role: formData.role,
      position: formData.position,
      gender: formData.gender,
      name: formData.name,
      username: formData.username,
    });

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col gap-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                <Shield className="w-5 h-5 text-blue-600" /> Manajemen Pengguna, Guru &amp; Staff TU
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola akun Administrator, Guru, dan TU ({users.length} terdaftar). Avatar otomatis menyesuaikan posisi &amp; gender bila foto kosong.
              </p>
            </div>

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition shadow-sm shadow-blue-200 cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" /> Tambah User
            </button>
          </div>

          {/* Export / Import / Print / Delete Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportXls}
              className="flex items-center gap-1.5 bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Unduh daftar pengguna ke file Excel (.xls)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh XLS
            </button>
            <button
              type="button"
              onClick={() => setShowPrePrintPanel((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border ${
                showPrePrintPanel
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
              }`}
              title="Atur Kop Surat, Spasi, TTD & Font sebelum Pratinjau atau Cetak"
            >
              <Sliders className="w-3.5 h-3.5" /> Atur Kop, Spasi &amp; TTD
            </button>
            <button
              type="button"
              onClick={handleDirectDownloadPdf}
              className="flex items-center gap-1.5 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Unduh langsung daftar pengguna dalam format PDF"
            >
              <FileDown className="w-3.5 h-3.5" /> Unduh PDF
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Pratinjau & Cetak PDF"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="Impor massal akun pengguna dari Excel / XLS"
            >
              <Upload className="w-3.5 h-3.5" /> Import Excel
            </button>

            {/* Delete Menu Dropdown */}
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                className="flex items-center gap-1.5 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Menu Hapus</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showDeleteMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showDeleteMenu && (
                <div
                  className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowDeleteMenu(false)}
                >
                  <button
                    onClick={triggerBulkDelete}
                    disabled={selectedUserIds.length === 0}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Hapus Pengguna Terpilih ({selectedUserIds.length})</span>
                  </button>
                  <button
                    onClick={triggerDeleteAllGuru}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Hapus Semua Akun Guru</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inline Pre-Print Kop, Spasi & TTD Settings Panel */}
        {showPrePrintPanel && (
          <div className="border-b border-indigo-100 bg-slate-50/80 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <PrintSettingsPanel
                settings={draftPrintSettings}
                onChange={setDraftPrintSettings}
                appConfig={effectiveAppConfig}
                currentUser={effectiveCurrentUser}
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
                    Pratinjau Kop Surat &amp; TTD Sebelum Cetak Data Pengguna
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Spasi: {(draftPrintSettings.kopStyle.lineSpacing ?? 1).toFixed(1)}x • Bawah: {draftPrintSettings.kopStyle.bottomSpacing ?? 6} mm
                  </span>
                </div>
                {draftPrintSettings.showKop ? (
                  <KopSurat appConfig={effectiveAppConfig} printSettings={draftPrintSettings} showBorder />
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Kop Surat dinonaktifkan pada dokumen ini.
                  </div>
                )}
                <SignatureLayoutEditor
                  compact
                  settings={draftPrintSettings}
                  onChange={setDraftPrintSettings}
                  appConfig={effectiveAppConfig}
                  currentUser={effectiveCurrentUser}
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
                  onClick={handlePrintPdf}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Pratinjau Lengkap &amp; Cetak PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, NIP, posisi, username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap justify-between sm:justify-end">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                roleFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.GURU)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                roleFilter === UserRole.GURU
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Guru ({users.filter((u) => u.role === UserRole.GURU).length})
            </button>
            <button
              onClick={() => setRoleFilter('TU')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                roleFilter === 'TU'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              TU ({users.filter((u) => getUserPosition(u) === 'TU').length})
            </button>
            <button
              onClick={() => setRoleFilter(UserRole.ADMIN)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                roleFilter === UserRole.ADMIN
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Admin ({users.filter((u) => u.role === UserRole.ADMIN).length})
            </button>

            {selectedUserIds.length > 0 && (
              <button
                onClick={triggerBulkDelete}
                className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm transition animate-in fade-in cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus ({selectedUserIds.length})
              </button>
            )}
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                    onChange={toggleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    title="Pilih Semua Pengguna"
                  />
                </th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Pengguna</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Posisi &amp; Role</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                const isCurrentLoggedIn = currentUser?.id === user.id;
                const pos = getUserPosition(user);
                const gender = inferUserGender(user);

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getUserAvatar(user)}
                          alt={user.name}
                          onError={(e) => {
                            const fallback = getDefaultUserAvatar(user);
                            if (!e.currentTarget.src.endsWith(fallback)) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-900 text-sm leading-snug">{user.name}</p>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                gender === 'P'
                                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                                  : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}
                            >
                              {gender}
                            </span>
                            {isCurrentLoggedIn && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                Anda
                              </span>
                            )}
                          </div>
                          {user.nip ? (
                            <p className="text-[11px] text-slate-500 font-mono">NIP: {user.nip}</p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">NIP belum diisi</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        @{user.username}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            pos === 'ADMIN'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : pos === 'TU'
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {pos === 'GURU' && <GraduationCap className="w-3 h-3" />}
                          {pos === 'TU' && <Briefcase className="w-3 h-3" />}
                          {pos === 'ADMIN' && <Shield className="w-3 h-3" />}
                          {getUserPositionLabel(user)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Hak Akses: {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Edit User"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerDeleteUser(user)}
                          disabled={isCurrentLoggedIn}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            isCurrentLoggedIn
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={
                            isCurrentLoggedIn
                              ? 'Tidak dapat menghapus akun Anda sendiri'
                              : 'Hapus User'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Tidak ada pengguna yang cocok dengan filter atau pencarian "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200 max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-800">
                {editingUser ? 'Edit Data Pengguna / Guru / TU' : 'Tambah Pengguna Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* Foto & Default Avatar Preview */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="relative shrink-0 cursor-pointer">
                  <img
                    src={previewAvatarSrc}
                    alt="Preview Avatar"
                    onError={(e) => {
                      const fallback = getDefaultUserAvatar({
                        role: formData.role,
                        position: formData.position,
                        gender: formData.gender,
                        name: formData.name,
                        username: formData.username,
                      });
                      if (!e.currentTarget.src.endsWith(fallback)) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    title="Upload foto profil"
                  />
                  <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white shadow-sm">
                    <Camera className="w-3 h-3" />
                  </div>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Foto Profil / Link Google Drive (Opsional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.avatar}
                      onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 text-xs"
                      placeholder="https://drive.google.com/... atau kosongkan"
                    />
                    {formData.avatar && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, avatar: '' })}
                        className="px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Jika kosong, otomatis menggunakan avatar bawaan sesuai posisi ({formData.position === 'TU' ? 'TU / Staff' : formData.position}) &amp; jenis kelamin ({formData.gender === 'P' ? 'Perempuan' : 'Laki-laki'}).
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap &amp; Gelar
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-medium"
                    placeholder="Contoh: Palupi Etikawati, S.Pd"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  NIP (Nomor Induk Pegawai)
                </label>
                <input
                  type="text"
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm"
                  placeholder="Contoh: 19860412 201101 2 003"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Username Login
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value.toLowerCase().replace(/\s+/g, ''),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-mono"
                    placeholder="Contoh: palupi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-mono"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2.5 text-slate-400 hover:text-blue-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Posisi / Jabatan
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => {
                      const pos = e.target.value as UserPosition;
                      setFormData({
                        ...formData,
                        position: pos,
                        role: pos === 'ADMIN' ? UserRole.ADMIN : formData.role,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-xs font-bold"
                  >
                    <option value="GURU">Guru / BK</option>
                    <option value="TU">TU / Staff</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-xs font-bold"
                  >
                    <option value="L">L (Laki-laki)</option>
                    <option value="P">P (Perempuan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Hak Akses
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setFormData({
                        ...formData,
                        role: nextRole,
                        position:
                          nextRole === UserRole.ADMIN && formData.position === 'GURU'
                            ? 'ADMIN'
                            : nextRole === UserRole.GURU && formData.position === 'ADMIN'
                            ? 'GURU'
                            : formData.position,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-xs font-bold"
                  >
                    <option value={UserRole.GURU}>GURU</option>
                    <option value={UserRole.ADMIN}>ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md shadow-blue-200 flex justify-center items-center gap-2 text-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Users Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" /> Import Pengguna / Guru (Excel/XLS)
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-6 bg-indigo-50/30 text-center">
                <Upload className="w-9 h-9 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 mb-3">
                  Pilih file Excel (.xlsx, .xls, .csv) berisi daftar Guru, TU, atau Admin
                </p>
                <label className="cursor-pointer bg-indigo-600 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-indigo-700 transition inline-block">
                  {selectedImportFile ? 'Ganti File' : 'Pilih File Excel'}
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setSelectedImportFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {selectedImportFile && (
                  <div className="mt-4 space-y-2">
                    <div className="bg-white border border-indigo-100 px-3 py-2 rounded-xl text-xs text-slate-700 font-medium flex justify-between items-center">
                      <span className="truncate">{selectedImportFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedImportFile(null)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleExecImportUsers}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      {isImporting ? 'Mengimpor...' : 'Proses Import Pengguna'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 py-2.5 rounded-xl hover:bg-indigo-50 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4" /> Unduh Template XLS Pengguna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Print Settings & Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        title="Pratinjau & Pengaturan Cetak Daftar Pengguna"
        fileNamePrefix="Data_Pengguna_Guru"
        appConfig={effectiveAppConfig}
        currentUser={effectiveCurrentUser}
        users={users}
        onClose={() => setIsPrintModalOpen(false)}
        buildPdfDoc={buildUsersPdfDoc}
        onSaveDefaultSettings={onSavePrintSettings}
        defaultOverrides={draftPrintSettings}
        onSettingsChange={setDraftPrintSettings}
      />

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

export default UserManagement;
