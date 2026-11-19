import {
  Student,
  User,
  UserRole,
  ViolationCategory,
  ViolationRecord,
  ViolationType,
  AppTheme,
  AppConfig,
  KopSuratStyleConfig,
  SignatureStyleConfig,
  PrintDocumentSettings,
} from './types';

// Default Logo URL (SMA Negeri 1 Kudus Official Logo)
export const DEFAULT_LOGO_URL = "/logo.png";
export const PROVINSI_LOGO_URL = "/provinsi_jateng.png";

// Deprecated: Use AppConfig instead. Keeping for backward compatibility if needed temporarily.
export const LOGO_URL = DEFAULT_LOGO_URL; 

export const DEFAULT_KOP_STYLE: KopSuratStyleConfig = {
  fontFamily: 'helvetica',
  line1: { fontSize: 10.5, bold: false, italic: false, underline: false, align: 'center' },
  line2: { fontSize: 12, bold: true, italic: false, underline: false, align: 'center' },
  line3: { fontSize: 14, bold: true, italic: false, underline: false, align: 'center' },
  line4: { fontSize: 8.5, bold: false, italic: false, underline: false, align: 'center' },
  line5: { fontSize: 8.5, bold: false, italic: false, underline: false, align: 'center' },
  line6: { fontSize: 8.5, bold: false, italic: false, underline: false, align: 'center' },
};

export const DEFAULT_SIGNATURE_STYLE: SignatureStyleConfig = {
  fontSize: 9,
  align: 'left',
  boldHeader: false,
  italicHeader: false,
  underlineHeader: false,
  boldName: true,
  italicName: false,
  underlineName: false,
  boldNip: false,
  italicNip: false,
  underlineNip: false,
  spacingHeight: 22,
};

export const DEFAULT_PRINT_SETTINGS: PrintDocumentSettings = {
  showKop: true,
  showPoints: true,
  showKepsekSignature: true,
  showStaffSignature: true,
  kepsekPosition: 'left',
  staffPosition: 'right',
  kepsekTitle: 'Kepala Sekolah',
  staffUserId: 'CURRENT_USER',
  staffRoleTitle: 'Guru BK / Admin',
  staffName: '',
  staffNip: '',
  cityLabel: 'Kudus',
  documentFontFamily: 'helvetica',
  kopStyle: DEFAULT_KOP_STYLE,
  signatureStyle: DEFAULT_SIGNATURE_STYLE,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  schoolName: 'SMA Negeri 1 Kudus',
  appName: 'SiPerSis System',
  logoUrl: DEFAULT_LOGO_URL,
  address: 'Jalan Pramuka Nomor 41, Kota Kudus, Kabupaten Kudus, Jawa Tengah,',
  website: 'http://sma1kudus.sch.id',
  email: 'sma1kds@yahoo.co.id',
  academicYear: '2026 / 2027',
  academicYears: ['2025 / 2026', '2026 / 2027', '2027 / 2028', '2028 / 2029'],
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
  printSettings: DEFAULT_PRINT_SETTINGS,
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
  { id: 's1', nis: '102301', nisn: '0061234501', name: 'Ahmad Rizky Pratama', class: 'X E 1', absenNumber: '01', birthPlace: 'Kudus', birthDate: '2010-03-14', email: 'ahmad.rizky@siswa.sma1kudus.sch.id', gender: 'L', address: 'Jl. Pemuda No. 12, Kec. Kota, Kudus', phone: '081234567890', parentPhone: '081234567890', status: 'Aktif', totalPoints: 25 },
  { id: 's2', nis: '102302', nisn: '0061234502', name: 'Siti Nurhaliza', class: 'X E 1', absenNumber: '02', birthPlace: 'Kudus', birthDate: '2010-05-22', email: 'siti.nurhaliza@siswa.sma1kudus.sch.id', gender: 'P', address: 'Ds. Demaan RT 02 RW 01, Kec. Kota, Kudus', phone: '081234567891', parentPhone: '081234567891', status: 'Aktif', totalPoints: 10 },
  { id: 's3', nis: '112301', nisn: '0051234503', name: 'Budi Santoso', class: 'XI F 2', absenNumber: '05', birthPlace: 'Jepara', birthDate: '2009-08-19', email: 'budi.santoso@siswa.sma1kudus.sch.id', gender: 'L', address: 'Jl. Sunan Muria No. 45, Bae, Kudus', phone: '081234567892', parentPhone: '081234567892', status: 'Aktif', totalPoints: 45 },
  { id: 's4', nis: '112302', nisn: '0051234504', name: 'Dewi Anggraeni', class: 'XI F 2', absenNumber: '08', birthPlace: 'Kudus', birthDate: '2009-11-03', email: 'dewi.anggraeni@siswa.sma1kudus.sch.id', gender: 'P', address: 'Ds. Rendeng RT 04 RW 02, Kec. Kota, Kudus', phone: '081234567893', parentPhone: '081234567893', status: 'Aktif', totalPoints: 15 },
  { id: 's5', nis: '102303', nisn: '0061234505', name: 'Dimas Setiawan', class: 'X E 3', absenNumber: '11', birthPlace: 'Pati', birthDate: '2010-01-27', email: 'dimas.setiawan@siswa.sma1kudus.sch.id', gender: 'L', address: 'Jl. Mejobo Permai Blok C-7, Mejobo, Kudus', phone: '081234567894', parentPhone: '081234567894', status: 'Aktif', totalPoints: 60 },
  { id: 's6', nis: '122301', nisn: '0041234506', name: 'Fajar Ramadhan', class: 'XII F 1', absenNumber: '14', birthPlace: 'Kudus', birthDate: '2008-09-12', email: 'fajar.ramadhan@siswa.sma1kudus.sch.id', gender: 'L', address: 'Ds. Jati Wetan RT 01 RW 03, Kec. Jati, Kudus', phone: '081234567895', parentPhone: '081234567895', status: 'Aktif', totalPoints: 30 },
  { id: 's7', nis: '112303', nisn: '0051234507', name: 'Gita Permata', class: 'XI F 3', absenNumber: '16', birthPlace: 'Demak', birthDate: '2009-06-08', email: 'gita.permata@siswa.sma1kudus.sch.id', gender: 'P', address: 'Jl. KHR Asnawi No. 23, Kec. Kota, Kudus', phone: '081234567896', parentPhone: '081234567896', status: 'Aktif', totalPoints: 5 },
  { id: 's8', nis: '122302', nisn: '0041234508', name: 'Hendra Wijaya', class: 'XII F 2', absenNumber: '18', birthPlace: 'Kudus', birthDate: '2008-12-01', email: 'hendra.wijaya@siswa.sma1kudus.sch.id', gender: 'L', address: 'Ds. Dersalam RT 03 RW 04, Kec. Bae, Kudus', phone: '081234567897', parentPhone: '081234567897', status: 'Aktif', totalPoints: 20 },
  { id: 's9', nis: '102304', nisn: '0061234509', name: 'Nadia Safitri', class: 'X E 2', absenNumber: '22', birthPlace: 'Kudus', birthDate: '2010-04-17', email: 'nadia.safitri@siswa.sma1kudus.sch.id', gender: 'P', address: 'Jl. Jenderal Sudirman No. 88, Kec. Kota, Kudus', phone: '081234567898', parentPhone: '081234567898', status: 'Aktif', totalPoints: 0 },
  { id: 's10', nis: '112304', nisn: '0051234510', name: 'Rizka Amelia', class: 'XI F 1', absenNumber: '25', birthPlace: 'Semarang', birthDate: '2009-07-30', email: 'rizka.amelia@siswa.sma1kudus.sch.id', gender: 'P', address: 'Ds. Getas Pejaten RT 02 RW 02, Kec. Jati, Kudus', phone: '081234567899', parentPhone: '081234567899', status: 'Aktif', totalPoints: 10 }
];

export const MOCK_USERS: User[] = [
  { 
    id: 'u1', 
    name: 'Admin Sekolah', 
    username: 'admin',
    password: 'admin123',
    role: UserRole.ADMIN,
    position: 'ADMIN',
    gender: 'L',
    nip: '19700101 199501 1 001'
  },
  { 
    id: 'u-palupi', 
    name: 'Palupi Etikawati, S.Pd', 
    username: 'palupi',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'P',
    nip: '19860412 201101 2 003'
  },
  { 
    id: 'u-lukman', 
    name: 'Lukman Darul Fuadi, S.Pd.Gr', 
    username: 'lukman',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19880715 201402 1 004'
  },
  { 
    id: 'u-hery', 
    name: 'Hery Supriyadi, S.Pd', 
    username: 'hery',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19820320 200801 1 005'
  },
  { 
    id: 'u-eko', 
    name: 'Eko Sarwono, S.Pd', 
    username: 'eko',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19790518 200604 1 006'
  },
  { 
    id: 'u-ayu', 
    name: 'Ayu Candra Permana Sari, S.Pd', 
    username: 'ayu',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'P',
    nip: '19900910 201503 2 007'
  },
  { 
    id: 'u-fauzul', 
    name: 'Fauzul Muna, S.Pd', 
    username: 'fauzul',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19921104 201902 1 008'
  },
  { 
    id: 'u-munawwaroh', 
    name: 'Dra. Munawwaroh', 
    username: 'munawwaroh',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'P',
    nip: '19670822 199303 2 009'
  },
  { 
    id: 'u-didik', 
    name: 'Didik Ardiato, S.Pd', 
    username: 'didik',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19840216 200901 1 010'
  },
  { 
    id: 'u-utomo', 
    name: 'Muhammad Utomo Aji Putro, S.Pd', 
    username: 'utomo',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19910625 201801 1 011'
  },
  { 
    id: 'u-harjito', 
    name: 'Harjito Tri Khamdhani, S.Pd', 
    username: 'harjito',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19870130 201201 1 012'
  },
  { 
    id: 'u2', 
    name: 'Pak Guru Budi', 
    username: 'guru',
    password: 'guru123',
    role: UserRole.GURU,
    position: 'GURU',
    gender: 'L',
    nip: '19851212 201001 1 002'
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