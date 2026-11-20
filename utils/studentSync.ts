import { Student, ViolationRecord } from '../types';
import { getRecordAcademicYear, normalizeAcademicYearFormat } from './academicYear';
import { normalizePhotoUrl } from './avatarHelpers';

export interface ReconcileSummary {
  mergedDuplicatesCount: number;
  relinkedViolationsCount: number;
  syncedViolationMetaCount: number;
  recalculatedPointsCount: number;
  normalizedYearsCount: number;
  orphanViolationsCount: number;
}

export interface ReconcileResult {
  students: Student[];
  violations: ViolationRecord[];
  updatedStudents: Student[];
  updatedViolations: ViolationRecord[];
  deletedDuplicateStudentIds: string[];
  hasChanges: boolean;
  summary: ReconcileSummary;
}

const normalizeText = (value?: string): string =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeNis = (nis?: string): string => {
  const cleaned = (nis || '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '0') return '';
  return cleaned.toLowerCase();
};

const pickBestText = (primary?: string, secondary?: string): string | undefined => {
  const p = (primary || '').trim();
  if (p && p !== '-') return p;
  const s = (secondary || '').trim();
  if (s && s !== '-') return s;
  return p || s || undefined;
};

const mergeStudentRecords = (base: Student, incoming: Student, targetYear: string): Student => {
  const mergedPhoto =
    normalizePhotoUrl(base.photoUrl || base.avatar) ||
    normalizePhotoUrl(incoming.photoUrl || incoming.avatar) ||
    undefined;
  const mergedPhone = pickBestText(base.phone || base.parentPhone, incoming.phone || incoming.parentPhone);

  return {
    ...base,
    nis: pickBestText(base.nis, incoming.nis) || base.nis || incoming.nis || '-',
    nisn: pickBestText(base.nisn, incoming.nisn) || '-',
    name: (base.name || incoming.name || '').trim(),
    class: (base.class || incoming.class || '').trim(),
    absenNumber: pickBestText(base.absenNumber, incoming.absenNumber),
    birthPlace: pickBestText(base.birthPlace, incoming.birthPlace),
    birthDate: pickBestText(base.birthDate, incoming.birthDate),
    email: pickBestText(base.email, incoming.email),
    gender: base.gender || incoming.gender || 'L',
    address: pickBestText(base.address, incoming.address),
    phone: mergedPhone,
    parentPhone: pickBestText(base.parentPhone, incoming.parentPhone) || mergedPhone,
    photoUrl: mergedPhoto,
    avatar: mergedPhoto || base.avatar || incoming.avatar,
    status: pickBestText(base.status, incoming.status) || 'Aktif',
    waliKelas: pickBestText(base.waliKelas, incoming.waliKelas),
    guruBk: pickBestText(base.guruBk, incoming.guruBk),
    academicYear: targetYear,
  };
};

const studentsDiffer = (a: Student, b: Student): boolean => {
  return (
    a.nis !== b.nis ||
    a.nisn !== b.nisn ||
    a.name !== b.name ||
    a.class !== b.class ||
    (a.absenNumber || '') !== (b.absenNumber || '') ||
    (a.birthPlace || '') !== (b.birthPlace || '') ||
    (a.birthDate || '') !== (b.birthDate || '') ||
    (a.email || '') !== (b.email || '') ||
    a.gender !== b.gender ||
    (a.address || '') !== (b.address || '') ||
    (a.phone || '') !== (b.phone || '') ||
    (a.parentPhone || '') !== (b.parentPhone || '') ||
    (a.photoUrl || '') !== (b.photoUrl || '') ||
    (a.avatar || '') !== (b.avatar || '') ||
    (a.status || 'Aktif') !== (b.status || 'Aktif') ||
    (a.waliKelas || '') !== (b.waliKelas || '') ||
    (a.guruBk || '') !== (b.guruBk || '') ||
    a.totalPoints !== b.totalPoints ||
    (a.academicYear || '') !== (b.academicYear || '')
  );
};

const violationsDiffer = (a: ViolationRecord, b: ViolationRecord): boolean => {
  return (
    a.studentId !== b.studentId ||
    a.studentName !== b.studentName ||
    a.studentClass !== b.studentClass ||
    (a.academicYear || '') !== (b.academicYear || '')
  );
};

/**
 * Reconciles previously recorded students and violations so they stay 100% in sync:
 * 1. Normalizes academicYear across students and violations.
 * 2. Deduplicates duplicate student entries in the same academic year (by NIS, or Name+Class when NIS missing),
 *    preserving all non-empty biodata and remapping violation studentIds.
 * 3. Re-links orphaned/stale violation.studentId references to the matching Student (by Name+Class+Year, Name+Class, or unique Name).
 * 4. Synchronizes violation.studentName and violation.studentClass with the current Student profile.
 * 5. Recalculates every student's totalPoints accurately from all linked violations/achievements.
 */
export function reconcileStudentsAndViolations(
  rawStudents: Student[],
  rawViolations: ViolationRecord[],
  fallbackAcademicYear: string
): ReconcileResult {
  const normalizedFallbackYear = normalizeAcademicYearFormat(fallbackAcademicYear);

  // Count direct violation references per studentId so deduplication prefers IDs already linked to violations
  const violationRefCounts = new Map<string, number>();
  rawViolations.forEach((v) => {
    if (v.studentId) {
      violationRefCounts.set(v.studentId, (violationRefCounts.get(v.studentId) || 0) + 1);
    }
  });

  const originalStudentMap = new Map<string, Student>();
  rawStudents.forEach((s) => {
    originalStudentMap.set(s.id, s);
  });

  let normalizedYearsCount = 0;
  let mergedDuplicatesCount = 0;
  const idRemap = new Map<string, string>();
  const deletedDuplicateStudentIds: string[] = [];

  // Deduplicate students by (academicYear + normalized NIS) or (academicYear + normalized Name + normalized Class when NIS empty)
  const keyToCanonicalIndex = new Map<string, number>();
  const canonicalStudents: Student[] = [];

  // Sort copy slightly so students with existing violation references or richer data come first when deduplicating
  const orderedStudents = [...rawStudents].sort((a, b) => {
    const refsA = violationRefCounts.get(a.id) || 0;
    const refsB = violationRefCounts.get(b.id) || 0;
    if (refsA !== refsB) return refsB - refsA;
    const photoA = a.photoUrl || a.avatar ? 1 : 0;
    const photoB = b.photoUrl || b.avatar ? 1 : 0;
    return photoB - photoA;
  });

  orderedStudents.forEach((raw) => {
    const targetYear = getRecordAcademicYear(raw.academicYear, normalizedFallbackYear);
    if (raw.academicYear !== targetYear) {
      normalizedYearsCount += 1;
    }

    const normNis = normalizeNis(raw.nis);
    const normName = normalizeText(raw.name);
    const normClass = normalizeText(raw.class);

    const nisKey = normNis ? `nis:${targetYear}|${normNis}` : '';
    const nameClassKey = normName && normClass ? `nc:${targetYear}|${normName}|${normClass}` : '';

    let existingIdx: number | undefined;
    if (nisKey && keyToCanonicalIndex.has(nisKey)) {
      existingIdx = keyToCanonicalIndex.get(nisKey);
    } else if (!nisKey && nameClassKey && keyToCanonicalIndex.has(nameClassKey)) {
      existingIdx = keyToCanonicalIndex.get(nameClassKey);
    } else if (nameClassKey && keyToCanonicalIndex.has(nameClassKey)) {
      const candidate = canonicalStudents[keyToCanonicalIndex.get(nameClassKey)!];
      const candidateNis = normalizeNis(candidate.nis);
      if (!candidateNis || candidateNis === normNis) {
        existingIdx = keyToCanonicalIndex.get(nameClassKey);
      }
    }

    if (existingIdx !== undefined) {
      const primary = canonicalStudents[existingIdx];
      if (primary.id !== raw.id) {
        idRemap.set(raw.id, primary.id);
        deletedDuplicateStudentIds.push(raw.id);
        mergedDuplicatesCount += 1;
      }
      canonicalStudents[existingIdx] = mergeStudentRecords(primary, raw, targetYear);
      if (nisKey) keyToCanonicalIndex.set(nisKey, existingIdx);
      if (nameClassKey) keyToCanonicalIndex.set(nameClassKey, existingIdx);
    } else {
      const normalizedPhoto = normalizePhotoUrl(raw.photoUrl || raw.avatar) || undefined;
      const cleanStudent: Student = {
        ...raw,
        name: (raw.name || '').trim(),
        class: (raw.class || '').trim(),
        nis: (raw.nis || '').trim() || '-',
        nisn: (raw.nisn || '').trim() || '-',
        phone: raw.phone || raw.parentPhone || undefined,
        parentPhone: raw.parentPhone || raw.phone || undefined,
        photoUrl: normalizedPhoto,
        avatar: normalizedPhoto || raw.avatar,
        status: (raw.status || '').trim() || 'Aktif',
        academicYear: targetYear,
      };
      const newIdx = canonicalStudents.length;
      canonicalStudents.push(cleanStudent);
      if (nisKey) keyToCanonicalIndex.set(nisKey, newIdx);
      if (nameClassKey) keyToCanonicalIndex.set(nameClassKey, newIdx);
    }
  });

  // Restore original list order as much as possible using rawStudents index
  const rawOrderMap = new Map<string, number>();
  rawStudents.forEach((s, idx) => {
    if (!rawOrderMap.has(s.id)) rawOrderMap.set(s.id, idx);
  });
  canonicalStudents.sort((a, b) => (rawOrderMap.get(a.id) ?? 999999) - (rawOrderMap.get(b.id) ?? 999999));

  // Build lookup indexes over canonicalStudents
  const studentById = new Map<string, Student>();
  const byNameClassYear = new Map<string, Student[]>();
  const byNameClass = new Map<string, Student[]>();
  const byNameYear = new Map<string, Student[]>();
  const byName = new Map<string, Student[]>();

  const pushToIndex = (map: Map<string, Student[]>, key: string, stu: Student) => {
    const arr = map.get(key) || [];
    arr.push(stu);
    map.set(key, arr);
  };

  canonicalStudents.forEach((s) => {
    studentById.set(s.id, s);
    const nName = normalizeText(s.name);
    const nClass = normalizeText(s.class);
    const nYear = getRecordAcademicYear(s.academicYear, normalizedFallbackYear);
    if (nName && nClass) {
      pushToIndex(byNameClassYear, `${nName}|${nClass}|${nYear}`, s);
      pushToIndex(byNameClass, `${nName}|${nClass}`, s);
    }
    if (nName) {
      pushToIndex(byNameYear, `${nName}|${nYear}`, s);
      pushToIndex(byName, nName, s);
    }
  });

  let relinkedViolationsCount = 0;
  let syncedViolationMetaCount = 0;
  let orphanViolationsCount = 0;

  // Re-link and synchronize violations
  const reconciledViolations: ViolationRecord[] = rawViolations.map((v) => {
    const remappedId = idRemap.get(v.studentId) || v.studentId;
    let matchedStudent = studentById.get(remappedId);
    const vYear = getRecordAcademicYear(v.academicYear, normalizedFallbackYear);

    if (!matchedStudent) {
      const nName = normalizeText(v.studentName);
      const nClass = normalizeText(v.studentClass);

      const candidates =
        (nName && nClass ? byNameClassYear.get(`${nName}|${nClass}|${vYear}`) : undefined) ||
        (nName && nClass ? byNameClass.get(`${nName}|${nClass}`) : undefined) ||
        (nName && byNameYear.get(`${nName}|${vYear}`)?.length === 1
          ? byNameYear.get(`${nName}|${vYear}`)
          : undefined) ||
        (nName && byName.get(nName)?.length === 1 ? byName.get(nName) : undefined);

      if (candidates && candidates.length > 0) {
        matchedStudent = candidates[0];
      }
    }

    if (matchedStudent) {
      const targetYear = v.academicYear
        ? normalizeAcademicYearFormat(v.academicYear)
        : matchedStudent.academicYear || normalizedFallbackYear;

      const updated: ViolationRecord = {
        ...v,
        studentId: matchedStudent.id,
        studentName: matchedStudent.name,
        studentClass: matchedStudent.class,
        academicYear: targetYear,
      };

      if (updated.studentId !== v.studentId) {
        relinkedViolationsCount += 1;
      } else if (
        updated.studentName !== v.studentName ||
        updated.studentClass !== v.studentClass ||
        updated.academicYear !== v.academicYear
      ) {
        syncedViolationMetaCount += 1;
      }

      return updated;
    }

    orphanViolationsCount += 1;
    if (v.academicYear !== vYear) {
      normalizedYearsCount += 1;
      return {
        ...v,
        academicYear: vYear,
      };
    }
    return v;
  });

  // Recalculate exact totalPoints per student from reconciled violations
  const pointsByStudentId = new Map<string, number>();
  reconciledViolations.forEach((v) => {
    const pts = Number(v.points);
    if (!Number.isNaN(pts)) {
      pointsByStudentId.set(v.studentId, (pointsByStudentId.get(v.studentId) || 0) + pts);
    }
  });

  let recalculatedPointsCount = 0;
  const reconciledStudents: Student[] = canonicalStudents.map((s) => {
    const computedPoints = pointsByStudentId.get(s.id) ?? 0;
    if (s.totalPoints !== computedPoints) {
      recalculatedPointsCount += 1;
      return {
        ...s,
        totalPoints: computedPoints,
      };
    }
    return s;
  });

  const updatedStudents = reconciledStudents.filter((s) => {
    const orig = originalStudentMap.get(s.id);
    return !orig || studentsDiffer(orig, s);
  });

  const originalViolationMap = new Map<string, ViolationRecord>();
  rawViolations.forEach((v) => originalViolationMap.set(v.id, v));

  const updatedViolations = reconciledViolations.filter((v) => {
    const orig = originalViolationMap.get(v.id);
    return !orig || violationsDiffer(orig, v);
  });

  const hasChanges =
    updatedStudents.length > 0 ||
    updatedViolations.length > 0 ||
    deletedDuplicateStudentIds.length > 0;

  return {
    students: reconciledStudents,
    violations: reconciledViolations,
    updatedStudents,
    updatedViolations,
    deletedDuplicateStudentIds,
    hasChanges,
    summary: {
      mergedDuplicatesCount,
      relinkedViolationsCount,
      syncedViolationMetaCount,
      recalculatedPointsCount,
      normalizedYearsCount,
      orphanViolationsCount,
    },
  };
}

/**
 * Merges bulk-imported students (Excel / Google Sheets) into the existing student directory
 * by matching NIS or Name+Class within the target academic year, preserving existing student IDs,
 * photos, and historical violation points instead of creating duplicate rows with 0 points.
 */
export function mergeImportedStudents(
  existingStudents: Student[],
  incomingStudents: Student[],
  violations: ViolationRecord[],
  targetAcademicYear: string
): {
  result: ReconcileResult;
  insertedCount: number;
  updatedExistingCount: number;
} {
  const year = normalizeAcademicYearFormat(targetAcademicYear);
  const working = [...existingStudents];
  let insertedCount = 0;
  let updatedExistingCount = 0;

  incomingStudents.forEach((inc) => {
    const incYear = getRecordAcademicYear(inc.academicYear, year);
    const incNis = normalizeNis(inc.nis);
    const incName = normalizeText(inc.name);
    const incClass = normalizeText(inc.class);

    const existingIdx = working.findIndex((s) => {
      const sYear = getRecordAcademicYear(s.academicYear, year);
      if (sYear !== incYear) return false;
      const sNis = normalizeNis(s.nis);
      if (incNis && sNis && incNis === sNis) return true;
      return Boolean(incName && incClass && normalizeText(s.name) === incName && normalizeText(s.class) === incClass);
    });

    if (existingIdx >= 0) {
      const existing = working[existingIdx];
      working[existingIdx] = mergeStudentRecords(
        {
          ...existing,
          ...Object.fromEntries(
            Object.entries(inc).filter(([k, v]) => {
              if (k === 'id' || k === 'totalPoints') return false;
              return v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-';
            })
          ),
          id: existing.id,
          totalPoints: existing.totalPoints,
        },
        existing,
        incYear
      );
      updatedExistingCount += 1;
    } else {
      working.unshift({
        ...inc,
        academicYear: incYear,
      });
      insertedCount += 1;
    }
  });

  const result = reconcileStudentsAndViolations(working, violations, year);
  return { result, insertedCount, updatedExistingCount };
}
