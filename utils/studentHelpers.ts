import { Student } from '../types';
import { getDefaultStudentAvatar, normalizePhotoUrl } from './avatarHelpers';

export const STUDENT_STATUS_OPTIONS = ['Aktif', 'Lulus', 'Pindah', 'Non-Aktif'] as const;

export function getRawStudentPhoto(student: Pick<Student, 'photoUrl' | 'avatar'>): string {
  return normalizePhotoUrl(student.photoUrl || student.avatar);
}

export function getStudentPhoto(student: Pick<Student, 'photoUrl' | 'avatar' | 'gender'>): string {
  return getRawStudentPhoto(student) || getDefaultStudentAvatar(student.gender);
}

function cleanFieldValue(raw?: string): string {
  const val = (raw || '').trim();
  if (!val) return '';
  const lower = val.toLowerCase();
  if (val === '-' || val === '—' || val === '--' || lower === 'null' || lower === 'undefined' || lower === 'n/a') {
    return '';
  }
  return val;
}

export function getStudentPhone(student: Pick<Student, 'phone' | 'parentPhone'>): string {
  return cleanFieldValue(student.phone) || cleanFieldValue(student.parentPhone);
}

export function getStudentStatus(student: Pick<Student, 'status'>): string {
  const s = (student.status || '').trim();
  return s || 'Aktif';
}

export function normalizeStudentStatus(raw?: string): string {
  const val = (raw || '').trim().toLowerCase();
  if (!val) return 'Aktif';
  if (val.includes('aktif') && !val.includes('non')) return 'Aktif';
  if (val.includes('lulus') || val.includes('alumni')) return 'Lulus';
  if (val.includes('pindah') || val.includes('mutasi') || val.includes('keluar')) return 'Pindah';
  if (val.includes('non') || val.includes('tidak')) return 'Non-Aktif';
  return raw!.trim();
}

export function normalizeGender(raw?: string): 'L' | 'P' {
  const val = (raw || '').trim().toUpperCase();
  if (val === 'P' || val.startsWith('PEREMPUAN') || val === 'WANITA' || val === 'F' || val === 'FEMALE') {
    return 'P';
  }
  return 'L';
}

export function parseBirthDateInput(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  // Excel serial number (days since 1899-12-30)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 1000 && raw < 100000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + raw * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const str = String(raw).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Try native Date parse if ISO or month name
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return str;
}

export function formatBirthDateDisplay(birthDate?: string, shortMonth = false): string {
  const str = cleanFieldValue(birthDate);
  if (!str) return '';

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const dt = new Date(year, month, day);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: shortMonth ? 'short' : 'long',
        year: 'numeric',
      });
    }
  }

  return str;
}

export function formatBirthPlaceDate(birthPlace?: string, birthDate?: string, shortMonth = false): string {
  const place = cleanFieldValue(birthPlace);
  const dateText = formatBirthDateDisplay(birthDate, shortMonth);
  if (place && dateText) return `${place}, ${dateText}`;
  if (place) return place;
  if (dateText) return dateText;
  return '-';
}

export function getStatusBadgeClasses(status?: string): string {
  const normalized = getStudentStatus({ status }).toLowerCase();
  if (normalized === 'aktif') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (normalized === 'lulus') {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
  if (normalized === 'pindah') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function compressStudentPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const MAX_SIZE = 320;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
