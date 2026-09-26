// ========================================================================
// AcademicSessionsModule Component
// Academic Session Master (Strictly Tenant-Scoped, Zero Hardcoding)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Plus,
  Search,
  CheckCircle,
  Star,
  Trash2,
  Edit2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { AcademicSession } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface AcademicSessionsModuleProps {
  tabId: string;
}

export const AcademicSessionsModule: React.FC<AcademicSessionsModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { hasPermission } = usePermission();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    start_date: '',
    end_date: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'COMPLETED',
    is_current: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = hasPermission('academic_sessions.manage') || hasPermission('academics.manage');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.get<AcademicSession[]>('/academics/sessions?includeInactive=true');
      setSessions(data);
    } catch (err) {
      console.error('Failed to load academic sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [activeBranch]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      start_date: '',
      end_date: '',
      status: 'ACTIVE',
      is_current: false,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: AcademicSession) => {
    setEditingId(s.id);
    setFormData({
      name: s.name,
      code: s.code,
      start_date: s.start_date ? s.start_date.split('T')[0] : '',
      end_date: s.end_date ? s.end_date.split('T')[0] : '',
      status: s.status,
      is_current: s.is_current,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingId) {
        await api.put(`/academics/sessions/${editingId}`, formData);
      } else {
        await api.post('/academics/sessions', formData);
      }
      setIsModalOpen(false);
      loadSessions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save academic session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetCurrent = async (id: string, name: string) => {
    if (!confirm(`Set academic session [${name}] as the current active session for the school?`)) return;
    try {
      await api.post(`/academics/sessions/${id}/set-current`, {});
      loadSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to switch current session');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete session [${name}]? Historical records will be protected.`)) return;
    try {
      await api.delete(`/academics/sessions/${id}`);
      loadSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete session');
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    }
    return true;
  });

  const currentSession = sessions.find(s => s.is_current);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            Academic Session Master
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure school academic sessions, date horizons, and operational current session.
          </p>
        </div>
        {canManage && (
          <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 self-start">
            <Plus className="w-4 h-4" />
            New Academic Session
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Current Session</p>
          <div className="flex items-center gap-2 mt-2">
            <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
            <p className="text-lg font-bold text-slate-900">
              {currentSession ? currentSession.name : 'None Selected'}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{currentSession?.code || '—'}</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Total Sessions</p>
          <p className="text-lg font-bold text-slate-900 mt-2">{sessions.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Configured in system</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Active Sessions</p>
          <p className="text-lg font-bold text-emerald-600 mt-2">
            {sessions.filter(s => s.status === 'ACTIVE').length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Operational cycles</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Historical Cycles</p>
          <p className="text-lg font-bold text-indigo-600 mt-2">
            {sessions.filter(s => s.status === 'COMPLETED').length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Archived academic years</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by session name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Status:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Session Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Timeline (Start — End)</th>
                <th className="py-3 px-4">Current Flag</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading academic sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No academic sessions found.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(s => (
                  <tr key={s.id} className={`hover:bg-slate-50/50 ${s.is_current ? 'bg-emerald-50/20' : ''}`}>
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      {s.name}
                      {s.is_current && (
                        <Badge variant="emerald" className="text-[10px] py-0">
                          Current
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{s.code}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.start_date ? s.start_date.split('T')[0] : '—'}</span>
                        <span className="text-slate-400">to</span>
                        <span>{s.end_date ? s.end_date.split('T')[0] : '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {s.is_current ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Primary Operational
                        </span>
                      ) : canManage ? (
                        <button
                          onClick={() => handleSetCurrent(s.id, s.name)}
                          className="text-[11px] text-teal-600 hover:text-teal-800 hover:underline font-medium"
                        >
                          Make Current
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          s.status === 'ACTIVE'
                            ? 'emerald'
                            : s.status === 'COMPLETED'
                            ? 'indigo'
                            : 'slate'
                        }
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded"
                              title="Edit Session"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!s.is_current && (
                              <button
                                onClick={() => handleDelete(s.id, s.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Delete Session"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
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
        title={editingId ? 'Edit Academic Session' : 'Create New Academic Session'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Session Name (e.g. 2026-27)"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. 2026-27"
            />
            <Input
              label="Session Code"
              required
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. AY2026-27"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Start Date"
              required
              value={formData.start_date}
              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              type="date"
              label="End Date"
              required
              value={formData.end_date}
              onChange={e => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_current}
                onChange={e => setFormData({ ...formData, is_current: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <span className="text-xs font-medium text-slate-700">
                Mark as Current Active Session for this School
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update Session' : 'Create Session'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
