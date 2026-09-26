// ========================================================================
// DesignationsModule Component
// Designation Master Management (Strictly Tenant-Scoped)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { Designation } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface DesignationsModuleProps {
  tabId: string;
}

export const DesignationsModule: React.FC<DesignationsModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { hasPermission } = usePermission();

  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<Designation[]>('/people/designations');
      setDesignations(data);
    } catch (err) {
      console.error('Failed to load designations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      code: '',
      name: '',
      description: '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (desig: Designation) => {
    setEditingId(desig.id);
    setFormData({
      code: desig.code,
      name: desig.name,
      description: desig.description || '',
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
        await api.put(`/people/designations/${editingId}`, formData);
      } else {
        await api.post('/people/designations', formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save designation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove designation "${name}"?`)) return;
    try {
      await api.delete(`/people/designations/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete designation');
    }
  };

  const filtered = designations.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Designation Master</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              Tenant Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure school staff designations, academic ranks, leadership posts, and hierarchy order.
          </p>
        </div>

        {hasPermission('users.create') && (
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Designation
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="max-w-md">
          <Input
            placeholder="Search designations by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs"
          />
        </div>
      </Card>

      {/* Designations Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Designation Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Loading designations...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    No designations defined.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {d.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-teal-700">
                      {d.code}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-sm">
                      {d.description || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={d.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(d)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(d.id, d.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Designation' : 'Create New Designation'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Designation Name *</label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Trained Graduate Teacher (TGT)"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              disabled={!!editingId}
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. DES-TGT"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief summary of duties or scope"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingId ? 'Save Changes' : 'Create Designation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
