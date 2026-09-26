// ========================================================================
// SubjectsGroupsModule Component
// Subject Catalogue, Subject Groups Master, and Class Subject Offerings
// Zero hardcoded subjects or curriculum rules
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle,
  Edit2,
  Trash2,
  Layers,
  Calendar,
  FolderTree,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  SubjectItem,
  SubjectGroup,
  AcademicClassSubject,
  ClassItem,
  AcademicSession,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface SubjectsGroupsModuleProps {
  tabId: string;
}

export const SubjectsGroupsModule: React.FC<SubjectsGroupsModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { hasPermission } = usePermission();

  const [activeTab, setActiveTab] = useState<'offerings' | 'subjects' | 'groups'>('offerings');

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);

  // Offerings State
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classSubjects, setClassSubjects] = useState<AcademicClassSubject[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    short_name: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    subject_ids: [] as string[],
  });

  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [offeringForm, setOfferingForm] = useState({
    subject_id: '',
    subject_group_id: '',
    is_required: true,
    subject_type: 'THEORY' as 'THEORY' | 'PRACTICAL' | 'BOTH',
    credits: 4,
    max_marks: 100,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = hasPermission('subjects.manage') || hasPermission('subject_groups.manage') || hasPermission('academics.manage');

  const loadData = async () => {
    setLoading(true);
    try {
      const [subjData, grpData, clsData, sessData] = await Promise.all([
        api.get<SubjectItem[]>('/academics/subjects?includeInactive=true'),
        api.get<SubjectGroup[]>('/academics/subject-groups'),
        api.get<ClassItem[]>('/academics/classes'),
        api.get<AcademicSession[]>('/academics/sessions'),
      ]);
      setSubjects(subjData);
      setGroups(grpData);
      setClasses(clsData);
      setSessions(sessData);

      const current = sessData.find(s => s.is_current) || sessData[0];
      if (current && !selectedSessionId) setSelectedSessionId(current.id);
      if (clsData.length > 0 && !selectedClassId) setSelectedClassId(clsData[0].id);
    } catch (err) {
      console.error('Failed to load subjects data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOfferings = async () => {
    if (!selectedSessionId || !selectedClassId) return;
    try {
      const data = await api.get<AcademicClassSubject[]>(
        `/academics/class-subjects?sessionId=${selectedSessionId}&classId=${selectedClassId}`
      );
      setClassSubjects(data);
    } catch (err) {
      console.error('Failed to load class subjects:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  useEffect(() => {
    if (selectedSessionId && selectedClassId) {
      loadOfferings();
    }
  }, [selectedSessionId, selectedClassId]);

  // Subject Master Handlers
  const handleOpenCreateSubject = () => {
    setEditingSubjectId(null);
    setSubjectForm({
      name: '',
      code: '',
      short_name: '',
      description: '',
      status: 'ACTIVE',
    });
    setErrorMessage(null);
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (s: SubjectItem) => {
    setEditingSubjectId(s.id);
    setSubjectForm({
      name: s.name,
      code: s.code,
      short_name: s.short_name || '',
      description: s.description || '',
      status: s.status,
    });
    setErrorMessage(null);
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingSubjectId) {
        await api.put(`/academics/subjects/${editingSubjectId}`, subjectForm);
      } else {
        await api.post('/academics/subjects', subjectForm);
      }
      setIsSubjectModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save subject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Delete subject [${name}]?`)) return;
    try {
      await api.delete(`/academics/subjects/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subject');
    }
  };

  // Group Handlers
  const handleOpenCreateGroup = () => {
    setEditingGroupId(null);
    setGroupForm({
      name: '',
      code: '',
      description: '',
      status: 'ACTIVE',
      subject_ids: [],
    });
    setErrorMessage(null);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (g: SubjectGroup) => {
    setEditingGroupId(g.id);
    setGroupForm({
      name: g.name,
      code: g.code,
      description: g.description || '',
      status: g.status,
      subject_ids: (g.subjects || []).map(s => s.id),
    });
    setErrorMessage(null);
    setIsGroupModalOpen(true);
  };

  const handleToggleGroupSubject = (subjId: string) => {
    setGroupForm(prev => {
      const exists = prev.subject_ids.includes(subjId);
      return {
        ...prev,
        subject_ids: exists ? prev.subject_ids.filter(id => id !== subjId) : [...prev.subject_ids, subjId],
      };
    });
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingGroupId) {
        await api.put(`/academics/subject-groups/${editingGroupId}`, groupForm);
      } else {
        await api.post('/academics/subject-groups', groupForm);
      }
      setIsGroupModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save subject group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete subject group [${name}]?`)) return;
    try {
      await api.delete(`/academics/subject-groups/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete group');
    }
  };

  // Offering Handlers
  const handleOpenCreateOffering = () => {
    setOfferingForm({
      subject_id: subjects[0]?.id || '',
      subject_group_id: '',
      is_required: true,
      subject_type: 'THEORY',
      credits: 4,
      max_marks: 100,
    });
    setErrorMessage(null);
    setIsOfferingModalOpen(true);
  };

  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/academics/class-subjects', {
        ...offeringForm,
        academic_session_id: selectedSessionId,
        class_id: selectedClassId,
        subject_group_id: offeringForm.subject_group_id || null,
      });
      setIsOfferingModalOpen(false);
      loadOfferings();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add subject offering');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffering = async (id: string) => {
    if (!confirm('Remove this subject offering from the class curriculum?')) return;
    try {
      await api.delete(`/academics/class-subjects/${id}`);
      loadOfferings();
    } catch (err: any) {
      alert(err.message || 'Failed to remove offering');
    }
  };

  const currentClassName = classes.find(c => c.id === selectedClassId)?.display_name || 'Selected Class';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            Curriculum & Subjects
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure subject offerings per class, master subjects catalogue, and relational subject groups.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-200/70 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab('offerings')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'offerings' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Class Subject Offerings
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'subjects' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Subjects Master ({subjects.length})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'groups' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Subject Groups ({groups.length})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: CLASS SUBJECT OFFERINGS                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'offerings' && (
        <div className="space-y-4">
          {/* Cascading Filter Bar */}
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-700">Session:</label>
                  <select
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.is_current ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-700">Class:</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {canManage && (
                <Button onClick={handleOpenCreateOffering} className="flex items-center gap-1.5 self-start">
                  <Plus className="w-4 h-4" />
                  Offer Subject to {currentClassName}
                </Button>
              )}
            </div>
          </Card>

          {/* Offerings Table */}
          <Card className="overflow-hidden border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4">Subject Code</th>
                    <th className="py-3 px-4">Subject Group</th>
                    <th className="py-3 px-4">Requirement</th>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Credits / Max Marks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {classSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No subjects currently configured for {currentClassName} in this session.
                      </td>
                    </tr>
                  ) : (
                    classSubjects.map(cs => (
                      <tr key={cs.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">{cs.subject?.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{cs.subject?.code}</td>
                        <td className="py-3 px-4">
                          {cs.subject_group ? (
                            <Badge variant="indigo">{cs.subject_group.name}</Badge>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Ungrouped</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={cs.is_required ? 'emerald' : 'amber'}>
                            {cs.is_required ? 'Compulsory' : 'Optional / Elective'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-600">
                          {cs.subject_type}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {cs.credits ? `${cs.credits} Credits` : '—'} / {cs.max_marks || 100} Marks
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canManage && (
                            <button
                              onClick={() => handleDeleteOffering(cs.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Remove Offering"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: SUBJECTS MASTER                                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Reusable catalogue of school academic subjects.
            </p>
            {canManage && (
              <Button onClick={handleOpenCreateSubject} className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add Subject
              </Button>
            )}
          </div>

          <Card className="overflow-hidden border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Short Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {subjects.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{s.code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{s.short_name || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {s.description || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={s.status === 'ACTIVE' ? 'emerald' : 'slate'}>{s.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditSubject(s)}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubject(s.id, s.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 3: SUBJECT GROUPS MASTER                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Curriculum subject groupings (e.g. Core, STEM Electives, Languages). Linked via relational tables.
            </p>
            {canManage && (
              <Button onClick={handleOpenCreateGroup} className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Create Subject Group
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(g => (
              <Card key={g.id} className="p-4 bg-white border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{g.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400">{g.code}</span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditGroup(g)}
                        className="p-1 text-slate-500 hover:text-teal-600"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(g.id, g.name)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {g.description && (
                  <p className="text-xs text-slate-500 mt-2">{g.description}</p>
                )}

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Subjects in Group:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.subjects && g.subjects.length > 0 ? (
                      g.subjects.map(s => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-medium rounded"
                        >
                          {s.name} ({s.code})
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs italic">No subjects added.</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Subject Master */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title={editingSubjectId ? 'Edit Subject' : 'Add New Subject'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Subject Name"
              required
              value={subjectForm.name}
              onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
              placeholder="e.g. Mathematics"
            />
            <Input
              label="Subject Code"
              required
              value={subjectForm.code}
              onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SUB-MATH"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Short Name / Acronym"
              value={subjectForm.short_name}
              onChange={e => setSubjectForm({ ...subjectForm, short_name: e.target.value })}
              placeholder="e.g. MATH"
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={subjectForm.status}
                onChange={e => setSubjectForm({ ...subjectForm, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={subjectForm.description}
              onChange={e => setSubjectForm({ ...subjectForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              placeholder="Curriculum summary..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsSubjectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingSubjectId ? 'Update Subject' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Subject Group Master */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title={editingGroupId ? 'Edit Subject Group' : 'Create Subject Group'}
      >
        <form onSubmit={handleSaveGroup} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Group Name"
              required
              value={groupForm.name}
              onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder="e.g. Core STEM"
            />
            <Input
              label="Group Code"
              required
              value={groupForm.code}
              onChange={e => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. GRP-STEM"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={groupForm.description}
              onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              placeholder="e.g. Foundation science disciplines"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Subjects to Include (Relational M:N):
            </label>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5">
              {subjects.map(s => {
                const checked = groupForm.subject_ids.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleGroupSubject(s.id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>{s.name} ({s.code})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsGroupModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingGroupId ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Class Subject Offering */}
      <Modal
        isOpen={isOfferingModalOpen}
        onClose={() => setIsOfferingModalOpen(false)}
        title={`Offer Subject to ${currentClassName}`}
      >
        <form onSubmit={handleSaveOffering} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
            <select
              value={offeringForm.subject_id}
              onChange={e => setOfferingForm({ ...offeringForm, subject_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              required
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Group (Optional)</label>
            <select
              value={offeringForm.subject_group_id}
              onChange={e => setOfferingForm({ ...offeringForm, subject_group_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
            >
              <option value="">No Group</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Component</label>
              <select
                value={offeringForm.subject_type}
                onChange={e => setOfferingForm({ ...offeringForm, subject_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              >
                <option value="THEORY">Theory Only</option>
                <option value="PRACTICAL">Practical Only</option>
                <option value="BOTH">Theory & Practical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Requirement</label>
              <select
                value={offeringForm.is_required ? 'true' : 'false'}
                onChange={e => setOfferingForm({ ...offeringForm, is_required: e.target.value === 'true' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              >
                <option value="true">Compulsory / Core</option>
                <option value="false">Elective / Optional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Credits"
              value={offeringForm.credits.toString()}
              onChange={e => setOfferingForm({ ...offeringForm, credits: parseFloat(e.target.value) || 0 })}
            />
            <Input
              type="number"
              label="Max Marks"
              value={offeringForm.max_marks.toString()}
              onChange={e => setOfferingForm({ ...offeringForm, max_marks: parseInt(e.target.value, 10) || 0 })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsOfferingModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Offering'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
