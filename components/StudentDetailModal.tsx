import React, { useState } from 'react';
import { toast } from 'sonner';
import { Student, ViolationRecord, ViolationCategory, AppConfig, User } from '../types';
import { X, User as UserIcon, Trophy, AlertTriangle, Calendar, Award, Printer, ArrowDownCircle, Clock, BellRing, Volume2, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { PROVINSI_LOGO_URL } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStudentTardinessInfo, generateTardinessLetterPdf, playAlarmSound, isTardinessRecord } from '../utils/tardiness';
import { KopSurat } from './KopSurat';
import { drawPdfKopSurat } from '../utils/pdfKop';

interface StudentDetailModalProps {
  student: Student;
  violations: ViolationRecord[];
  onClose: () => void;
  appConfig: AppConfig;
  currentUser: User;
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ student, violations, onClose, appConfig, currentUser }) => {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'tardiness'>('all');

  const handleDownloadImage = async (url: string) => {
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `bukti-foto-${student.name.replace(/\s+/g, '_')}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Foto berhasil diunduh.");
        return;
      }

      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const extension = blob.type.split('/')[1] || 'jpg';
        link.download = `bukti-foto-${student.name.replace(/\s+/g, '_')}-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        toast.success("Foto berhasil diunduh.");
      } catch (fetchErr) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = `bukti-foto-${student.name.replace(/\s+/g, '_')}-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Mengunduh / membuka gambar.");
      }
    } catch (err) {
      console.error(err);
      window.open(url, '_blank');
      toast.info("Gambar dibuka di tab baru.");
    }
  };

  // Tardiness summary for this student
  const tardinessInfo = getStudentTardinessInfo(student.id, student.name, student.class, violations);

  // Filter violations for this student and sort by date (newest first)
  const allStudentRecords = violations
    .filter(v => v.studentId === student.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const studentRecords = activeFilter === 'tardiness'
    ? allStudentRecords.filter(r => isTardinessRecord(r))
    : allStudentRecords;

  const handlePrintTardinessLetter = async () => {
    try {
      toast.info("Menyiapkan Surat Panggilan Orang Tua...");
      const url = await generateTardinessLetterPdf(student, tardinessInfo, appConfig, currentUser);
      setPdfPreviewUrl(url);
      toast.success("Surat Panggilan Orang Tua berhasil dibuat.");
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat surat panggilan.");
    }
  };

  const handlePrint = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Kop Surat Resmi
      const currentY = await drawPdfKopSurat(doc, appConfig, 8);

      // Title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("LAPORAN RIWAYAT PELANGGARAN & PRESTASI SISWA", pageWidth / 2, currentY + 6, { align: 'center' });

      // Student Info
      doc.setFontSize(10);
      doc.text("BIODATA SISWA", 15, currentY + 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nama Lengkap : ${student.name}`, 15, currentY + 22);
      doc.text(`Kelas         : ${student.class} (${student.gender === 'L' ? 'Laki-laki' : 'Perempuan'})`, 15, currentY + 27);
      doc.text(`NIS / NISN    : ${student.nis} / ${student.nisn || '-'}`, 15, currentY + 32);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL POIN : ${student.totalPoints}`, pageWidth - 15, currentY + 22, { align: 'right' });

      // Table
      const headers = [["Tanggal", "Kategori", "Deskripsi Kejadian", "Poin"]];
      const body = studentRecords.map(record => [
        new Date(record.date).toLocaleDateString('id-ID'),
        record.category.toUpperCase(),
        record.description,
        record.category === ViolationCategory.PRESTASI ? record.points : `+${record.points}`
      ]);

      autoTable(doc, {
        startY: currentY + 40,
        head: headers,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }
        }
      });

      // Signature
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Left side
      doc.text("Mengetahui,", 15, finalY);
      doc.text("Orang Tua / Wali", 15, finalY + 5);
      doc.text("( ........................................ )", 15, finalY + 35);

      // Right side
      doc.text(`Kudus, ${today}`, pageWidth - 15, finalY, { align: 'right' });
      doc.text(currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK', pageWidth - 15, finalY + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(currentUser.name, pageWidth - 15, finalY + 35, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      if (currentUser.nip) {
        doc.text(`NIP. ${currentUser.nip}`, pageWidth - 15, finalY + 39, { align: 'right' });
      }

      // Preview instead of save
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      toast.info("Pratinjau PDF telah dibuat.");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Gagal membuat PDF. Silakan coba lagi.");
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement('a');
    link.href = pdfPreviewUrl;
    link.download = `SIPERSIS_Siswa_${student.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    link.click();
  };

  const closePreview = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfPreviewUrl(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:block">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:h-auto print:overflow-visible">
        
        {/* Screen Header (Hidden on Print) */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-6 flex justify-between items-start text-white shrink-0 print:hidden">
          <div className="flex items-center gap-6">
            <div className="relative">
              {student.photoUrl ? (
                <button
                  type="button"
                  onClick={() => setPreviewImage(student.photoUrl!)}
                  className="group relative block rounded-full focus:outline-none"
                  title="Klik untuk lihat & unduh foto siswa"
                >
                  <img 
                    src={student.photoUrl} 
                    alt={student.name} 
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/30 shadow-lg group-hover:opacity-90 transition" 
                  />
                  <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition">
                    Lihat Foto
                  </span>
                </button>
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg">
                  <UserIcon className="w-10 h-10 text-white" />
                </div>
              )}
              {student.totalPoints < 0 && (
                <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 p-1.5 rounded-full shadow-md border-2 border-white">
                  <Trophy className="w-5 h-5" />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold">{student.name}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-blue-50">
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm font-mono">NIS: {student.nis}</span>
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm font-mono">NISN: {student.nisn || '-'}</span>
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm font-bold">{student.class}</span>
                 <span className={`bg-white/20 px-3 py-1 rounded-lg text-sm backdrop-blur-sm font-bold border ${student.gender === 'P' ? 'border-pink-300 text-pink-100' : 'border-blue-300'}`}>
                    {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                 </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
             <div className="flex gap-2">
               <button 
                  onClick={handlePrint} 
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg backdrop-blur-sm border border-white/20"
               >
                 <Printer className="w-5 h-5" /> Cetak PDF
               </button>
               <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors" title="Tutup">
                 <X className="w-6 h-6" />
               </button>
             </div>
             <div className="bg-white text-indigo-900 px-4 py-2 rounded-xl shadow-lg text-center min-w-[100px]">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Poin</p>
                <p className={`text-2xl font-extrabold ${student.totalPoints > 50 ? 'text-red-600' : student.totalPoints < 0 ? 'text-green-600' : 'text-indigo-900'}`}>
                  {student.totalPoints}
                </p>
             </div>
          </div>
        </div>

        {/* ALARM KETERLAMBATAN BANNER DALAM MODAL (Hidden on Print) */}
        {tardinessInfo.isAlarm && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-4 px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md print:hidden border-b border-red-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl animate-pulse shadow-inner flex-shrink-0">
                <BellRing className="w-5 h-5 text-yellow-300" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-yellow-400 text-red-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                    🚨 Alarm Keterlambatan Aktif ({tardinessInfo.count}x)
                  </span>
                  <span className="font-extrabold text-sm text-white">
                    {tardinessInfo.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-rose-100 mt-0.5 font-medium">
                  Rekomendasi Tindakan: <span className="font-bold underline">{tardinessInfo.actionRequired}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  playAlarmSound();
                  toast.info("Memutar nada alarm keterlambatan.");
                }}
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-white/20"
                title="Bunyikan Alarm"
              >
                <Volume2 className="w-3.5 h-3.5 text-yellow-300" /> Nada Alarm
              </button>
              <button
                onClick={handlePrintTardinessLetter}
                className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-black transition shadow-md flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-red-600" /> Cetak Surat Panggilan Ortu
              </button>
            </div>
          </div>
        )}

        {/* KOP SURAT (Visible only on print) */}
        <div className="hidden print:block p-8">
          <KopSurat appConfig={appConfig} showBorder={true} />
        </div>

        {/* Print Content Header */}
        <div className="hidden print:block px-8 mb-4">
          <div className="text-center mb-8">
             <h2 className="text-2xl font-black uppercase">LAPORAN RIWAYAT PELANGGARAN & PRESTASI SISWA</h2>
          </div>
          
          <div className="flex justify-between items-start mb-6">
             <div className="space-y-1">
                <h3 className="text-lg font-bold mb-2">BIODATA SISWA</h3>
                <table className="text-sm font-medium">
                   <tbody>
                      <tr>
                         <td className="w-32 py-0.5">Nama Lengkap</td>
                         <td className="w-4">:</td>
                         <td className="uppercase font-bold">{student.name}</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">Kelas</td>
                         <td>:</td>
                         <td>{student.class} ({student.gender === 'L' ? 'Laki-laki' : 'Perempuan'})</td>
                      </tr>
                      <tr>
                         <td className="py-0.5">NIS / NISN</td>
                         <td>:</td>
                         <td className="font-mono">{student.nis} / {student.nisn || '-'}</td>
                      </tr>
                   </tbody>
                </table>
             </div>
             <div className="text-right">
                <div className="text-xl font-black bg-slate-100 p-4 border-2 border-black rounded-lg">
                   TOTAL POIN : {student.totalPoints}
                </div>
             </div>
          </div>
        </div>

        {/* Content List */}
        <div className="p-6 overflow-y-auto bg-slate-50 flex-1 print:bg-white print:p-8 print:overflow-visible">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 print:hidden">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" /> Riwayat Catatan Siswa
            </h3>

            {/* Filter Toggle */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Catatan ({allStudentRecords.length})
              </button>
              <button
                onClick={() => setActiveFilter('tardiness')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeFilter === 'tardiness' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : tardinessInfo.isAlarm 
                    ? 'text-red-600 font-extrabold animate-pulse' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Keterlambatan ({tardinessInfo.count})
                {tardinessInfo.isAlarm && (
                  <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
              </button>
            </div>
          </div>

          {studentRecords.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed print:border-black">
               <p className="text-slate-400 print:text-black">
                 {activeFilter === 'tardiness' 
                   ? 'Siswa ini tidak memiliki catatan keterlambatan (Tertib).' 
                   : 'Belum ada catatan pelanggaran atau prestasi.'}
               </p>
            </div>
          ) : (
            <div className="space-y-4 print:space-y-0">
               {/* Print Table Header */}
               <div className="hidden print:grid grid-cols-12 gap-2 font-bold text-sm border-b-2 border-black pb-2 mb-2">
                  <div className="col-span-2">Tanggal</div>
                  <div className="col-span-2">Kategori</div>
                  <div className="col-span-6">Deskripsi Kejadian</div>
                  <div className="col-span-2 text-right">Poin</div>
               </div>

               {studentRecords.map((record) => (
                 <div 
                    key={record.id} 
                    className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center transition-all hover:shadow-md print:shadow-none print:rounded-none print:border-0 print:border-b print:border-black/50 print:p-2 print:grid print:grid-cols-12 print:gap-2 print:items-start
                      ${record.category === ViolationCategory.PRESTASI ? 'border-green-300 ring-1 ring-green-100' : 'border-slate-200'}
                    `}
                 >
                    {/* Screen View: Date */}
                    <div className="flex-shrink-0 min-w-[100px] text-center md:text-left print:hidden">
                       <span className="block text-xs font-bold text-black uppercase">{new Date(record.date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</span>
                       <span className="block text-xl font-bold text-black">{new Date(record.date).getDate()}</span>
                       <span className="block text-xs text-black">{new Date(record.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>

                     {/* Print View: Date */}
                    <div className="hidden print:block col-span-2 text-sm text-black">
                       {new Date(record.date).toLocaleDateString('id-ID')}
                    </div>

                    <div className="flex-1 print:col-span-8 print:grid print:grid-cols-8 print:gap-2">
                       {/* Category */}
                       <div className="flex flex-col gap-1 mb-1 print:col-span-2 print:mb-0">
                          {record.category === ViolationCategory.PRESTASI ? (
                             <span className="w-fit bg-green-100 text-green-900 border border-green-600 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 print:border-0 print:p-0 print:bg-white print:text-black">
                                <Award className="w-3 h-3 print:hidden" /> PRESTASI
                             </span>
                          ) : (
                             <span className={`w-fit px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 bg-white text-black border print:border-0 print:p-0
                                ${record.category === ViolationCategory.RINGAN ? 'border-yellow-500' :
                                  record.category === ViolationCategory.SEDANG ? 'border-orange-500' :
                                  'border-red-500'}
                             `}>
                                <AlertTriangle className="w-3 h-3 print:hidden" /> {record.category.toUpperCase()}
                             </span>
                          )}
                          <span className="text-xs text-slate-500 print:hidden">Oleh: {record.reporterName}</span>
                       </div>
                       
                       {/* Description */}
                       <div className="print:col-span-6">
                         <p className="text-black font-medium print:text-sm print:font-normal">{record.description}</p>
                         
                         {/* Explicit Label for Reward reducing points */}
                         {record.category === ViolationCategory.PRESTASI && (
                             <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded border border-green-200 print:border-black print:text-black print:bg-white">
                                <ArrowDownCircle className="w-3 h-3" /> Mengurangi Poin Pelanggaran
                             </div>
                         )}

                         {/* Tardiness Badge */}
                         {isTardinessRecord(record) && (
                             <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded border border-rose-200 print:border-black print:text-black print:bg-white">
                                <Clock className="w-3 h-3 text-rose-600" /> Keterlambatan Masuk Sekolah
                             </div>
                         )}

                         {record.evidenceUrl && (
                            <div className="mt-2.5 print:hidden">
                               <button 
                                 type="button"
                                 onClick={() => setPreviewImage(record.evidenceUrl!)} 
                                 className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition shadow-xs"
                                 title="Klik untuk lihat & unduh bukti foto"
                               >
                                 <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                 Lihat & Unduh Bukti Foto
                               </button>
                            </div>
                         )}
                       </div>
                    </div>

                    <div className="flex-shrink-0 text-right print:col-span-2">
                       <span className={`text-lg font-bold print:text-sm ${record.category === ViolationCategory.PRESTASI ? 'text-green-600' : 'text-red-600'} print:text-black`}>
                          {record.category === ViolationCategory.PRESTASI ? '' : '+'}{record.points}
                       </span>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 text-center text-xs text-slate-400 print:hidden">
          Catatan: Prestasi (Poin Negatif) akan mengurangi total poin pelanggaran siswa.
        </div>

        {/* Print Footer / Signature */}
        <div className="hidden print:flex justify-between items-start mt-12 px-12 pb-12 w-full">
           <div className="text-center w-64">
              <p className="mb-24 font-medium">
                 Mengetahui,<br/>Orang Tua / Wali
              </p>
              <p className="font-bold uppercase pb-1">( ........................................ )</p>
           </div>
           <div className="text-center w-64">
              <p className="mb-24 font-medium">
                 Kudus, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br/>
                 {currentUser.role === 'ADMIN' ? 'Admin' : 'Guru BK'}
              </p>
              <div>
                 <p className="font-bold uppercase">{currentUser.name}</p>
                 {currentUser.nip && <p className="text-xs">NIP. {currentUser.nip}</p>}
              </div>
           </div>
        </div>

      </div>

      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300 print:hidden">
          <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-700">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-white shrink-0">
               <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
                     <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none">Pratinjau Riwayat Siswa</h3>
                    <p className="text-xs text-slate-400 mt-1">Silakan periksa biodata dan catatan sebelum mengunduh</p>
                  </div>
               </div>
               <div className="flex gap-2">
                 <button 
                   onClick={handleDownloadPdf}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-indigo-900/20"
                 >
                   <ArrowDownCircle className="w-4 h-4" /> Unduh PDF
                 </button>
                 <button 
                   onClick={closePreview}
                   className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-xl transition"
                 >
                   <X className="w-6 h-6" />
                 </button>
               </div>
            </div>
            <div className="flex-1 bg-slate-800 relative">
               <iframe 
                 src={pdfPreviewUrl} 
                 className="w-full h-full border-0"
                 title="PDF Preview"
               />
               <div className="absolute inset-0 flex items-center justify-center -z-10 text-slate-400">
                  Memuat Pratinjau PDF...
               </div>
            </div>
            <div className="p-4 bg-slate-900 text-center text-xs text-slate-500 border-t border-slate-800">
              Gunakan kontrol di dalam preview PDF untuk mencetak langsung jika didukung oleh browser Anda.
            </div>
          </div>
        </div>
      )}
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 print:hidden" 
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">Bukti Foto / Gambar</h4>
                  <p className="text-[11px] text-slate-400">Siswa: {student.name} ({student.class})</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadImage(previewImage)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md shadow-blue-900/30"
                  title="Unduh File Gambar Ini"
                >
                  <ArrowDownCircle className="w-4 h-4" /> Unduh Gambar
                </button>
                <button
                  onClick={() => window.open(previewImage, '_blank')}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition"
                  title="Buka di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl transition"
                  title="Tutup Pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img 
                src={previewImage} 
                alt="Bukti Foto" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl" 
              />
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-between px-6">
              <span>Format: PNG, JPG, JPEG, WebP</span>
              <button 
                onClick={() => handleDownloadImage(previewImage)}
                className="text-blue-400 hover:underline font-semibold flex items-center gap-1"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" /> Simpan Gambar ke Komputer / HP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetailModal;