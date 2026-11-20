import React from 'react';
import { Student } from '../types';
import { getDefaultStudentAvatar } from '../utils/avatarHelpers';
import { getStudentPhoto } from '../utils/studentHelpers';

interface StudentAvatarProps {
  student?: Pick<Student, 'name' | 'gender' | 'photoUrl' | 'avatar'> | null;
  name?: string;
  sizeClass?: string;
  className?: string;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  name,
  sizeClass = 'w-8 h-8',
  className = '',
}) => {
  const fallback = getDefaultStudentAvatar(student?.gender);
  const src = student ? getStudentPhoto(student) : fallback;
  const altText = name || student?.name || 'Siswa';

  return (
    <img
      src={src}
      alt={altText}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(fallback)) {
          e.currentTarget.src = fallback;
        }
      }}
      className={`${sizeClass} rounded-full object-cover shrink-0 border border-slate-200 bg-slate-100 shadow-2xs ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

export default StudentAvatar;
