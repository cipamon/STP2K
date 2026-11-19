import { UserActivityLog, ActivityType, UserRole } from '../types';
import { DEFAULT_AVATARS } from './avatarHelpers';
import { exportRowsToSpreadsheet } from './exportHelpers';

export const INITIAL_ACTIVITIES: UserActivityLog[] = [
  {
    id: 'act-1',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 mins ago
    userId: 'u-palupi',
    userName: 'Palupi Etikawati, S.Pd',
    userRole: UserRole.GURU,
    userAvatar: DEFAULT_AVATARS.GURU_P,
    action: 'ADD_VIOLATION',
    title: 'Pencatatan Keterlambatan Siswa',
    details: 'Mencatat pelanggaran: "Terlambat Masuk Sekolah (>15 Menit)" (+5 poin) untuk siswa Ahmad Zaki (X RPL 1)',
    device: 'Chrome / Windows 11',
    badgeColor: 'amber'
  },
  {
    id: 'act-2',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 mins ago
    userId: 'u-lukman',
    userName: 'Lukman Darul Fuadi, S.Pd.Gr',
    userRole: UserRole.GURU,
    userAvatar: DEFAULT_AVATARS.GURU_L,
    action: 'ADD_VIOLATION',
    title: 'Pencatatan Reward Prestasi Siswa',
    details: 'Mencatat reward: "Juara 1 Lomba Karya Tulis Ilmiah Nasional" (-30 poin) untuk siswa Fajar Nugraha (XI TKJ 1)',
    device: 'Safari / iPhone iOS 17',
    badgeColor: 'emerald'
  },
  {
    id: 'act-3',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(), // 42 mins ago
    userId: 'u1',
    userName: 'Admin Sekolah',
    userRole: UserRole.ADMIN,
    userAvatar: DEFAULT_AVATARS.STAFF_L,
    action: 'LOGIN',
    title: 'Autentikasi Login Admin',
    details: 'Login berhasil ke panel manajemen SiPerSis via akun administrator',
    device: 'Chrome / MacOS Monterey',
    badgeColor: 'blue'
  },
  {
    id: 'act-4',
    timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 1 hr ago
    userId: 'u-hery',
    userName: 'Hery Supriyadi, S.Pd',
    userRole: UserRole.GURU,
    userAvatar: DEFAULT_AVATARS.GURU_L,
    action: 'ADD_VIOLATION',
    title: 'Pencatatan Pelanggaran Atribut',
    details: 'Mencatat pelanggaran: "Seragam Tidak Lengkap / Atribut Hilang" (+5 poin) untuk siswa Budi Santoso (X RPL 1)',
    device: 'Edge / Windows 10',
    badgeColor: 'amber'
  },
  {
    id: 'act-5',
    timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(), // ~2 hrs ago
    userId: 'u-palupi',
    userName: 'Palupi Etikawati, S.Pd',
    userRole: UserRole.GURU,
    userAvatar: DEFAULT_AVATARS.GURU_P,
    action: 'LOGIN',
    title: 'Login Pengguna Guru',
    details: 'Login berhasil via akun guru "palupi"',
    device: 'Chrome / Android 14',
    badgeColor: 'blue'
  },
  {
    id: 'act-6',
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(), // 3 hrs ago
    userId: 'u1',
    userName: 'Admin Sekolah',
    userRole: UserRole.ADMIN,
    userAvatar: DEFAULT_AVATARS.STAFF_L,
    action: 'USER_MANAGEMENT',
    title: 'Sinkronisasi Data Dewan Guru',
    details: 'Mendaftarkan 10 akun guru baru ke dalam sistem tata tertib sekolah',
    device: 'Chrome / MacOS Monterey',
    badgeColor: 'purple'
  },
  {
    id: 'act-7',
    timestamp: new Date(Date.now() - 260 * 60 * 1000).toISOString(), // 4.3 hrs ago
    userId: 'u-munawwaroh',
    userName: 'Dra. Munawwaroh',
    userRole: UserRole.GURU,
    userAvatar: DEFAULT_AVATARS.GURU_P,
    action: 'ADD_VIOLATION',
    title: 'Pencatatan Reward Tahfidz',
    details: 'Mencatat reward: "Khatam Hafalan Al-Qur\'an Juz 30" (-25 poin) untuk siswa Rizky Ramadhan (XI TKJ 1)',
    device: 'Chrome / Windows 11',
    badgeColor: 'emerald'
  },
  {
    id: 'act-8',
    timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(), // 6 hrs ago
    userId: 'u1',
    userName: 'Admin Sekolah',
    userRole: UserRole.ADMIN,
    userAvatar: DEFAULT_AVATARS.STAFF_L,
    action: 'EXPORT_DATA',
    title: 'Unduh Berkas Rekap & Bukti',
    details: 'Mengunduh rekapitulasi data pelanggaran dan berkas bukti foto format Excel & ZIP',
    device: 'Chrome / MacOS Monterey',
    badgeColor: 'indigo'
  },
  {
    id: 'act-9',
    timestamp: new Date(Date.now() - 850 * 60 * 1000).toISOString(), // ~14 hrs ago (yesterday)
    userId: 'u1',
    userName: 'Admin Sekolah',
    userRole: UserRole.ADMIN,
    userAvatar: DEFAULT_AVATARS.STAFF_L,
    action: 'BULK_IMPORT',
    title: 'Impor Data Master Siswa',
    details: 'Sinkronisasi 50 data siswa baru kelas X dan XI via file format Excel',
    device: 'Chrome / MacOS Monterey',
    badgeColor: 'sky'
  }
];

export function getActionLabel(action: ActivityType): { label: string; color: string; bg: string } {
  switch (action) {
    case 'LOGIN':
      return { label: 'Login', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
    case 'LOGOUT':
      return { label: 'Logout', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
    case 'ADD_VIOLATION':
      return { label: 'Input Catatan', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    case 'DELETE_VIOLATION':
      return { label: 'Hapus Catatan', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' };
    case 'ADD_STUDENT':
    case 'UPDATE_STUDENT':
    case 'DELETE_STUDENT':
      return { label: 'Kelola Siswa', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    case 'BULK_IMPORT':
      return { label: 'Impor Massal', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' };
    case 'USER_MANAGEMENT':
      return { label: 'Manajemen User', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    case 'EXPORT_DATA':
      return { label: 'Ekspor / Unduh', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' };
    case 'SETTINGS_UPDATE':
      return { label: 'Pengaturan', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' };
    case 'DATABASE_RESET':
      return { label: 'Reset Database', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
    default:
      return { label: 'Aktivitas', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' };
  }
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    if (diffHour < 24) return `${diffHour} jam yang lalu`;
    if (diffDay === 1) return `Kemarin, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDay < 7) return `${diffDay} hari yang lalu`;
    
    return date.toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export function exportActivitiesToExcel(
  activities: UserActivityLog[],
  filename?: string,
  format: 'xls' | 'xlsx' = 'xls'
): void {
  const data = activities.map((act, index) => ({
    "No": index + 1,
    "Waktu": new Date(act.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
    "Nama Pengguna": act.userName,
    "Role": act.userRole,
    "Jenis Aksi": act.action,
    "Judul Aktivitas": act.title,
    "Rincian Detail": act.details,
    "Perangkat / Browser": act.device || 'Web Browser'
  }));

  const baseName = (filename || `Log_Aktivitas_User_${new Date().toISOString().split('T')[0]}`).replace(/\.(xls|xlsx)$/i, '');
  exportRowsToSpreadsheet(
    data,
    'Log Aktivitas',
    baseName,
    [5, 20, 25, 10, 18, 30, 55, 22],
    format
  );
}
