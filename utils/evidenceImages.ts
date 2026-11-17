import { ViolationCategory } from '../types';
import JSZip from 'jszip';

export interface EvidencePreset {
  id: string;
  title: string;
  category: ViolationCategory;
  keywords: string[];
  description: string;
  url: string;
  tag: string;
}

export const EVIDENCE_PRESETS: EvidencePreset[] = [
  {
    id: 'tardiness_gate',
    title: 'Terlambat Hadir (Pintu Gerbang)',
    category: ViolationCategory.RINGAN,
    keywords: ['terlambat', 'telat', 'kesiangan', 'gerbang', 'pintu masuk', 'bel masuk'],
    description: 'Dokumentasi siswa tiba di sekolah setelah bel masuk berbunyi / gerbang tertutup.',
    url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80',
    tag: 'Keterlambatan'
  },
  {
    id: 'tardiness_clock',
    title: 'Keterlambatan (Presensi & Jam Masuk)',
    category: ViolationCategory.RINGAN,
    keywords: ['jam masuk', 'piket', 'catatan terlambat', 'waktu'],
    description: 'Catatan bukti jam kedatangan melebihi batas toleransi jam 07.00 WIB.',
    url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80',
    tag: 'Keterlambatan'
  },
  {
    id: 'uniform_tie',
    title: 'Seragam Tidak Lengkap / Rapi',
    category: ViolationCategory.RINGAN,
    keywords: ['seragam', 'atribut', 'dasi', 'bet', 'ikat pinggang', 'sabuk', 'kaos kaki', 'logo'],
    description: 'Bukti pakaian seragam tidak sesuai ketentuan hari itu (tanpa dasi/bet/sabuk).',
    url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
    tag: 'Tata Tertib Seragam'
  },
  {
    id: 'uniform_shoes',
    title: 'Sepatu Tidak Sesuai Aturan',
    category: ViolationCategory.RINGAN,
    keywords: ['sepatu', 'warna sepatu', 'kaos kaki putih', 'sepatu bebas'],
    description: 'Bukti pemakaian sepatu yang tidak sesuai standar hitam/ketentuan sekolah.',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    tag: 'Tata Tertib Seragam'
  },
  {
    id: 'hair_grooming',
    title: 'Rambut Tidak Rapi / Gondrong',
    category: ViolationCategory.RINGAN,
    keywords: ['rambut', 'gondrong', 'cukur', 'semir', 'cat rambut', 'poni'],
    description: 'Dokumentasi panjang rambut siswa melampaui ketentuan tata tertib sekolah.',
    url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    tag: 'Kerapian Diri'
  },
  {
    id: 'books_study',
    title: 'Tidak Membawa Buku / Tugas',
    category: ViolationCategory.RINGAN,
    keywords: ['buku', 'lks', 'pr', 'tugas', 'alat tulis', 'modul'],
    description: 'Meja siswa kosong tanpa perlengkapan modul belajar/buku catatan saat KBM.',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
    tag: 'Kesiapan Belajar'
  },
  {
    id: 'phone_class',
    title: 'Main HP / Gadget saat Pelajaran',
    category: ViolationCategory.SEDANG,
    keywords: ['hp', 'handphone', 'gadget', 'game', 'ponsel', 'tiktok', 'sosmed'],
    description: 'Penggunaan perangkat ponsel/game online tanpa izin guru saat proses belajar mengajar.',
    url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
    tag: 'Ketertiban Kelas'
  },
  {
    id: 'truancy_skipping',
    title: 'Bolos Pelajaran / Luar Kelas',
    category: ViolationCategory.SEDANG,
    keywords: ['bolos', 'keluar kelas', 'pagar', 'kantin', 'cabut', 'nongkrong', 'tanpa izin'],
    description: 'Terpantau berada di luar ruang kelas / kantin / sudut sekolah saat jam belajar aktif.',
    url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80',
    tag: 'Disiplin Waktu'
  },
  {
    id: 'smoking_prohibited',
    title: 'Merokok / Membawa Barang Terlarang',
    category: ViolationCategory.BERAT,
    keywords: ['rokok', 'merokok', 'vape', 'pod', 'korek', 'asap', 'tembakau'],
    description: 'Barang bukti rokok/vape yang ditemukan di lingkungan sekolah.',
    url: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80',
    tag: 'Pelanggaran Berat'
  },
  {
    id: 'fighting_conduct',
    title: 'Berkelahi / Pembinaan Disiplin Khusus',
    category: ViolationCategory.BERAT,
    keywords: ['berkelahi', 'kelahi', 'tengkar', 'pukul', 'ribut', 'tawuran', 'konflik', 'mediasi'],
    description: 'Catatan proses penanganan & mediasi di ruang Bimbingan Konseling (BK).',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    tag: 'Pelanggaran Berat'
  },
  {
    id: 'facility_damage',
    title: 'Merusak Fasilitas / Coret Meja',
    category: ViolationCategory.SEDANG,
    keywords: ['rusak', 'fasilitas', 'meja', 'kursi', 'coret', 'vandalisme', 'jendela', 'pintu'],
    description: 'Dokumentasi kerusakan sarana prasarana kelas/sekolah yang diakibatkan siswa.',
    url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=800&q=80',
    tag: 'Sarana Prasarana'
  },
  {
    id: 'sleeping_class',
    title: 'Tidur di Kelas saat Jam Pelajaran',
    category: ViolationCategory.RINGAN,
    keywords: ['tidur', 'mengantuk', 'rebahan', 'menunduk'],
    description: 'Siswa tertidur di meja kelas saat pembelajaran sedang berlangsung.',
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
    tag: 'Kesiapan Belajar'
  },
  // PRESTASI
  {
    id: 'achievement_trophy',
    title: 'Juara 1 / Trofi Kejuaraan',
    category: ViolationCategory.PRESTASI,
    keywords: ['juara 1', 'juara i', 'piala', 'trofi', 'championship', 'gold', 'emas'],
    description: 'Piala juara kehormatan turnamen/kompetisi akademik maupun non-akademik.',
    url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    tag: 'Prestasi Siswa'
  },
  {
    id: 'achievement_medal',
    title: 'Medali & Sertifikat Juara',
    category: ViolationCategory.PRESTASI,
    keywords: ['medali', 'sertifikat', 'piagam', 'olimpiade', 'lomba', 'juara 2', 'juara 3', 'provinsi', 'nasional'],
    description: 'Dokumentasi medali penghargaan dan piagam sertifikat resmi kejuaraan.',
    url: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?auto=format&fit=crop&w=800&q=80',
    tag: 'Prestasi Siswa'
  },
  {
    id: 'achievement_osis',
    title: 'Kepengurusan OSIS / MPK / Organisasi',
    category: ViolationCategory.PRESTASI,
    keywords: ['osis', 'mpk', 'ketua osis', 'pengurus', 'organisasi', 'ekskul', 'upacara', 'pemimpin'],
    description: 'Dokumentasi pelantikan dan kontribusi kepengurusan organisasi siswa.',
    url: 'https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&w=800&q=80',
    tag: 'Apresiasi Karakter'
  }
];

/**
 * Automatically find the most fitting evidence photo according to the violation text & category
 */
export function getEvidenceImageForViolation(description: string = '', category: ViolationCategory = ViolationCategory.RINGAN): string {
  const text = description.toLowerCase();

  // Match by keyword in presets
  for (const preset of EVIDENCE_PRESETS) {
    if (preset.category === category || category === ViolationCategory.RINGAN) {
      for (const kw of preset.keywords) {
        if (text.includes(kw)) {
          return preset.url;
        }
      }
    }
  }

  // General check across all keywords if category didn't restrict
  for (const preset of EVIDENCE_PRESETS) {
    for (const kw of preset.keywords) {
      if (text.includes(kw)) {
        return preset.url;
      }
    }
  }

  // Fallbacks based on category
  switch (category) {
    case ViolationCategory.PRESTASI:
      return 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80'; // Trophy
    case ViolationCategory.BERAT:
      return 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80'; // Cigarette / severe
    case ViolationCategory.SEDANG:
      return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'; // Phone / rule
    case ViolationCategory.RINGAN:
    default:
      return 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80'; // School gate
  }
}

/**
 * Downloads a single image file with automatic fallback
 */
export async function downloadImageFile(url: string, filename: string): Promise<boolean> {
  try {
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const ext = blob.type.split('/')[1] || 'jpg';
      const cleanName = filename.replace(/\.[^/.]+$/, '');
      link.download = `${cleanName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return true;
    } catch {
      // Fallback: direct anchor with target _blank
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
  } catch (err) {
    console.error('Failed to download image:', err);
    window.open(url, '_blank');
    return false;
  }
}

/**
 * Fetch image as blob for zip inclusion, with SVG fallback generator if CORS fails
 */
async function fetchImageBlob(url: string, label: string): Promise<Blob> {
  if (url.startsWith('data:image/')) {
    const parts = url.split(';base64,');
    const contentType = parts[0].replace('data:', '');
    const byteCharacters = atob(parts[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('HTTP status ' + response.status);
    return await response.blob();
  } catch {
    // If CORS prevents direct binary download, generate a high-contrast SVG badge image
    const safeLabel = label.replace(/[<>&"]/g, '');
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b" />
            <stop offset="100%" stop-color="#312e81" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#g)" />
        <rect x="40" y="40" width="720" height="520" rx="20" fill="#ffffff" fill-opacity="0.05" stroke="#6366f1" stroke-width="3" />
        <text x="400" y="240" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">BUKTI DOKUMENTASI SIPERSIS</text>
        <text x="400" y="290" font-family="sans-serif" font-size="18" fill="#a5b4fc" text-anchor="middle">${safeLabel}</text>
        <text x="400" y="340" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">URL Sumber Gambar: ${url.slice(0, 70)}...</text>
        <text x="400" y="480" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle">SiPerSis Kedisiplinan & Reward Siswa</text>
      </svg>
    `.trim();
    return new Blob([svgString], { type: 'image/svg+xml' });
  }
}

/**
 * Bundles multiple images into a ZIP archive
 */
export async function downloadMultipleImagesAsZip(
  items: { url: string; filename: string; label: string }[],
  zipFilename: string = 'semua_bukti_foto.zip',
  onProgress?: (percent: number, currentName: string) => void
): Promise<boolean> {
  const zip = new JSZip();
  const folder = zip.folder('bukti_foto_pelanggaran');

  let completed = 0;
  for (const item of items) {
    if (onProgress) {
      onProgress(Math.round((completed / items.length) * 100), item.filename);
    }
    try {
      const blob = await fetchImageBlob(item.url, item.label);
      const ext = blob.type.includes('png') ? '.png' : blob.type.includes('svg') ? '.svg' : '.jpg';
      const cleanName = item.filename.replace(/\.[^/.]+$/, '');
      folder?.file(`${cleanName}${ext}`, blob);
    } catch (e) {
      console.error('Error adding file to zip:', item.filename, e);
    }
    completed++;
  }

  if (onProgress) {
    onProgress(100, 'Mengompresi file ZIP...');
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const blobUrl = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);

  return true;
}
