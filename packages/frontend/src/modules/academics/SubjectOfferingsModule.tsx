// ========================================================================
// SubjectOfferingsModule Component
// Dedicated Class Subject Offerings Management per Academic Session
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Layers,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  FolderTree,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  ClassItem,
  SubjectItem,
  SubjectGroup,
  AcademicClassSubject
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';

interface SubjectOfferingsModuleProps {
  tabId: string;
}

export const SubjectOfferingsModule: React.FC<SubjectOfferingsModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [offerings, setOfferings] = useState<AcademicClassSubject[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formGroupId, setFormGroupId] = useState('');
  const [formType, setFormType] = useState<'THEORY' | 'PRACTICAL' | 'BOTH'>('THEORY');
  const [formIsRequired, setFormIsRequired] = useState(true);
  const [formCredits, setFormCredits] = useState('4');
  const [formMaxMarks, setFormMaxMarks] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, classesData, subjectsData, groupsData] = await Promise.all([
        api.get<AcademicSession[]>('/academics/sessions?includeInactive=true'),
        api.get<ClassItem[]>('/academics/classes'),
        api.get<SubjectItem[]>('/academics/subjects'),
        api.get<SubjectGroup[]>('/academics/subject-groups'),
      ]);

      setSessions(sessionsData);
      setClasses(classesData);
      setSubjects(subjectsData);
      setGroups(groupsData);

      let activeSession = sessionsData.find(s => s.is_current) || sessionsData[0];
      const sessionIdToUse = selectedSessionId || activeSession?.id || '';
      if (!selectedSessionId && sessionIdToUse) {
        setSelectedSessionId(sessionIdToUse);
      }

      if (sessionIdToUse) {
        const offData = await api.get<AcademicClassSubject[]>(`/academics/class-subjects?sessionId=${sessionIdToUse}`);
        setOfferings(offData);
      }
    } catch (err) {
      console.error('Failed to load subject offerings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  useEffect(() => {
    if (selectedSessionId) {
      api.get<AcademicClassSubject[]>(`/academics/class-subjects?sessionId=${selectedSessionId}`)
        .then(data => setOfferings(data))
        .catch(err => console.error('Failed to load offerings for session', err));
    }
  }, [selectedSessionId]);

  const handleOpenCreate = () => {
    setFormClassId(classes[0]?.id || '');
    setFormSubjectId(subjects[0]?.id || '');
    setFormGroupId('');
    setFormType('THEORY');
    setFormIsRequired(true);
    setFormCredits('4');
    setFormMaxMarks('100');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !formClassId || !formSubjectId) {
      setErrorMessage('Please select a class and subject');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await api.post('/academics/class-subjects', {
        academic_session_id: selectedSessionId,
        class_id: formClassId,
        subject_id: formSubjectId,
        subject_group_id: formGroupId || undefined,
        subject_type: formType,
        is_required: formIsRequired,
        credits: parseInt(formCredits, 10) || undefined,
        max_marks: parseInt(formMaxMarks, 10) || undefined,
      });
      setIsModalOpen(false);
      const updated = await api.get<AcademicClassSubject[]>(`/academics/class-subjects?sessionId=${selectedSessionId}`);
      setOfferings(updated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to setup class subject offering');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Are you sure you want to remove subject offering "${label}"?`)) return;
    try {
      await api.delete(`/academics/class-subjects/${id}`);
      setOfferings(prev => prev.filter(o => o.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete class subject offering');
    }
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            Subjects & Offerings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure curriculum subject offerings per class and session. Zero display_order - sorted newest first.
          </p>
        </div>
        {(hasPermission('class_subjects.manage') || hasPermission('subjects.manage')) && (
          <Button
            onClick={handleOpenCreate}
            variant="primary"
            disabled={!selectedSessionId || classes.length === 0 || subjects.length === 0}
            className="self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Offer Subject
          </Button>
        )}
      </div>

      {/* Session Filter Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-700">Academic Session:</span>
            <div className="w-56">
              <Select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                options={sessions.map(s => ({
                  value: s.id,
                  label: `${s.name} ${s.is_current ? '(Active Current)' : ''}`,
                }))}
              />
            </div>
            {selectedSession?.is_current && (
              <Badge variant="emerald">Current Session</Badge>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Offerings Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Subject Group</th>
                <th className="py-3 px-4">Subject Type</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Max Marks / Credits</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Loading subject offerings...
                  </td>
                </tr>
              ) : offerings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No subjects offered for this academic session yet.
                  </td>
                </tr>
              ) : (
                offerings.map(off => {
                  const cls = classes.find(c => c.id === off.class_id);
                  const sub = subjects.find(s => s.id === off.subject_id);
                  const grp = groups.find(g => g.id === off.subject_group_id);
                  const label = `${cls?.display_name || 'Class'} - ${sub?.name || 'Subject'}`;

                  return (
                    <tr key={off.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {cls?.display_name || cls?.name || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-teal-700">
                        {sub?.name || '—'}
                        <span className="font-mono text-[10px] text-slate-400 ml-1.5">({sub?.code})</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {grp ? (
                          <Badge variant="slate">{grp.name}</Badge>
                        ) : (
                          <span className="text-slate-400 italic">Standalone</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">
                        {off.subject_type}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={off.is_required ? 'indigo' : 'purple'}>
                          {off.is_required ? 'Compulsory' : 'Elective'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {off.max_marks ? `${off.max_marks} marks` : '—'} / {off.credits ? `${off.credits} cr` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(hasPermission('class_subjects.manage') || hasPermission('subjects.manage')) && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(off.id, label)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Setup Subject Offering for Class"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Academic Session</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
              {selectedSession?.name} ({selectedSession?.code})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Select Class *</label>
              <Select
                value={formClassId}
                onChange={e => setFormClassId(e.target.value)}
                options={classes.map(c => ({
                  value: c.id,
                  label: `${c.display_name} (${c.code})`,
                }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Select Subject *</label>
              <Select
                value={formSubjectId}
                onChange={e => setFormSubjectId(e.target.value)}
                options={subjects.map(s => ({
                  value: s.id,
                  label: `${s.name} (${s.code})`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Subject Group (Optional)</label>
              <Select
                value={formGroupId}
                onChange={e => setFormGroupId(e.target.value)}
                options={[
                  { value: '', label: 'None (Standalone)' },
                  ...groups.map(g => ({ value: g.id, label: g.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Delivery Type</label>
              <Select
                value={formType}
                onChange={e => setFormType(e.target.value as any)}
                options={[
                  { value: 'THEORY', label: 'Theory Only' },
                  { value: 'PRACTICAL', label: 'Practical / Lab' },
                  { value: 'BOTH', label: 'Theory & Practical' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Max Marks</label>
              <Input
                type="number"
                value={formMaxMarks}
                onChange={e => setFormMaxMarks(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Academic Credits</label>
              <Input
                type="number"
                value={formCredits}
                onChange={e => setFormCredits(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsRequired}
                onChange={e => setFormIsRequired(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="font-semibold">Compulsory Subject</span>
              <span className="text-slate-400 font-normal">(Uncheck for Electives)</span>
            </label>
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
              {submitting ? 'Offering...' : 'Offer Subject'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
