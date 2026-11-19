import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Calendar, Plus, CheckCircle2, Trash2, ArrowRight, Users, FileText, Copy, Eye, Sparkles } from 'lucide-react';
import { Student, ViolationRecord } from '../types';
import {
  getRecordAcademicYear,
  normalizeAcademicYearFormat,
  promoteClassName,
  sortAcademicYears,
  suggestNextAcademicYear,
} from '../utils/academicYear';
import ConfirmModal from './ConfirmModal';

interface AcademicYearManagerProps {
  activeAcademicYear: string;
  selectedAcademicYear: string;
  availableYears: string[];
  students: Student[];
  violations: ViolationRecord[];
  onSetActiveYear: (year: string) => Promise<void> | void;
  onAddYear: (year: string) => Promise<void> | void;
  onDeleteYear: (year: string) => Promise<void> | void;
  onSelectViewYear: (year: string) => void;
  onPromoteStudents: (newStudents: Student[], targetYear: string) => Promise<void> | void;
}

export const AcademicYearManager: React.FC<AcademicYearManagerProps> = ({
  activeAcademicYear,
  selectedAcademicYear,
  availableYears,
  students,
  violations,
  onSetActiveYear,
  onAddYear,
  onDeleteYear,
  onSelectViewYear,
  onPromoteStudents,
}) => {
  const sortedYears = useMemo(() => sortAcademicYears(availableYears), [availableYears]);
  const [newYearInput, setNewYearInput] = useState(() => suggestNextAcademicYear(availableYears));
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);

  // Student promotion / copy between years
  const [showPromotePanel, setShowPromotePanel] = useState(false);
  const [sourceYear, setSourceYear] = useState(activeAcademicYear);
  const [targetYear, setTargetYear] = useState(() => {
    const idx = sortedYears.indexOf(activeAcademicYear);
    return idx >= 0 && sortedYears[idx + 1] ? sortedYears[idx + 1] : suggestNextAcademicYear(sortedYears);
  });
  const [autoPromoteGrade, setAutoPromoteGrade] = useState(true);
  const [resetPointsOnCopy, setResetPointsOnCopy] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const yearStats = useMemo(() => {
    const map: Record<string, { studentCount: number; violationCount: number }> = {};
    sortedYears.forEach((y) => {
      map[y] = { studentCount: 0, violationCount: 0 };
    });
    students.forEach((s) => {
      const y = getRecordAcademicYear(s.academicYear);
      if (!map[y]) map[y] = { studentCount: 0, violationCount: 0 };
      map[y].studentCount += 1;
    });
    violations.forEach((v) => {
      const y = getRecordAcademicYear(v.academicYear);
      if (!map[y]) map[y] = { studentCount: 0, violationCount: 0 };
      map[y].violationCount += 1;
    });
    return map;
  }, [sortedYears, students, violations]);

  const handleAddYearSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeAcademicYearFormat(newYearInput);
    if (!normalized || normalized.length < 4) {
      toast.error('Masukkan format tahun ajaran yang valid (contoh: 2027 / 2028).');
      return;
    }
    if (sortedYears.includes(normalized)) {
      toast.info(`Tahun ajaran ${normalized} sudah terdaftar.`);
      return;
    }
    await onAddYear(normalized);
    setNewYearInput(suggestNextAcademicYear([...sortedYears, normalized]));
    setTargetYear(normalized);
  };

  const handlePromoteSubmit = async () => {
    if (!sourceYear || !targetYear) return;
    if (sourceYear === targetYear) {
      toast.error('Tahun sumber dan tahun tujuan tidak boleh sama.');
      return;
    }

    const sourceStudents = students.filter(
      (s) => getRecordAcademicYear(s.academicYear) === sourceYear
    );
    if (sourceStudents.length === 0) {
      toast.error(`Tidak ada data siswa pada tahun ajaran ${sourceYear}.`);
      return;
    }

    const existingTargetNis = new Set(
      students
        .filter((s) => getRecordAcademicYear(s.academicYear) === targetYear)
        .map((s) => s.nis)
    );

    const studentsToCreate: Student[] = [];
    let skippedGraduated = 0;
    let skippedDuplicate = 0;

    sourceStudents.forEach((s, idx) => {
      if (existingTargetNis.has(s.nis)) {
        skippedDuplicate += 1;
        return;
      }

      let nextClass = s.class;
      if (autoPromoteGrade) {
        const promoted = promoteClassName(s.class);
        if (promoted.graduated) {
          skippedGraduated += 1;
          return;
        }
        nextClass = promoted.nextClass;
      }

      studentsToCreate.push({
        ...s,
        id: `stu-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        class: nextClass,
        totalPoints: resetPointsOnCopy ? 0 : s.totalPoints,
        academicYear: targetYear,
      });
    });

    if (studentsToCreate.length === 0) {
      toast.warning(
        skippedDuplicate > 0
          ? `Semua siswa dari ${sourceYear} sudah terdaftar di ${targetYear}.`
          : `Tidak ada siswa yang disalin (${skippedGraduated} siswa kelas akhir lulus).`
      );
      return;
    }

    setIsCopying(true);
    try {
      await onPromoteStudents(studentsToCreate, targetYear);
      toast.success(
        `Berhasil menyalin ${studentsToCreate.length} siswa ke Tahun Ajaran ${targetYear}` +
          (skippedGraduated > 0 ? ` (${skippedGraduated} kelas akhir lulus)` : '') +
          (skippedDuplicate > 0 ? ` (${skippedDuplicate} sudah ada)` : '')
      );
      setShowPromotePanel(false);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-200/80 overflow-hidden">
      <div className="p-6 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-xl flex items-center gap-2 text-slate-900">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Manajemen Tahun Ajaran & Pemisahan Data
          </h4>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Kelola daftar tahun ajaran untuk periode ke depan. Setiap data siswa, catatan pelanggaran/reward, bukti foto, dan poin tersimpan terpisah berdasarkan tahun ajarannya masing-masing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPromotePanel((prev) => !prev)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Copy className="w-4 h-4" />
          {showPromotePanel ? 'Tutup Salin / Naik Kelas' : 'Salin / Naikkan Kelas Siswa'}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Add New Academic Year Form */}
        <form onSubmit={handleAddYearSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Tambah Tahun Ajaran Baru (Untuk Periode Mendatang)
            </label>
            <input
              type="text"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              placeholder="Contoh: 2029 / 2030"
              className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Tambah Tahun Ajaran
          </button>
        </form>

        {/* Optional Student Promotion / Copy Utility */}
        {showPromotePanel && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-sm text-indigo-950">Salin & Naikkan Kelas Siswa ke Tahun Ajaran Baru</h5>
                <p className="text-xs text-indigo-800/80 mt-0.5">
                  Memudahkan transisi ke tahun ajaran berikutnya tanpa menghapus data tahun sebelumnya. Data tahun lama tetap tersimpan utuh sebagai arsip.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ambil Data Siswa Dari Tahun:</label>
                <select
                  value={sourceYear}
                  onChange={(e) => setSourceYear(e.target.value)}
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800"
                >
                  {sortedYears.map((y) => (
                    <option key={y} value={y}>
                      {y} ({yearStats[y]?.studentCount || 0} siswa)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Salin Ke Tahun Ajaran Tujuan:</label>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-slate-800"
                >
                  {sortedYears.map((y) => (
                    <option key={y} value={y}>
                      {y} ({yearStats[y]?.studentCount || 0} siswa)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 text-xs text-slate-700 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={autoPromoteGrade}
                  onChange={(e) => setAutoPromoteGrade(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                Otomatis naikkan kelas (X → XI, XI → XII, kelas XII lulus tidak disalin)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={resetPointsOnCopy}
                  onChange={(e) => setResetPointsOnCopy(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                Reset total poin siswa menjadi 0 di tahun baru
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPromotePanel(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handlePromoteSubmit}
                disabled={isCopying || sourceYear === targetYear}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {isCopying ? 'Menyalin Data...' : 'Proses Salin Siswa ke Tahun Tujuan'}
              </button>
            </div>
          </div>
        )}

        {/* List of Configured Academic Years */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedYears.map((year) => {
            const isActive = year === activeAcademicYear;
            const isViewing = year === selectedAcademicYear;
            const stats = yearStats[year] || { studentCount: 0, violationCount: 0 };

            return (
              <div
                key={year}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isActive
                    ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                    : isViewing
                    ? 'bg-indigo-50/60 border-indigo-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900">{year}</span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                          <CheckCircle2 className="w-3 h-3" /> Aktif Utama
                        </span>
                      )}
                      {isViewing && !isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                          <Eye className="w-3 h-3" /> Sedang Dibuka
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 font-semibold">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        {stats.studentCount} Siswa
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        {stats.violationCount} Laporan
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200/70">
                  {!isViewing && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectViewYear(year);
                        toast.info(`Menampilkan data Tahun Ajaran ${year}`);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Lihat Data
                    </button>
                  )}

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSetActiveYear(year)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Jadikan Tahun Aktif
                    </button>
                  )}

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => setYearToDelete(year)}
                      className="p-1.5 bg-white hover:bg-rose-50 text-rose-500 border border-rose-200 rounded-lg transition cursor-pointer"
                      title="Hapus tahun ajaran dari daftar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!yearToDelete}
        onClose={() => setYearToDelete(null)}
        onConfirm={async () => {
          if (yearToDelete) {
            await onDeleteYear(yearToDelete);
            setYearToDelete(null);
          }
        }}
        title="Hapus Tahun Ajaran"
        message={
          yearToDelete ? (
            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus tahun ajaran <strong>{yearToDelete}</strong> dari daftar pilihan?
              </p>
              {(yearStats[yearToDelete]?.studentCount > 0 || yearStats[yearToDelete]?.violationCount > 0) && (
                <p className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-semibold">
                  Catatan: Terdapat {yearStats[yearToDelete]?.studentCount || 0} siswa dan{' '}
                  {yearStats[yearToDelete]?.violationCount || 0} laporan pada tahun ajaran ini. Menghapus dari daftar hanya menyembunyikan opsi, atau data masih dapat dilihat melalui filter &quot;Semua Tahun Ajaran&quot;.
                </p>
              )}
            </div>
          ) : (
            ''
          )
        }
        variant="warning"
        confirmText="Ya, Hapus dari Daftar"
      />
    </div>
  );
};

export default AcademicYearManager;
