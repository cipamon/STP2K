import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { UserPlus, Pencil, Trash2, X, Save, Shield, Key, User as UserIcon, Eye, EyeOff, Search, GraduationCap, ChevronDown, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from './ConfirmModal';

interface UserManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onBulkDeleteUsers?: (userIds: string[]) => void;
  currentUser?: User;
}

const UserManagement: React.FC<UserManagementProps> = ({ 
  users, 
  onAddUser, 
  onUpdateUser, 
  onDeleteUser,
  onBulkDeleteUsers,
  currentUser 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Selection & Delete Menu States
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  // In-app ConfirmModal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    action: () => void;
    variant: 'danger' | 'warning';
    confirmText: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    variant: 'danger',
    confirmText: 'Hapus',
  });

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    nip: '',
    role: UserRole.GURU,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
  });

  const handleOpenModal = (user?: User) => {
    setShowPassword(false);
    if (user) {
      setEditingUser(user);
      setFormData({ 
        name: user.name, 
        username: user.username,
        password: user.password,
        nip: user.nip || '',
        role: user.role, 
        avatar: user.avatar || '' 
      });
    } else {
      setEditingUser(null);
      setFormData({ 
        name: '', 
        username: '',
        password: '',
        nip: '',
        role: UserRole.GURU, 
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80` 
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdateUser({ ...editingUser, ...formData });
    } else {
      onAddUser({
        id: `u-${Date.now()}`,
        ...formData
      });
    }
    setIsModalOpen(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.nip && user.nip.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Toggle single user selection
  const toggleSelect = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Toggle select all filtered users
  const toggleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  // Trigger Individual Delete
  const triggerDeleteUser = (user: User) => {
    if (currentUser && user.id === currentUser.id) {
      toast.error('Anda tidak dapat menghapus akun Anda sendiri yang sedang digunakan saat ini.');
      return;
    }
    if (users.length <= 1) {
      toast.error('Sistem membutuhkan minimal 1 akun pengguna aktif.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengguna',
      message: (
        <div>
          <p className="mb-2">Apakah Anda yakin ingin menghapus akun pengguna berikut?</p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 text-sm">{user.name}</div>
            <div className="text-xs text-slate-500 font-mono">Username: @{user.username}</div>
            <div className="text-xs text-slate-500">Role: {user.role === UserRole.ADMIN ? 'Administrator' : 'Guru'}</div>
          </div>
          <p className="mt-2 text-rose-600 text-xs font-semibold">Tindakan ini akan menghapus akun secara permanen dari basis data dan tidak dapat dibatalkan.</p>
        </div>
      ),
      variant: 'danger',
      confirmText: 'Ya, Hapus Akun',
      action: () => {
        onDeleteUser(user.id);
        setSelectedUserIds(prev => prev.filter(id => id !== user.id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Trigger Bulk Delete Selected
  const triggerBulkDelete = () => {
    if (selectedUserIds.length === 0) return;

    // Filter out current active user if selected
    const safeToDelete = selectedUserIds.filter(id => !currentUser || id !== currentUser.id);
    if (safeToDelete.length === 0) {
      toast.error('Akun yang dipilih adalah akun Anda sendiri dan tidak dapat dihapus.');
      return;
    }

    if (users.length - safeToDelete.length < 1) {
      toast.error('Tidak dapat menghapus seluruh akun. Sisakan minimal 1 akun Administrator.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Pengguna Terpilih',
      message: (
        <div>
          <p>Apakah Anda yakin ingin menghapus <strong className="text-rose-600">{safeToDelete.length} akun pengguna</strong> yang dipilih?</p>
          {selectedUserIds.includes(currentUser?.id || '') && (
            <p className="mt-2 text-amber-600 bg-amber-50 p-2 rounded-lg text-xs font-medium">
              Catatan: Akun Anda yang sedang aktif tidak akan dihapus demi keamanan sesi login.
            </p>
          )}
          <p className="mt-2 text-slate-500 text-xs">Seluruh akun yang dipilih akan dihapus secara permanen dari sistem dan Cloud Firestore.</p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus ${safeToDelete.length} Pengguna`,
      action: () => {
        if (onBulkDeleteUsers) {
          onBulkDeleteUsers(safeToDelete);
        } else {
          safeToDelete.forEach(id => onDeleteUser(id));
        }
        setSelectedUserIds([]);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Trigger Delete All Guru Accounts
  const triggerDeleteAllGuru = () => {
    const guruUsers = users.filter(u => u.role === UserRole.GURU && (!currentUser || u.id !== currentUser.id));
    if (guruUsers.length === 0) {
      toast.info('Tidak ada akun guru yang dapat dihapus.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Semua Akun Guru',
      message: (
        <div>
          <p>Tindakan ini akan menghapus seluruh <strong className="text-rose-600">{guruUsers.length} akun Dewan Guru</strong> dari sistem.</p>
          <p className="mt-2 text-slate-600 bg-slate-100 p-2.5 rounded-lg text-xs">
            Akun Administrator tetap aman dan tidak akan terhapus.
          </p>
          <p className="mt-2 text-rose-600 text-xs font-semibold">Lanjutkan penghapusan seluruh akun guru?</p>
        </div>
      ),
      variant: 'danger',
      confirmText: `Hapus ${guruUsers.length} Akun Guru`,
      action: () => {
        const ids = guruUsers.map(g => g.id);
        if (onBulkDeleteUsers) {
          onBulkDeleteUsers(ids);
        } else {
          ids.forEach(id => onDeleteUser(id));
        }
        setSelectedUserIds(prev => prev.filter(id => !ids.includes(id)));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h4 className="font-bold text-lg flex items-center gap-2 text-slate-800">
              <Shield className="w-5 h-5 text-blue-600" /> Manajemen Pengguna & Dewan Guru
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">Kelola akun akses sistem login untuk Administrator dan Dewan Guru ({users.length} terdaftar)</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Delete Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                className="flex items-center gap-1.5 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Menu Hapus User</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDeleteMenu ? 'rotate-180' : ''}`} />
              </button>

              {showDeleteMenu && (
                <div 
                  className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowDeleteMenu(false)}
                >
                  <button
                    onClick={triggerBulkDelete}
                    disabled={selectedUserIds.length === 0}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Hapus Pengguna Terpilih ({selectedUserIds.length})</span>
                  </button>
                  <button
                    onClick={triggerDeleteAllGuru}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition"
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Hapus Semua Akun Guru</span>
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition shadow-sm shadow-blue-200 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Tambah Guru / User
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama, NIP, atau username..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-between sm:justify-end">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${roleFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                Semua ({users.length})
              </button>
              <button
                onClick={() => setRoleFilter(UserRole.GURU)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${roleFilter === UserRole.GURU ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                Guru ({users.filter(u => u.role === UserRole.GURU).length})
              </button>
              <button
                onClick={() => setRoleFilter(UserRole.ADMIN)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${roleFilter === UserRole.ADMIN ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                Admin ({users.filter(u => u.role === UserRole.ADMIN).length})
              </button>
            </div>

            {selectedUserIds.length > 0 && (
              <button
                onClick={triggerBulkDelete}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition animate-in fade-in cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedUserIds.length})
              </button>
            )}
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                    onChange={toggleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    title="Pilih Semua Pengguna"
                  />
                </th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Pengguna</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Password</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider">Role / Hak Akses</th>
                <th className="px-4 py-3 font-bold text-xs uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                const isCurrentLoggedIn = currentUser?.id === user.id;

                return (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                          alt={user.name} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 text-sm leading-snug">{user.name}</p>
                            {isCurrentLoggedIn && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                                Anda
                              </span>
                            )}
                          </div>
                          {user.nip ? (
                            <p className="text-[11px] text-slate-500 font-mono">NIP: {user.nip}</p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">NIP belum diisi</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">@{user.username}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      <span className="text-slate-400">••••••</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        user.role === UserRole.ADMIN 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {user.role === UserRole.GURU && <GraduationCap className="w-3.5 h-3.5" />}
                        {user.role === UserRole.ADMIN && <Shield className="w-3.5 h-3.5" />}
                        {user.role === UserRole.GURU ? 'GURU' : 'ADMIN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenModal(user)} 
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Edit User"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => triggerDeleteUser(user)} 
                          disabled={isCurrentLoggedIn}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            isCurrentLoggedIn 
                              ? 'text-slate-300 cursor-not-allowed' 
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={isCurrentLoggedIn ? 'Tidak dapat menghapus akun Anda sendiri' : 'Hapus User'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Tidak ada pengguna yang cocok dengan filter atau pencarian "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingUser ? 'Edit Data Pengguna / Guru' : 'Tambah Guru Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Lengkap & Gelar</label>
                <div className="relative">
                   <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                   <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-medium"
                    placeholder="Contoh: Palupi Etikawati, S.Pd"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">NIP (Nomor Induk Pegawai)</label>
                <input
                  type="text"
                  value={formData.nip}
                  onChange={e => setFormData({...formData, nip: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm"
                  placeholder="Contoh: 19860412 201101 2 003"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Username Login</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '')})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-mono"
                    placeholder="Contoh: palupi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-mono"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2.5 text-slate-400 hover:text-blue-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Role / Hak Akses</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-sm font-bold"
                >
                  <option value={UserRole.GURU}>GURU (Input Laporan & Rekap Siswa)</option>
                  <option value={UserRole.ADMIN}>ADMIN (Full Access & Konfigurasi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">URL Foto Profil / Avatar (Opsional)</label>
                <input
                  type="url"
                  value={formData.avatar}
                  onChange={e => setFormData({...formData, avatar: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 text-xs text-slate-600"
                  placeholder="https://..."
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md shadow-blue-200 flex justify-center items-center gap-2 text-sm cursor-pointer">
                  <Save className="w-4 h-4" /> Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />
    </>
  );
};

export default UserManagement;
