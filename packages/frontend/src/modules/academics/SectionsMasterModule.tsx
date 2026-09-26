// ========================================================================
// SectionsMasterModule Component
// Dedicated Sections Master Management
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Grid,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { SectionItem } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface SectionsMasterModuleProps {
  tabId: string;
}

export const SectionsMasterModule: React.FC<SectionsMasterModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<SectionItem[]>('/academics/sections?includeInactive=true');
      setSections(data);
    } catch (err) {
      console.error('Failed to load sections:', err);
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
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sec: SectionItem) => {
    setEditingId(sec.id);
    setFormData({
      name: sec.name,
      code: sec.code,
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
        await api.put(`/academics/sections/${editingId}`, formData);
      } else {
        await api.post('/academics/sections', formData);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save section');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete section "${name}"?`)) return;
    try {
      await api.delete(`/academics/sections/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete section');
    }
  };

  const filtered = sections.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Grid className="w-5 h-5 text-teal-600" />
            Sections Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable division labels (A, B, C or Alpha, Beta). Newest created sections appear first.
          </p>
        </div>
        {hasPermission('sections.manage') && (
          <Button
            onClick={handleOpenCreate}
            variant="primary"
            className="self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Section
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
              placeholder="Search sections by name or code..."
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Sections Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Section Name</th>
                <th className="py-3 px-4">Section Code</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    Loading sections...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    No sections found.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-teal-700">
                      {s.code}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={s.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasPermission('sections.manage') ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(s)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(s.id, s.name)}
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
        title={editingId ? 'Edit Section' : 'Create New Section'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Section Name *</label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. A or Alpha"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              disabled={!!editingId}
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SEC-A"
            />
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
              {submitting ? 'Saving...' : editingId ? 'Update Section' : 'Create Section'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
