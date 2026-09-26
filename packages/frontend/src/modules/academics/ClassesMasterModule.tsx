// ========================================================================
// ClassesMasterModule Component
// Dedicated Classes Master Management
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  RefreshCw,
  Hash
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { ClassItem } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface ClassesMasterModuleProps {
  tabId: string;
}

export const ClassesMasterModule: React.FC<ClassesMasterModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    display_name: '',
    numeric_order: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<ClassItem[]>('/academics/classes?includeInactive=true');
      setClasses(data);
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      display_name: '',
      numeric_order: classes.length + 1,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cls: ClassItem) => {
    setEditingId(cls.id);
    setFormData({
      name: cls.name,
      code: cls.code,
      display_name: cls.display_name,
      numeric_order: cls.numeric_order,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingId) {
        await api.put(`/academics/classes/${editingId}`, formData);
      } else {
        await api.post('/academics/classes', formData);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete class "${name}"?`)) return;
    try {
      await api.delete(`/academics/classes/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete class');
    }
  };

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            Classes Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable academic grades and class levels. Newest created classes appear first.
          </p>
        </div>
        {hasPermission('classes.manage') && (
          <Button
            onClick={handleOpenCreate}
            variant="primary"
            className="self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search classes by name, code, or display name..."
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Classes Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Class Name</th>
                <th className="py-3 px-4">Display Label</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Numeric Order</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading classes...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No classes found.
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {c.display_name}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-teal-700">
                      {c.code}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {c.numeric_order}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={c.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasPermission('classes.manage') ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(c)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(c.id, c.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Class' : 'Create New Class'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Class Name *</label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. 10 or Nursery"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Display Label *</label>
            <Input
              required
              value={formData.display_name}
              onChange={e => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="e.g. Class 10 or Nursery"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
              <Input
                required
                disabled={!!editingId}
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CLS-10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Numeric Order</label>
              <Input
                type="number"
                required
                value={formData.numeric_order}
                onChange={e => setFormData({ ...formData, numeric_order: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingId ? 'Update Class' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
