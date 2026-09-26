// ========================================================================
// MarksEntryModule
// High-Speed Operational Marks Entry for Teachers & Examination Admins
// Authoritative Student Roster from student_academic_enrollments
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Edit3,
  Search,
  Filter,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Award,
  Users,
  CheckSquare,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  ExamMaster,
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
  SubjectItem,
  ExamStructure,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

interface MarksEntryModuleProps {
  tabId?: string;
}

interface StudentMarksRow {
  enrollment_id: string;
  student_user_id: string;
  student_name: string;
  admission_number: string;
  roll_number: string;
  maximum_marks: number;
  passing_marks: number;
  obtained_marks: number | '' | null;
  attendance_status: 'PRESENT' | 'ABSENT' | 'EXEMPT';
  status: string;
  remarks: string;
  grade?: string;
  is_pass?: boolean;
}

export const MarksEntryModule: React.FC<MarksEntryModuleProps> = () => {
  const { activeBranch } = useAuth();

  // Filters
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Roster & Marks Data
  const [roster, setRoster] = useState<StudentMarksRow[]>([]);
  const [maximumMarks, setMaximumMarks] = useState<number>(100);
  const [passingMarks, setPassingMarks] = useState<number>(33);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        console.error('[MarksEntryModule] Error loading initial masters:', err);
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
        console.error('[MarksEntryModule] Error loading class sections:', err);
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
    // Auto-select first section or All Sections
    if (matchedSections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(matchedSections[0].id);
    }
  }, [selectedClassId, classSections]);

  // 4. Load Subjects Configured for this Exam & Class
  useEffect(() => {
    if (!selectedExamId || !selectedClassId || !selectedSessionId) {
      setSubjects([]);
      return;
    }

    const loadExamSubjects = async () => {
      try {
        const structs = await api.get<ExamStructure[]>('/exams/structures/list', {
          academicSessionId: selectedSessionId,
          examId: selectedExamId,
          classId: selectedClassId,
          sectionId: selectedSectionId || undefined,
        });

        if (structs && structs.length > 0) {
          const allSubs: SubjectItem[] = [];
          for (const st of structs) {
            for (const sub of st.subjects || []) {
              if (sub.subject && !allSubs.some((s) => s.id === sub.subject_id)) {
                allSubs.push(sub.subject as SubjectItem);
              }
            }
          }
          if (allSubs.length > 0) {
            setSubjects(allSubs);
            setSelectedSubjectId(allSubs[0].id);
            return;
          }
        }

        // Fallback to all subjects
        const fallback = await api.get<SubjectItem[]>('/academics/subjects');
        setSubjects(fallback || []);
        if (fallback && fallback.length > 0) {
          setSelectedSubjectId(fallback[0].id);
        }
      } catch (err) {
        console.error('[MarksEntryModule] Error loading subjects:', err);
      }
    };

    loadExamSubjects();
  }, [selectedExamId, selectedClassId, selectedSectionId, selectedSessionId]);

  // 5. Load Marks Roster for Active Context
  const loadRoster = async () => {
    if (!selectedExamId || !selectedSessionId || !selectedClassId || !selectedSubjectId) {
      setRoster([]);
      return;
    }

    try {
      setLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const res: any = await api.get('/exams/marks-roster', {
        examId: selectedExamId,
        academicSessionId: selectedSessionId,
        locationId: activeBranch?.id || undefined,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
        subjectId: selectedSubjectId,
      });

      if (res && res.roster) {
        setMaximumMarks(res.maximum_marks || 100);
        setPassingMarks(res.passing_marks || 33);
        setRoster(
          res.roster.map((r: any) => ({
            ...r,
            obtained_marks: r.obtained_marks !== null && r.obtained_marks !== undefined ? r.obtained_marks : '',
          }))
        );
      } else {
        setRoster([]);
      }
    } catch (err: any) {
      console.error('[MarksEntryModule] Error loading roster:', err);
      setErrorMessage(err.message || 'Failed to load enrolled roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [selectedExamId, selectedSessionId, selectedClassId, selectedSectionId, selectedSubjectId, activeBranch?.id]);

  // Handle Mark Changes
  const handleMarkChange = (idx: number, valStr: string) => {
    const next = [...roster];
    if (valStr === '') {
      next[idx].obtained_marks = '';
      next[idx].grade = '';
      next[idx].is_pass = false;
    } else {
      const num = Number(valStr);
      next[idx].obtained_marks = num;
      next[idx].is_pass = num >= next[idx].passing_marks;

      // Calculate instant grade
      const pct = (num / next[idx].maximum_marks) * 100;
      if (pct >= 90) next[idx].grade = 'A+';
      else if (pct >= 80) next[idx].grade = 'A';
      else if (pct >= 70) next[idx].grade = 'B+';
      else if (pct >= 60) next[idx].grade = 'B';
      else if (pct >= 50) next[idx].grade = 'C+';
      else if (pct >= 40) next[idx].grade = 'C';
      else if (pct >= 33) next[idx].grade = 'D';
      else next[idx].grade = 'F';
    }
    setRoster(next);
  };

  const handleAttendanceChange = (idx: number, status: 'PRESENT' | 'ABSENT' | 'EXEMPT') => {
    const next = [...roster];
    next[idx].attendance_status = status;
    if (status === 'ABSENT') {
      next[idx].obtained_marks = null;
      next[idx].grade = 'ABS';
      next[idx].is_pass = false;
    } else if (status === 'EXEMPT') {
      next[idx].obtained_marks = null;
      next[idx].grade = 'EXM';
      next[idx].is_pass = true;
    }
    setRoster(next);
  };

  const handleRemarksChange = (idx: number, val: string) => {
    const next = [...roster];
    next[idx].remarks = val;
    setRoster(next);
  };

  // Bulk Save
  const handleSaveMarks = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validation
    for (const r of roster) {
      if (r.attendance_status === 'PRESENT' && r.obtained_marks !== '' && r.obtained_marks !== null) {
        const num = Number(r.obtained_marks);
        if (num < 0) {
          setErrorMessage(`Marks for ${r.student_name} cannot be negative.`);
          return;
        }
        if (num > maximumMarks) {
          setErrorMessage(`Marks for ${r.student_name} (${num}) exceed maximum marks (${maximumMarks}).`);
          return;
        }
      }
    }

    try {
      setSaving(true);
      const payload = {
        exam_id: selectedExamId,
        academic_session_id: selectedSessionId,
        location_id: activeBranch?.id,
        class_id: selectedClassId,
        section_id: selectedSectionId || (sections[0]?.id || ''),
        subject_id: selectedSubjectId,
        marks: roster.map((r) => ({
          student_user_id: r.student_user_id,
          obtained_marks: r.attendance_status === 'PRESENT' && r.obtained_marks !== '' && r.obtained_marks !== null
            ? Number(r.obtained_marks)
            : null,
          attendance_status: r.attendance_status,
          remarks: r.remarks,
        })),
      };

      await api.post('/exams/marks/bulk', payload);
      setSuccessMessage(`Marks saved successfully for ${roster.length} students.`);
      await loadRoster();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Edit3 className="w-6 h-6 text-brand-600" />
            Marks Entry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative marks scoring, attendance marking, and real-time pass/fail validation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRoster}
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Roster
          </Button>

          <Button
            variant="primary"
            onClick={handleSaveMarks}
            loading={saving}
            disabled={roster.length === 0}
            className="flex items-center gap-1.5 shadow-2xs"
          >
            <Save className="w-4 h-4" />
            Save Marks
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

        {/* Subject */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full text-xs bg-brand-50 px-3 py-2 rounded-lg border border-brand-300 text-brand-900 font-semibold focus:outline-hidden"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} {sub.code ? `(${sub.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Threshold Indicators & Feedback */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-slate-600">
            Maximum Marks: <strong className="text-slate-900 font-bold">{maximumMarks}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            Passing Marks: <strong className="text-slate-900 font-bold">{passingMarks}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            Enrolled Candidates: <strong className="text-brand-700 font-bold">{roster.length}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pass
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Fail
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Absent
          </span>
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Roster Table Card */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading student roster from academic enrollments...</div>
        ) : roster.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No Enrolled Students Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
              There are no active enrolled students in this Class & Section for the active session. Please enroll students in Academic Assignment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-14">Roll</th>
                  <th className="py-3 px-4 w-32">Admission No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 w-36">Attendance</th>
                  <th className="py-3 px-4 w-32">Marks ({maximumMarks})</th>
                  <th className="py-3 px-4 w-20 text-center">Grade</th>
                  <th className="py-3 px-4 w-24 text-center">Result</th>
                  <th className="py-3 px-4">Remarks (Optional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((row, idx) => {
                  const isAbsent = row.attendance_status === 'ABSENT';
                  const isExempt = row.attendance_status === 'EXEMPT';
                  const hasMark = row.obtained_marks !== '' && row.obtained_marks !== null;

                  return (
                    <tr key={row.student_user_id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {row.roll_number || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {row.admission_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {row.student_name}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={row.attendance_status}
                          onChange={(e) => handleAttendanceChange(idx, e.target.value as any)}
                          className={`text-xs px-2 py-1 rounded border font-medium focus:outline-hidden ${
                            row.attendance_status === 'ABSENT'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : row.attendance_status === 'EXEMPT'
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="PRESENT">Present</option>
                          <option value="ABSENT">Absent</option>
                          <option value="EXEMPT">Exempt</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          type="number"
                          disabled={isAbsent || isExempt}
                          placeholder={isAbsent ? 'ABS' : isExempt ? 'EXM' : '0'}
                          value={row.obtained_marks === null ? '' : row.obtained_marks}
                          onChange={(e) => handleMarkChange(idx, e.target.value)}
                          className="h-8 text-xs font-bold w-28"
                          min={0}
                          max={maximumMarks}
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.grade ? (
                          <span
                            className={`px-2 py-0.5 rounded font-black text-[11px] ${
                              row.grade === 'A+' || row.grade === 'A'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.grade === 'B+' || row.grade === 'B'
                                ? 'bg-blue-100 text-blue-800'
                                : row.grade === 'F' || row.grade === 'ABS'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {row.grade}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isAbsent ? (
                          <Badge variant="amber">ABSENT</Badge>
                        ) : isExempt ? (
                          <Badge variant="purple">EXEMPT</Badge>
                        ) : hasMark ? (
                          <Badge variant={row.is_pass ? 'emerald' : 'rose'}>
                            {row.is_pass ? 'PASS' : 'FAIL'}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Teacher notes..."
                          value={row.remarks}
                          onChange={(e) => handleRemarksChange(idx, e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-hidden focus:border-brand-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
