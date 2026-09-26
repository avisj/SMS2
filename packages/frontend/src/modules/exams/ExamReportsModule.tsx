// ========================================================================
// ExamReportsModule
// Analytical Reporting, Tabular Result Ledgers & Evaluation Progress
// Real data aggregation from exam results, marks & student academic placements
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Search,
  Printer,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  ExamMaster,
  ExamResult,
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface ExamReportsModuleProps {
  tabId?: string;
}

interface SubjectPerformanceItem {
  subject_id: string;
  subject_name: string;
  total_students: number;
  appeared: number;
  absent: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  passed_count: number;
  failed_count: number;
  pass_percentage: number;
}

interface MarksEntryStatusItem {
  subject_id: string;
  subject_name: string;
  max_marks: number;
  passing_marks: number;
  total_students: number;
  entered_count: number;
  pending_count: number;
  completion_percentage: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export const ExamReportsModule: React.FC<ExamReportsModuleProps> = () => {
  const { activeBranch } = useAuth();

  // Active Report View
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics' | 'progress'>('ledger');

  // Filter dropdown data
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);

  // Selected filters
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Report Data States
  const [resultsLedger, setResultsLedger] = useState<ExamResult[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformanceItem[]>([]);
  const [marksProgress, setMarksProgress] = useState<MarksEntryStatusItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Load initial dropdowns
  useEffect(() => {
    loadSessions();
  }, [activeBranch]);

  const loadSessions = async () => {
    try {
      const sessList = await api.get<AcademicSession[]>('/academics/sessions');
      setSessions(sessList || []);
      const active = sessList?.find((s) => s.status === 'ACTIVE') || sessList?.[0];
      if (active) {
        setSelectedSessionId(active.id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  // Load class sections and exams when session changes
  useEffect(() => {
    if (selectedSessionId) {
      loadExams(selectedSessionId);
      loadClassSections(selectedSessionId);
    }
  }, [selectedSessionId]);

  const loadExams = async (sessionId: string) => {
    try {
      const res = await api.get<ExamMaster[]>(`/exams?academic_session_id=${sessionId}`);
      setExams(res || []);
      if (res && res.length > 0) {
        setSelectedExamId(res[0].id);
      } else {
        setSelectedExamId('');
      }
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  };

  const loadClassSections = async (sessionId: string) => {
    try {
      const csList = await api.get<AcademicClassSection[]>('/academics/class-sections', {
        sessionId,
      });
      setClassSections(csList || []);

      const classMap = new Map<string, ClassItem>();
      (csList || []).forEach((cs) => {
        if (cs.class) {
          classMap.set(cs.class.id, {
            ...cs.class,
            display_name: (cs as any).display_name || (cs.class as any).display_label || cs.class.name,
          });
        }
      });

      const derivedClasses = Array.from(classMap.values());
      setClasses(derivedClasses);
      if (derivedClasses.length > 0) {
        setSelectedClassId(derivedClasses[0].id);
      }
    } catch (err) {
      console.error('Failed to load class sections:', err);
    }
  };

  // Extract unique sections for selected class
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      return;
    }
    const matching = classSections.filter((cs) => cs.class_id === selectedClassId && cs.section);
    const secMap = new Map<string, SectionItem>();
    matching.forEach((cs) => {
      if (cs.section) secMap.set(cs.section.id, cs.section);
    });
    setSections(Array.from(secMap.values()));
  }, [selectedClassId, classSections]);

  // Fetch report data whenever filters or active tab changes
  useEffect(() => {
    if (selectedExamId && selectedClassId) {
      fetchReportData();
    } else {
      setResultsLedger([]);
      setSubjectPerformance([]);
      setMarksProgress([]);
    }
  }, [selectedExamId, selectedClassId, selectedSectionId, activeTab]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'ledger') {
        const queryParams = new URLSearchParams({
          exam_id: selectedExamId,
          class_id: selectedClassId,
        });
        if (selectedSectionId) queryParams.append('section_id', selectedSectionId);

        const res = await api.get<ExamResult[]>(`/exams/results?${queryParams.toString()}`);
        setResultsLedger(res || []);
      } else if (activeTab === 'analytics') {
        const queryParams = new URLSearchParams({
          examId: selectedExamId,
          classId: selectedClassId,
        });
        if (selectedSectionId) queryParams.append('sectionId', selectedSectionId);

        const res = await api.get<SubjectPerformanceItem[]>(
          `/exams/reports/subject-performance?${queryParams.toString()}`
        );
        setSubjectPerformance(res || []);
      } else if (activeTab === 'progress') {
        const queryParams = new URLSearchParams({
          examId: selectedExamId,
          academicSessionId: selectedSessionId,
          classId: selectedClassId,
        });
        if (selectedSectionId) queryParams.append('sectionId', selectedSectionId);

        const res = await api.get<MarksEntryStatusItem[]>(
          `/exams/reports/marks-entry-status?${queryParams.toString()}`
        );
        setMarksProgress(res || []);
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Ledger
  const filteredLedger = resultsLedger.filter((res) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const sName = ((res.student as any)?.full_name || `${(res.student as any)?.first_name || ''} ${(res.student as any)?.last_name || ''}`).toLowerCase();
    const adm = ((res.student as any)?.admission_number || res.admission_number || '').toLowerCase();
    const roll = String(res.roll_number || '');
    return sName.includes(q) || adm.includes(q) || roll.includes(q);
  });

  // Analytics Metrics
  const totalLedgerStudents = resultsLedger.length;
  const passedStudents = resultsLedger.filter((r) => r.result_status === 'PASS').length;
  const overallPassRate =
    totalLedgerStudents > 0 ? ((passedStudents / totalLedgerStudents) * 100).toFixed(1) : '0';
  const averagePercentage =
    totalLedgerStudents > 0
      ? (
          resultsLedger.reduce((acc, r) => acc + Number(r.percentage || 0), 0) /
          totalLedgerStudents
        ).toFixed(1)
      : '0';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Exam Reports & Analytics</h1>
              <p className="text-xs text-slate-500">
                Institutional result ledgers, subject performance distributions & mark entry progress
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <Card className="p-4 bg-slate-50/70 border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Examination
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              {exams.length === 0 ? (
                <option value="">No exams found</option>
              ) : (
                exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.exam_name} ({ex.exam_code})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSectionId('');
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-1 focus:ring-indigo-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Section (Optional)
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-1 focus:ring-indigo-500"
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
      </Card>

      {/* High-Level Overview Metrics */}
      {selectedExamId && selectedClassId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Evaluated Students</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalLedgerStudents}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Active enrollments computed</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Class Average</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{averagePercentage}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Aggregated across all subjects</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Pass Rate</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{overallPassRate}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {passedStudents} passed out of {totalLedgerStudents}
            </p>
          </Card>

          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Subjects Configured</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {subjectPerformance.length || marksProgress.length || '—'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">In current exam structure</p>
          </Card>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Class Result Ledger
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Subject Performance Analytics
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
              activeTab === 'progress'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Marks Entry Progress
          </button>
        </div>

        {activeTab === 'ledger' && (
          <div className="relative pb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Class Result Ledger */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Admission No</th>
                  <th className="py-3 px-4">Total Max</th>
                  <th className="py-3 px-4">Total Obtained</th>
                  <th className="py-3 px-4">Percentage</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Class Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading class results ledger...
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No results calculated yet for this examination and class. Compute results in
                      the Results module.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((res, index) => {
                    const studentName = (res.student as any)?.full_name || `${(res.student as any)?.first_name || ''} ${(res.student as any)?.last_name || ''}`;
                    const admNo = (res.student as any)?.admission_number || res.admission_number || '—';
                    const rollNo = res.roll_number || '—';

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {rollNo}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {studentName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {admNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {res.total_maximum_marks}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {res.total_obtained_marks}
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-600">
                          {res.percentage}%
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="indigo" size="sm">
                            {res.grade || 'N/A'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={res.result_status === 'PASS' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {res.result_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          #{index + 1}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Subject Performance Analytics */}
      {activeTab === 'analytics' && (
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Enrolled</th>
                  <th className="py-3 px-4">Appeared</th>
                  <th className="py-3 px-4">Absent</th>
                  <th className="py-3 px-4">Average Score</th>
                  <th className="py-3 px-4">Highest Score</th>
                  <th className="py-3 px-4">Lowest Score</th>
                  <th className="py-3 px-4">Pass / Fail</th>
                  <th className="py-3 px-4">Pass Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading subject performance analytics...
                    </td>
                  </tr>
                ) : subjectPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No marks recorded yet for subjects under this examination.
                    </td>
                  </tr>
                ) : (
                  subjectPerformance.map((sp) => (
                    <tr key={sp.subject_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{sp.subject_name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {sp.total_students}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">{sp.appeared}</td>
                      <td className="py-3 px-4 text-rose-500 font-semibold">{sp.absent}</td>
                      <td className="py-3 px-4 font-bold text-indigo-600">{sp.average_score}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">{sp.highest_score}</td>
                      <td className="py-3 px-4 font-bold text-rose-600">{sp.lowest_score}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-emerald-600">{sp.passed_count}P</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="font-semibold text-rose-500">{sp.failed_count}F</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                sp.pass_percentage >= 75
                                  ? 'bg-emerald-500'
                                  : sp.pass_percentage >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${sp.pass_percentage}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700">{sp.pass_percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Marks Entry Progress */}
      {activeTab === 'progress' && (
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4">Passing Marks</th>
                  <th className="py-3 px-4">Total Students</th>
                  <th className="py-3 px-4">Marks Entered</th>
                  <th className="py-3 px-4">Pending</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Evaluation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading marks entry progress tracker...
                    </td>
                  </tr>
                ) : marksProgress.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No subjects configured in the exam structure for this class.
                    </td>
                  </tr>
                ) : (
                  marksProgress.map((mp) => (
                    <tr key={mp.subject_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{mp.subject_name}</td>
                      <td className="py-3 px-4 text-slate-700 font-semibold">{mp.max_marks}</td>
                      <td className="py-3 px-4 text-slate-700">{mp.passing_marks}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {mp.total_students}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{mp.entered_count}</td>
                      <td className="py-3 px-4 font-bold text-rose-500">{mp.pending_count}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                mp.completion_percentage === 100
                                  ? 'bg-emerald-500'
                                  : mp.completion_percentage > 0
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${mp.completion_percentage}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700">
                            {mp.completion_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            mp.status === 'COMPLETED'
                              ? 'success'
                              : mp.status === 'IN_PROGRESS'
                              ? 'warning'
                              : 'slate'
                          }
                          size="sm"
                        >
                          {mp.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
