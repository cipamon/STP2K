import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Student, ViolationRecord, User, UserActivityLog, AppConfig } from '../types';
import { MOCK_STUDENTS, INITIAL_VIOLATIONS, MOCK_USERS } from '../constants';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId from configuration if present
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connection test as mandated by Firebase skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or connecting...');
    } else {
      console.log('Firestore connection ready:', error);
    }
    return false;
  }
}

// Initial seed if cloud collections are empty
export async function seedInitialCloudDataIfNeeded(defaultConfig: AppConfig) {
  try {
    // Check if database was already initialized once
    const systemMetaRef = doc(db, 'system', 'metadata');
    const systemMetaSnap = await getDocFromServer(systemMetaRef).catch(() => null);

    if (systemMetaSnap && systemMetaSnap.exists() && systemMetaSnap.data()?.initialized) {
      // Database has already been initialized previously.
      // Do NOT re-seed even if collections were intentionally emptied by the user!
      return;
    }

    // 1. Check & Seed Settings
    const settingsSnap = await getDocs(collection(db, 'settings'));
    if (settingsSnap.empty) {
      await setDoc(doc(db, 'settings', 'app_config'), defaultConfig);
      console.log('Initial app_config seeded to Firestore');
    }

    // 2. Check & Seed Users
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      const batch = writeBatch(db);
      MOCK_USERS.forEach(user => {
        batch.set(doc(db, 'users', user.id), user);
      });
      await batch.commit();
      console.log('Initial users seeded to Firestore');
    }

    // 3. Check & Seed Students
    const studentsSnap = await getDocs(collection(db, 'students'));
    if (studentsSnap.empty) {
      const batch = writeBatch(db);
      MOCK_STUDENTS.forEach(student => {
        batch.set(doc(db, 'students', student.id), { ...student, academicYear: defaultConfig.academicYear });
      });
      await batch.commit();
      console.log('Initial students seeded to Firestore');
    }

    // 4. Check & Seed Violations
    const violationsSnap = await getDocs(collection(db, 'violations'));
    if (violationsSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_VIOLATIONS.forEach(violation => {
        batch.set(doc(db, 'violations', violation.id), { ...violation, academicYear: defaultConfig.academicYear });
      });
      await batch.commit();
      console.log('Initial violations seeded to Firestore');
    }

    // Mark system as initialized so empty states are respected in future sessions
    await setDoc(systemMetaRef, {
      initialized: true,
      initialSeedDate: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Error checking or seeding initial cloud data:', error);
  }
}

// Real-time subscribers
export function subscribeToSettings(onData: (config: AppConfig) => void) {
  return onSnapshot(doc(db, 'settings', 'app_config'), (snapshot) => {
    if (snapshot.exists()) {
      onData(snapshot.data() as AppConfig);
    }
  }, (error) => {
    console.warn('Error subscribing to settings:', error);
  });
}

export function subscribeToUsers(onData: (users: User[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const userList = snapshot.docs.map(d => d.data() as User);
    onData(userList);
  }, (error) => {
    console.warn('Error subscribing to users:', error);
  });
}

export function subscribeToStudents(onData: (students: Student[]) => void) {
  return onSnapshot(collection(db, 'students'), (snapshot) => {
    const studentList = snapshot.docs.map(d => d.data() as Student);
    onData(studentList);
  }, (error) => {
    console.warn('Error subscribing to students:', error);
  });
}

export function subscribeToViolations(onData: (violations: ViolationRecord[]) => void) {
  return onSnapshot(collection(db, 'violations'), (snapshot) => {
    const violationList = snapshot.docs.map(d => d.data() as ViolationRecord);
    // Sort by date descending
    violationList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onData(violationList);
  }, (error) => {
    console.warn('Error subscribing to violations:', error);
  });
}

export function subscribeToActivities(onData: (activities: UserActivityLog[]) => void) {
  const q = query(collection(db, 'activities'), orderBy('timestamp', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const activityList = snapshot.docs.map(d => d.data() as UserActivityLog);
      onData(activityList);
    }
  }, (error) => {
    // If index isn't ready or order fails, fallback to simple collection
    return onSnapshot(collection(db, 'activities'), (snap) => {
      const list = snap.docs.map(d => d.data() as UserActivityLog);
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onData(list);
    });
  });
}

function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) {
        cleaned[k] = sanitizeForFirestore(v);
      }
    });
    return cleaned as T;
  }
  return value;
}

// Data synchronization mutations
export async function saveCloudSettings(config: AppConfig) {
  const cleanConfig = sanitizeForFirestore(config);
  await setDoc(doc(db, 'settings', 'app_config'), cleanConfig);
}

export async function saveCloudStudent(student: Student) {
  const cleanStudent = Object.fromEntries(
    Object.entries(student).filter(([_, v]) => v !== undefined)
  );
  await setDoc(doc(db, 'students', student.id), cleanStudent);
}

export async function deleteCloudStudent(studentId: string) {
  await deleteDoc(doc(db, 'students', studentId));
}

export async function bulkDeleteCloudStudents(studentIds: string[]) {
  if (studentIds.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    studentIds.slice(i, i + CHUNK_SIZE).forEach(id => {
      batch.delete(doc(db, 'students', id));
    });
    await batch.commit();
  }
}

export async function clearAllCloudStudents() {
  const snap = await getDocs(collection(db, 'students'));
  if (snap.empty) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + CHUNK_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function bulkSaveCloudStudents(students: Student[]) {
  if (students.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    students.slice(i, i + CHUNK_SIZE).forEach(s => {
      const cleanStudent = Object.fromEntries(
        Object.entries(s).filter(([_, v]) => v !== undefined)
      );
      batch.set(doc(db, 'students', s.id), cleanStudent);
    });
    await batch.commit();
  }
}

export async function saveCloudViolation(violation: ViolationRecord) {
  // Save violation document
  // Note: Firestore does not accept undefined values, so clean undefined fields
  const cleanViolation = Object.fromEntries(
    Object.entries(violation).filter(([_, v]) => v !== undefined)
  );
  await setDoc(doc(db, 'violations', violation.id), cleanViolation);
}

export async function deleteCloudViolation(violationId: string) {
  await deleteDoc(doc(db, 'violations', violationId));
}

export async function bulkDeleteCloudViolations(violationIds: string[]) {
  if (violationIds.length === 0) return;
  const batch = writeBatch(db);
  violationIds.forEach(id => {
    batch.delete(doc(db, 'violations', id));
  });
  await batch.commit();
}

export async function bulkSaveCloudViolations(violations: ViolationRecord[]) {
  const batch = writeBatch(db);
  violations.forEach(v => {
    const cleanViolation = Object.fromEntries(
      Object.entries(v).filter(([_, val]) => val !== undefined)
    );
    batch.set(doc(db, 'violations', v.id), cleanViolation);
  });
  await batch.commit();
}

export async function saveCloudUser(user: User) {
  const cleanUser = Object.fromEntries(
    Object.entries(user).filter(([_, v]) => v !== undefined)
  );
  await setDoc(doc(db, 'users', user.id), cleanUser);
}

export async function bulkSaveCloudUsers(users: User[]) {
  if (users.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    users.slice(i, i + CHUNK_SIZE).forEach(u => {
      const cleanUser = Object.fromEntries(
        Object.entries(u).filter(([_, v]) => v !== undefined)
      );
      batch.set(doc(db, 'users', u.id), cleanUser);
    });
    await batch.commit();
  }
}

export async function deleteCloudUser(userId: string) {
  await deleteDoc(doc(db, 'users', userId));
}

export async function bulkDeleteCloudUsers(userIds: string[]) {
  if (userIds.length === 0) return;
  const batch = writeBatch(db);
  userIds.forEach(id => {
    batch.delete(doc(db, 'users', id));
  });
  await batch.commit();
}

export async function clearAllCloudViolations() {
  const snap = await getDocs(collection(db, 'violations'));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function saveCloudActivity(activity: UserActivityLog) {
  const cleanActivity = Object.fromEntries(
    Object.entries(activity).filter(([_, val]) => val !== undefined)
  );
  await setDoc(doc(db, 'activities', activity.id), cleanActivity);
}

export async function clearCloudActivities() {
  const snap = await getDocs(collection(db, 'activities'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

export async function resetCloudAllSampleData(defaultConfig: AppConfig) {
  // Overwrite settings
  await setDoc(doc(db, 'settings', 'app_config'), defaultConfig);

  // Clear & reset students
  const studentsSnap = await getDocs(collection(db, 'students'));
  const batch1 = writeBatch(db);
  studentsSnap.docs.forEach(d => batch1.delete(d.ref));
  MOCK_STUDENTS.forEach(s => batch1.set(doc(db, 'students', s.id), { ...s, academicYear: defaultConfig.academicYear }));
  await batch1.commit();

  // Clear & reset violations
  const violationsSnap = await getDocs(collection(db, 'violations'));
  const batch2 = writeBatch(db);
  violationsSnap.docs.forEach(d => batch2.delete(d.ref));
  INITIAL_VIOLATIONS.forEach(v => batch2.set(doc(db, 'violations', v.id), { ...v, academicYear: defaultConfig.academicYear }));
  await batch2.commit();

  // Clear & reset users
  const usersSnap = await getDocs(collection(db, 'users'));
  const batch3 = writeBatch(db);
  usersSnap.docs.forEach(d => batch3.delete(d.ref));
  MOCK_USERS.forEach(u => batch3.set(doc(db, 'users', u.id), u));
  await batch3.commit();
}
