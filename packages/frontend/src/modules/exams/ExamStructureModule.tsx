// ========================================================================
// ExamStructureModule
// Academic Class & Section Assessment Blueprints
// Configures Participatory Classes, Subjects, Maximum/Passing Marks & Weightage
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  ExamMaster,
  ExamStructure,
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
  SubjectItem,
  AcademicClassSubject,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface ExamStructureModuleProps {
  tabId?: string;
}

interface SubjectConfigRow {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  maximum_marks: number;
  passing_marks: number;
  grade_applicable: boolean;
  weightage: number;
  is_selected: boolean;
}

export const ExamStructureModule: React.FC<ExamStructureModuleProps> = () => {
  const { activeBranch } = useAuth();

  // Masters
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);
  const [structures, setStructures] = useState<ExamStructure[]>([]);

  // Filter Bar
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStructure, setEditingStructure] = useState<ExamStructure | null>(null);
  const [modalExamId, setModalExamId] = useState<string>('');
  const [modalClassId, setModalClassId] = useState<string>('');
  const [modalSectionId, setModalSectionId] = useState<string>('');
  const [subjectConfigs, setSubjectConfigs] = useState<SubjectConfigRow[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // 1. Load Initial Masters (Sessions & Active Exams)
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
        console.error('[ExamStructureModule] Error loading initial masters:', err);
      }
    };
    loadMasters();
  }, []);

  // 2. Load Class-Sections for Selected Academic Session
  useEffect(() => {
    if (!selectedSessionId) return;

    const loadClassSections = async () => {
      try {
        const csList = await api.get<AcademicClassSection[]>('/academics/class-sections', {
          sessionId: selectedSessionId,
        });
        setClassSections(csList || []);

        // Derive unique classes from authoritative setup
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

        // Auto-select first class if none selected
        if (derivedClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(derivedClasses[0].id);
        }
      } catch (err) {
        console.error('[ExamStructureModule] Error loading class-sections:', err);
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

  // 4. Load Structures
  const loadStructures = async () => {
    if (!selectedSessionId) return;
    try {
      setLoading(true);
      const res = await api.get<ExamStructure[]>('/exams/structures/list', {
        academicSessionId: selectedSessionId,
        examId: selectedExamId || undefined,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
        locationId: activeBranch?.id || undefined,
      });
      setStructures(res || []);
    } catch (err) {
      console.error('[ExamStructureModule] Error loading structures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructures();
  }, [selectedSessionId, selectedExamId, selectedClassId, selectedSectionId, activeBranch?.id]);

  // 5. Load Subjects for Modal Class Selection
  const loadSubjectsForModal = async (classId: string, prefill?: ExamStructure) => {
    if (!classId || !selectedSessionId) return;
    try {
      setLoadingSubjects(true);

      // 1. Try class-subjects
      const classSubjs = await api.get<AcademicClassSubject[]>('/academics/class-subjects', {
        sessionId: selectedSessionId,
        classId,
      });

      // 2. Fallback to all subjects if none configured
      const allSubjs = await api.get<SubjectItem[]>('/academics/subjects');

      const existingMap = new Map<string, any>();
      if (prefill?.subjects) {
        for (const s of prefill.subjects) {
          existingMap.set(s.subject_id, s);
        }
      }

      // Determine active list
      let candidateList: Array<{ id: string; name: string; code: string }> = [];
      if (classSubjs && classSubjs.length > 0) {
        candidateList = classSubjs.map((cs) => ({
          id: cs.subject_id,
          name: cs.subject?.name || 'Subject',
          code: cs.subject?.code || '',
        }));
      } else {
        candidateList = (allSubjs || []).map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        }));
      }

      const rows: SubjectConfigRow[] = candidateList.map((c) => {
        const exist = existingMap.get(c.id);
        return {
          subject_id: c.id,
          subject_name: c.name,
          subject_code: c.code,
          maximum_marks: exist ? exist.maximum_marks : 100,
          passing_marks: exist ? exist.passing_marks : 33,
          grade_applicable: exist ? exist.grade_applicable : true,
          weightage: exist ? exist.weightage : 100,
          is_selected: Boolean(exist) || true, // selected by default
        };
      });

      setSubjectConfigs(rows);
    } catch (err) {
      console.error('[ExamStructureModule] Error loading subjects for modal:', err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingStructure(null);
    setModalExamId(selectedExamId || (exams[0]?.id || ''));
    setModalClassId(selectedClassId || (classes[0]?.id || ''));
    setModalSectionId(selectedSectionId || '');
    setFormError(null);
    setIsModalOpen(true);
    if (selectedClassId || classes[0]?.id) {
      loadSubjectsForModal(selectedClassId || classes[0].id);
    }
  };

  const handleOpenEditModal = (st: ExamStructure) => {
    setEditingStructure(st);
    setModalExamId(st.exam_id);
    setModalClassId(st.class_id);
    setModalSectionId(st.section_id || '');
    setFormError(null);
    setIsModalOpen(true);
    loadSubjectsForModal(st.class_id, st);
  };

  const handleModalClassChange = (newClassId: string) => {
    setModalClassId(newClassId);
    loadSubjectsForModal(newClassId);
  };

  const handleToggleSubject = (idx: number) => {
    const next = [...subjectConfigs];
    next[idx].is_selected = !next[idx].is_selected;
    setSubjectConfigs(next);
  };

  const handleSubjectFieldChange = (idx: number, field: keyof SubjectConfigRow, val: any) => {
    const next = [...subjectConfigs];
    (next[idx] as any)[field] = val;
    setSubjectConfigs(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const selectedSubs = subjectConfigs.filter((s) => s.is_selected);
    if (selectedSubs.length === 0) {
      setFormError('Please select at least one subject to include in the Exam Structure.');
      return;
    }

    for (const sub of selectedSubs) {
      if (Number(sub.maximum_marks) <= 0) {
        setFormError(`Maximum marks for ${sub.subject_name} must be greater than 0.`);
        return;
      }
      if (Number(sub.passing_marks) < 0 || Number(sub.passing_marks) > Number(sub.maximum_marks)) {
        setFormError(`Passing marks for ${sub.subject_name} must be between 0 and Maximum Marks.`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        exam_id: modalExamId,
        academic_session_id: selectedSessionId,
        location_id: activeBranch?.id || null,
        class_id: modalClassId,
        section_id: modalSectionId || null,
        subjects: selectedSubs.map((s) => ({
          subject_id: s.subject_id,
          maximum_marks: Number(s.maximum_marks),
          passing_marks: Number(s.passing_marks),
          grade_applicable: s.grade_applicable,
          weightage: Number(s.weightage) || 100,
        })),
      };

      if (editingStructure) {
        await api.put(`/exams/structures/${editingStructure.id}`, payload);
      } else {
        await api.post('/exams/structures', payload);
      }

      setIsModalOpen(false);
      await loadStructures();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save Exam Structure.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Exam Structure?')) return;
    try {
      await api.delete(`/exams/structures/${id}`);
      await loadStructures();
    } catch (err: any) {
      alert(err.message || 'Failed to delete Exam Structure.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-brand-600" />
            Exam Structure
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure participating classes, sections, subject offerings, maximum marks, and passing thresholds.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          Define Structure
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

      {/* Structure Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading exam structures...</div>
        ) : structures.length === 0 ? (
          <div className="py-16 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No Exam Structures Configured</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Attach classes and their subjects (e.g. English, Math, Science) with maximum marks to begin scheduling and marks entry.
            </p>
            <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              Configure First Structure
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Exam Name</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Configured Subjects & Marks</th>
                  <th className="py-3 px-4">Total Max Marks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {structures.map((st) => {
                  const totalMarks = (st.subjects || []).reduce((acc, s) => acc + Number(s.maximum_marks), 0);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {st.exam?.exam_name || 'Exam'}
                        <span className="block font-mono text-[10px] text-slate-400">
                          {st.exam?.exam_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {st.class?.display_name || st.class?.name || 'Class'}
                        <span className="block text-[11px] text-brand-700 font-normal">
                          {st.section ? `Section ${st.section.name}` : 'All Sections'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {(st.subjects || []).map((sub) => (
                            <span
                              key={sub.id}
                              className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-medium text-slate-800 flex items-center gap-1"
                            >
                              <span>{sub.subject?.name || 'Subject'}</span>
                              <span className="text-slate-400">|</span>
                              <span className="font-bold text-slate-900">{sub.maximum_marks}M</span>
                              <span className="text-[9px] text-slate-500">(Pass {sub.passing_marks})</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {totalMarks} Marks
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={st.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                          {st.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(st)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(st.id)}
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

      {/* Structure Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStructure ? 'Edit Exam Structure' : 'Define Exam Structure'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Exam</label>
              <select
                value={modalExamId}
                onChange={(e) => setModalExamId(e.target.value)}
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class</label>
              <select
                value={modalClassId}
                onChange={(e) => handleModalClassChange(e.target.value)}
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
                value={modalSectionId}
                onChange={(e) => setModalSectionId(e.target.value)}
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

          {/* Subjects Configuration */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Subject Offerings & Marks Distribution:
            </span>

            {loadingSubjects ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading subject offerings...</div>
            ) : subjectConfigs.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>No subjects found for this class. Please configure subjects in Academic Masters first.</span>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">Include</th>
                      <th className="py-2 px-3">Subject Name</th>
                      <th className="py-2 px-3 w-32">Maximum Marks</th>
                      <th className="py-2 px-3 w-32">Passing Marks</th>
                      <th className="py-2 px-3 w-28">Grade Scale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjectConfigs.map((row, idx) => (
                      <tr key={row.subject_id} className={row.is_selected ? 'bg-white' : 'bg-slate-50/70 opacity-60'}>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.is_selected}
                            onChange={() => handleToggleSubject(idx)}
                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {row.subject_name}
                          {row.subject_code && (
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">({row.subject_code})</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            disabled={!row.is_selected}
                            value={row.maximum_marks}
                            onChange={(e) => handleSubjectFieldChange(idx, 'maximum_marks', e.target.value)}
                            className="h-8 text-xs font-semibold"
                            min={1}
                            required
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            disabled={!row.is_selected}
                            value={row.passing_marks}
                            onChange={(e) => handleSubjectFieldChange(idx, 'passing_marks', e.target.value)}
                            className="h-8 text-xs font-semibold"
                            min={0}
                            required
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            disabled={!row.is_selected}
                            value={row.grade_applicable ? 'YES' : 'NO'}
                            onChange={(e) => handleSubjectFieldChange(idx, 'grade_applicable', e.target.value === 'YES')}
                            className="px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                          >
                            <option value="YES">CBSE (A+ to F)</option>
                            <option value="NO">Marks Only</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingStructure ? 'Update Structure' : 'Save Structure'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
