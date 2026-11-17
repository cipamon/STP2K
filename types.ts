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

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  nip?: string;
  avatar?: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string; // Added NISN
  name: string;
  class: string;
  gender: 'L' | 'P'; // Added Gender: L = Laki-laki, P = Perempuan
  totalPoints: number;
  photoUrl?: string;
  avatar?: string;
  parentPhone?: string;
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

export interface AppConfig {
  schoolName: string;
  appName: string;
  logoUrl: string;
  address: string;
  website: string;
  email: string;
  academicYear: string;
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
