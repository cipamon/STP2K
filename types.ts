export enum UserRole {
  ADMIN = 'ADMIN',
  GURU = 'GURU',
}

export enum ViolationCategory {
  RINGAN = 'Ringan',
  SEDANG = 'Sedang',
  BERAT = 'Berat',
  PRESTASI = 'Prestasi', // Reward
}

export type UserPosition = 'GURU' | 'TU' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  position?: UserPosition;
  gender?: 'L' | 'P';
  nip?: string;
  avatar?: string;
}

export type StudentStatus = 'Aktif' | 'Lulus' | 'Pindah' | 'Non-Aktif';

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  class: string;
  absenNumber?: string;
  birthPlace?: string;
  birthDate?: string;
  email?: string;
  gender: 'L' | 'P';
  address?: string;
  phone?: string;
  parentPhone?: string;
  photoUrl?: string;
  avatar?: string;
  status?: StudentStatus | string;
  totalPoints: number;
  academicYear?: string;
}

export interface ViolationType {
  id: string;
  label: string;
  points: number;
  category: ViolationCategory;
}

export interface ViolationRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  date: string; // ISO String
  description: string;
  category: ViolationCategory;
  points: number;
  reporterName: string;
  evidenceUrl?: string; // Placeholder for image data/url
  academicYear?: string;
}

export interface AIAnalysisResult {
  category: ViolationCategory;
  suggestedPoints: number;
  summary: string;
}

export type ThemeName = 'ocean' | 'nature' | 'sunset' | 'royal' | 'striking';

export interface AppTheme {
  name: ThemeName;
  label: string;
  primary: string; // Tailwind class, e.g., 'blue'
  secondary: string; // Tailwind class, e.g., 'cyan'
  gradient: string; // Full tailwind class for gradient
  button: string; // Button gradient
  sidebar: string; // Sidebar border/active color
}

export type PrintFontFamily = 'helvetica' | 'times' | 'courier';
export type PrintTextAlign = 'left' | 'center' | 'right' | 'justify';
export type SignatureBoxPosition = 'left' | 'center' | 'right';

export interface TextFormatStyle {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: PrintTextAlign;
}

export interface KopSuratStyleConfig {
  fontFamily: PrintFontFamily;
  line1: TextFormatStyle;
  line2: TextFormatStyle;
  line3: TextFormatStyle;
  line4: TextFormatStyle;
  line5: TextFormatStyle;
  line6: TextFormatStyle;
}

export interface SignatureStyleConfig {
  fontSize: number;
  align: PrintTextAlign;
  boldHeader: boolean;
  italicHeader: boolean;
  underlineHeader: boolean;
  boldName: boolean;
  italicName: boolean;
  underlineName: boolean;
  boldNip: boolean;
  italicNip: boolean;
  underlineNip: boolean;
  spacingHeight: number;
}

export interface PrintDocumentSettings {
  showKop: boolean;
  showKepsekSignature: boolean;
  showStaffSignature: boolean;
  kepsekPosition: SignatureBoxPosition;
  staffPosition: SignatureBoxPosition;
  kepsekTitle: string;
  staffUserId: string;
  staffRoleTitle: string;
  staffName: string;
  staffNip: string;
  cityLabel: string;
  documentFontFamily: PrintFontFamily;
  kopStyle: KopSuratStyleConfig;
  signatureStyle: SignatureStyleConfig;
}

export interface AppConfig {
  schoolName: string;
  appName: string;
  logoUrl: string;
  address: string;
  website: string;
  email: string;
  academicYear: string;
  academicYears?: string[];
  principalName: string;
  principalNip: string;
  theme?: ThemeName;
  webhookUrl?: string;
  webhookEnabled?: boolean;
  governmentHeader?: string;
  departmentHeader?: string;
  postalCode?: string;
  phone?: string;
  fax?: string;
  provinsiLogoUrl?: string;
  printSettings?: PrintDocumentSettings;
}

export type ActivityType = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'ADD_VIOLATION'
  | 'DELETE_VIOLATION'
  | 'ADD_STUDENT'
  | 'UPDATE_STUDENT'
  | 'DELETE_STUDENT'
  | 'BULK_IMPORT'
  | 'USER_MANAGEMENT'
  | 'EXPORT_DATA'
  | 'SETTINGS_UPDATE'
  | 'DATABASE_RESET';

export interface UserActivityLog {
  id: string;
  timestamp: string; // ISO string
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar?: string;
  action: ActivityType;
  title: string;
  details: string;
  ipAddress?: string;
  device?: string;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'indigo' | 'sky';
}
