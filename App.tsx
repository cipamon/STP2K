import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { INITIAL_VIOLATIONS, MOCK_STUDENTS, MOCK_USERS, INITIAL_VIOLATION_TYPES, THEMES, DEFAULT_APP_CONFIG, DEFAULT_LOGO_URL, DEFAULT_KOP_STYLE, DEFAULT_PRINT_SETTINGS, DEFAULT_SIGNATURE_STYLE } from './constants';
import { Student, User, UserRole, ViolationRecord, ViolationType, ThemeName, AppTheme, AppConfig, UserActivityLog, ViolationCategory, PrintDocumentSettings, PrintFontFamily, PrintTextAlign, SignatureBoxPosition } from './types';
import { INITIAL_ACTIVITIES } from './utils/activityLogger';
import ViolationForm from './components/ViolationForm';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import UserManagement from './components/UserManagement';
import ViolationTypeManagement from './components/ViolationTypeManagement';
import StudentDetailModal from './components/StudentDetailModal';
import EvidenceGallery from './components/EvidenceGallery';
import ReportCenter from './components/ReportCenter';
import { KopSurat } from './components/KopSurat';
import { KopStyleEditor } from './components/KopStyleEditor';
import AcademicYearManager from './components/AcademicYearManager';
import { resolvePrintSettings } from './utils/pdfKop';
import {
  DEFAULT_ACADEMIC_YEARS,
  getRecordAcademicYear,
  matchesAcademicYear,
  normalizeAcademicYearFormat,
  sortAcademicYears,
} from './utils/academicYear';
import { 
  testFirestoreConnection, 
  seedInitialCloudDataIfNeeded, 
  subscribeToSettings, 
  subscribeToUsers, 
  subscribeToStudents, 
  subscribeToViolations, 
  subscribeToActivities, 
  saveCloudSettings, 
  saveCloudStudent, 
  deleteCloudStudent, 
  bulkSaveCloudStudents, 
  bulkDeleteCloudStudents,
  clearAllCloudStudents,
  saveCloudViolation, 
  deleteCloudViolation, 
  bulkSaveCloudViolations, 
  bulkDeleteCloudViolations,
  clearAllCloudViolations,
  saveCloudUser, 
  bulkSaveCloudUsers,
  deleteCloudUser, 
  bulkDeleteCloudUsers,
  saveCloudActivity, 
  clearCloudActivities, 
  resetCloudAllSampleData 
} from './services/firebase';
import { getDefaultUserAvatar, getUserAvatar } from './utils/avatarHelpers';
import ConfirmModal from './components/ConfirmModal';
import { 
  sendViolationToExternalWebhook, 
  testWebhookConnection, 
  isGoogleSpreadsheetUrl, 
  getGoogleAppsScriptCode, 
  extractSpreadsheetId 
} from './utils/webhook';
import { 
  LayoutDashboard, Users, FileText, Settings, LogOut, Menu, Lock, User as UserIcon, 
  ArrowRight, Sparkles, Eye, EyeOff, CheckSquare, Palette, Globe, Save, Upload, 
  RefreshCcw, Trash2, RotateCcw, ArrowDownCircle, Images, Cloud, CloudCheck, RefreshCw, 
  Link as LinkIcon, Send, Copy, ExternalLink, HelpCircle, Check, FileSpreadsheet, AlertTriangle, X, Calendar, Printer 
} from 'lucide-react';

// Login Component
const Login: React.FC<{ onLogin: (user: User) => void; users: User[]; appConfig: AppConfig }> = ({ onLogin, users, appConfig }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  // Check for saved credentials on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('siPersis_saved_username');
    const savedPass = localStorage.getItem('siPersis_saved_password');
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem('siPersis_saved_username', username);
        localStorage.setItem('siPersis_saved_password', password);
      } else {
        localStorage.removeItem('siPersis_saved_username');
        localStorage.removeItem('siPersis_saved_password');
      }
      
      onLogin(user);
    } else {
      setError('Username atau Password salah!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden p-4">
      {/* Background Ambience - Colorful */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-300/30 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-300/30 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>

      <div className="bg-white/95 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/50 max-w-md w-full relative z-10 transform transition-all hover:scale-[1.005]">
        
        <div className="mb-8 text-center">
          <div className="inline-flex p-1.5 bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 rounded-3xl shadow-lg mb-4">
             <div className="p-2 bg-white rounded-[1.35rem]">
               <img src={appConfig.logoUrl} alt="Logo SMA Negeri 1 Kudus" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
             </div>
          </div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight uppercase mb-1">{appConfig.schoolName}</h1>
          <p className="text-slate-500 font-bold text-sm flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-500" /> {appConfig.appName} <Sparkles className="w-3 h-3 text-yellow-500" />
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
             <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">Username</label>
             <div className="relative group">
               <UserIcon className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
               <input 
                 type="text" 
                 value={username}
                 onChange={e => { setUsername(e.target.value); setError(''); }}
                 className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all outline-none font-semibold text-slate-900 placeholder:text-slate-400"
                 placeholder="Masukkan username"
                 required
               />
             </div>
          </div>
          <div>
             <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">Password</label>
             <div className="relative group">
               <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
               <input 
                 type={showPassword ? "text" : "password"}
                 value={password}
                 onChange={e => { setPassword(e.target.value); setError(''); }}
                 className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all outline-none font-semibold text-slate-900 placeholder:text-slate-400"
                 placeholder="Masukkan password"
                 required
               />
               <button
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 className="absolute right-4 top-3.5 text-slate-400 hover:text-purple-600 transition-colors focus:outline-none"
               >
                 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
               </button>
             </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-300 group-hover:border-purple-400'}`}>
                {rememberMe && <CheckSquare className="w-3.5 h-3.5 text-white" />}
              </div>
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="hidden"
              />
              <span className="text-sm font-semibold text-slate-600 group-hover:text-purple-600 transition-colors">Ingat Saya</span>
            </label>
            <a href="#" className="text-sm font-bold text-purple-600 hover:underline">Lupa Password?</a>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-1 shadow-sm">
               <span className="block w-2 h-2 bg-red-600 rounded-full shrink-0"></span> {error}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-purple-200 hover:shadow-purple-300 hover:scale-[1.02] flex items-center justify-center gap-2 group mt-2 text-base"
          >
            Masuk Aplikasi <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 rounded-full mx-auto w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Cloud className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold text-[11px]">Database Cloud Terhubung • Semua Akun Sinkron</span>
        </div>
        
        <div className="mt-6 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wide">
          <p>© {new Date().getFullYear()} {appConfig.appName} - {appConfig.schoolName}</p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // Initialize currentUser from localStorage if available
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // App Configuration State (Global Settings)
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Automatically migrate logo if old default or outdated link
        let logo = parsed.logoUrl;
        if (!logo || logo.includes('facebook') || logo.includes('instagram') || logo.includes('fbcdn') || logo.includes('1789110535581') || logo === '/logo.png') {
          logo = DEFAULT_LOGO_URL;
        }
        // Keep configured academic year unless missing or invalid placeholder
        let academicYear = parsed.academicYear;
        if (academicYear === '2026 / 2026' || !academicYear) {
          academicYear = DEFAULT_APP_CONFIG.academicYear;
        } else {
          academicYear = normalizeAcademicYearFormat(academicYear);
        }
        const academicYears = sortAcademicYears([
          ...DEFAULT_ACADEMIC_YEARS,
          ...(Array.isArray(parsed.academicYears) ? parsed.academicYears : []),
          academicYear,
        ]);
        const mergedPrintSettings: PrintDocumentSettings = {
          ...DEFAULT_PRINT_SETTINGS,
          ...(parsed.printSettings || {}),
          kopStyle: {
            fontFamily: parsed.printSettings?.kopStyle?.fontFamily || DEFAULT_KOP_STYLE.fontFamily,
            line1: { ...DEFAULT_KOP_STYLE.line1, ...(parsed.printSettings?.kopStyle?.line1 || {}) },
            line2: { ...DEFAULT_KOP_STYLE.line2, ...(parsed.printSettings?.kopStyle?.line2 || {}) },
            line3: { ...DEFAULT_KOP_STYLE.line3, ...(parsed.printSettings?.kopStyle?.line3 || {}) },
            line4: { ...DEFAULT_KOP_STYLE.line4, ...(parsed.printSettings?.kopStyle?.line4 || {}) },
            line5: { ...DEFAULT_KOP_STYLE.line5, ...(parsed.printSettings?.kopStyle?.line5 || {}) },
            line6: { ...DEFAULT_KOP_STYLE.line6, ...(parsed.printSettings?.kopStyle?.line6 || {}) },
          },
          signatureStyle: {
            ...DEFAULT_SIGNATURE_STYLE,
            ...(parsed.printSettings?.signatureStyle || {}),
          },
        };
        return {
          ...DEFAULT_APP_CONFIG,
          ...parsed,
          logoUrl: logo,
          academicYear,
          academicYears,
          printSettings: mergedPrintSettings,
        };
      } catch (e) {
        return DEFAULT_APP_CONFIG;
      }
    }
    return DEFAULT_APP_CONFIG;
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'students' | 'evidence' | 'reports' | 'settings'>('dashboard');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(() => appConfig.academicYear || DEFAULT_APP_CONFIG.academicYear);
  const hasManuallySelectedYearRef = useRef<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isResetLogoModalOpen, setIsResetLogoModalOpen] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const isSavingLogoRef = useRef<boolean>(false);
  const isEditingConfigRef = useRef<boolean>(false);
  const [violations, setViolations] = useState<ViolationRecord[]>(() => {
    const saved = localStorage.getItem('siPersis_violations');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_VIOLATIONS;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('siPersis_students');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // fallback
      }
    }
    return MOCK_STUDENTS;
  });

  // Persist students and violations to localStorage
  useEffect(() => {
    localStorage.setItem('siPersis_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('siPersis_violations', JSON.stringify(violations));
  }, [violations]);

  // User Activities State with persistence
  const [activities, setActivities] = useState<UserActivityLog[]>(() => {
    const saved = localStorage.getItem('siPersis_user_activities');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_ACTIVITIES;
  });

  useEffect(() => {
    localStorage.setItem('siPersis_user_activities', JSON.stringify(activities));
  }, [activities]);

  const logActivity = (act: Omit<UserActivityLog, 'id' | 'timestamp'>) => {
    const newLog: UserActivityLog = {
      ...act,
      userAvatar: act.userAvatar || (currentUser ? getUserAvatar(currentUser) : undefined),
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    setActivities(prev => [newLog, ...prev]);
    saveCloudActivity(newLog).catch(err => console.warn('Cloud save activity error:', err));
  };

  const handleClearActivities = () => {
    setActivities([]);
    localStorage.setItem('siPersis_user_activities', JSON.stringify([]));
    clearCloudActivities().catch(err => console.warn('Cloud clear activities error:', err));
    toast.success('Riwayat aktivitas berhasil dibersihkan di seluruh akun!');
  };

  // User Accounts State with localStorage and Cloud Firestore real-time sync
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('siPersis_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    return MOCK_USERS;
  });

  useEffect(() => {
    localStorage.setItem('siPersis_users', JSON.stringify(users));
  }, [users]);

  // Cloud Synchronization state
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [violationTypes, setViolationTypes] = useState<ViolationType[]>(INITIAL_VIOLATION_TYPES);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Theme State
  const [themeName, setThemeName] = useState<ThemeName>(() => appConfig.theme || 'striking');
  const currentTheme: AppTheme = THEMES[themeName] || THEMES.striking;

  // Student Detail Modal State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // General Settings Form State
  const [tempConfig, setTempConfig] = useState<AppConfig>(appConfig);

  // Real-time Cloud Synchronization across all devices & accounts
  useEffect(() => {
    let unsubscribeSettings: (() => void) | undefined;
    let unsubscribeStudents: (() => void) | undefined;
    let unsubscribeViolations: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeActivities: (() => void) | undefined;

    async function initCloudSync() {
      setIsSyncing(true);
      try {
        await testFirestoreConnection();
        setIsCloudConnected(true);
        // Seed initial data if Firestore collections are completely empty
        await seedInitialCloudDataIfNeeded(DEFAULT_APP_CONFIG);

        // Real-time Settings Listener (Identitas sekolah & setting sama di semua akun)
        unsubscribeSettings = subscribeToSettings((remoteConfig) => {
          if (remoteConfig && remoteConfig.schoolName) {
            const normalizedYear = normalizeAcademicYearFormat(remoteConfig.academicYear || DEFAULT_APP_CONFIG.academicYear);
            const baseRemoteYears =
              Array.isArray(remoteConfig.academicYears) && remoteConfig.academicYears.length > 0
                ? remoteConfig.academicYears
                : DEFAULT_ACADEMIC_YEARS;
            const mergedYears = sortAcademicYears([
              ...baseRemoteYears,
              normalizedYear,
            ]);
            const mergedPrintSettings: PrintDocumentSettings = {
              ...DEFAULT_PRINT_SETTINGS,
              ...(remoteConfig.printSettings || {}),
              kopStyle: {
                fontFamily: remoteConfig.printSettings?.kopStyle?.fontFamily || DEFAULT_KOP_STYLE.fontFamily,
                line1: { ...DEFAULT_KOP_STYLE.line1, ...(remoteConfig.printSettings?.kopStyle?.line1 || {}) },
                line2: { ...DEFAULT_KOP_STYLE.line2, ...(remoteConfig.printSettings?.kopStyle?.line2 || {}) },
                line3: { ...DEFAULT_KOP_STYLE.line3, ...(remoteConfig.printSettings?.kopStyle?.line3 || {}) },
                line4: { ...DEFAULT_KOP_STYLE.line4, ...(remoteConfig.printSettings?.kopStyle?.line4 || {}) },
                line5: { ...DEFAULT_KOP_STYLE.line5, ...(remoteConfig.printSettings?.kopStyle?.line5 || {}) },
                line6: { ...DEFAULT_KOP_STYLE.line6, ...(remoteConfig.printSettings?.kopStyle?.line6 || {}) },
              },
              signatureStyle: {
                ...DEFAULT_SIGNATURE_STYLE,
                ...(remoteConfig.printSettings?.signatureStyle || {}),
              },
            };
            const mergedConfig: AppConfig = {
              ...DEFAULT_APP_CONFIG,
              ...remoteConfig,
              academicYear: normalizedYear,
              academicYears: mergedYears,
              printSettings: mergedPrintSettings,
            };
            if (isSavingLogoRef.current) {
              // Avoid overwriting a logo upload that is currently being saved to Firestore
              setAppConfig(prev => ({ ...mergedConfig, logoUrl: prev.logoUrl }));
              return;
            }
            setAppConfig(mergedConfig);
            setTempConfig(prev =>
              isEditingConfigRef.current
                ? { ...prev, logoUrl: mergedConfig.logoUrl, theme: mergedConfig.theme, academicYears: mergedYears }
                : mergedConfig
            );
            if (!hasManuallySelectedYearRef.current) {
              setSelectedAcademicYear(normalizedYear);
            }
            if (mergedConfig.theme) {
              setThemeName(mergedConfig.theme);
            }
          }
        });

        // Real-time Students Listener (Semua akun melihat data siswa yang sama)
        unsubscribeStudents = subscribeToStudents((remoteStudents) => {
          if (Array.isArray(remoteStudents)) {
            setStudents(remoteStudents);
          }
        });

        // Real-time Violations Listener (Semua guru & admin melihat laporan yang sama)
        unsubscribeViolations = subscribeToViolations((remoteViolations) => {
          if (Array.isArray(remoteViolations)) {
            setViolations(remoteViolations);
          }
        });

        // Real-time Users Listener (Akun guru & admin sinkron di semua perangkat)
        unsubscribeUsers = subscribeToUsers((remoteUsers) => {
          if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
            setUsers(remoteUsers);
          }
        });

        // Real-time Activities Listener (Log aktivitas terpusat)
        unsubscribeActivities = subscribeToActivities((remoteActivities) => {
          if (remoteActivities) {
            setActivities(remoteActivities);
          }
        });
      } catch (err) {
        console.warn('Cloud synchronization connection note:', err);
      } finally {
        setIsSyncing(false);
      }
    }

    initCloudSync();

    return () => {
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeStudents) unsubscribeStudents();
      if (unsubscribeViolations) unsubscribeViolations();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeActivities) unsubscribeActivities();
    };
  }, []);

  // Effect to set initial tab based on role on load
  useEffect(() => {
    if (currentUser) {
       if (activeTab === 'dashboard' && currentUser.role === UserRole.GURU) {
          setActiveTab(currentUser.role === UserRole.GURU ? 'input' : 'dashboard');
       }
    }
  }, []);

  // Save config to local storage and sync favicon whenever appConfig changes
  useEffect(() => {
    try {
      localStorage.setItem('appConfig', JSON.stringify(appConfig));
    } catch (err) {
      console.warn('Failed to save appConfig to localStorage:', err);
    }
    const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (favicon && appConfig.logoUrl) {
      favicon.href = appConfig.logoUrl;
    }
  }, [appConfig]);

  // User Auth Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setActiveTab(user.role === UserRole.GURU ? 'input' : 'dashboard');

    logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userAvatar: getUserAvatar(user),
      action: 'LOGIN',
      title: 'Autentikasi Login Berhasil',
      details: `Pengguna masuk ke sistem SiPerSis dengan akun username "${user.username}"`,
      device: 'Browser Web'
    });
  };

  const handleLogout = () => {
    if (currentUser) {
      logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        userAvatar: currentUser.avatar,
        action: 'LOGOUT',
        title: 'Logout dari Sistem',
        details: `Pengguna "${currentUser.name}" keluar dari sesi aplikasi`,
        device: 'Browser Web'
      });
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await testFirestoreConnection();
      setIsCloudConnected(true);
      toast.success('Database Cloud terhubung & tersinkronisasi!');
    } catch (e) {
      toast.error('Gagal menyinkronkan dengan Cloud Firestore.');
    } finally {
      setIsSyncing(false);
    }
  };

  const availableAcademicYears = useMemo(() => {
    const baseYears =
      appConfig.academicYears && appConfig.academicYears.length > 0
        ? appConfig.academicYears
        : DEFAULT_ACADEMIC_YEARS;
    const fromStudents = students.map(s => getRecordAcademicYear(s.academicYear));
    const fromViolations = violations.map(v => getRecordAcademicYear(v.academicYear));
    return sortAcademicYears([
      ...baseYears,
      appConfig.academicYear,
      ...fromStudents,
      ...fromViolations,
    ]);
  }, [appConfig.academicYears, appConfig.academicYear, students, violations]);

  const effectiveInputAcademicYear =
    selectedAcademicYear === 'ALL' ? appConfig.academicYear : selectedAcademicYear;

  const scopedStudents = useMemo(
    () => students.filter(s => matchesAcademicYear(s.academicYear, selectedAcademicYear)),
    [students, selectedAcademicYear]
  );

  const scopedViolations = useMemo(
    () => violations.filter(v => matchesAcademicYear(v.academicYear, selectedAcademicYear)),
    [violations, selectedAcademicYear]
  );

  const displayConfig: AppConfig = useMemo(
    () => ({
      ...appConfig,
      academicYear:
        selectedAcademicYear === 'ALL'
          ? `Semua Tahun (${appConfig.academicYear})`
          : selectedAcademicYear,
    }),
    [appConfig, selectedAcademicYear]
  );

  const handleSelectViewingYear = (year: string) => {
    hasManuallySelectedYearRef.current = true;
    setSelectedAcademicYear(year);
    setSelectedStudent(null);
  };

  const handleSeedSampleData = async () => {
    const taggedStudents = MOCK_STUDENTS.map(s => ({ ...s, academicYear: appConfig.academicYear }));
    const taggedViolations = INITIAL_VIOLATIONS.map(v => ({ ...v, academicYear: appConfig.academicYear }));
    setStudents(taggedStudents);
    setViolations(taggedViolations);
    localStorage.setItem('siPersis_students', JSON.stringify(taggedStudents));
    localStorage.setItem('siPersis_violations', JSON.stringify(taggedViolations));
    try {
      await resetCloudAllSampleData(appConfig);
      toast.success('Data sampel dan foto bukti berhasil dimuat ulang dan disinkronkan ke seluruh akun!');
    } catch (e) {
      toast.success('Data sampel berhasil dimuat ulang secara lokal!');
    }
  };

  const addViolation = (record: ViolationRecord) => {
    const taggedRecord: ViolationRecord = {
      ...record,
      academicYear: record.academicYear || effectiveInputAcademicYear,
    };
    setViolations([taggedRecord, ...violations]);
    
    // Update student points
    const targetStudent = students.find(s => s.id === taggedRecord.studentId);
    const updatedStudent = targetStudent 
      ? { ...targetStudent, totalPoints: targetStudent.totalPoints + taggedRecord.points }
      : null;

    if (updatedStudent) {
      setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
      saveCloudStudent(updatedStudent).catch(err => console.warn('Cloud save student points error:', err));
    }

    saveCloudViolation(taggedRecord).catch(err => console.warn('Cloud save violation error:', err));
    toast.success(taggedRecord.evidenceUrl ? 'Laporan berhasil ditambahkan beserta bukti foto!' : 'Laporan berhasil ditambahkan!');

    // Dispatch to external link / webhook if configured
    if (appConfig.webhookUrl) {
      if (isGoogleSpreadsheetUrl(appConfig.webhookUrl)) {
        toast.error('Data belum terkirim ke Google Sheets: Link di Pengaturan masih link tampilan spreadsheet langsung. Pasang skrip Web App (/exec) di menu Pengaturan agar data otomatis masuk ke baris tabel.', { duration: 8000 });
      } else if (appConfig.webhookEnabled !== false) {
        sendViolationToExternalWebhook(appConfig.webhookUrl, taggedRecord).then(res => {
          if (res.success) {
            toast.info('Data berhasil disinkronkan ke tautan eksternal!');
          } else if (res.isDirectSpreadsheetUrl) {
            toast.error(res.message, { duration: 8000 });
          } else {
            toast.error(`Sinkronisasi eksternal gagal: ${res.message}`);
          }
        }).catch(err => console.warn('External webhook forward error:', err));
      }
    }

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || record.reporterName || 'Guru',
      userRole: currentUser?.role || UserRole.GURU,
      userAvatar: currentUser?.avatar,
      action: 'ADD_VIOLATION',
      title: record.category === ViolationCategory.PRESTASI ? 'Pencatatan Reward Siswa' : 'Pencatatan Pelanggaran Siswa',
      details: `Mencatat ${record.category}: "${record.description}" (${record.points > 0 ? '+' : ''}${record.points} poin) untuk siswa ${record.studentName} (${record.studentClass})`,
      device: 'Browser Web'
    });
  };

  const deleteViolation = (id: string) => {
    const recordToDelete = violations.find(v => v.id === id);
    if (recordToDelete) {
       setViolations(violations.filter(v => v.id !== id));
       // Revert points
       const targetStudent = students.find(s => s.id === recordToDelete.studentId);
       const updatedStudent = targetStudent
         ? { ...targetStudent, totalPoints: targetStudent.totalPoints - recordToDelete.points }
         : null;

       if (updatedStudent) {
         setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
         saveCloudStudent(updatedStudent).catch(err => console.warn('Cloud update student points error:', err));
       }
       deleteCloudViolation(id).catch(err => console.warn('Cloud delete violation error:', err));

       toast.success('Laporan berhasil dihapus!');

       logActivity({
         userId: currentUser?.id || 'anon',
         userName: currentUser?.name || 'Petugas',
         userRole: currentUser?.role || UserRole.ADMIN,
         userAvatar: currentUser?.avatar,
         action: 'DELETE_VIOLATION',
         title: 'Penghapusan Catatan Laporan',
         details: `Menghapus laporan ${recordToDelete.category} siswa ${recordToDelete.studentName} (${recordToDelete.description})`,
         device: 'Browser Web'
       });
    }
  };

  const handleBulkDeleteViolations = (ids: string[]) => {
    if (ids.length === 0) return;
    const recordsToDelete = violations.filter(v => ids.includes(v.id));
    if (recordsToDelete.length === 0) return;

    // Filter out deleted violations
    setViolations(prev => prev.filter(v => !ids.includes(v.id)));

    // Revert points for all affected students
    const pointDeltasByStudentId: { [studentId: string]: number } = {};
    recordsToDelete.forEach(record => {
      pointDeltasByStudentId[record.studentId] = (pointDeltasByStudentId[record.studentId] || 0) + record.points;
    });

    const touchedStudents: Student[] = [];
    const updatedStudents = students.map(student => {
      const delta = pointDeltasByStudentId[student.id];
      if (delta !== undefined) {
        const updated = { ...student, totalPoints: student.totalPoints - delta };
        touchedStudents.push(updated);
        return updated;
      }
      return student;
    });

    setStudents(updatedStudents);

    // Sync deletion and student point changes to Cloud Firestore
    bulkDeleteCloudViolations(ids).catch(err => console.warn('Cloud bulk delete violations error:', err));
    if (touchedStudents.length > 0) {
      bulkSaveCloudStudents(touchedStudents).catch(err => console.warn('Cloud bulk update touched students error:', err));
    }

    toast.success(`${recordsToDelete.length} data laporan dan bukti foto berhasil dihapus!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Petugas',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'DELETE_VIOLATION',
      title: 'Hapus Massal Bukti & Laporan',
      details: `Menghapus ${recordsToDelete.length} data laporan & foto bukti terpilih secara massal`,
      device: 'Browser Web'
    });
  };

  // Student CRUD Handlers
  const handleAddStudent = (student: Student) => {
    const taggedStudent: Student = {
      ...student,
      academicYear: student.academicYear || effectiveInputAcademicYear,
    };
    setStudents([taggedStudent, ...students]);
    saveCloudStudent(taggedStudent).catch(err => console.warn('Cloud save student error:', err));
    toast.success(`Data siswa berhasil ditambahkan ke TA ${taggedStudent.academicYear} dan disinkronkan!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'ADD_STUDENT',
      title: 'Tambah Siswa Baru',
      details: `Mendaftarkan siswa: ${taggedStudent.name} (NIS: ${taggedStudent.nis}, Kelas: ${taggedStudent.class}, TA: ${taggedStudent.academicYear})`,
      device: 'Browser Web'
    });
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    const taggedStudent: Student = {
      ...updatedStudent,
      academicYear: updatedStudent.academicYear || effectiveInputAcademicYear,
    };
    setStudents(students.map(s => s.id === taggedStudent.id ? taggedStudent : s));
    saveCloudStudent(taggedStudent).catch(err => console.warn('Cloud update student error:', err));
    toast.success('Data siswa berhasil diperbarui!');

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'UPDATE_STUDENT',
      title: 'Pembaruan Data Siswa',
      details: `Memperbarui biodata siswa: ${taggedStudent.name} (Kelas: ${taggedStudent.class})`,
      device: 'Browser Web'
    });
  };

  const handleDeleteStudent = (id: string) => {
    const target = students.find(s => s.id === id);
    setStudents(students.filter(s => s.id !== id));
    deleteCloudStudent(id).catch(err => console.warn('Cloud delete student error:', err));
    toast.success('Data siswa berhasil dihapus!');

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'DELETE_STUDENT',
      title: 'Penghapusan Data Siswa',
      details: `Menghapus data siswa: ${target ? target.name : id}`,
      device: 'Browser Web'
    });
  };

  const handleBulkUploadStudents = (newStudents: Student[]) => {
    const taggedStudents = newStudents.map(s => ({
      ...s,
      academicYear: s.academicYear || effectiveInputAcademicYear,
    }));
    setStudents([...taggedStudents, ...students]);
    bulkSaveCloudStudents(taggedStudents).catch(err => console.warn('Cloud bulk save students error:', err));
    toast.success(`${taggedStudents.length} data siswa berhasil diimpor ke TA ${effectiveInputAcademicYear} & disinkronkan!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'BULK_IMPORT',
      title: 'Impor Massal Siswa via Excel',
      details: `Berhasil mengimpor ${taggedStudents.length} record data siswa baru untuk TA ${effectiveInputAcademicYear}`,
      device: 'Browser Web'
    });
  };

  const handleBulkUploadViolations = (newViolations: ViolationRecord[]) => {
    const taggedViolations = newViolations.map(v => ({
      ...v,
      academicYear: v.academicYear || effectiveInputAcademicYear,
    }));
    setViolations([...taggedViolations, ...violations]);
    
    // Update student points for each violation
    const updatedStudents = [...students];
    const touchedStudents: Student[] = [];
    taggedViolations.forEach(record => {
      const studentIndex = updatedStudents.findIndex(s => s.id === record.studentId);
      if (studentIndex > -1) {
        updatedStudents[studentIndex] = {
          ...updatedStudents[studentIndex],
          totalPoints: updatedStudents[studentIndex].totalPoints + record.points
        };
        touchedStudents.push(updatedStudents[studentIndex]);
      }
    });
    setStudents(updatedStudents);

    bulkSaveCloudViolations(taggedViolations).catch(err => console.warn('Cloud bulk save violations error:', err));
    if (touchedStudents.length > 0) {
      bulkSaveCloudStudents(touchedStudents).catch(err => console.warn('Cloud bulk update touched students error:', err));
    }
    
    toast.success(`${taggedViolations.length} data laporan berhasil diimpor ke TA ${effectiveInputAcademicYear} & disinkronkan!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'BULK_IMPORT',
      title: 'Impor Massal Laporan via Excel',
      details: `Berhasil mengimpor ${newViolations.length} catatan pelanggaran & reward siswa`,
      device: 'Browser Web'
    });
  };

  const handleBulkDeleteStudents = (ids: string[]) => {
    if (ids.length === 0) return;
    setStudents(prev => prev.filter(s => !ids.includes(s.id)));
    bulkDeleteCloudStudents(ids).catch(err => console.warn('Cloud bulk delete students error:', err));
    toast.success(`${ids.length} data siswa berhasil dihapus!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'DELETE_STUDENT',
      title: 'Hapus Siswa Terpilih',
      details: `Menghapus ${ids.length} data siswa secara massal`,
      device: 'Browser Web'
    });
  };

  const handleDeleteStudentsByClass = (className: string) => {
    const targetStudents = students.filter(
      s => s.class === className && matchesAcademicYear(s.academicYear, selectedAcademicYear)
    );
    if (targetStudents.length === 0) return;
    const targetIds = targetStudents.map(s => s.id);
    setStudents(prev => prev.filter(s => !targetIds.includes(s.id)));
    bulkDeleteCloudStudents(targetIds).catch(err => console.warn('Cloud delete students by class error:', err));
    toast.success(`${targetStudents.length} siswa kelas ${className} berhasil dihapus!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'DELETE_STUDENT',
      title: `Hapus Siswa Kelas ${className}`,
      details: `Menghapus ${targetStudents.length} siswa rombel kelas ${className} (${selectedAcademicYear})`,
      device: 'Browser Web'
    });
  };

  const handleDeleteAllStudents = () => {
    if (selectedAcademicYear === 'ALL') {
      const count = students.length;
      setStudents([]);
      localStorage.setItem('siPersis_students', JSON.stringify([]));
      clearAllCloudStudents().catch(err => console.warn('Cloud clear students error:', err));
      toast.success(`Seluruh data siswa (${count} siswa) telah berhasil dihapus!`);

      logActivity({
        userId: currentUser?.id || 'anon',
        userName: currentUser?.name || 'Admin',
        userRole: currentUser?.role || UserRole.ADMIN,
        userAvatar: currentUser?.avatar,
        action: 'DELETE_STUDENT',
        title: 'Hapus Semua Data Siswa',
        details: `Mengosongkan seluruh direktori siswa (${count} siswa)`,
        device: 'Browser Web'
      });
      return;
    }

    const targetIds = scopedStudents.map(s => s.id);
    const count = targetIds.length;
    if (count === 0) return;
    setStudents(prev => prev.filter(s => !targetIds.includes(s.id)));
    bulkDeleteCloudStudents(targetIds).catch(err => console.warn('Cloud clear year students error:', err));
    toast.success(`${count} siswa pada Tahun Ajaran ${selectedAcademicYear} berhasil dihapus!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'DELETE_STUDENT',
      title: `Hapus Siswa TA ${selectedAcademicYear}`,
      details: `Mengosongkan direktori siswa Tahun Ajaran ${selectedAcademicYear} (${count} siswa)`,
      device: 'Browser Web'
    });
  };

  // Reset All Data
  const handleResetData = () => {
    setStudents([]);
    setViolations([]);
    localStorage.setItem('siPersis_students', JSON.stringify([]));
    localStorage.setItem('siPersis_violations', JSON.stringify([]));
    clearAllCloudStudents().catch(err => console.warn('Cloud clear students error:', err));
    clearAllCloudViolations().catch(err => console.warn('Cloud clear violations error:', err));
    toast.success("Seluruh data siswa dan laporan telah berhasil dikosongkan!");

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'DATABASE_RESET',
      title: 'Reset Total Database Siswa & Laporan',
      details: 'Mengosongkan seluruh basis data siswa dan riwayat pelanggaran di lokal dan cloud',
      device: 'Browser Web'
    });
  };

  // Bulk Delete Users
  const handleBulkDeleteUsers = (ids: string[]) => {
    if (ids.length === 0) return;
    const safeIds = ids.filter(id => id !== currentUser?.id);
    if (safeIds.length === 0) {
      toast.error('Tidak dapat menghapus akun Anda sendiri.');
      return;
    }
    setUsers(prev => prev.filter(u => !safeIds.includes(u.id)));
    bulkDeleteCloudUsers(safeIds).catch(err => console.warn('Cloud bulk delete users error:', err));
    toast.success(`${safeIds.length} pengguna berhasil dihapus!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'USER_MANAGEMENT',
      title: 'Hapus Pengguna Terpilih',
      details: `Menghapus ${safeIds.length} akun pengguna dari sistem`,
      device: 'Browser Web'
    });
  };

  // User CRUD Handlers
  const handleAddUser = (user: User) => {
    setUsers([...users, user]);
    saveCloudUser(user).catch(err => console.warn('Cloud save user error:', err));
    toast.success('Pengguna baru berhasil ditambahkan dan disinkronkan!');

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'USER_MANAGEMENT',
      title: 'Penambahan Akun Pengguna / Guru',
      details: `Mendaftarkan akun baru: ${user.name} (@${user.username}) sebagai ${user.role}`,
      device: 'Browser Web'
    });
  };

  const handleBulkAddUsers = (newUsers: User[]) => {
    if (newUsers.length === 0) return;
    setUsers(prev => [...prev, ...newUsers]);
    bulkSaveCloudUsers(newUsers).catch(err => console.warn('Cloud bulk save users error:', err));
    toast.success(`${newUsers.length} pengguna baru berhasil diimpor dan disinkronkan!`);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser ? getUserAvatar(currentUser) : undefined,
      action: 'USER_MANAGEMENT',
      title: 'Impor Massal Pengguna via Excel',
      details: `Berhasil mengimpor ${newUsers.length} akun pengguna/guru/TU/admin`,
      device: 'Browser Web'
    });
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser && updatedUser.id === currentUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
    saveCloudUser(updatedUser).catch(err => console.warn('Cloud update user error:', err));
    toast.success('Data pengguna berhasil diperbarui!');

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'USER_MANAGEMENT',
      title: 'Pembaruan Akun Pengguna',
      details: `Memperbarui info user: ${updatedUser.name} (@${updatedUser.username})`,
      device: 'Browser Web'
    });
  };

  const handleDeleteUser = (userId: string) => {
    if (users.length <= 1) {
      toast.error("Tidak bisa menghapus user terakhir.");
      return;
    }
    const target = users.find(u => u.id === userId);
    setUsers(users.filter(u => u.id !== userId));
    deleteCloudUser(userId).catch(err => console.warn('Cloud delete user error:', err));
    toast.success('Pengguna berhasil dihapus!');

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'USER_MANAGEMENT',
      title: 'Penghapusan Akun Pengguna',
      details: `Menghapus akun user: ${target ? target.name : userId}`,
      device: 'Browser Web'
    });
  };

  // Violation Type CRUD
  const handleAddViolationType = (type: ViolationType) => {
    setViolationTypes([...violationTypes, type]);
    toast.success('Jenis pelanggaran/reward berhasil ditambahkan!');
  };

  const handleBulkAddViolationTypes = (newTypes: ViolationType[]) => {
    if (newTypes.length === 0) return;
    setViolationTypes(prev => [...prev, ...newTypes]);
    toast.success(`${newTypes.length} jenis pelanggaran/reward berhasil diimpor!`);
  };

  const handleUpdateViolationType = (updatedType: ViolationType) => {
    setViolationTypes(violationTypes.map(t => t.id === updatedType.id ? updatedType : t));
    toast.success('Data jenis pelanggaran/reward berhasil diperbarui!');
  };
  
  const handleDeleteViolationType = (id: string) => {
     setViolationTypes(violationTypes.filter(t => t.id !== id));
     toast.success('Jenis pelanggaran/reward berhasil dihapus!');
  }

  // Handle Theme Selection & Synchronization
  const handleSelectTheme = (tName: ThemeName) => {
    setThemeName(tName);
    const updated = { ...appConfig, theme: tName };
    setAppConfig(updated);
    setTempConfig(updated);
    saveCloudSettings(updated).catch(err => console.warn('Cloud theme save error:', err));
    toast.success(`Tema ${THEMES[tName].label} diterapkan dan disinkronkan ke seluruh akun!`);
  };

  // Handle Academic Year Management Actions
  const handleAddAcademicYear = async (newYear: string) => {
    const normalized = normalizeAcademicYearFormat(newYear);
    const updatedYears = sortAcademicYears([...availableAcademicYears, normalized]);
    const updatedConfig: AppConfig = {
      ...appConfig,
      academicYears: updatedYears,
      theme: themeName,
    };
    setAppConfig(updatedConfig);
    setTempConfig(prev => ({ ...prev, academicYears: updatedYears }));
    try {
      await saveCloudSettings(updatedConfig);
      toast.success(`Tahun ajaran ${normalized} berhasil ditambahkan & disinkronkan!`);
    } catch (err) {
      console.error('Failed to add academic year:', err);
      toast.error('Tahun ajaran ditambahkan lokal, namun gagal sinkron ke Cloud Firestore.');
    }

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'SETTINGS_UPDATE',
      title: 'Tambah Tahun Ajaran Baru',
      details: `Menambahkan tahun ajaran "${normalized}" ke dalam daftar sistem`,
      device: 'Browser Web'
    });
  };

  const handleSetActiveAcademicYear = async (year: string) => {
    const normalized = normalizeAcademicYearFormat(year);
    const updatedYears = sortAcademicYears([...availableAcademicYears, normalized]);
    const updatedConfig: AppConfig = {
      ...appConfig,
      academicYear: normalized,
      academicYears: updatedYears,
      theme: themeName,
    };
    setAppConfig(updatedConfig);
    setTempConfig(prev => ({ ...prev, academicYear: normalized, academicYears: updatedYears }));
    hasManuallySelectedYearRef.current = true;
    setSelectedAcademicYear(normalized);
    try {
      await saveCloudSettings(updatedConfig);
      toast.success(`Tahun ajaran aktif diubah ke ${normalized} dan disinkronkan ke seluruh akun!`);
    } catch (err) {
      console.error('Failed to set active academic year:', err);
      toast.error('Tahun ajaran aktif diperbarui lokal, namun gagal sinkron ke Cloud Firestore.');
    }

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'SETTINGS_UPDATE',
      title: 'Penggantian Tahun Ajaran Aktif',
      details: `Mengubah tahun ajaran aktif utama sekolah menjadi ${normalized}`,
      device: 'Browser Web'
    });
  };

  const handleDeleteAcademicYear = async (year: string) => {
    if (year === appConfig.academicYear) {
      toast.error('Tidak dapat menghapus tahun ajaran yang sedang aktif.');
      return;
    }
    const updatedYears = sortAcademicYears(
      (appConfig.academicYears || availableAcademicYears).filter(y => y !== year)
    );
    const updatedConfig: AppConfig = {
      ...appConfig,
      academicYears: updatedYears,
      theme: themeName,
    };
    setAppConfig(updatedConfig);
    setTempConfig(prev => ({ ...prev, academicYears: updatedYears }));
    if (selectedAcademicYear === year) {
      setSelectedAcademicYear(appConfig.academicYear);
    }
    try {
      await saveCloudSettings(updatedConfig);
      toast.success(`Tahun ajaran ${year} dihapus dari daftar.`);
    } catch (err) {
      console.error('Failed to delete academic year:', err);
      toast.error('Gagal menyinkronkan penghapusan tahun ajaran ke Cloud Firestore.');
    }
  };

  const handlePromoteStudentsToYear = async (newStudents: Student[], targetYear: string) => {
    setStudents(prev => [...newStudents, ...prev]);
    try {
      await bulkSaveCloudStudents(newStudents);
    } catch (err) {
      console.warn('Cloud promote students error:', err);
    }
    hasManuallySelectedYearRef.current = true;
    setSelectedAcademicYear(targetYear);

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'BULK_IMPORT',
      title: `Salin / Naik Kelas Siswa ke TA ${targetYear}`,
      details: `Menyalin ${newStudents.length} siswa ke Tahun Ajaran ${targetYear}`,
      device: 'Browser Web'
    });
  };

  const handleSavePrintSettings = async (newPrintSettings: PrintDocumentSettings) => {
    const updatedConfig: AppConfig = {
      ...appConfig,
      printSettings: newPrintSettings,
      theme: themeName,
    };
    setAppConfig(updatedConfig);
    setTempConfig((prev) => ({ ...prev, printSettings: newPrintSettings }));
    try {
      localStorage.setItem('appConfig', JSON.stringify(updatedConfig));
    } catch {
      // ignore storage quota warning
    }
    try {
      await saveCloudSettings(updatedConfig);
      toast.success('Pengaturan default Kop & TTD berhasil disimpan dan disinkronkan!');
    } catch (err) {
      console.error('Failed to save print settings to Cloud Firestore:', err);
      toast.error('Pengaturan default tersimpan lokal, namun gagal sinkron ke Cloud Firestore.');
    }
  };

  // Handle General Settings Save & Synchronization
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedYear = normalizeAcademicYearFormat(tempConfig.academicYear);
    const updatedYears = sortAcademicYears([
      ...availableAcademicYears,
      normalizedYear,
    ]);
    const configToSave: AppConfig = {
      ...tempConfig,
      academicYear: normalizedYear,
      academicYears: updatedYears,
      theme: themeName,
    };
    isEditingConfigRef.current = false;
    setAppConfig(configToSave);
    setTempConfig(configToSave);
    if (!hasManuallySelectedYearRef.current) {
      setSelectedAcademicYear(normalizedYear);
    }
    try {
      localStorage.setItem('appConfig', JSON.stringify(configToSave));
    } catch {
      // ignore storage quota warning
    }
    try {
      await saveCloudSettings(configToSave);
      toast.success("Pengaturan sekolah berhasil disimpan dan disinkronkan ke seluruh akun!");
    } catch (err) {
      console.error('Failed to save settings to Cloud Firestore:', err);
      toast.error("Pengaturan tersimpan di perangkat ini, namun gagal sinkron ke Cloud Firestore.");
    }

    logActivity({
      userId: currentUser?.id || 'anon',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || UserRole.ADMIN,
      userAvatar: currentUser?.avatar,
      action: 'SETTINGS_UPDATE',
      title: 'Pembaruan Konfigurasi Sistem',
      details: `Menyimpan perubahan identitas sekolah: ${configToSave.schoolName} (${configToSave.academicYear})`,
      device: 'Browser Web'
    });
  };

  // Resize and compress uploaded logo so it safely fits Firestore 1MB limit while staying crisp
  const compressLogoImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak valid atau file rusak.'));
        img.onload = () => {
          const MAX_DATA_URL_LENGTH = 450000; // ~330KB binary, safe for Firestore 1MB doc limit
          const renderAtSize = (maxDim: number, mime: string, quality?: number): string => {
            const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
            const width = Math.max(1, Math.round((img.width || maxDim) * scale));
            const height = Math.max(1, Math.round((img.height || maxDim) * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reader.result as string;
            if (mime === 'image/jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL(mime, quality);
          };

          // 1. Try 400px PNG (preserves transparency & matches jsPDF PNG)
          let result = renderAtSize(400, 'image/png');
          if (result.length <= MAX_DATA_URL_LENGTH) return resolve(result);

          // 2. Try 280px PNG
          result = renderAtSize(280, 'image/png');
          if (result.length <= MAX_DATA_URL_LENGTH) return resolve(result);

          // 3. Try 320px WebP (preserves transparency with much smaller payload)
          const webpResult = renderAtSize(320, 'image/webp', 0.85);
          if (webpResult.startsWith('data:image/webp') && webpResult.length <= MAX_DATA_URL_LENGTH) {
            return resolve(webpResult);
          }

          // 4. Fallback to 320px JPEG
          result = renderAtSize(320, 'image/jpeg', 0.82);
          if (result.length <= MAX_DATA_URL_LENGTH) return resolve(result);

          result = renderAtSize(240, 'image/jpeg', 0.7);
          resolve(result);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("File harus berupa gambar (PNG, JPG, WEBP, atau SVG).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar. Maksimal 10MB.");
      return;
    }

    setIsUploadingLogo(true);
    isSavingLogoRef.current = true;
    try {
      const compressedLogoUrl = await compressLogoImage(file);
      const updatedConfig: AppConfig = {
        ...appConfig,
        ...tempConfig,
        logoUrl: compressedLogoUrl,
        theme: themeName,
      };

      setTempConfig(updatedConfig);
      setAppConfig(updatedConfig);
      try {
        localStorage.setItem('appConfig', JSON.stringify(updatedConfig));
      } catch {
        // ignore storage quota warning
      }

      await saveCloudSettings(updatedConfig);
      toast.success("Logo sekolah berhasil diunggah dan langsung tersimpan ke Cloud!");

      logActivity({
        userId: currentUser?.id || 'anon',
        userName: currentUser?.name || 'Admin',
        userRole: currentUser?.role || UserRole.ADMIN,
        userAvatar: currentUser?.avatar,
        action: 'SETTINGS_UPDATE',
        title: 'Pembaruan Logo Sekolah',
        details: `Mengunggah logo sekolah baru untuk ${updatedConfig.schoolName}`,
        device: 'Browser Web'
      });
    } catch (err) {
      console.error('Logo upload/sync error:', err);
      toast.error("Logo gagal disinkronkan ke Cloud Firestore. Periksa koneksi atau format gambar.");
    } finally {
      isSavingLogoRef.current = false;
      setIsUploadingLogo(false);
    }
  };

  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);

  const handleCopyScript = () => {
    const sheetId = extractSpreadsheetId(tempConfig.webhookUrl || '') || undefined;
    const scriptCode = getGoogleAppsScriptCode(sheetId);
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    toast.success('Kode Google Apps Script berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedScript(false), 4000);
  };

  const handleTestWebhook = async () => {
    if (!tempConfig.webhookUrl || !tempConfig.webhookUrl.trim()) {
      toast.error('Masukkan URL tautan/webhook terlebih dahulu.');
      return;
    }
    if (isGoogleSpreadsheetUrl(tempConfig.webhookUrl)) {
      toast.error(
        'Tautan yang Anda masukkan adalah link Google Spreadsheet langsung. Server Google Spreadsheet menolak input langsung (Error 405). Silakan ikuti panduan di bawah untuk menyalin kode Apps Script Web App (/exec).',
        { duration: 8000 }
      );
      return;
    }
    setIsTestingWebhook(true);
    const toastId = toast.loading('Mengirim data sampel ke link...');
    try {
      const result = await testWebhookConnection(tempConfig.webhookUrl);
      toast.dismiss(toastId);
      if (result.success) {
        toast.success('Uji pengiriman berhasil! Link tujuan siap menerima data inputan.');
      } else if (result.isDirectSpreadsheetUrl) {
        toast.error(result.message, { duration: 8000 });
      } else {
        toast.error(`Uji pengiriman gagal: ${result.message}`);
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Terjadi kesalahan saat menguji tautan.');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleResetLogo = () => {
    setIsResetLogoModalOpen(true);
  };

  const executeResetLogo = async () => {
    isSavingLogoRef.current = true;
    const updatedConfig: AppConfig = {
      ...appConfig,
      ...tempConfig,
      logoUrl: DEFAULT_LOGO_URL,
      theme: themeName,
    };
    setTempConfig(updatedConfig);
    setAppConfig(updatedConfig);
    try {
      localStorage.setItem('appConfig', JSON.stringify(updatedConfig));
    } catch {
      // ignore
    }
    try {
      await saveCloudSettings(updatedConfig);
      toast.success("Logo dikembalikan ke default dan disinkronkan ke Cloud!");
    } catch (err) {
      console.error('Reset logo sync error:', err);
      toast.error("Logo dikembalikan secara lokal, namun gagal sinkron ke Cloud Firestore.");
    } finally {
      isSavingLogoRef.current = false;
    }
  };

  // View Student Logic
  const handleViewStudent = (student: Student) => {
    setSelectedStudent(student);
  };

  if (!currentUser) return <Login onLogin={handleLogin} users={users} appConfig={appConfig} />;

  return (
    <div className={`min-h-screen bg-slate-100 flex flex-col md:flex-row print:bg-white font-sans text-slate-800 print:h-auto print:overflow-visible`}>
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm z-20 sticky top-0 print:hidden border-b border-indigo-100">
         <div className="flex items-center gap-3 font-bold text-slate-800">
            <div className="w-9 h-9 p-1 bg-white rounded-xl border border-indigo-100 shadow-sm flex items-center justify-center">
               <img src={appConfig.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className={`text-sm bg-gradient-to-r ${currentTheme.gradient} bg-clip-text text-transparent font-black`}>{appConfig.schoolName}</span>
         </div>
         <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 text-${currentTheme.primary}-600 bg-${currentTheme.primary}-50 rounded-lg`}>
            <Menu className="w-6 h-6" />
         </button>
      </div>

      {/* Sidebar / Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        ${currentTheme.sidebar}
        print:hidden
      `}>
        <div className={`p-6 border-b border-${currentTheme.primary}-50 flex flex-col items-center text-center gap-3 bg-gradient-to-b from-${currentTheme.primary}-50/50 to-white`}>
          <div className={`p-1 bg-gradient-to-tr ${currentTheme.gradient} rounded-2xl shadow-md`}>
            <div className="p-1.5 bg-white rounded-[0.9rem]">
               <img src={appConfig.logoUrl} alt="Logo" className="w-14 h-14 object-contain" referrerPolicy="no-referrer" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-lg tracking-tight block leading-tight mb-1">{appConfig.schoolName}</span>
            <span className={`text-[10px] text-white font-bold uppercase tracking-wider bg-gradient-to-r ${currentTheme.gradient} px-3 py-1 rounded-full shadow-sm`}>{appConfig.appName}</span>
          </div>
        </div>
        
        <div className={`p-6 flex items-center gap-4 border-b border-${currentTheme.primary}-50 mx-2`}>
          <img
            src={getUserAvatar(currentUser)}
            alt={currentUser.name}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const fb = getDefaultUserAvatar(currentUser);
              if (!e.currentTarget.src.endsWith(fb)) {
                e.currentTarget.src = fb;
              }
            }}
            className={`w-12 h-12 rounded-full object-cover border-2 border-${currentTheme.primary}-100 shadow-sm bg-white`}
          />
          <div className="overflow-hidden">
             <p className="text-sm font-bold truncate text-slate-900">{currentUser.name}</p>
             <p className={`text-[10px] text-${currentTheme.primary}-500 font-bold uppercase bg-${currentTheme.primary}-50 inline-block px-2 py-0.5 rounded mt-1`}>{currentUser.role}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Menu Items with Colorful Active State */}
          <button 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 
              ${activeTab === 'dashboard' 
                ? `bg-gradient-to-r ${currentTheme.gradient} text-white shadow-md` 
                : `text-slate-500 hover:bg-${currentTheme.primary}-50 hover:text-${currentTheme.primary}-600`}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>

          <button 
            onClick={() => { setActiveTab('input'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 
              ${activeTab === 'input' 
                ? `bg-gradient-to-r ${currentTheme.gradient} text-white shadow-md` 
                : `text-slate-500 hover:bg-${currentTheme.primary}-50 hover:text-${currentTheme.primary}-600`}`}
          >
            <FileText className="w-5 h-5" /> Input Laporan
          </button>
          
          <button 
            onClick={() => { setActiveTab('students'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 
              ${activeTab === 'students' 
                ? `bg-gradient-to-r ${currentTheme.gradient} text-white shadow-md` 
                : `text-slate-500 hover:bg-${currentTheme.primary}-50 hover:text-${currentTheme.primary}-600`}`}
          >
            <Users className="w-5 h-5" /> Data Siswa
          </button>

          <button 
            onClick={() => { setActiveTab('evidence'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 
              ${activeTab === 'evidence' 
                ? `bg-gradient-to-r ${currentTheme.gradient} text-white shadow-md` 
                : `text-slate-500 hover:bg-${currentTheme.primary}-50 hover:text-${currentTheme.primary}-600`}`}
          >
            <div className="flex items-center gap-3">
              <Images className="w-5 h-5" /> Unduh Bukti Foto
            </div>
            {scopedViolations.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === 'evidence' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {scopedViolations.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 
              ${activeTab === 'reports' 
                ? `bg-gradient-to-r ${currentTheme.gradient} text-white shadow-md` 
                : `text-slate-500 hover:bg-${currentTheme.primary}-50 hover:text-${currentTheme.primary}-600`}`}
          >
            <div className="flex items-center gap-3">
              <Printer className="w-5 h-5" /> Cetak Laporan
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide ${
              activeTab === 'reports' ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'
            }`}>
              + Foto
            </span>
          </button>

          {currentUser.role === UserRole.ADMIN && (
             <button 
               onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
               className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 
                 ${activeTab === 'settings' 
                   ? `bg-gradient-to-r ${currentTheme.gradient} text-white shadow-md` 
                   : `text-slate-500 hover:bg-${currentTheme.primary}-50 hover:text-${currentTheme.primary}-600`}`}
             >
               <Settings className="w-5 h-5" /> Pengaturan
             </button>
          )}

          {/* Mobile / Sidebar Academic Year Switcher */}
          <div className="mt-6 pt-4 border-t border-slate-100 px-3 md:hidden">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
               <Calendar className="w-3 h-3" /> Filter Tahun Ajaran
             </label>
             <select
               value={selectedAcademicYear}
               onChange={(e) => handleSelectViewingYear(e.target.value)}
               className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
             >
               {availableAcademicYears.map(y => (
                 <option key={y} value={y}>
                   {y}{y === appConfig.academicYear ? ' (Aktif)' : ''}
                 </option>
               ))}
               <option value="ALL">Semua Tahun Ajaran</option>
             </select>
          </div>

          {/* Theme Selector */}
          <div className="mt-8 pt-4 border-t border-slate-100">
             <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
               <Palette className="w-3 h-3" /> Tema Tampilan
             </p>
             <div className="flex gap-2 px-4">
               {Object.values(THEMES).map(t => (
                 <button 
                   key={t.name}
                   onClick={() => handleSelectTheme(t.name)}
                   className={`w-6 h-6 rounded-full bg-gradient-to-br ${t.gradient} border-2 ${themeName === t.name ? 'border-slate-600 scale-110' : 'border-transparent opacity-70 hover:opacity-100'} transition-all`}
                   title={t.label}
                 />
               ))}
             </div>
          </div>

          {/* Cloud Database Sync Status in Sidebar */}
          <div className="mx-3 mt-4 p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-2.5">
            <div className="relative flex items-center justify-center shrink-0">
              <span className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-500 animate-ping'} absolute`}></span>
              <span className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-amber-500' : 'bg-emerald-600'} relative`}></span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-800">
                <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Cloud Firestore Aktif</span>
              </div>
              <p className="text-[10px] text-emerald-700 leading-tight truncate">
                {isSyncing ? 'Menyinkronkan...' : 'Semua akun & seting sinkron'}
              </p>
            </div>
          </div>
        </nav>

        <div className={`p-4 border-t border-${currentTheme.primary}-50`}>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors">
            <LogOut className="w-5 h-5" /> Keluar Aplikasi
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

      {/* Main Content */}
      <main className={`flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen print:h-auto print:overflow-visible print:p-0 bg-slate-50/50 relative ${selectedStudent ? 'print:hidden' : 'print:block'}`}>
        {/* Background decorations - Themed */}
        <div className={`absolute top-0 left-0 w-full h-64 bg-gradient-to-r ${currentTheme.gradient} opacity-10 -z-10 print:hidden`}></div>

        <div className="max-w-7xl mx-auto print:max-w-none space-y-8 relative z-0 print:space-y-0">
          
          {/* Header Title Dynamic */}
          <div className="print:hidden mb-6 flex justify-between items-end">
             <div>
               <h2 className="text-3xl font-black text-slate-800 tracking-tight">{
                  activeTab === 'dashboard' ? 'Dashboard Overview' :
                  activeTab === 'input' ? 'Input Data Pelanggaran' :
                  activeTab === 'students' ? 'Direktori Siswa' : 
                  activeTab === 'evidence' ? 'Galeri & Unduh Bukti Foto' :
                  activeTab === 'reports' ? 'Pusat Cetak Laporan & Foto' : 'Pengaturan Sistem'
               }</h2>
               <p className="text-slate-500 text-sm mt-1 font-medium">Selamat datang, <span className={`text-${currentTheme.primary}-600`}>{currentUser.name}</span></p>
             </div>
             <div className="hidden md:flex items-center gap-3 text-right">
                {/* Cloud Connection Badge */}
                <button
                   onClick={handleManualSync}
                   title="Klik untuk menyinkronkan data dengan Cloud Firestore"
                   disabled={isSyncing}
                   className="bg-white/95 hover:bg-white px-3.5 py-1.5 rounded-full shadow-sm border border-emerald-200 hover:border-emerald-300 flex items-center gap-2 transition-all group cursor-pointer text-left"
                >
                   <div className="relative flex items-center justify-center">
                     <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-500 animate-ping'} absolute`}></span>
                     <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500' : 'bg-emerald-600'} relative`}></span>
                   </div>
                   <Cloud className="w-4 h-4 text-emerald-600" />
                   <div>
                     <span className="text-xs font-bold text-emerald-800 block leading-tight flex items-center gap-1">
                       Cloud Terhubung
                       <RefreshCw className={`w-3 h-3 text-emerald-600 group-hover:rotate-180 transition-transform ${isSyncing ? 'animate-spin' : ''}`} />
                     </span>
                     <span className="text-[9px] text-emerald-600 font-medium block leading-tight">Data & Seting Sinkron</span>
                   </div>
                </button>

                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-end gap-1">
                     <Calendar className="w-3 h-3" /> Tahun Ajaran Data
                   </p>
                   <select
                     value={selectedAcademicYear}
                     onChange={(e) => handleSelectViewingYear(e.target.value)}
                     title="Pilih tahun ajaran untuk membedakan & memfilter data"
                     className={`px-3.5 py-1.5 rounded-full shadow-sm border text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                       selectedAcademicYear !== appConfig.academicYear
                         ? 'bg-amber-50 border-amber-300 text-amber-800'
                         : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                     }`}
                   >
                     {availableAcademicYears.map(y => (
                       <option key={y} value={y}>
                         TA {y}{y === appConfig.academicYear ? ' (Aktif)' : ''}
                       </option>
                     ))}
                     <option value="ALL">Semua Tahun Ajaran</option>
                   </select>
                </div>
              </div>
          </div>

          {/* Non-default Academic Year Context Banner */}
          {selectedAcademicYear !== appConfig.academicYear && (
            <div className="print:hidden bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 text-xs text-amber-900">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {selectedAcademicYear === 'ALL' ? (
                    <>
                      Menampilkan <strong>gabungan seluruh Tahun Ajaran</strong> ({scopedStudents.length} siswa, {scopedViolations.length} laporan). Input data baru otomatis masuk ke TA aktif <strong>{appConfig.academicYear}</strong>.
                    </>
                  ) : (
                    <>
                      Anda sedang melihat data khusus Tahun Ajaran <strong>{selectedAcademicYear}</strong> ({scopedStudents.length} siswa, {scopedViolations.length} laporan). Tahun aktif sekolah saat ini: <strong>{appConfig.academicYear}</strong>.
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSelectViewingYear(appConfig.academicYear)}
                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
              >
                Kembali ke TA Aktif ({appConfig.academicYear})
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard 
               violations={scopedViolations} 
               students={scopedStudents} 
               onDelete={deleteViolation} 
               onViewStudent={handleViewStudent}
               theme={currentTheme}
               appConfig={displayConfig}
               currentUser={currentUser}
               onNavigateTab={setActiveTab}
               activities={activities}
               onClearActivities={handleClearActivities}
               users={users}
               onSavePrintSettings={handleSavePrintSettings}
            />
          )}

          {activeTab === 'input' && (
            <ViolationForm 
              currentUser={currentUser} 
              students={selectedAcademicYear === 'ALL' ? students.filter(s => matchesAcademicYear(s.academicYear, effectiveInputAcademicYear)) : scopedStudents} 
              violationTypes={violationTypes}
              onSubmit={addViolation} 
              onBulkUpload={handleBulkUploadViolations}
              appConfig={displayConfig}
              activeAcademicYear={effectiveInputAcademicYear}
            />
          )}

          {activeTab === 'students' && (
            <StudentList 
              students={scopedStudents} 
              violations={scopedViolations}
              onAddStudent={handleAddStudent} 
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkUpload={handleBulkUploadStudents}
              onBulkDeleteStudents={handleBulkDeleteStudents}
              onDeleteAllStudents={handleDeleteAllStudents}
              onDeleteStudentsByClass={handleDeleteStudentsByClass}
              onViewStudent={handleViewStudent}
              appConfig={displayConfig}
              currentUser={currentUser}
              activeAcademicYear={effectiveInputAcademicYear}
              users={users}
              onSavePrintSettings={handleSavePrintSettings}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidenceGallery 
              violations={scopedViolations} 
              students={scopedStudents} 
              appConfig={displayConfig} 
              currentUser={currentUser} 
              onViewStudent={handleViewStudent}
              onSeedSampleData={handleSeedSampleData}
              onDeleteViolation={deleteViolation}
              onBulkDeleteViolations={handleBulkDeleteViolations}
              users={users}
              onSavePrintSettings={handleSavePrintSettings}
            />
          )}

          {activeTab === 'reports' && (
            <ReportCenter
              students={scopedStudents}
              violations={scopedViolations}
              appConfig={displayConfig}
              currentUser={currentUser}
              users={users}
              theme={currentTheme}
              onViewStudent={handleViewStudent}
              onSavePrintSettings={handleSavePrintSettings}
            />
          )}

          {activeTab === 'settings' && currentUser.role === UserRole.ADMIN && (
             <div className="space-y-8">
                {/* Cloud Database Interconnection Info Card */}
                <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200 rounded-2xl p-6 shadow-sm">
                   <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                            <Cloud className="w-6 h-6" />
                         </div>
                         <div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                               <h3 className="text-lg font-black text-slate-900">Database Cloud Firestore Aktif</h3>
                               <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Semua Akun Saling Terhubung
                               </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                               Seluruh memori dan data (daftar siswa, catatan pelanggaran & reward, galeri bukti foto, akun guru/admin, dan pengaturan sekolah) tersimpan secara real-time di Cloud Firestore sehingga data dan pengaturan selalu sama persis di semua akun.
                            </p>
                         </div>
                      </div>
                      <button
                         onClick={handleManualSync}
                         disabled={isSyncing}
                         className="flex items-center gap-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
                      >
                         <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                         {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                      </button>
                   </div>

                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-emerald-200/60">
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 text-center">
                         <span className="text-[10px] uppercase font-bold text-slate-400 block">Siswa Tersinkron</span>
                         <span className="text-lg font-black text-slate-800">{students.length} Siswa</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 text-center">
                         <span className="text-[10px] uppercase font-bold text-slate-400 block">Catatan Laporan</span>
                         <span className="text-lg font-black text-slate-800">{violations.length} Data</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 text-center">
                         <span className="text-[10px] uppercase font-bold text-slate-400 block">Akun Terdaftar</span>
                         <span className="text-lg font-black text-slate-800">{users.length} Akun</span>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 text-center">
                         <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Pengaturan</span>
                         <span className="text-lg font-black text-emerald-600 flex items-center justify-center gap-1">
                            <CloudCheck className="w-5 h-5" /> Terhubung
                         </span>
                      </div>
                   </div>
                </div>

                {/* Academic Year Management Card */}
                <AcademicYearManager
                  activeAcademicYear={appConfig.academicYear}
                  selectedAcademicYear={selectedAcademicYear}
                  availableYears={availableAcademicYears}
                  students={students}
                  violations={violations}
                  onSetActiveYear={handleSetActiveAcademicYear}
                  onAddYear={handleAddAcademicYear}
                  onDeleteYear={handleDeleteAcademicYear}
                  onSelectViewYear={handleSelectViewingYear}
                  onPromoteStudents={handlePromoteStudentsToYear}
                />

                {/* General Settings Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-white">
                      <h4 className="font-bold text-xl flex items-center gap-2 text-slate-900">
                        <Globe className="w-5 h-5 text-blue-600" /> Pengaturan Umum Aplikasi
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Sesuaikan identitas sekolah dan aplikasi untuk tampilan dashboard dan hasil cetak.</p>
                    </div>
                    <form
                      onSubmit={handleSaveConfig}
                      onChange={(e) => {
                        if ((e.target as HTMLInputElement).type !== 'file') {
                          isEditingConfigRef.current = true;
                        }
                      }}
                      className="p-6 bg-white"
                    >
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">Nama Sekolah</label>
                            <input 
                              type="text" 
                              value={tempConfig.schoolName}
                              onChange={e => setTempConfig({...tempConfig, schoolName: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">Nama Aplikasi</label>
                            <input 
                              type="text" 
                              value={tempConfig.appName}
                              onChange={e => setTempConfig({...tempConfig, appName: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* Logo Upload Section */}
                          <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-800 mb-2">Logo Sekolah</label>
                            <div className="flex flex-col sm:flex-row items-start gap-6 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                               <div className="flex flex-col items-center gap-2 shrink-0">
                                  <div className="w-24 h-24 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-2 shadow-sm">
                                     <img src={tempConfig.logoUrl || DEFAULT_LOGO_URL} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  </div>
                                  <div className="flex flex-col items-center gap-1 w-full">
                                    <a 
                                      href={tempConfig.logoUrl} 
                                      download="logo-sekolah.png"
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-xs text-blue-600 flex items-center gap-1 hover:underline font-bold"
                                      title="Unduh file logo sekolah"
                                    >
                                      <ArrowDownCircle className="w-3.5 h-3.5" /> Unduh Logo
                                    </a>
                                    <button 
                                      type="button" 
                                      onClick={handleResetLogo}
                                      disabled={isUploadingLogo}
                                      className="text-[11px] text-red-500 flex items-center gap-1 hover:underline font-medium cursor-pointer disabled:opacity-50"
                                    >
                                      <RefreshCcw className="w-3 h-3" /> Reset Default
                                    </button>
                                  </div>
                               </div>
                               <div className="flex-1 w-full">
                                  <label className={`block w-full border-2 border-dashed border-slate-300 rounded-xl p-6 text-center transition-colors group ${isUploadingLogo ? 'opacity-60 cursor-wait bg-slate-100' : 'hover:bg-white hover:border-blue-400 cursor-pointer'}`}>
                                     <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-50">
                                       {isUploadingLogo ? (
                                         <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                                       ) : (
                                         <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                                       )}
                                     </div>
                                     <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 block">
                                       {isUploadingLogo ? 'Mengoptimalkan & Menyimpan Logo...' : 'Klik untuk Upload Logo Baru'}
                                     </span>
                                     <span className="text-xs text-slate-400 block mt-1">
                                       Format: PNG, JPG, WEBP, SVG (Max 10MB • Otomatis tersimpan &amp; sinkron ke Cloud)
                                     </span>
                                     <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="hidden" />
                                  </label>
                               </div>
                            </div>
                          </div>

                          {/* Detail Kop Surat Resmi */}
                          <div className="md:col-span-2 pt-4 border-t border-slate-200">
                            <h5 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" /> Pengaturan Format Kop Surat Resmi
                            </h5>
                            <p className="text-xs text-slate-500 mb-4">
                              Sesuaikan teks instansi pemerintah, dinas, nomor kontak, dan identitas surat resmi sesuai ketentuan dinas provinsi.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Header Pemerintah (Baris 1)</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.governmentHeader || ''}
                                  onChange={e => setTempConfig({...tempConfig, governmentHeader: e.target.value})}
                                  placeholder="Contoh: PEMERINTAH PROVINSI JAWA TENGAH"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Header Dinas / Instansi (Baris 2)</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.departmentHeader || ''}
                                  onChange={e => setTempConfig({...tempConfig, departmentHeader: e.target.value})}
                                  placeholder="Contoh: DINAS PENDIDIKAN DAN KEBUDAYAAN"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.address}
                                  onChange={e => setTempConfig({...tempConfig, address: e.target.value})}
                                  placeholder="Contoh: Jl. Pramuka No. 41 Kudus"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Pos</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.postalCode || ''}
                                  onChange={e => setTempConfig({...tempConfig, postalCode: e.target.value})}
                                  placeholder="Contoh: 59319"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Telepon</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.phone || ''}
                                  onChange={e => setTempConfig({...tempConfig, phone: e.target.value})}
                                  placeholder="Contoh: 0291-431368"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Faksimile</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.fax || ''}
                                  onChange={e => setTempConfig({...tempConfig, fax: e.target.value})}
                                  placeholder="Contoh: 0291-431368"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Surat Elektronik (Email)</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.email}
                                  onChange={e => setTempConfig({...tempConfig, email: e.target.value})}
                                  placeholder="Contoh: sma1kudus@yahoo.com"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Laman Web (Website)</label>
                                <input 
                                  type="text" 
                                  value={tempConfig.website}
                                  onChange={e => setTempConfig({...tempConfig, website: e.target.value})}
                                  placeholder="Contoh: sman1kudus.sch.id"
                                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Tipografi & Gaya Per Baris Kop Surat + Default Cetak & TTD */}
                            <div className="mt-5 space-y-4">
                              {(() => {
                                const resolvedPrint = resolvePrintSettings(tempConfig, currentUser, users);
                                const updateTempPrint = (patch: Partial<PrintDocumentSettings>) => {
                                  isEditingConfigRef.current = true;
                                  setTempConfig((prev) => ({
                                    ...prev,
                                    printSettings: {
                                      ...resolvePrintSettings(prev, currentUser, users),
                                      ...patch,
                                    },
                                  }));
                                };
                                return (
                                  <>
                                    <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                                      <div>
                                        <h6 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                                          Ukuran Huruf, Jenis Font &amp; Format Per Baris Kop Surat
                                        </h6>
                                        <p className="text-[11px] text-indigo-800/80 mt-0.5">
                                          Atur ukuran huruf (pt), Bold/Italic/Underline, perataan (Left/Center/Right/Justify) per baris kop serta jenis font resmi.
                                        </p>
                                      </div>
                                      <KopStyleEditor
                                        kopStyle={resolvedPrint.kopStyle}
                                        onChange={(updatedKopStyle) =>
                                          updateTempPrint({ kopStyle: updatedKopStyle })
                                        }
                                        compact={true}
                                      />
                                    </div>

                                    <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                                      <div>
                                        <h6 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                                          Pengaturan Default Tampil Kop, TTD &amp; Font Dokumen
                                        </h6>
                                        <p className="text-[11px] text-emerald-800/80 mt-0.5">
                                          Anda tetap dapat mengubah opsi ini sebelum mencetak dari jendela Pratinjau Cetak.
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <label className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200 text-xs font-bold text-slate-700 cursor-pointer">
                                          <span>Tampilkan Kop Surat</span>
                                          <input
                                            type="checkbox"
                                            checked={resolvedPrint.showKop}
                                            onChange={(e) => updateTempPrint({ showKop: e.target.checked })}
                                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                          />
                                        </label>
                                        <label className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200 text-xs font-bold text-slate-700 cursor-pointer">
                                          <span>TTD Kepala Sekolah</span>
                                          <input
                                            type="checkbox"
                                            checked={resolvedPrint.showKepsekSignature}
                                            onChange={(e) => updateTempPrint({ showKepsekSignature: e.target.checked })}
                                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                          />
                                        </label>
                                        <label className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-200 text-xs font-bold text-slate-700 cursor-pointer">
                                          <span>TTD Admin / Guru</span>
                                          <input
                                            type="checkbox"
                                            checked={resolvedPrint.showStaffSignature}
                                            onChange={(e) => updateTempPrint({ showStaffSignature: e.target.checked })}
                                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                          />
                                        </label>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Font Dokumen &amp; TTD
                                          </label>
                                          <select
                                            value={resolvedPrint.documentFontFamily}
                                            onChange={(e) =>
                                              updateTempPrint({ documentFontFamily: e.target.value as PrintFontFamily })
                                            }
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                                          >
                                            <option value="helvetica">Helvetica / Arial</option>
                                            <option value="times">Times New Roman</option>
                                            <option value="courier">Courier New</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Posisi TTD Kepsek
                                          </label>
                                          <select
                                            value={resolvedPrint.kepsekPosition}
                                            onChange={(e) =>
                                              updateTempPrint({ kepsekPosition: e.target.value as SignatureBoxPosition })
                                            }
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                                          >
                                            <option value="left">Kiri</option>
                                            <option value="center">Tengah</option>
                                            <option value="right">Kanan</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Posisi TTD Guru/Admin
                                          </label>
                                          <select
                                            value={resolvedPrint.staffPosition}
                                            onChange={(e) =>
                                              updateTempPrint({ staffPosition: e.target.value as SignatureBoxPosition })
                                            }
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                                          >
                                            <option value="left">Kiri</option>
                                            <option value="center">Tengah</option>
                                            <option value="right">Kanan</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Perataan Teks TTD
                                          </label>
                                          <select
                                            value={resolvedPrint.signatureStyle.align}
                                            onChange={(e) =>
                                              updateTempPrint({
                                                signatureStyle: {
                                                  ...resolvedPrint.signatureStyle,
                                                  align: e.target.value as PrintTextAlign,
                                                },
                                              })
                                            }
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                                          >
                                            <option value="left">Rata Kiri (Left - Rapi)</option>
                                            <option value="center">Tengah (Center)</option>
                                            <option value="right">Rata Kanan (Right)</option>
                                            <option value="justify">Rata Kiri-Kanan (Justify)</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>

                            {/* Live Kop Preview Card */}
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Pratinjau Kop Surat Resmi:</span>
                              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 overflow-x-auto">
                                <KopSurat appConfig={tempConfig} showBorder={true} />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">Tahun Ajaran Aktif</label>
                            <select
                              value={tempConfig.academicYear}
                              onChange={e => setTempConfig({...tempConfig, academicYear: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
                            >
                              {sortAcademicYears([...availableAcademicYears, tempConfig.academicYear]).map(y => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">Website</label>
                            <input 
                              type="text" 
                              value={tempConfig.website}
                              onChange={e => setTempConfig({...tempConfig, website: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">Email</label>
                            <input 
                              type="text" 
                              value={tempConfig.email}
                              onChange={e => setTempConfig({...tempConfig, email: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">Nama Kepala Sekolah</label>
                            <input 
                              type="text" 
                              value={tempConfig.principalName}
                              onChange={e => setTempConfig({...tempConfig, principalName: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                              placeholder="Contoh: Drs. H. Purnomo, M.Pd"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1.5">NIP Kepala Sekolah</label>
                            <input 
                              type="text" 
                              value={tempConfig.principalNip}
                              onChange={e => setTempConfig({...tempConfig, principalNip: e.target.value})}
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                              placeholder="Contoh: 19680101 199003 1 001"
                            />
                          </div>

                          {/* Integrasi Webhook / Tautan Pengiriman Data Otomatis */}
                          <div className="md:col-span-2 pt-6 border-t border-slate-200">
                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <div>
                                   <h5 className="text-base font-black text-slate-800 flex items-center gap-2">
                                      <Send className="w-4 h-4 text-emerald-600" /> Sinkronisasi Pengiriman Data ke Tautan Eksternal
                                   </h5>
                                   <p className="text-xs text-slate-500 mt-0.5">
                                      Otomatis mengirimkan dan mencatat setiap hasil inputan baru ke URL tautan / Google Sheets / Webhook Anda.
                                   </p>
                                </div>
                                <label className="inline-flex items-center cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                                   <input 
                                      type="checkbox" 
                                      checked={tempConfig.webhookEnabled || false} 
                                      onChange={e => setTempConfig({...tempConfig, webhookEnabled: e.target.checked})}
                                      className="sr-only peer"
                                   />
                                   <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 relative"></div>
                                   <span className="ml-2.5 text-xs font-bold text-slate-700">
                                      {tempConfig.webhookEnabled ? 'Pengiriman Aktif' : 'Non-aktif'}
                                   </span>
                                </label>
                             </div>
                             
                             <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                <div className="relative flex-1">
                                   <LinkIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                   <input 
                                      type="url" 
                                      value={tempConfig.webhookUrl || ''} 
                                      onChange={e => setTempConfig({...tempConfig, webhookUrl: e.target.value})}
                                      placeholder="https://script.google.com/macros/s/.../exec atau URL Webhook Anda"
                                      className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 font-mono"
                                   />
                                </div>
                                <button
                                   type="button"
                                   onClick={handleTestWebhook}
                                   disabled={isTestingWebhook || !tempConfig.webhookUrl}
                                   className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                                >
                                   <Send className="w-3.5 h-3.5" />
                                   {isTestingWebhook ? 'Menguji...' : 'Uji Kirim Data'}
                                </button>
                             </div>

                             {/* Peringatan Khusus Jika Pengguna Memasukkan Link Google Spreadsheet Langsung */}
                             {isGoogleSpreadsheetUrl(tempConfig.webhookUrl || '') && (
                                <div className="mt-3.5 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm">
                                   <div className="flex items-start gap-3">
                                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                      <div className="flex-1 space-y-2.5">
                                         <div>
                                            <h6 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                                               Tautan Google Spreadsheet Langsung Terdeteksi
                                            </h6>
                                            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                               Link yang Anda masukkan adalah halaman tampilan Google Spreadsheet. Server Google menolak kiriman data langsung ke URL ini (<em>HTTP 405 Method Not Allowed</em>).
                                            </p>
                                            <p className="text-xs text-amber-800 mt-1 font-semibold">
                                               Agar hasil inputan otomatis masuk menjadi baris di spreadsheet Anda, pasang <strong>Google Apps Script</strong> (Gratis &amp; Selesai dalam 1 Menit):
                                            </p>
                                         </div>

                                         <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200 text-xs space-y-2">
                                            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 text-[12px] leading-relaxed">
                                               <li>
                                                  Buka Google Spreadsheet Anda:{' '}
                                                  <a 
                                                     href={tempConfig.webhookUrl} 
                                                     target="_blank" 
                                                     rel="noreferrer" 
                                                     className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline"
                                                  >
                                                     Buka Spreadsheet ↗
                                                  </a>
                                               </li>
                                               <li>Di menu atas Google Spreadsheet, klik <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.</li>
                                               <li>Hapus semua kode yang ada di editor, lalu <strong>Paste / Tempelkan</strong> kode yang sudah disiapkan.</li>
                                               <li>Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &gt; pilih <strong>Deployment baru (New deployment)</strong>.</li>
                                               <li>Pilih jenis <strong>Aplikasi web (Web app)</strong>.</li>
                                               <li>Pada opsi <em>"Siapa yang memiliki akses" (Who has access)</em>, <strong>WAJIB PILIH: "Siapa saja" (Anyone)</strong>.</li>
                                               <li>Klik <strong>Terapkan</strong>, izinkan akses, lalu salin URL yang berakhiran <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded font-mono font-bold">/exec</code>.</li>
                                               <li>Ganti link di kolom URL di atas dengan link <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded font-mono font-bold">/exec</code> tersebut, lalu klik <strong>Simpan Pengaturan</strong>.</li>
                                            </ol>
                                         </div>

                                         <div className="flex flex-wrap items-center gap-2 pt-1">
                                            <button
                                               type="button"
                                               onClick={handleCopyScript}
                                               className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-200 cursor-pointer"
                                            >
                                               {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                               {copiedScript ? 'Kode Berhasil Disalin!' : 'Salin Kode Google Apps Script'}
                                            </button>
                                            <button
                                               type="button"
                                               onClick={() => setShowScriptModal(true)}
                                               className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                            >
                                               <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                               Lihat Kode Skrip Lengkap
                                            </button>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             )}

                             <div className="text-[11px] text-slate-600 mt-2.5 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <div className="flex items-start gap-2">
                                   <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                   <div className="space-y-0.5">
                                      <p><strong>Format yang didukung:</strong> Web App Google Apps Script (rekapan otomatis Google Sheets), Zapier, Make, n8n, Google Forms Webhook, atau REST API.</p>
                                      <p className="text-slate-500">Data otomatis terkirim: Tanggal, Waktu, NIS, Nama Siswa, Kelas, Kategori, Deskripsi, Poin, Pelapor, dan URL Bukti Foto.</p>
                                   </div>
                                </div>
                                <button
                                   type="button"
                                   onClick={() => setShowScriptModal(true)}
                                   className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                   <HelpCircle className="w-3.5 h-3.5" /> Panduan &amp; Kode Google Sheets
                                </button>
                             </div>
                          </div>
                       </div>
                       <div className="mt-6 flex justify-end">
                          <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md shadow-blue-200">
                             <Save className="w-4 h-4" /> Simpan Pengaturan
                          </button>
                       </div>
                    </form>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <UserManagement 
                        users={users} 
                        onAddUser={handleAddUser}
                        onBulkAddUsers={handleBulkAddUsers}
                        onUpdateUser={handleUpdateUser}
                        onDeleteUser={handleDeleteUser}
                        onBulkDeleteUsers={handleBulkDeleteUsers}
                        currentUser={currentUser}
                        appConfig={displayConfig}
                        onSavePrintSettings={handleSavePrintSettings}
                    />
                    <ViolationTypeManagement 
                        types={violationTypes}
                        onAddType={handleAddViolationType}
                        onBulkAddTypes={handleBulkAddViolationTypes}
                        onUpdateType={handleUpdateViolationType}
                        onDeleteType={handleDeleteViolationType}
                        appConfig={displayConfig}
                        currentUser={currentUser}
                        users={users}
                        onSavePrintSettings={handleSavePrintSettings}
                    />
                </div>

                {/* Reset Data Section */}
                <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden mt-8">
                    <div className="p-6 border-b border-red-50 bg-red-50/30">
                      <h4 className="font-bold text-xl flex items-center gap-2 text-red-700">
                        <Trash2 className="w-5 h-5" /> Reset Database
                      </h4>
                      <p className="text-xs text-red-500 mt-1">Hapus seluruh data siswa dan catatan untuk memulai dari awal.</p>
                    </div>
                    <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                       <div>
                          <p className="font-bold text-slate-800">Hapus Seluruh Data Siswa & Laporan</p>
                          <p className="text-sm text-slate-500">Tindakan ini akan mengosongkan direktori siswa dan laporan di lokal dan Firestore Cloud.</p>
                       </div>
                       <button 
                        onClick={() => setIsResetModalOpen(true)}
                        className="bg-white border-2 border-red-500 text-red-600 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white transition shadow-sm flex items-center gap-2 cursor-pointer"
                       >
                          <RotateCcw className="w-4 h-4" /> Reset Sekarang
                       </button>
                    </div>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Google Apps Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-800 text-base">Panduan Integrasi Google Sheets (Apps Script)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-emerald-900 leading-relaxed">
                <strong>Mengapa butuh Google Apps Script?</strong><br />
                Google Spreadsheet adalah halaman visual yang tidak menerima kiriman HTTP POST langsung dari aplikasi lain. Dengan memasang skrip 1 menit ini, spreadsheet Anda memiliki link API resmi (<code className="font-bold">/exec</code>) yang dapat menerima data secara gratis dan aman.
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Langkah Pemasangan (Hanya 1 Menit):</h4>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <li>Buka spreadsheet Google Anda tempat data ingin dicatat.</li>
                  <li>Di menu atas spreadsheet, klik <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.</li>
                  <li>Hapus teks bawaan yang ada di editor skrip, lalu salin dan tempel kode di bawah ini.</li>
                  <li>Klik tombol biru <strong>Terapkan (Deploy)</strong> di pojok kanan atas &gt; pilih <strong>Deployment baru (New deployment)</strong>.</li>
                  <li>Klik ikon roda gigi ⚙️ di samping <em>"Pilih jenis"</em>, lalu pilih <strong>Aplikasi web (Web app)</strong>.</li>
                  <li>Isi deskripsi bebas (contoh: <em>SiPerSis Webhook</em>).</li>
                  <li>Pada bagian <strong>"Siapa yang memiliki akses" (Who has access)</strong>, pilih: <strong>"Siapa saja" (Anyone)</strong>.</li>
                  <li>Klik tombol <strong>Terapkan</strong>, berikan otorisasi izin akun Google Anda.</li>
                  <li>Salin <strong>URL Aplikasi Web</strong> yang berakhiran <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">/exec</code>.</li>
                  <li>Tempelkan URL tersebut ke kolom <strong>URL Tautan</strong> di Pengaturan SiPerSis dan klik Simpan.</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">Kode Skrip Otomatis (Siap Pakai):</span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Tersalin!' : 'Salin Semua Kode'}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed">
                  {getGoogleAppsScriptCode(extractSpreadsheetId(tempConfig.webhookUrl || '') || undefined)}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Reset Confirm Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          handleResetData();
          setIsResetModalOpen(false);
        }}
        title="Reset Total Database Siswa & Laporan"
        message={
          <div>
            <p className="font-bold text-rose-700 mb-2">PERINGATAN KRUSIAL:</p>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Anda akan mengosongkan seluruh database <strong>Data Siswa ({students.length})</strong> dan <strong>Catatan Pelanggaran/Reward ({violations.length})</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Data yang dihapus akan disinkronkan secara permanen ke Cloud Firestore dan tidak dapat dikembalikan lagi.
            </p>
          </div>
        }
        variant="danger"
        confirmText="Ya, Reset Total Sekarang"
      />

      {/* Reset Logo Confirm Modal */}
      <ConfirmModal
        isOpen={isResetLogoModalOpen}
        onClose={() => setIsResetLogoModalOpen(false)}
        onConfirm={() => {
          executeResetLogo();
          setIsResetLogoModalOpen(false);
        }}
        title="Kembalikan Logo Default"
        message="Apakah Anda yakin ingin mengembalikan logo sekolah ke logo bawaan sistem? Perubahan akan langsung diterapkan dan disinkronkan ke seluruh akun."
        variant="warning"
        confirmText="Ya, Kembalikan Default"
      />

      {/* Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal 
          student={selectedStudent} 
          violations={scopedViolations}
          onClose={() => setSelectedStudent(null)}
          appConfig={displayConfig}
          currentUser={currentUser}
          users={users}
          onSavePrintSettings={handleSavePrintSettings}
        />
      )}
      <Toaster richColors position="top-right" />
    </div>
  );
};

export default App;