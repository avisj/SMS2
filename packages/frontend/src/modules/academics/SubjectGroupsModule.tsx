// ========================================================================
// SubjectGroupsModule Component
// Dedicated Subject Groups Management
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { SubjectGroup, SubjectItem } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface SubjectGroupsModuleProps {
  tabId: string;
}

export const SubjectGroupsModule: React.FC<SubjectGroupsModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    subject_ids: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, subjectsData] = await Promise.all([
        api.get<SubjectGroup[]>('/academics/subject-groups'),
        api.get<SubjectItem[]>('/academics/subjects'),
      ]);
      setGroups(groupsData);
      setSubjects(subjectsData);
    } catch (err) {
      console.error('Failed to load subject groups:', err);
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
      description: '',
      subject_ids: [],
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (grp: SubjectGroup) => {
    setEditingId(grp.id);
    setFormData({
      name: grp.name,
      code: grp.code,
      description: grp.description || '',
      subject_ids: grp.subjects?.map(s => s.id) || [],
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const toggleSubject = (subId: string) => {
    setFormData(prev => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(subId)
        ? prev.subject_ids.filter(id => id !== subId)
        : [...prev.subject_ids, subId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingId) {
        await api.put(`/academics/subject-groups/${editingId}`, formData);
      } else {
        await api.post('/academics/subject-groups', formData);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save subject group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete subject group "${name}"?`)) return;
    try {
      await api.delete(`/academics/subject-groups/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subject group');
    }
  };

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-teal-600" />
            Subject Groups Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable academic clusters (e.g. Core Subjects, Science Electives). Zero comma-separated values.
          </p>
        </div>
        {hasPermission('subject_groups.manage') && (
          <Button
            onClick={handleOpenCreate}
            variant="primary"
            className="self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Subject Group
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
              placeholder="Search subject groups by name or code..."
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Groups Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Group Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Included Subjects</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading subject groups...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No subject groups found.
                  </td>
                </tr>
              ) : (
                filtered.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {g.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-teal-700">
                      {g.code}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs">
                      {g.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {g.subjects && g.subjects.length > 0 ? (
                          g.subjects.map(sub => (
                            <Badge key={sub.id} variant="slate" className="text-[10px]">
                              {sub.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No subjects linked</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={g.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                        {g.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasPermission('subject_groups.manage') ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(g)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(g.id, g.name)}
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
        title={editingId ? 'Edit Subject Group' : 'Create New Subject Group'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Group Name *</label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Core Foundation Subjects"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              disabled={!!editingId}
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. GRP-CORE"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Group notes or purpose"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Select Subjects Included in Group
            </label>
            <div className="border border-slate-200 rounded-lg p-2.5 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50">
              {subjects.map(sub => {
                const isSelected = formData.subject_ids.includes(sub.id);
                return (
                  <label
                    key={sub.id}
                    className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-teal-50 border border-teal-200 text-teal-900 font-medium' : 'hover:bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSubject(sub.id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>{sub.name}</span>
                    <span className="text-[11px] font-mono text-slate-400 ml-auto">{sub.code}</span>
                  </label>
                );
              })}
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
              {submitting ? 'Saving...' : editingId ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
