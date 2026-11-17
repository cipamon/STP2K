import { Student, User, UserRole, ViolationCategory, ViolationRecord, ViolationType, AppTheme, AppConfig } from './types';

// Default Logo URL (SMA Negeri 1 Kudus Official Logo)
export const DEFAULT_LOGO_URL = "/logo.png";
export const PROVINSI_LOGO_URL = "/provinsi_jateng.png";

// Deprecated: Use AppConfig instead. Keeping for backward compatibility if needed temporarily.
export const LOGO_URL = DEFAULT_LOGO_URL; 

export const DEFAULT_APP_CONFIG: AppConfig = {
  schoolName: 'SMA Negeri 1 Kudus',
  appName: 'SiPerSis System',
  logoUrl: DEFAULT_LOGO_URL,
  address: 'Jalan Pramuka Nomor 41, Kota Kudus, Kabupaten Kudus, Jawa Tengah,',
  website: 'http://sma1kudus.sch.id',
  email: 'sma1kds@yahoo.co.id',
  academicYear: '2026 / 2027',
  principalName: 'Drs. H. Purnomo, M.Pd',
  principalNip: '19680101 199003 1 001',
  theme: 'striking',
  webhookUrl: '',
  webhookEnabled: false,
  governmentHeader: 'PEMERINTAH PROVINSI JAWA TENGAH',
  departmentHeader: 'DINAS PENDIDIKAN',
  postalCode: '59319',
  phone: '0291-431368',
  fax: '0291-431368',
  provinsiLogoUrl: '/provinsi_jateng.png',
};

// Generator Kelas Otomatis
const generateClasses = () => {
  const classes = [];
  // Kelas X E 1 - 12
  for (let i = 1; i <= 12; i++) classes.push(`X E ${i}`);
  // Kelas XI F 1 - 12
  for (let i = 1; i <= 12; i++) classes.push(`XI F ${i}`);
  // Kelas XII F 1 - 12
  for (let i = 1; i <= 12; i++) classes.push(`XII F ${i}`);
  return classes;
};

export const CLASS_LIST = generateClasses();

export const THEMES: Record<string, AppTheme> = {
  ocean: {
    name: 'ocean',
    label: 'Ocean Blue',
    primary: 'blue',
    secondary: 'cyan',
    gradient: 'from-blue-500 to-cyan-500',
    button: 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700',
    sidebar: 'border-blue-100 text-blue-600 bg-blue-50',
  },
  striking: {
    name: 'striking',
    label: 'Striking Neon',
    primary: 'fuchsia',
    secondary: 'yellow',
    gradient: 'from-fuchsia-600 to-yellow-400',
    button: 'from-fuchsia-600 to-yellow-500 hover:from-fuchsia-700 hover:to-yellow-600 text-white shadow-lg shadow-fuchsia-500/50',
    sidebar: 'border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50',
  },
  nature: {
    name: 'nature',
    label: 'Nature Green',
    primary: 'emerald',
    secondary: 'teal',
    gradient: 'from-emerald-500 to-teal-500',
    button: 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700',
    sidebar: 'border-emerald-100 text-emerald-600 bg-emerald-50',
  },
  sunset: {
    name: 'sunset',
    label: 'Sunset Orange',
    primary: 'orange',
    secondary: 'rose',
    gradient: 'from-orange-500 to-rose-500',
    button: 'from-orange-600 to-rose-600 hover:from-orange-700 hover:to-rose-700',
    sidebar: 'border-orange-100 text-orange-600 bg-orange-50',
  },
  royal: {
    name: 'royal',
    label: 'Royal Purple',
    primary: 'indigo',
    secondary: 'purple',
    gradient: 'from-indigo-600 to-purple-600',
    button: 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700',
    sidebar: 'border-indigo-100 text-indigo-600 bg-indigo-50',
  }
};

export const MOCK_STUDENTS: Student[] = [
  { id: 's1', nis: '102301', nisn: '0061234501', name: 'Ahmad Rizky Pratama', class: 'X E 1', gender: 'L', totalPoints: 25, parentPhone: '081234567890', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80' },
  { id: 's2', nis: '102302', nisn: '0061234502', name: 'Siti Nurhaliza', class: 'X E 1', gender: 'P', totalPoints: 10, parentPhone: '081234567891', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80' },
  { id: 's3', nis: '112301', nisn: '0051234503', name: 'Budi Santoso', class: 'XI F 2', gender: 'L', totalPoints: 45, parentPhone: '081234567892', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' },
  { id: 's4', nis: '112302', nisn: '0051234504', name: 'Dewi Anggraeni', class: 'XI F 2', gender: 'P', totalPoints: 15, parentPhone: '081234567893', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' },
  { id: 's5', nis: '102303', nisn: '0061234505', name: 'Dimas Setiawan', class: 'X E 3', gender: 'L', totalPoints: 60, parentPhone: '081234567894', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' },
  { id: 's6', nis: '122301', nisn: '0041234506', name: 'Fajar Ramadhan', class: 'XII F 1', gender: 'L', totalPoints: 30, parentPhone: '081234567895', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80' },
  { id: 's7', nis: '112303', nisn: '0051234507', name: 'Gita Permata', class: 'XI F 3', gender: 'P', totalPoints: 5, parentPhone: '081234567896', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80' },
  { id: 's8', nis: '122302', nisn: '0041234508', name: 'Hendra Wijaya', class: 'XII F 2', gender: 'L', totalPoints: 20, parentPhone: '081234567897', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80' },
  { id: 's9', nis: '102304', nisn: '0061234509', name: 'Nadia Safitri', class: 'X E 2', gender: 'P', totalPoints: 0, parentPhone: '081234567898', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80' },
  { id: 's10', nis: '112304', nisn: '0051234510', name: 'Rizka Amelia', class: 'XI F 1', gender: 'P', totalPoints: 10, parentPhone: '081234567899', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }
];

export const MOCK_USERS: User[] = [
  { 
    id: 'u1', 
    name: 'Admin Sekolah', 
    username: 'admin',
    password: 'admin123',
    role: UserRole.ADMIN, 
    nip: '19700101 199501 1 001',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-palupi', 
    name: 'Palupi Etikawati, S.Pd', 
    username: 'palupi',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19860412 201101 2 003',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-lukman', 
    name: 'Lukman Darul Fuadi, S.Pd.Gr', 
    username: 'lukman',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19880715 201402 1 004',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-hery', 
    name: 'Hery Supriyadi, S.Pd', 
    username: 'hery',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19820320 200801 1 005',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-eko', 
    name: 'Eko Sarwono, S.Pd', 
    username: 'eko',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19790518 200604 1 006',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-ayu', 
    name: 'Ayu Candra Permana Sari, S.Pd', 
    username: 'ayu',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19900910 201503 2 007',
    avatar: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-fauzul', 
    name: 'Fauzul Muna, S.Pd', 
    username: 'fauzul',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19921104 201902 1 008',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-munawwaroh', 
    name: 'Dra. Munawwaroh', 
    username: 'munawwaroh',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19670822 199303 2 009',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-didik', 
    name: 'Didik Ardiato, S.Pd', 
    username: 'didik',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19840216 200901 1 010',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-utomo', 
    name: 'Muhammad Utomo Aji Putro, S.Pd', 
    username: 'utomo',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19910625 201801 1 011',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u-harjito', 
    name: 'Harjito Tri Khamdhani, S.Pd', 
    username: 'harjito',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19870130 201201 1 012',
    avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=150&q=80' 
  },
  { 
    id: 'u2', 
    name: 'Pak Guru Budi', 
    username: 'guru',
    password: 'guru123',
    role: UserRole.GURU, 
    nip: '19851212 201001 1 002',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' 
  },
];

export const INITIAL_VIOLATIONS: ViolationRecord[] = [
  {
    id: 'v1',
    studentId: 's1',
    studentName: 'Ahmad Rizky Pratama',
    studentClass: 'X E 1',
    date: '2026-09-02T07:15:00.000Z',
    description: 'Terlambat Hadir (Pintu Gerbang Tertutup Jam 07.15 WIB)',
    category: ViolationCategory.RINGAN,
    points: 5,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v2',
    studentId: 's1',
    studentName: 'Ahmad Rizky Pratama',
    studentClass: 'X E 1',
    date: '2026-09-05T07:12:00.000Z',
    description: 'Terlambat Masuk Sekolah (Catatan Piket 07.12 WIB)',
    category: ViolationCategory.RINGAN,
    points: 5,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v3',
    studentId: 's1',
    studentName: 'Ahmad Rizky Pratama',
    studentClass: 'X E 1',
    date: '2026-09-08T07:18:00.000Z',
    description: 'Terlambat Hadir di Gerbang Sekolah',
    category: ViolationCategory.RINGAN,
    points: 5,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v4',
    studentId: 's5',
    studentName: 'Dimas Setiawan',
    studentClass: 'X E 3',
    date: '2026-09-03T09:30:00.000Z',
    description: 'Bermain HP / Gadget saat Jam Pelajaran Fisika Tanpa Izin',
    category: ViolationCategory.SEDANG,
    points: 10,
    reporterName: 'Ibu Guru Ratna',
    evidenceUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v5',
    studentId: 's5',
    studentName: 'Dimas Setiawan',
    studentClass: 'X E 3',
    date: '2026-09-07T07:30:00.000Z',
    description: 'Seragam Tidak Rapi (Tidak memakai dasi dan ikat pinggang resmi)',
    category: ViolationCategory.RINGAN,
    points: 3,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v6',
    studentId: 's6',
    studentName: 'Fajar Ramadhan',
    studentClass: 'XII F 1',
    date: '2026-09-01T10:15:00.000Z',
    description: 'Bolos Pelajaran (Berada di luar kelas / kantin belakang saat KBM)',
    category: ViolationCategory.SEDANG,
    points: 10,
    reporterName: 'Petugas Tatib',
    evidenceUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v7',
    studentId: 's6',
    studentName: 'Fajar Ramadhan',
    studentClass: 'XII F 1',
    date: '2026-09-06T12:45:00.000Z',
    description: 'Merokok di area belakang sekolah saat jam istirahat kedua',
    category: ViolationCategory.BERAT,
    points: 25,
    reporterName: 'Petugas Tatib',
    evidenceUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v8',
    studentId: 's3',
    studentName: 'Budi Santoso',
    studentClass: 'XI F 2',
    date: '2026-09-04T08:00:00.000Z',
    description: 'Rambut Tidak Rapi / Gondrong melampaui kerah seragam',
    category: ViolationCategory.RINGAN,
    points: 5,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v9',
    studentId: 's3',
    studentName: 'Budi Santoso',
    studentClass: 'XI F 2',
    date: '2026-09-09T07:25:00.000Z',
    description: 'Sepatu Tidak Sesuai Aturan (Memakai sepatu warna-warni)',
    category: ViolationCategory.RINGAN,
    points: 3,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v10',
    studentId: 's8',
    studentName: 'Hendra Wijaya',
    studentClass: 'XII F 2',
    date: '2026-09-05T11:00:00.000Z',
    description: 'Merusak Fasilitas (Coret-coret meja kelas dan jendela)',
    category: ViolationCategory.SEDANG,
    points: 20,
    reporterName: 'Ibu Guru Ratna',
    evidenceUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v11',
    studentId: 's2',
    studentName: 'Siti Nurhaliza',
    studentClass: 'X E 1',
    date: '2026-09-04T13:00:00.000Z',
    description: 'Juara 1 Tingkat Nasional (Olimpiade Sains Nasional Bidang Biologi)',
    category: ViolationCategory.PRESTASI,
    points: -50,
    reporterName: 'Admin Sekolah',
    evidenceUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v12',
    studentId: 's2',
    studentName: 'Siti Nurhaliza',
    studentClass: 'X E 1',
    date: '2026-08-25T08:00:00.000Z',
    description: 'Ketua OSIS / MPK Terpilih Periode 2026/2027',
    category: ViolationCategory.PRESTASI,
    points: -25,
    reporterName: 'Admin Sekolah',
    evidenceUrl: 'https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v13',
    studentId: 's4',
    studentName: 'Dewi Anggraeni',
    studentClass: 'XI F 2',
    date: '2026-09-09T14:30:00.000Z',
    description: 'Juara 2 Tingkat Provinsi (Lomba Karya Ilmiah Remaja)',
    category: ViolationCategory.PRESTASI,
    points: -20,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'v14',
    studentId: 's9',
    studentName: 'Nadia Safitri',
    studentClass: 'X E 2',
    date: '2026-09-10T08:30:00.000Z',
    description: 'Tidak Membawa Buku Modul Belajar & Tugas Sekolah',
    category: ViolationCategory.RINGAN,
    points: 2,
    reporterName: 'Pak Guru Budi',
    evidenceUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80'
  }
];

export const INITIAL_VIOLATION_TYPES: ViolationType[] = [
  // Pelanggaran
  { id: 't1', label: 'Terlambat', points: 5, category: ViolationCategory.RINGAN },
  { id: 't2', label: 'Tidak Membawa Buku', points: 2, category: ViolationCategory.RINGAN },
  { id: 't3', label: 'Seragam Tidak Rapi', points: 3, category: ViolationCategory.RINGAN },
  { id: 't4', label: 'Bolos Pelajaran', points: 10, category: ViolationCategory.SEDANG },
  { id: 't5', label: 'Berkelahi', points: 50, category: ViolationCategory.BERAT },
  { id: 't6', label: 'Merokok', points: 25, category: ViolationCategory.BERAT },
  { id: 't7', label: 'Merusak Fasilitas', points: 20, category: ViolationCategory.SEDANG },

  // PRESTASI BERJENJANG (TIERED)
  { id: 'p_kota_1', label: 'Juara 1 Tingkat Kota/Kab (Berjenjang)', points: -15, category: ViolationCategory.PRESTASI },
  { id: 'p_kota_2', label: 'Juara 2 Tingkat Kota/Kab (Berjenjang)', points: -10, category: ViolationCategory.PRESTASI },
  { id: 'p_kota_3', label: 'Juara 3 Tingkat Kota/Kab (Berjenjang)', points: -7, category: ViolationCategory.PRESTASI },

  { id: 'p_prov_1', label: 'Juara 1 Tingkat Provinsi (Berjenjang)', points: -25, category: ViolationCategory.PRESTASI },
  { id: 'p_prov_2', label: 'Juara 2 Tingkat Provinsi (Berjenjang)', points: -20, category: ViolationCategory.PRESTASI },
  { id: 'p_prov_3', label: 'Juara 3 Tingkat Provinsi (Berjenjang)', points: -15, category: ViolationCategory.PRESTASI },

  { id: 'p_nas_1', label: 'Juara 1 Tingkat Nasional (Berjenjang)', points: -50, category: ViolationCategory.PRESTASI },
  { id: 'p_nas_2', label: 'Juara 2 Tingkat Nasional (Berjenjang)', points: -40, category: ViolationCategory.PRESTASI },
  { id: 'p_nas_3', label: 'Juara 3 Tingkat Nasional (Berjenjang)', points: -30, category: ViolationCategory.PRESTASI },

  { id: 'p_int_1', label: 'Juara 1 Tingkat Internasional (Berjenjang)', points: -100, category: ViolationCategory.PRESTASI },
  { id: 'p_int_2', label: 'Juara 2 Tingkat Internasional (Berjenjang)', points: -75, category: ViolationCategory.PRESTASI },
  { id: 'p_int_3', label: 'Juara 3 Tingkat Internasional (Berjenjang)', points: -50, category: ViolationCategory.PRESTASI },

  // PRESTASI TIDAK BERJENJANG (NON-TIERED)
  { id: 'pn_kota_1', label: 'Juara 1 Tingkat Kota/Kab (Tidak Berjenjang)', points: -10, category: ViolationCategory.PRESTASI },
  { id: 'pn_kota_2', label: 'Juara 2 Tingkat Kota/Kab (Tidak Berjenjang)', points: -7, category: ViolationCategory.PRESTASI },
  { id: 'pn_kota_3', label: 'Juara 3 Tingkat Kota/Kab (Tidak Berjenjang)', points: -5, category: ViolationCategory.PRESTASI },

  { id: 'pn_prov_1', label: 'Juara 1 Tingkat Provinsi (Tidak Berjenjang)', points: -15, category: ViolationCategory.PRESTASI },
  { id: 'pn_nas_1', label: 'Juara 1 Tingkat Nasional (Tidak Berjenjang)', points: -30, category: ViolationCategory.PRESTASI },
  { id: 'pn_int_1', label: 'Juara 1 Tingkat Internasional (Tidak Berjenjang)', points: -60, category: ViolationCategory.PRESTASI },
  
  // Organisasi
  { id: 'org_ketua', label: 'Ketua OSIS / MPK', points: -25, category: ViolationCategory.PRESTASI },
  { id: 'org_pengurus', label: 'Pengurus OSIS / MPK', points: -15, category: ViolationCategory.PRESTASI },
];