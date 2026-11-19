import { Student, ViolationRecord } from '../types';
import { getDefaultStudentAvatar } from './avatarHelpers';
import { getRawStudentPhoto } from './studentHelpers';

export interface PdfImageAsset {
  dataUrl: string;
  format: 'JPEG';
  width: number;
  height: number;
}

const imageCache = new Map<string, Promise<PdfImageAsset | null>>();

const rasterizeImage = (img: HTMLImageElement, maxDim = 360): PdfImageAsset | null => {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) return null;

  const ratio = Math.min(1, maxDim / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * ratio));
  const h = Math.max(1, Math.round(naturalH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  try {
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.85),
      format: 'JPEG',
      width: w,
      height: h,
    };
  } catch {
    return null;
  }
};

/**
 * Loads an image URL (Data URL, local /assets path, or remote HTTPS URL) into a
 * normalized JPEG Data URL suitable for jsPDF doc.addImage(), with in-memory caching.
 */
export const loadPdfImageAsset = (url?: string | null, maxDim = 360): Promise<PdfImageAsset | null> => {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) return Promise.resolve(null);

  const cacheKey = `${maxDim}::${cleanUrl}`;
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const task = new Promise<PdfImageAsset | null>((resolve) => {
    const img = new Image();
    if (!cleanUrl.startsWith('data:') && !cleanUrl.startsWith('/')) {
      img.crossOrigin = 'Anonymous';
    }

    const timeout = window.setTimeout(() => resolve(null), 6000);

    img.onload = () => {
      window.clearTimeout(timeout);
      resolve(rasterizeImage(img, maxDim));
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };
    img.src = cleanUrl;
  });

  imageCache.set(cacheKey, task);
  return task;
};

/**
 * Loads the student's profile photo for PDF embedding, automatically falling back
 * to the local gender-matched default avatar if empty or blocked by CORS.
 */
export const loadStudentPdfPhoto = async (
  student: Pick<Student, 'photoUrl' | 'avatar' | 'gender'>
): Promise<PdfImageAsset | null> => {
  const raw = getRawStudentPhoto(student);
  if (raw) {
    const loaded = await loadPdfImageAsset(raw, 280);
    if (loaded) return loaded;
  }
  return loadPdfImageAsset(getDefaultStudentAvatar(student.gender), 280);
};

/**
 * Loads the evidence photo for a violation/reward record if attached.
 */
export const loadEvidencePdfPhoto = async (
  record: Pick<ViolationRecord, 'evidenceUrl'>
): Promise<PdfImageAsset | null> => {
  if (!record.evidenceUrl) return null;
  return loadPdfImageAsset(record.evidenceUrl, 380);
};
