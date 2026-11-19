export const DEFAULT_ACTIVE_ACADEMIC_YEAR = '2026 / 2027';

export const DEFAULT_ACADEMIC_YEARS: string[] = [
  '2025 / 2026',
  '2026 / 2027',
  '2027 / 2028',
  '2028 / 2029',
];

/**
 * Normalizes an academic year string (e.g. "2026/2027" -> "2026 / 2027").
 */
export function normalizeAcademicYearFormat(raw?: string): string {
  if (!raw) return DEFAULT_ACTIVE_ACADEMIC_YEAR;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_ACTIVE_ACADEMIC_YEAR;
  const match = trimmed.match(/^(\d{4})\s*[-/]\s*(\d{4})$/);
  if (match) {
    return `${match[1]} / ${match[2]}`;
  }
  return trimmed;
}

/**
 * Returns the academic year of a student or violation record,
 * falling back to the default year for legacy records created before multi-year support.
 */
export function getRecordAcademicYear(
  recordYear?: string,
  fallbackYear: string = DEFAULT_ACTIVE_ACADEMIC_YEAR
): string {
  if (recordYear && recordYear.trim()) {
    return normalizeAcademicYearFormat(recordYear);
  }
  return normalizeAcademicYearFormat(fallbackYear);
}

/**
 * Checks whether a record belongs to the currently selected academic year filter.
 */
export function matchesAcademicYear(
  recordYear: string | undefined,
  selectedYear: string,
  fallbackYear: string = DEFAULT_ACTIVE_ACADEMIC_YEAR
): boolean {
  if (!selectedYear || selectedYear === 'ALL') return true;
  return getRecordAcademicYear(recordYear, fallbackYear) === normalizeAcademicYearFormat(selectedYear);
}

/**
 * Deduplicates and sorts academic years chronologically (oldest -> newest).
 */
export function sortAcademicYears(years: string[]): string[] {
  const unique = Array.from(
    new Set(years.filter(Boolean).map(y => normalizeAcademicYearFormat(y)))
  );
  return unique.sort((a, b) => {
    const numA = parseInt(a.slice(0, 4), 10);
    const numB = parseInt(b.slice(0, 4), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
}

/**
 * Suggests the next academic year based on the latest configured year.
 */
export function suggestNextAcademicYear(existingYears: string[]): string {
  const sorted = sortAcademicYears(existingYears);
  const last = sorted[sorted.length - 1] || DEFAULT_ACTIVE_ACADEMIC_YEAR;
  const match = last.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (match) {
    const nextStart = parseInt(match[1], 10) + 1;
    const nextEnd = parseInt(match[2], 10) + 1;
    return `${nextStart} / ${nextEnd}`;
  }
  const currentYear = new Date().getFullYear();
  return `${currentYear} / ${currentYear + 1}`;
}

/**
 * Promotes a student's class name to the next grade level when copying to a new academic year.
 * Example: "X E 1" -> "XI F 1", "XI F 2" -> "XII F 2", "XII F 1" -> graduated.
 */
export function promoteClassName(className: string): { nextClass: string; graduated: boolean } {
  const trimmed = className.trim();
  const upper = trimmed.toUpperCase();

  // Graduating grade 12 classes
  if (/^(XII|12)\b/.test(upper)) {
    return { nextClass: trimmed, graduated: true };
  }

  // Grade XI -> XII (e.g. "XI F 1" -> "XII F 1", "XI IPA 2" -> "XII IPA 2")
  if (/^XI\b/i.test(trimmed)) {
    return { nextClass: trimmed.replace(/^XI\b/i, 'XII'), graduated: false };
  }

  // Grade X -> XI (SMA Kurikulum Merdeka: "X E 1" -> "XI F 1", generic "X ..." -> "XI ...")
  if (/^X\s+E\s+/i.test(trimmed)) {
    return { nextClass: trimmed.replace(/^X\s+E\s+/i, 'XI F '), graduated: false };
  }
  if (/^X\b/i.test(trimmed)) {
    return { nextClass: trimmed.replace(/^X\b/i, 'XI'), graduated: false };
  }

  // Numeric grades: 10 -> 11, 11 -> 12
  if (/^11\b/.test(trimmed)) {
    return { nextClass: trimmed.replace(/^11\b/, '12'), graduated: false };
  }
  if (/^10\b/.test(trimmed)) {
    return { nextClass: trimmed.replace(/^10\b/, '11'), graduated: false };
  }

  // Junior high grades: IX -> graduated, VIII -> IX, VII -> VIII
  if (/^IX\b/i.test(trimmed) || /^9\b/.test(trimmed)) {
    return { nextClass: trimmed, graduated: true };
  }
  if (/^VIII\b/i.test(trimmed)) {
    return { nextClass: trimmed.replace(/^VIII\b/i, 'IX'), graduated: false };
  }
  if (/^VII\b/i.test(trimmed)) {
    return { nextClass: trimmed.replace(/^VII\b/i, 'VIII'), graduated: false };
  }

  return { nextClass: trimmed, graduated: false };
}
