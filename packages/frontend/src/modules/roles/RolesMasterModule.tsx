// ========================================================================
// RolesMasterModule Component
// Dedicated Roles Master Management (Configurable Roles)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  Lock,
  RefreshCw,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { Role } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface RolesMasterModuleProps {
  tabId: string;
}

export const RolesMasterModule: React.FC<RolesMasterModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermission();

  const [roles, setRoles] = useState<Role[]>([]);
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
      const data = await api.get<Role[]>('/roles');
      setRoles(data);
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({ code: '', name: '', description: '' });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingId(role.id);
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || '',
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
        await api.put(`/roles/${editingId}`, formData);
      } else {
        await api.post('/roles', formData);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete role "${name}"?`)) return;
    try {
      await api.delete(`/roles/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete role');
    }
  };

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            Roles Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage institutional authorization roles. A Role is a bundle of Rights (Permissions).
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="primary"
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Role
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search roles by name, code, or description..."
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Roles Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Role Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Assigned Rights</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading roles...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No roles found.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {r.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-teal-700">
                      {r.code}
                    </td>
                    <td className="py-3 px-4">
                      {r.is_system ? (
                        <Badge variant="indigo" className="flex items-center gap-1 w-fit">
                          <Lock className="w-3 h-3" /> System
                        </Badge>
                      ) : (
                        <Badge variant="slate">Custom</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-sm">
                      {r.description || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {r.permissions?.length || 0} rights
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(r)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {!r.is_system && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(r.id, r.name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
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
        title={editingId ? 'Edit Role' : 'Create New Role'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Role Name *</label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Academic Exam Coordinator"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              disabled={!!editingId}
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              placeholder="e.g. ROLE_EXAM_COORD"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief summary of duties or authorization scope"
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
              {submitting ? 'Saving...' : editingId ? 'Update Role' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
