import { User, UserPosition, UserRole } from '../types';

export const DEFAULT_AVATARS = {
  STUDENT_P: '/assets/aistudio/student_female_avatar_1794570398718-m4SVYcqv_972800f4.jpg',
  STUDENT_L: '/assets/aistudio/student_male_avatar_1794570399254-Bz7qmsSC_dd500b95.jpg',
  GURU_P: '/assets/aistudio/image_05c5b30c.png',
  GURU_L: '/assets/aistudio/image_75beabf3.png',
  STAFF_P: '/assets/aistudio/image_05f16c00.png', // TU & Admin Perempuan
  STAFF_L: '/assets/aistudio/image_a36e2763.png', // TU & Admin Laki-laki
} as const;

/**
 * Normalizes photo URLs including Google Drive share links into direct embeddable image URLs.
 */
export function normalizePhotoUrl(url?: string | null): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  // Convert Google Drive sharing links like:
  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID&export=view
  if (trimmed.includes('drive.google.com')) {
    const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = fileMatch?.[1] || idParamMatch?.[1];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
  }

  return trimmed;
}

export function getDefaultStudentAvatar(gender?: 'L' | 'P'): string {
  return gender === 'P' ? DEFAULT_AVATARS.STUDENT_P : DEFAULT_AVATARS.STUDENT_L;
}

export function inferUserGender(user: Pick<User, 'gender' | 'name'>): 'L' | 'P' {
  if (user.gender === 'L' || user.gender === 'P') {
    return user.gender;
  }

  const lower = (user.name || '').toLowerCase();
  const femaleKeywords = [
    'ibu ',
    'bu ',
    'dra.',
    'dra ',
    'hj.',
    'ny.',
    'siti',
    'dewi',
    'ayu',
    'palupi',
    'munawwaroh',
    'ratna',
    'putri',
    'lestari',
    'wulandari',
    'fitri',
    'indah',
    'sri ',
    'rina',
    'ani',
    'nurul',
    'nadia',
    'gita',
    'rizka',
    'etikawati',
    'sari',
    'fatimah',
    'aisyah',
  ];

  if (femaleKeywords.some((kw) => lower.includes(kw))) {
    return 'P';
  }
  return 'L';
}

export function getUserPosition(user: Pick<User, 'role' | 'position' | 'name' | 'username'>): UserPosition {
  if (user.position === 'GURU' || user.position === 'TU' || user.position === 'ADMIN') {
    return user.position;
  }
  const combined = `${user.name || ''} ${user.username || ''}`.toLowerCase();
  if (combined.includes('tata usaha') || /\btu\b/.test(combined) || combined.includes('staff')) {
    return 'TU';
  }
  return user.role === UserRole.ADMIN ? 'ADMIN' : 'GURU';
}

export function getUserPositionLabel(user: Pick<User, 'role' | 'position' | 'name' | 'username'>): string {
  const pos = getUserPosition(user);
  if (pos === 'TU') return 'TU / Staff';
  if (pos === 'ADMIN') return 'Admin';
  return 'Guru';
}

export function getDefaultUserAvatar(user: Pick<User, 'role' | 'position' | 'gender' | 'name' | 'username'>): string {
  const pos = getUserPosition(user);
  const gender = inferUserGender(user);

  if (pos === 'TU' || pos === 'ADMIN') {
    return gender === 'P' ? DEFAULT_AVATARS.STAFF_P : DEFAULT_AVATARS.STAFF_L;
  }
  return gender === 'P' ? DEFAULT_AVATARS.GURU_P : DEFAULT_AVATARS.GURU_L;
}

export function getUserAvatar(user: Pick<User, 'avatar' | 'role' | 'position' | 'gender' | 'name' | 'username'>): string {
  const normalized = normalizePhotoUrl(user.avatar);
  if (normalized) return normalized;
  return getDefaultUserAvatar(user);
}
