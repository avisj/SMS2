// ========================================================================
// ExamMasterModule
// Examination & Assessment Definitions Master
// Supports Exam Types, Session Binding, Date Windows, and Lifecycle Statuses
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Play,
  CheckCircle,
  Layers,
  Edit3,
  Award,
  ArrowRight,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  ExamMaster,
  AcademicSession,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface ExamMasterModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

const EXAM_TYPES = [
  { value: 'UNIT_TEST', label: 'Unit Test' },
  { value: 'PERIODIC_TEST', label: 'Periodic Test' },
  { value: 'HALF_YEARLY', label: 'Half Yearly Examination' },
  { value: 'ANNUAL', label: 'Annual Examination' },
  { value: 'PRE_BOARD', label: 'Pre-Board Examination' },
  { value: 'INTERNAL', label: 'Internal Assessment' },
  { value: 'OTHER', label: 'Other Assessment' },
];

const EXAM_STATUSES = ['DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'RESULTS_READY', 'PUBLISHED', 'CANCELLED'];

export const ExamMasterModule: React.FC<ExamMasterModuleProps> = () => {
  const { openTab } = useWorkspace();
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const handleUpdateStatus = async (examId: string, newStatus: string) => {
    try {
      await api.post(`/exams/${examId}/status`, { status: newStatus });
      await loadExams();
    } catch (err: any) {
      alert(err.message || 'Failed to update exam status.');
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<ExamMaster | null>(null);
  const [formData, setFormData] = useState({
    academic_session_id: '',
    exam_name: '',
    exam_code: '',
    exam_type: 'HALF_YEARLY',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    status: 'DRAFT' as any,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // 1. Load Sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessRes = await api.get<AcademicSession[]>('/academics/sessions');
        setSessions(sessRes || []);
        const active = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (active) {
          setSelectedSessionId(active.id);
        }
      } catch (err) {
        console.error('[ExamMasterModule] Error loading sessions:', err);
      }
    };
    loadSessions();
  }, []);

  // 2. Load Exams
  const loadExams = async () => {
    if (!selectedSessionId) return;
    try {
      setLoading(true);
      const res = await api.get<ExamMaster[]>('/exams', {
        academicSessionId: selectedSessionId,
        status: statusFilter || undefined,
        search: searchQuery.trim() || undefined,
      });
      setExams(res || []);
    } catch (err) {
      console.error('[ExamMasterModule] Error loading exams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [selectedSessionId, statusFilter, searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingExam(null);
    setFormData({
      academic_session_id: selectedSessionId,
      exam_name: '',
      exam_code: '',
      exam_type: 'HALF_YEARLY',
      description: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'SCHEDULED',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exam: ExamMaster) => {
    setEditingExam(exam);
    setFormData({
      academic_session_id: exam.academic_session_id,
      exam_name: exam.exam_name,
      exam_code: exam.exam_code,
      exam_type: exam.exam_type,
      description: exam.description || '',
      start_date: exam.start_date.split('T')[0],
      end_date: exam.end_date.split('T')[0],
      status: exam.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.exam_name.trim()) {
      setFormError('Exam Name is required.');
      return;
    }
    if (!formData.exam_code.trim()) {
      setFormError('Exam Code is required.');
      return;
    }
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      setFormError('Start Date cannot be after End Date.');
      return;
    }

    try {
      setSaving(true);
      if (editingExam) {
        await api.put(`/exams/${editingExam.id}`, formData);
      } else {
        await api.post('/exams', formData);
      }
      setIsModalOpen(false);
      await loadExams();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save examination definition.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete examination "${name}"?`)) return;
    try {
      await api.delete(`/exams/${id}`);
      await loadExams();
    } catch (err: any) {
      alert(err.message || 'Failed to delete exam.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-brand-600" />
            Exam Master
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create and manage formal examinations, periodic assessments, and test codes for the academic year.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Create Exam
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Session */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent font-medium text-slate-900 focus:outline-hidden"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            {EXAM_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search exam name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-brand-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Exams Table Card */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading examinations...</div>
        ) : exams.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No Examinations Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Get started by defining an examination (e.g. "Half Yearly Examination") for the active academic session.
            </p>
            <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              Define New Exam
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Exam Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Exam Type</th>
                  <th className="py-3 px-4">Date Range</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Workflow Actions</th>
                  <th className="py-3 px-4 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {ex.exam_name}
                      {ex.description && (
                        <span className="block text-[11px] text-slate-400 font-normal truncate max-w-xs">
                          {ex.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800">
                        {ex.exam_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {EXAM_TYPES.find((t) => t.value === ex.exam_type)?.label || ex.exam_type}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(ex.start_date).toLocaleDateString()} — {new Date(ex.end_date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            ex.status === 'PUBLISHED'
                              ? 'emerald'
                              : ex.status === 'RESULTS_READY'
                              ? 'primary'
                              : ex.status === 'COMPLETED'
                              ? 'purple'
                              : ex.status === 'ONGOING'
                              ? 'amber'
                              : ex.status === 'SCHEDULED'
                              ? 'indigo'
                              : ex.status === 'CANCELLED'
                              ? 'rose'
                              : 'slate'
                          }
                        >
                          {ex.status}
                        </Badge>
                        <select
                          value={ex.status}
                          onChange={(e) => handleUpdateStatus(ex.id, e.target.value)}
                          className="text-[10px] bg-transparent border border-slate-200 rounded px-1 py-0.5 text-slate-500 hover:text-slate-900 focus:outline-hidden"
                          title="Change Exam Status"
                        >
                          {EXAM_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {ex.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(ex.id, 'SCHEDULED')}
                              className="h-7 text-[11px] text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 whitespace-nowrap"
                            >
                              Mark Scheduled
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTab('exam-structure', 'Exam Structure', 'Layers')}
                              className="h-7 text-[11px] text-slate-600 hover:text-slate-900 whitespace-nowrap"
                            >
                              Structure
                            </Button>
                          </>
                        )}
                        {ex.status === 'SCHEDULED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(ex.id, 'ONGOING')}
                              className="h-7 text-[11px] text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100 whitespace-nowrap"
                            >
                              Start Exam
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTab('exam-schedule', 'Exam Schedule', 'Calendar')}
                              className="h-7 text-[11px] text-slate-600 hover:text-slate-900 whitespace-nowrap"
                            >
                              Timetable
                            </Button>
                          </>
                        )}
                        {ex.status === 'ONGOING' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(ex.id, 'COMPLETED')}
                              className="h-7 text-[11px] text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100 whitespace-nowrap"
                            >
                              Complete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTab('marks-entry', 'Marks Entry', 'Edit3')}
                              className="h-7 text-[11px] text-slate-600 hover:text-slate-900 whitespace-nowrap"
                            >
                              Enter Marks
                            </Button>
                          </>
                        )}
                        {(ex.status === 'COMPLETED' || ex.status === 'RESULTS_READY') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTab('exam-results', 'Results Ledger', 'Award')}
                            className="h-7 text-[11px] text-brand-700 border-brand-200 bg-brand-50 hover:bg-brand-100 whitespace-nowrap"
                          >
                            Results Ledger
                          </Button>
                        )}
                        {ex.status === 'PUBLISHED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTab('report-cards', 'Report Cards', 'FileText')}
                              className="h-7 text-[11px] text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 whitespace-nowrap"
                            >
                              Report Cards
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTab('exam-results', 'Results Ledger', 'Award')}
                              className="h-7 text-[11px] text-slate-600 hover:text-slate-900 whitespace-nowrap"
                            >
                              Ledger
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(ex)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(ex.id, ex.exam_name)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExam ? 'Edit Examination' : 'Define New Examination'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Session</label>
            <select
              value={formData.academic_session_id}
              onChange={(e) => setFormData({ ...formData, academic_session_id: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              required
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Name</label>
            <Input
              type="text"
              placeholder="e.g. Half Yearly Examination"
              value={formData.exam_name}
              onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Code</label>
              <Input
                type="text"
                placeholder="e.g. HY-2026"
                value={formData.exam_code}
                onChange={(e) => setFormData({ ...formData, exam_code: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Type</label>
              <select
                value={formData.exam_type}
                onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
            >
              {EXAM_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes (Optional)</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Instructions or scope of examination..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingExam ? 'Update Exam' : 'Create Exam'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
