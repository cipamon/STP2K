import React, { useState } from 'react';
import { toast } from 'sonner';
import { Student, User, ViolationCategory, ViolationRecord, ViolationType, AppConfig } from '../types';
import { CLASS_LIST } from '../constants';
import { analyzeViolationText } from '../services/geminiService';
import { Sparkles, Camera, Upload, CheckCircle, AlertCircle, Award, RotateCcw, ImagePlus, X, FileDown, Table, Check } from 'lucide-react';
import CameraModal from './CameraModal';
import * as XLSX from 'xlsx';
import { isGoogleSpreadsheetUrl } from '../utils/webhook';
import { getStudentPhoto } from '../utils/studentHelpers';
import { getDefaultStudentAvatar } from '../utils/avatarHelpers';
import { exportAoaToSpreadsheet } from '../utils/exportHelpers';

interface ViolationFormProps {
  currentUser: User;
  students: Student[]; 
  violationTypes: ViolationType[];
  onSubmit: (record: ViolationRecord) => void;
  onBulkUpload: (records: ViolationRecord[]) => Promise<void> | void;
  appConfig: AppConfig;
  activeAcademicYear?: string;
}

const ViolationForm: React.FC<ViolationFormProps> = ({ currentUser, students, violationTypes, onSubmit, onBulkUpload, appConfig, activeAcademicYear }) => {
  const targetAcademicYear = activeAcademicYear || appConfig.academicYear;
  // Cascading Dropdown States
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ViolationCategory>(ViolationCategory.RINGAN);
  const [points, setPoints] = useState<number>(0); // Default 0 to encourage input
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Camera Modal State
  const [showCamera, setShowCamera] = useState(false);
  
  // Bulk Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);

  // Filter types by category group
  const negativeTypes = violationTypes.filter(t => t.category !== ViolationCategory.PRESTASI);
  const positiveTypes = violationTypes.filter(t => t.category === ViolationCategory.PRESTASI);

  const studentsInClass = students.filter(s => s.class === selectedClass).sort((a, b) => a.name.localeCompare(b.name));
  
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const handleAIAnalysis = async () => {
    if (!description) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeViolationText(description);
      setCategory(result.category);
      setPoints(result.suggestedPoints);
      toast.success('Analisis AI selesai');
    } catch (e) {
      toast.error("Gagal melakukan analisis AI. Silakan input manual.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleCameraCapture = (imageData: string) => {
    setImagePreview(imageData);
    setShowCamera(false);
  };

  const handlePresetClick = (type: ViolationType) => {
    // Append description
    const newDesc = description.trim().length > 0 ? `${description}, ${type.label}` : type.label;
    setDescription(newDesc);
    
    // Accumulate points
    setPoints(prev => prev + type.points);
    setCategory(type.category);
  };

  const handleDownloadTemplate = () => {
    const headers = [['Tanggal (YYYY-MM-DD)', 'NIS', 'Nama Siswa', 'Kelas', 'Kategori (Ringan/Sedang/Berat/Prestasi)', 'Deskripsi', 'Poin']];
    exportAoaToSpreadsheet(
      headers,
      'Template Pelanggaran',
      'Template_Import_Pelanggaran_SiPerSis',
      [20, 15, 30, 10, 25, 50, 10],
      'xls'
    );
    toast.success('Template XLS pelanggaran berhasil diunduh.');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedExcelFile(file);
      e.target.value = '';
    }
  };

  const execUploadExcel = () => {
    if (!selectedExcelFile) return;
    
    setIsSyncing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          toast.error("File tidak valid atau kosong.");
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const rows = jsonData.slice(1);
        
        const newRecords: ViolationRecord[] = [];
        let errorCount = 0;

        const norm = (val: unknown) => String(val ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

        rows.forEach((row: any, index) => {
           if (!Array.isArray(row) || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
             return;
           }
           // Map columns: 0=Tanggal, 1=NIS, 2=Nama, 3=Kelas, 4=Kategori, 5=Deskripsi, 6=Poin
           const rawDateCell = row[0];
           const vDateStr = rawDateCell?.toString().trim();
           const vNis = norm(row[1]);
           const vName = norm(row[2]);
           const vClass = norm(row[3]);
           const vCategoryStr = row[4]?.toString().trim();
           const vDescription = row[5]?.toString().trim();
           const vPoints = Number(row[6]);

           // Find student (NIS match, fallback to Name+Class, or unique Name)
           let student = vNis && vNis !== '-' ? students.find(s => norm(s.nis) === vNis) : undefined;
           if (!student && vName && vClass) {
              student = students.find(s => norm(s.name) === vName && norm(s.class) === vClass);
           }
           if (!student && vName) {
              const nameMatches = students.filter(s => norm(s.name) === vName);
              if (nameMatches.length === 1) student = nameMatches[0];
           }

           if (student && vDescription && !isNaN(vPoints)) {
              // Parse category
              let vCategory = ViolationCategory.RINGAN;
              const catLower = vCategoryStr?.toLowerCase();
              if (catLower?.includes('sedang')) vCategory = ViolationCategory.SEDANG;
              else if (catLower?.includes('berat')) vCategory = ViolationCategory.BERAT;
              else if (catLower?.includes('prestasi') || catLower?.includes('reward')) vCategory = ViolationCategory.PRESTASI;

              // Parse date (supports Excel serial dates & text dates)
              let finalDate = new Date().toISOString();
              if (typeof rawDateCell === 'number' && Number.isFinite(rawDateCell) && rawDateCell > 1000 && rawDateCell < 100000) {
                 const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                 const dt = new Date(excelEpoch.getTime() + rawDateCell * 86400000);
                 if (!isNaN(dt.getTime())) finalDate = dt.toISOString();
              } else if (vDateStr) {
                 const parsedDate = new Date(vDateStr);
                 if (!isNaN(parsedDate.getTime())) {
                    finalDate = parsedDate.toISOString();
                 }
              }

              newRecords.push({
                 id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
                 studentId: student.id,
                 studentName: student.name,
                 studentClass: student.class,
                 date: finalDate,
                 description: vDescription,
                 category: vCategory,
                 points: vPoints,
                 reporterName: currentUser.name,
                 evidenceUrl: undefined,
                 academicYear: targetAcademicYear,
              });
           } else {
              if (vNis || vName) errorCount++;
           }
        });

        if (newRecords.length > 0) {
          await onBulkUpload(newRecords);
          setShowImportModal(false);
          setSelectedExcelFile(null);
          if (errorCount > 0) {
             toast.warning(`${newRecords.length} data berhasil, tapi ${errorCount} data gagal (Siswa tidak ditemukan atau data tidak lengkap).`);
          }
        } else {
          toast.error('Gagal membaca data. Pastikan format tabel sesuai dan siswa sudah terdaftar di sistem.');
        }
      } catch (err) {
        console.error("Excel Read Error:", err);
        toast.error("Gagal membaca file Excel. Pastikan file tidak rusak.");
      } finally {
        setIsSyncing(false);
      }
    };
    reader.onerror = () => {
      toast.error("Terjadi masalah saat membaca file.");
      setIsSyncing(false);
    };
    reader.readAsArrayBuffer(selectedExcelFile);
  };

  const handleResetForm = () => {
    setDescription('');
    setPoints(0);
    setCategory(ViolationCategory.RINGAN);
    setInputDate(new Date().toISOString().split('T')[0]);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error("Pilih siswa terlebih dahulu.");
      return;
    }

    if (points === 0 && !confirm("Poin bernilai 0. Lanjutkan menyimpan?")) {
        return;
    }

    const finalEvidence = imagePreview || undefined;

    const newRecord: ViolationRecord = {
      id: Date.now().toString(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentClass: selectedStudent.class,
      date: new Date(inputDate).toISOString(),
      description,
      category,
      points,
      reporterName: currentUser.name,
      evidenceUrl: finalEvidence,
      academicYear: targetAcademicYear,
    };

    onSubmit(newRecord);
    
    // Reset form partial
    handleResetForm();
  };

  return (
    <>
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-slate-100 max-w-4xl mx-auto">
        {/* Header - Dynamically colored by parent context/css generally, but hardcoded blue here for form consistency */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 -m-4 sm:-m-6 mb-5 sm:mb-6 p-4 sm:p-6 rounded-t-xl text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload className="w-6 h-6" />
                Input Data Pelanggaran / Reward
              </h2>
              <span className="text-[11px] font-extrabold bg-white/20 border border-white/30 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                TA {targetAcademicYear}
              </span>
            </div>
            <p className="text-blue-50 text-sm mt-1">Catat perilaku siswa secara digital dan akurat untuk Tahun Ajaran {targetAcademicYear}.</p>
          </div>
          <button 
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition border border-white/30 backdrop-blur-sm shrink-0"
          >
            <Table className="w-4 h-4" /> Import Excel
          </button>
        </div>

        {appConfig?.webhookUrl && (
          isGoogleSpreadsheetUrl(appConfig.webhookUrl) ? (
            <div className="mb-6 -mt-2 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 shadow-sm">
              <div className="flex items-start sm:items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong>Perlu Skrip Perantara:</strong> Tautan di Pengaturan adalah link Google Spreadsheet langsung. Server Google Spreadsheet menolak input luar (Error 405). Buka menu <strong>Pengaturan</strong> untuk memasang <strong>Google Apps Script Web App</strong> agar data otomatis masuk.
                </span>
              </div>
            </div>
          ) : (
            appConfig?.webhookEnabled && (
              <div className="mb-6 -mt-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <span><strong>Tersambung ke Link Tujuan:</strong> Setiap hasil inputan otomatis dikirim & dicatat ke tautan eksternal.</span>
                </div>
                <span className="font-mono text-[11px] bg-white border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg truncate max-w-full sm:max-w-[260px]">
                  {appConfig.webhookUrl}
                </span>
              </div>
            )
          )
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cascading Selection: Class -> Student */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">1. Pilih Kelas</label>
               <select 
                 className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 shadow-sm"
                 value={selectedClass}
                 onChange={(e) => {
                   setSelectedClass(e.target.value);
                   setSelectedStudentId(''); // Reset student when class changes
                 }}
               >
                 <option value="">-- Pilih Kelas --</option>
                 {CLASS_LIST.map(c => (
                   <option key={c} value={c}>{c}</option>
                 ))}
               </select>
             </div>
             
             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">2. Pilih Nama Siswa</label>
               <select 
                 className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 shadow-sm"
                 value={selectedStudentId}
                 onChange={(e) => setSelectedStudentId(e.target.value)}
                 disabled={!selectedClass}
               >
                 <option value="">-- Pilih Siswa --</option>
                 {studentsInClass.length === 0 && selectedClass ? (
                   <option disabled>Tidak ada siswa di kelas ini</option>
                 ) : (
                   studentsInClass.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.nis})</option>
                   ))
                 )}
               </select>
             </div>
          </div>

          {/* Selected Student Card Detail - Blue Theme */}
          {selectedStudent && (
            <div className="bg-blue-50 p-4 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300 border border-blue-200 shadow-sm">
                <img
                  src={getStudentPhoto(selectedStudent)}
                  alt={selectedStudent.name}
                  onError={(e) => {
                    const fallback = getDefaultStudentAvatar(selectedStudent.gender);
                    if (!e.currentTarget.src.endsWith(fallback)) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                  referrerPolicy="no-referrer"
                />
               <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-lg text-blue-900">{selectedStudent.name}</p>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {selectedStudent.status || 'Aktif'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-blue-700 mt-1">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-100 shadow-sm">NIS: {selectedStudent.nis}</span>
                    <span className="font-medium bg-white px-2 py-0.5 rounded border border-blue-100 shadow-sm">{selectedStudent.class}</span>
                    {selectedStudent.absenNumber && (
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-100 shadow-sm">Absen: {selectedStudent.absenNumber}</span>
                    )}
                    <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-100 shadow-sm text-blue-800">{selectedStudent.gender}</span>
                  </div>
                  <p className="text-xs mt-2 text-blue-600">Total Poin Saat Ini: <strong>{selectedStudent.totalPoints}</strong></p>
               </div>
               <div>
                  <CheckCircle className="w-8 h-8 text-green-500 drop-shadow-sm" />
               </div>
            </div>
          )}

          {/* Date, Category & Points */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Kejadian</label>
              <input
                type="date"
                required
                className="w-full p-2.5 border border-slate-300 rounded-lg shadow-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Kategori (Utama)</label>
              <select
                className="w-full p-2.5 border border-slate-300 rounded-lg shadow-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                value={category}
                onChange={(e) => setCategory(e.target.value as ViolationCategory)}
              >
                <optgroup label="Pelanggaran (Poin Positif +)">
                  <option value={ViolationCategory.RINGAN}>Pelanggaran Ringan</option>
                  <option value={ViolationCategory.SEDANG}>Pelanggaran Sedang</option>
                  <option value={ViolationCategory.BERAT}>Pelanggaran Berat</option>
                </optgroup>
                <optgroup label="Apresiasi (Poin Negatif -)">
                  <option value={ViolationCategory.PRESTASI}>Prestasi / Reward</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Total Poin (Akumulasi)</label>
              <input
                type="number"
                className={`w-full p-2.5 border rounded-lg shadow-sm bg-white focus:ring-2 font-bold text-lg
                  ${points < 0 ? 'text-green-600 border-green-300 focus:ring-green-500' : 'text-red-600 border-red-300 focus:ring-red-500'}
                `}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Separated Preset Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Section Violation */}
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 max-h-80 overflow-y-auto">
               <div className="flex items-center gap-2 mb-3 text-orange-800 sticky top-0 bg-orange-50 pb-2 z-10">
                  <AlertCircle className="w-5 h-5" />
                  <label className="block text-sm font-bold">Pilih Jenis Pelanggaran</label>
               </div>
               <div className="flex flex-wrap gap-2">
                  {negativeTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handlePresetClick(type)}
                      className={`text-xs px-3 py-2 rounded-lg transition-all shadow-sm border text-left hover:scale-[1.02] active:scale-95
                        ${type.category === ViolationCategory.BERAT 
                          ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' 
                          : 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200'}
                      `}
                    >
                      {type.label} ({type.points})
                    </button>
                  ))}
                  {negativeTypes.length === 0 && <p className="text-orange-300 text-xs italic">Tidak ada preset pelanggaran.</p>}
               </div>
             </div>

             {/* Section Achievement */}
             <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 max-h-80 overflow-y-auto">
               <div className="flex items-center gap-2 mb-3 text-emerald-800 sticky top-0 bg-emerald-50 pb-2 z-10">
                  <Award className="w-5 h-5" />
                  <label className="block text-sm font-bold">Pilih Jenis Prestasi / Reward</label>
               </div>
               <div className="flex flex-wrap gap-2">
                  {positiveTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handlePresetClick(type)}
                      className="text-xs px-3 py-2 rounded-lg transition-all shadow-sm border text-left bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 hover:scale-[1.02] active:scale-95"
                    >
                      {type.label} ({type.points})
                    </button>
                  ))}
                  {positiveTypes.length === 0 && <p className="text-emerald-300 text-xs italic">Tidak ada preset prestasi.</p>}
               </div>
             </div>
          </div>

          {/* Description & AI */}
          <div>
            <div className="flex justify-between items-end mb-1">
               <label className="block text-sm font-bold text-slate-700">Deskripsi Kejadian</label>
               {(description || points !== 0) && (
                 <button 
                    type="button" 
                    onClick={handleResetForm}
                    className="text-xs text-red-500 flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Input
                 </button>
               )}
            </div>
            <div className="flex gap-2 items-start">
              <textarea
                className="flex-1 w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-sm bg-white text-slate-900 placeholder:text-slate-400"
                rows={3}
                placeholder="Contoh: Terlambat masuk kelas 15 menit, Seragam tidak rapi..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAIAnalysis}
                disabled={isAnalyzing || !description}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[80px] transition-all shadow-sm border
                  ${isAnalyzing ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200'}
                `}
                title="Analisis Otomatis dengan Gemini AI"
              >
                <Sparkles className={`w-6 h-6 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold">AI SCAN</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 italic">
               Tips: Klik tombol jenis pelanggaran/reward di bawah untuk menambahkan deskripsi dan menjumlahkan poin secara otomatis. Anda dapat memasukkan banyak pelanggaran sekaligus.
            </p>
          </div>

          {/* Evidence Upload Section - SPLIT BUTTONS & PRESETS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-bold text-slate-700">
                  Bukti Foto Dokumentasi <span className="text-xs font-normal text-slate-400 ml-1">(Opsional)</span>
                </label>
                <span className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium border border-slate-200">
                  Opsional
                </span>
              </div>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Hapus / Kosongkan Foto
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
               {/* Button 1: Live Camera */}
               <button 
                 type="button"
                 onClick={() => setShowCamera(true)}
                 className="flex items-center justify-center p-4 border-2 border-dashed border-blue-300 bg-blue-50/60 text-blue-700 rounded-xl hover:bg-blue-100/80 transition-colors gap-3 group"
               >
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform text-blue-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block">Ambil Foto (Kamera)</span>
                    <span className="text-[11px] text-blue-500">Kamera langsung HP / Laptop</span>
                  </div>
               </button>

               {/* Button 2: Upload File */}
               <label className="flex items-center justify-center p-4 border-2 border-dashed border-indigo-300 bg-indigo-50/60 text-indigo-700 rounded-xl hover:bg-indigo-100/80 transition-colors gap-3 cursor-pointer group">
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform text-indigo-600">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block">Upload dari Galeri / File</span>
                    <span className="text-[11px] text-indigo-500">Pilih file JPG, PNG, atau WebP</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
               </label>
            </div>

            {/* Preview Area */}
            {imagePreview && (
              <div className="mt-3 relative w-full h-64 bg-slate-900 rounded-xl overflow-hidden border-2 border-blue-400 shadow-sm">
                <img src={imagePreview} alt="Bukti" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                <button 
                  type="button"
                  className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow-md transition-colors"
                  onClick={() => setImagePreview(null)}
                  title="Hapus / Kosongkan Foto"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg">
                   <span className="flex items-center gap-1 font-medium">
                     <Check className="w-3.5 h-3.5 text-green-400" /> Foto Terpasang (Opsional)
                   </span>
                   <button
                     type="button"
                     onClick={() => setImagePreview(null)}
                     className="text-[11px] text-red-300 hover:text-white underline font-semibold"
                   >
                     Hapus / Batal Pasang Foto
                   </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-3.5 rounded-xl font-bold hover:shadow-lg hover:scale-[1.01] transition-all duration-200 shadow-blue-200"
          >
            Simpan Laporan
          </button>
        </form>
      </div>
      
      {/* Live Camera Modal */}
      {showCamera && (
        <CameraModal 
           onClose={() => setShowCamera(false)}
           onCapture={handleCameraCapture}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Table className="w-5 h-5 text-blue-600" /> Import Laporan (Excel)
              </h3>
              <button 
                onClick={() => setShowImportModal(false)} 
                className="text-slate-400 hover:text-red-500 transition-colors"
                disabled={isSyncing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
               <div className="border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-blue-50/30 hover:bg-blue-50 transition-colors text-center group">
                  <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-sm text-slate-600 mb-4 font-medium">Upload file Excel (.xlsx / .xls)</p>
                  <div className="flex flex-col items-center gap-4">
                     <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition">
                        {selectedExcelFile ? 'Ganti File' : 'Pilih File'}
                        <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} className="hidden" disabled={isSyncing} />
                     </label>
                     {selectedExcelFile && (
                        <div className="w-full">
                           <div className="bg-white border border-blue-100 p-3 rounded-xl mb-4 flex items-center justify-between shadow-sm">
                              <span className="text-sm text-slate-700 truncate font-medium">{selectedExcelFile.name}</span>
                              <button onClick={() => setSelectedExcelFile(null)} className="text-red-400 hover:text-red-600" disabled={isSyncing}>
                                 <X className="w-4 h-4" />
                              </button>
                           </div>
                           <button 
                              onClick={execUploadExcel}
                              disabled={isSyncing}
                              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:bg-slate-300"
                           >
                              {isSyncing ? 'Memproses...' : 'Proses Import'}
                           </button>
                        </div>
                     )}
                  </div>
               </div>
               
               <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <h4 className="text-xs font-bold text-amber-800 uppercase mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Petunjuk Penting
                  </h4>
                  <ul className="text-[10px] text-amber-700 space-y-1 list-disc pl-3">
                    <li>Gunakan <strong>NIS</strong> atau <strong>Nama + Kelas</strong> yang sesuai dengan data siswa di sistem.</li>
                    <li>Siswa harus sudah terdaftar di menu <strong>Data Siswa</strong> sebelum melakukan import laporan.</li>
                    <li>Kategori yang valid: <strong>Ringan, Sedang, Berat, Prestasi</strong>.</li>
                    <li>Poin: Gunakan angka (cth: 10 atau -5).</li>
                  </ul>
               </div>

               <div className="border-t border-slate-100 pt-4">
                   <button 
                     onClick={handleDownloadTemplate}
                     className="w-full flex items-center justify-center gap-2 text-sm font-bold text-blue-600 bg-white border border-blue-200 py-3 rounded-xl hover:bg-blue-50 transition shadow-sm"
                   >
                      <FileDown className="w-4 h-4" /> Unduh Template Excel Pelanggaran
                   </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ViolationForm;