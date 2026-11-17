import React, { useState } from 'react';
import { ViolationType, ViolationCategory } from '../types';
import { Plus, Trash2, Tag, Save, X, Pencil } from 'lucide-react';

interface ViolationTypeManagementProps {
  types: ViolationType[];
  onAddType: (type: ViolationType) => void;
  onUpdateType: (type: ViolationType) => void;
  onDeleteType: (id: string) => void;
}

const ViolationTypeManagement: React.FC<ViolationTypeManagementProps> = ({ types, onAddType, onUpdateType, onDeleteType }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [label, setLabel] = useState('');
  const [points, setPoints] = useState(5);
  const [category, setCategory] = useState<ViolationCategory>(ViolationCategory.RINGAN);

  const handleAddNew = () => {
    setEditingId(null);
    setLabel('');
    setPoints(5);
    setCategory(ViolationCategory.RINGAN);
    setIsFormOpen(true);
  };

  const handleEdit = (type: ViolationType) => {
    setEditingId(type.id);
    setLabel(type.label);
    setPoints(type.points);
    setCategory(type.category);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      // Update existing
      onUpdateType({
        id: editingId,
        label,
        points,
        category
      });
    } else {
      // Add new
      onAddType({
        id: Date.now().toString(),
        label,
        points,
        category,
      });
    }
    setIsFormOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-sky-100 overflow-hidden">
      <div className="p-6 border-b border-sky-100 flex justify-between items-center bg-gradient-to-r from-sky-50 to-white">
        <h4 className="font-semibold text-lg flex items-center gap-2 text-sky-900">
          <Tag className="w-5 h-5 text-sky-600" /> Master Data Jenis Pelanggaran
        </h4>
        <button 
          onClick={handleAddNew}
          className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-sky-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Tambah Baru
        </button>
      </div>

      {isFormOpen && (
        <div className="p-4 bg-sky-50 border-b border-sky-100 animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-2">
             <h5 className="text-xs font-bold uppercase text-sky-600 tracking-wide">{editingId ? 'Edit Data' : 'Tambah Data Baru'}</h5>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-sky-700 mb-1">Nama Pelanggaran / Reward</label>
              <input 
                type="text" 
                required
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full p-2 border border-sky-200 rounded-lg text-sm bg-white text-black"
                placeholder="Contoh: Merusak fasilitas..."
              />
            </div>
            <div className="w-full md:w-32">
              <label className="block text-xs font-semibold text-sky-700 mb-1">Poin</label>
              <input 
                type="number" 
                required
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
                className="w-full p-2 border border-sky-200 rounded-lg text-sm bg-white text-black"
              />
              <span className="text-[10px] text-sky-500">*Gunakan minus (-) untuk Reward</span>
            </div>
            <div className="w-full md:w-40">
              <label className="block text-xs font-semibold text-sky-700 mb-1">Kategori</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value as ViolationCategory)}
                className="w-full p-2 border border-sky-200 rounded-lg text-sm bg-white text-black"
              >
                {Object.values(ViolationCategory).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm" title="Simpan">
                <Save className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => setIsFormOpen(false)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition" title="Batal">
                <X className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-sky-50 text-sky-800 sticky top-0">
            <tr>
              <th className="px-6 py-3 font-medium">Nama Pelanggaran / Reward</th>
              <th className="px-6 py-3 font-medium">Kategori</th>
              <th className="px-6 py-3 font-medium">Poin</th>
              <th className="px-6 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((type) => (
              <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 font-medium text-slate-700">{type.label}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold
                     ${type.category === ViolationCategory.RINGAN ? 'bg-yellow-100 text-yellow-800' :
                       type.category === ViolationCategory.SEDANG ? 'bg-orange-100 text-orange-800' :
                       type.category === ViolationCategory.BERAT ? 'bg-red-100 text-red-800' :
                       'bg-green-100 text-green-800'
                     }
                  `}>
                    {type.category}
                  </span>
                </td>
                <td className="px-6 py-3 font-mono font-bold">
                   <span className={type.points < 0 ? 'text-green-600' : 'text-red-600'}>
                     {type.points > 0 ? `+${type.points}` : type.points}
                   </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleEdit(type)}
                      className="p-1.5 rounded bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('Apakah Anda yakin ingin menghapus jenis pelanggaran ini?')) {
                          onDeleteType(type.id);
                        }
                      }}
                      className="p-1.5 rounded bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViolationTypeManagement;