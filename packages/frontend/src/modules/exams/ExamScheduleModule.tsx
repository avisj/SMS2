// ========================================================================
// ExamScheduleModule
// Timetable & Paper Scheduling Engine for Examinations
// Date Windows, Time Slots, Venue Allocation & Conflict Prevention
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  MapPin,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  ExamMaster,
  ExamStructure,
  ExamSchedule,
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
  SubjectItem,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface ExamScheduleModuleProps {
  tabId?: string;
}

export const ExamScheduleModule: React.FC<ExamScheduleModuleProps> = () => {
  const { activeBranch, branches } = useAuth();

  // Masters
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectItem[]>([]);

  // Filter Row
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<ExamSchedule | null>(null);
  const [formData, setFormData] = useState({
    exam_id: '',
    academic_session_id: '',
    location_id: '',
    class_id: '',
    section_id: '',
    subject_id: '',
    exam_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '11:00',
    venue: 'Main Examination Hall',
    maximum_marks: 100,
    instructions: 'Please arrive 15 minutes before the exam starts.',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // 1. Load Sessions & Exams
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [sessRes, examsRes] = await Promise.all([
          api.get<AcademicSession[]>('/academics/sessions'),
          api.get<ExamMaster[]>('/exams'),
        ]);

        setSessions(sessRes || []);
        setExams(examsRes || []);

        const activeSess = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (activeSess) setSelectedSessionId(activeSess.id);

        if (examsRes && examsRes.length > 0) {
          setSelectedExamId(examsRes[0].id);
        }
      } catch (err) {
        console.error('[ExamScheduleModule] Error loading masters:', err);
      }
    };
    loadMasters();
  }, []);

  // 2. Load Class-Sections for Academic Session
  useEffect(() => {
    if (!selectedSessionId) return;

    const loadClassSections = async () => {
      try {
        const csList = await api.get<AcademicClassSection[]>('/academics/class-sections', {
          sessionId: selectedSessionId,
        });
        setClassSections(csList || []);

        const classMap = new Map<string, ClassItem>();
        (csList || []).forEach((cs) => {
          if (cs.class) {
            classMap.set(cs.class.id, {
              ...cs.class,
              display_name: (cs as any).display_name || (cs.class as any).display_label || (cs.class.name.toLowerCase().startsWith('class') ? cs.class.name : `Class ${cs.class.name}`),
            });
          }
        });

        const derivedClasses = Array.from(classMap.values()).sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        });
        setClasses(derivedClasses);

        if (derivedClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(derivedClasses[0].id);
        }
      } catch (err) {
        console.error('[ExamScheduleModule] Error loading class sections:', err);
      }
    };

    loadClassSections();
  }, [selectedSessionId]);

  // 3. Derive Sections for Selected Class
  useEffect(() => {
    if (!selectedClassId || classSections.length === 0) {
      setSections([]);
      return;
    }

    const matchedSections = classSections
      .filter((cs) => cs.class_id === selectedClassId && cs.section)
      .map((cs) => cs.section!)
      .filter((sec, idx, self) => self.findIndex((s) => s.id === sec.id) === idx)
      .sort((a, b) => a.name.localeCompare(b.name));

    setSections(matchedSections);
  }, [selectedClassId, classSections]);

  // 4. Load Schedules
  const loadSchedules = async () => {
    if (!selectedSessionId) return;
    try {
      setLoading(true);
      const res = await api.get<ExamSchedule[]>('/exams/schedules/list', {
        academicSessionId: selectedSessionId,
        examId: selectedExamId || undefined,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
        locationId: activeBranch?.id || undefined,
      });
      setSchedules(res || []);
    } catch (err) {
      console.error('[ExamScheduleModule] Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [selectedSessionId, selectedExamId, selectedClassId, selectedSectionId, activeBranch?.id]);

  // Load configured subjects for class
  const loadSubjectsForClass = async (classId: string) => {
    if (!classId || !selectedSessionId) return;
    try {
      // Check exam structure first
      if (selectedExamId) {
        const structs = await api.get<ExamStructure[]>('/exams/structures/list', {
          academicSessionId: selectedSessionId,
          examId: selectedExamId,
          classId,
        });
        if (structs && structs.length > 0 && structs[0].subjects) {
          const mapped = structs[0].subjects
            .filter((s) => s.subject)
            .map((s) => s.subject as SubjectItem);
          if (mapped.length > 0) {
            setAvailableSubjects(mapped);
            if (!formData.subject_id) setFormData((prev) => ({ ...prev, subject_id: mapped[0].id }));
            return;
          }
        }
      }

      // Fallback
      const all = await api.get<SubjectItem[]>('/academics/subjects');
      setAvailableSubjects(all || []);
      if (all && all.length > 0 && !formData.subject_id) {
        setFormData((prev) => ({ ...prev, subject_id: all[0].id }));
      }
    } catch (err) {
      console.error('[ExamScheduleModule] Error loading subjects:', err);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSchedule(null);
    const clsId = selectedClassId || (classes[0]?.id || '');
    const branchId = activeBranch?.id || branches?.[0]?.id || '';
    setFormData({
      exam_id: selectedExamId || (exams[0]?.id || ''),
      academic_session_id: selectedSessionId,
      location_id: branchId,
      class_id: clsId,
      section_id: selectedSectionId || '',
      subject_id: '',
      exam_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '11:00',
      venue: 'Exam Hall 1',
      maximum_marks: 100,
      instructions: 'Carry Hall Ticket & Stationary.',
    });
    setFormError(null);
    setIsModalOpen(true);
    loadSubjectsForClass(clsId);
  };

  const handleOpenEditModal = (sc: ExamSchedule) => {
    setEditingSchedule(sc);
    setFormData({
      exam_id: sc.exam_id,
      academic_session_id: sc.academic_session_id,
      location_id: sc.location_id,
      class_id: sc.class_id,
      section_id: sc.section_id || '',
      subject_id: sc.subject_id,
      exam_date: sc.exam_date.split('T')[0],
      start_time: sc.start_time,
      end_time: sc.end_time,
      venue: sc.venue || '',
      maximum_marks: sc.maximum_marks,
      instructions: sc.instructions || '',
    });
    setFormError(null);
    setIsModalOpen(true);
    loadSubjectsForClass(sc.class_id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.subject_id) {
      setFormError('Please select a subject to schedule.');
      return;
    }
    if (formData.start_time >= formData.end_time) {
      setFormError('End Time must be after Start Time.');
      return;
    }

    try {
      setSaving(true);
      const branchId = activeBranch?.id || formData.location_id || branches?.[0]?.id || '';
      const payload = {
        ...formData,
        academic_session_id: selectedSessionId,
        location_id: branchId,
        section_id: formData.section_id || null,
      };

      if (editingSchedule) {
        await api.put(`/exams/schedules/${editingSchedule.id}`, payload);
      } else {
        await api.post('/exams/schedules', payload);
      }

      setIsModalOpen(false);
      await loadSchedules();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save Exam Schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled paper?')) return;
    try {
      await api.delete(`/exams/schedules/${id}`);
      await loadSchedules();
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-brand-600" />
            Exam Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Build and publish the examination timetable, room venues, and date windows with automatic clash prevention.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          Schedule Paper
        </Button>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Session */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Academic Session</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-800 font-medium focus:outline-hidden"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Exam */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Examination</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-800 font-medium focus:outline-hidden"
          >
            <option value="">All Exams</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.exam_name} ({ex.exam_code})
              </option>
            ))}
          </select>
        </div>

        {/* Class */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-800 font-medium focus:outline-hidden"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name || c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-slate-800 font-medium focus:outline-hidden"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading examination schedule...</div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No Exam Schedule Entries Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Schedule subject papers with dates and time slots for students and invigilators.
            </p>
            <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              Schedule First Paper
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Exam Date & Day</th>
                  <th className="py-3 px-4">Time Window</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Venue</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((sc) => {
                  const d = new Date(sc.exam_date);
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <tr key={sc.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {d.toLocaleDateString()}
                        <span className="block text-[11px] text-brand-700 font-normal uppercase">
                          {dayName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-medium">
                          {sc.start_time} – {sc.end_time}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {sc.subject?.name || 'Subject'}
                        {sc.subject?.code && (
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                            ({sc.subject.code})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {sc.class?.display_name || sc.class?.name || 'Class'}
                        <span className="block text-[11px] text-slate-500 font-normal">
                          {sc.section ? `Section ${sc.section.name}` : 'All Sections'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {sc.venue || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {sc.maximum_marks}M
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(sc)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sc.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Schedule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSchedule ? 'Edit Scheduled Paper' : 'Schedule Examination Paper'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Exam</label>
            <select
              value={formData.exam_id}
              onChange={(e) => setFormData({ ...formData, exam_id: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              required
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} ({ex.exam_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class</label>
              <select
                value={formData.class_id}
                onChange={(e) => {
                  setFormData({ ...formData, class_id: e.target.value });
                  loadSubjectsForClass(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                required
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
              <select
                value={formData.section_id}
                onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
            <select
              value={formData.subject_id}
              onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              required
            >
              <option value="">-- Select Subject --</option>
              {availableSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} {sub.code ? `(${sub.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Date</label>
            <Input
              type="date"
              value={formData.exam_date}
              onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Venue</label>
              <Input
                type="text"
                placeholder="e.g. Hall A / Room 204"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Maximum Marks</label>
              <Input
                type="number"
                value={formData.maximum_marks}
                onChange={(e) => setFormData({ ...formData, maximum_marks: Number(e.target.value) })}
                min={1}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Student Instructions</label>
            <Input
              type="text"
              placeholder="e.g. Bring scientific calculator, no electronic devices"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingSchedule ? 'Update Paper' : 'Schedule Paper'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
