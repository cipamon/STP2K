import React from 'react';
import { AppConfig } from '../types';
import { PROVINSI_LOGO_URL } from '../constants';

interface KopSuratProps {
  appConfig: AppConfig;
  className?: string;
  showBorder?: boolean;
}

export const KopSurat: React.FC<KopSuratProps> = ({ 
  appConfig, 
  className = '',
  showBorder = true 
}) => {
  const govHeader = appConfig.governmentHeader || 'PEMERINTAH PROVINSI JAWA TENGAH';
  const deptHeader = appConfig.departmentHeader || 'DINAS PENDIDIKAN';
  
  // Format formal school name in Kop: if "SMA Negeri 1 Kudus", use "SEKOLAH MENENGAH ATAS NEGERI 1 KUDUS" matching user's official kop
  let formalSchoolName = appConfig.schoolName;
  if (!formalSchoolName || formalSchoolName.trim().toUpperCase() === 'SMA NEGERI 1 KUDUS') {
    formalSchoolName = 'SEKOLAH MENENGAH ATAS NEGERI 1 KUDUS';
  }

  const address = appConfig.address || 'Jalan Pramuka Nomor 41, Kota Kudus, Kabupaten Kudus, Jawa Tengah,';
  const postalCode = appConfig.postalCode || '59319';
  const phone = appConfig.phone || '0291-431368';
  const fax = appConfig.fax || '0291-431368';
  const website = appConfig.website || 'http://sma1kudus.sch.id';
  const email = appConfig.email || 'sma1kds@yahoo.co.id';
  const provLogo = appConfig.provinsiLogoUrl || PROVINSI_LOGO_URL;
  const schoolLogo = appConfig.logoUrl || '/logo.png';

  return (
    <div className={`w-full text-black font-sans select-none bg-white ${className}`}>
      <div className="flex items-center justify-between gap-4 sm:gap-6 pb-2">
        {/* Logo Provinsi Jawa Tengah (Kiri) */}
        <div className="w-20 sm:w-28 shrink-0 flex items-center justify-center">
          <img 
            src={provLogo} 
            alt="Logo Provinsi Jawa Tengah" 
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PROVINSI_LOGO_URL;
            }}
          />
        </div>

        {/* Kop Surat Header Text (Tengah) */}
        <div className="text-center flex-1 px-1 sm:px-2 leading-snug">
          <h3 className="text-base sm:text-lg md:text-xl font-normal uppercase tracking-wider text-black font-sans">
            {govHeader}
          </h3>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold uppercase tracking-wide text-black mt-0.5 font-sans">
            {deptHeader}
          </h2>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-black mt-0.5 font-sans">
            {formalSchoolName}
          </h1>
          <p className="text-xs sm:text-sm text-black font-normal mt-1.5 leading-snug font-sans">
            {address}
          </p>
          <p className="text-[11px] sm:text-[13px] text-black font-normal leading-snug font-sans">
            Kode Pos {postalCode} Telepon {phone}, Faksimile {fax},
          </p>
          <p className="text-[11px] sm:text-[13px] text-black font-normal leading-snug font-sans">
            Laman <span className="text-blue-700 underline">{website}</span> Pos-el <span className="text-black">{email}</span>
          </p>
        </div>

        {/* Logo SMA Negeri 1 Kudus (Kanan) */}
        <div className="w-20 sm:w-28 shrink-0 flex items-center justify-center">
          <img 
            src={schoolLogo} 
            alt="Logo SMA Negeri 1 Kudus" 
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
          />
        </div>
      </div>

      {/* Garis Ganda Standar Surat Dinas: Garis tebal di atas dan garis tipis di bawah */}
      {showBorder && (
        <div className="mt-1.5 pb-2">
          <div className="w-full h-[3.5px] bg-black"></div>
          <div className="w-full h-[1px] bg-black mt-[2px]"></div>
        </div>
      )}
    </div>
  );
};

export default KopSurat;
