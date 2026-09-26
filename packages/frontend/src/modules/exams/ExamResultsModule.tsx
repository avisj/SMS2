// ========================================================================
// ExamResultsModule
// Examination Results Ledger, Grade Aggregation & Official Publication
// Weighted Percentage Calculation & Immutable Publication Snapshots
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Award,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Eye,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
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
import { Modal } from '../../components/common/Modal.js';

interface ExamResultsModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const ExamResultsModule: React.FC<ExamResultsModuleProps> = ({ onNavigate }) => {
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();

  // Filters
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Results State
  const [results, setResults] = useState<ExamResult[]>([]);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [pendingMarks, setPendingMarks] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail Modal
  const [detailResult, setDetailResult] = useState<ExamResult | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

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
        console.error('[ExamResultsModule] Error loading initial masters:', err);
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
          academic_session_id: selectedSessionId,
          location_id: activeBranch?.id || undefined,
        });
        setClassSections(csList || []);

        const uniqueClasses: ClassItem[] = [];
        const seenClassIds = new Set<string>();
        for (const cs of csList || []) {
          if (cs.class && !seenClassIds.has(cs.class_id)) {
            seenClassIds.add(cs.class_id);
            uniqueClasses.push(cs.class);
          }
        }
        setClasses(uniqueClasses);
        if (uniqueClasses.length > 0 && !selectedClassId) {
          setSelectedClassId(uniqueClasses[0].id);
        }
      } catch (err) {
        console.error('[ExamResultsModule] Error loading class sections:', err);
      }
    };

    loadClassSections();
  }, [selectedSessionId, activeBranch?.id]);

  // 3. Update Available Sections on Class Change
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      return;
    }
    const matchingSections = classSections
      .filter((cs) => cs.class_id === selectedClassId && cs.section)
      .map((cs) => cs.section!);
    setSections(matchingSections);
  }, [selectedClassId, classSections]);

  // 4. Load Results
  const loadResults = async () => {
    if (!selectedExamId || !selectedSessionId || !selectedClassId) {
      setResults([]);
      setIsPublished(false);
      return;
    }

    try {
      setLoading(true);
      setPublishMessage(null);
      setErrorMessage(null);

      const res: any = await api.get('/exams/results', {
        examId: selectedExamId,
        academicSessionId: selectedSessionId,
        locationId: activeBranch?.id || undefined,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
      });

      // Safe response shape resolution
      const list = Array.isArray(res)
        ? res
        : (res?.results || res?.data?.results || (Array.isArray(res?.data) ? res.data : []));
      const pub = res?.isPublished !== undefined
        ? Boolean(res.isPublished)
        : (res?.data?.isPublished !== undefined ? Boolean(res.data.isPublished) : false);
      const pending = res?.pendingMarksCount ?? res?.data?.pendingMarksCount ?? 0;

      setResults(list);
      setIsPublished(pub);
      setPendingMarks(pending);
    } catch (err: any) {
      console.error('[ExamResultsModule] Error loading results:', err);
      setErrorMessage(err.message || 'Failed to load examination results.');
      setResults([]);
      setIsPublished(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, [selectedExamId, selectedSessionId, selectedClassId, selectedSectionId, activeBranch?.id]);

  // Publish Results Execution
  const handleExecutePublish = async () => {
    try {
      setPublishing(true);
      setPublishMessage(null);
      setErrorMessage(null);

      const res: any = await api.post('/exams/results/publish', {
        examId: selectedExamId,
        academicSessionId: selectedSessionId,
        locationId: activeBranch?.id,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
      });

      setIsPublishModalOpen(false);
      setPublishMessage(res?.message || 'Examination results published successfully! Certified report cards are now accessible.');
      await loadResults();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish results.');
    } finally {
      setPublishing(false);
    }
  };

  const handleNavigateToReportCards = () => {
    if (onNavigate) {
      onNavigate('report-cards');
    } else {
      openTab('report-cards', 'Report Cards', 'FileText');
    }
  };

  const handleNavigateToMarksEntry = () => {
    if (onNavigate) {
      onNavigate('marks-entry');
    } else {
      openTab('marks-entry', 'Marks Entry', 'Edit3');
    }
  };

  // Filtered List
  const filteredResults = results.filter((r) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase();
    const name = r.student ? `${r.student.first_name} ${r.student.last_name || ''}`.toLowerCase() : '';
    const adm = r.admission_number ? r.admission_number.toLowerCase() : '';
    const roll = r.roll_number ? r.roll_number.toLowerCase() : '';
    return name.includes(s) || adm.includes(s) || roll.includes(s);
  });

  // Aggregates
  const totalStudents = results.length;
  const passedStudents = results.filter((r) => r.result_status === 'PASS').length;
  const failedStudents = results.filter((r) => r.result_status === 'FAIL').length;
  const passRate = totalStudents > 0 ? Number(((passedStudents / totalStudents) * 100).toFixed(1)) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Award className="w-6 h-6 text-brand-600" />
            Examination Results Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Calculated score aggregates, weighted percentages, grading allocation, and official result publishing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPublished && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateToReportCards}
              className="flex items-center gap-1.5 text-brand-700 border-brand-200 bg-brand-50 hover:bg-brand-100"
            >
              <FileText className="w-3.5 h-3.5" />
              View Report Cards
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadResults}
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-Calculate
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsPublishModalOpen(true)}
            loading={publishing}
            disabled={results.length === 0}
            className="flex items-center gap-1.5 shadow-2xs"
          >
            <Send className="w-4 h-4" />
            {isPublished ? 'Re-Publish Results' : 'Publish Results'}
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

        {/* Search */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search Student</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Name or Roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-brand-500 bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="text-center sm:text-left sm:pl-3">
          <span className="text-[11px] text-slate-500 font-medium">Total Candidates</span>
          <p className="text-lg font-bold text-slate-900">{totalStudents}</p>
        </div>
        <div className="text-center sm:text-left sm:border-l sm:border-slate-100 sm:pl-4">
          <span className="text-[11px] text-emerald-600 font-medium">Passed</span>
          <p className="text-lg font-bold text-emerald-700">{passedStudents}</p>
        </div>
        <div className="text-center sm:text-left sm:border-l sm:border-slate-100 sm:pl-4">
          <span className="text-[11px] text-rose-600 font-medium">Failed</span>
          <p className="text-lg font-bold text-rose-700">{failedStudents}</p>
        </div>
        <div className="text-center sm:text-left sm:border-l sm:border-slate-100 sm:pl-4">
          <span className="text-[11px] text-brand-600 font-medium">Pass Rate</span>
          <p className="text-lg font-bold text-brand-800">{passRate}%</p>
        </div>
        <div className="text-center sm:text-left sm:border-l sm:border-slate-100 sm:pl-4">
          <span className="text-[11px] text-amber-600 font-medium">Pending Marks</span>
          <p className={`text-lg font-bold ${pendingMarks > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
            {pendingMarks}
          </p>
        </div>
      </div>

      {/* Workflow Status Banners */}
      {isPublished ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-bold text-emerald-950 text-sm">Official Results Published</span>
              <p className="text-emerald-700 text-[11px] mt-0.5">
                Examination results are officially certified and permanently recorded. Official student report cards can now be generated and printed.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNavigateToReportCards}
            className="whitespace-nowrap flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Open Student Report Cards
          </Button>
        </div>
      ) : results.length > 0 ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <span className="font-bold text-blue-950 text-sm">Results Ledger (Draft Preview)</span>
              <p className="text-blue-700 text-[11px] mt-0.5">
                These scores and grades are computed dynamically from entered marks. Click <strong>Publish Results</strong> to finalize records and certify official report cards.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPublishModalOpen(true)}
            className="whitespace-nowrap flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Publish Results Now
          </Button>
        </div>
      ) : null}

      {/* Pending Marks Warning */}
      {pendingMarks > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span><strong>Marks Entry Incomplete:</strong> {pendingMarks} student subject marks are still unentered.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateToMarksEntry}
            className="h-7 text-xs text-amber-800 border-amber-300 hover:bg-amber-100 whitespace-nowrap"
          >
            Go to Marks Entry
          </Button>
        </div>
      )}

      {/* Messages */}
      {publishMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{publishMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Publication State Badge */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-500 font-medium">
          Showing {filteredResults.length} of {results.length} candidate results:
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Ledger State:</span>
          <Badge variant={isPublished ? 'emerald' : 'amber'}>
            {isPublished ? 'OFFICIALLY PUBLISHED' : 'DRAFT / PREVIEW'}
          </Badge>
        </div>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Computing results...</div>
        ) : filteredResults.length === 0 ? (
          <div className="py-16 text-center">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700">No Examination Results</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Select an exam and class with entered marks to compute the results ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12">Roll</th>
                  <th className="py-3 px-4 w-28">Admission No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4 text-center">Total Marks</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4 text-center">Grade</th>
                  <th className="py-3 px-4 text-center">Result</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((r) => {
                  const studentName = r.student
                    ? `${r.student.first_name} ${r.student.last_name || ''}`.trim()
                    : 'Student';

                  return (
                    <tr key={r.student_user_id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {r.roll_number || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.admission_number || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {studentName}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {r.class?.display_name || r.class?.name || 'Class'}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {r.section ? `Section ${r.section.name}` : 'Section A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {r.total_obtained_marks} / {r.total_maximum_marks}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-900">
                        {r.percentage}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-black text-[11px] ${
                            r.grade === 'A+' || r.grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.grade === 'B+' || r.grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : r.grade === 'F' || r.grade === 'ABS'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {r.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            r.result_status === 'PASS'
                              ? 'emerald'
                              : r.result_status === 'ABSENT'
                              ? 'amber'
                              : 'rose'
                          }
                        >
                          {r.result_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailResult(r);
                            setIsDetailModalOpen(true);
                          }}
                          className="h-7 text-xs flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Student Result Breakdown Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Student Performance Breakdown"
        maxWidth="lg"
      >
        {detailResult && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {detailResult.student
                    ? `${detailResult.student.first_name} ${detailResult.student.last_name || ''}`
                    : 'Student'}
                </p>
                <p className="text-xs text-slate-500">
                  Adm: {detailResult.admission_number || '—'} | Roll: {detailResult.roll_number || '—'}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-black text-brand-800">
                  {detailResult.percentage}% ({detailResult.grade})
                </p>
                <Badge
                  variant={
                    detailResult.result_status === 'PASS'
                      ? 'emerald'
                      : detailResult.result_status === 'ABSENT'
                      ? 'amber'
                      : 'rose'
                  }
                >
                  {detailResult.result_status}
                </Badge>
              </div>
            </div>

            {/* Subject details table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Subject Name</th>
                    <th className="py-2.5 px-3 text-center">Max Marks</th>
                    <th className="py-2.5 px-3 text-center">Pass Marks</th>
                    <th className="py-2.5 px-3 text-center">Scored</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detailResult.details || []).map((d) => (
                    <tr key={d.subject_id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {d.subject_name}
                      </td>
                      <td className="py-2.5 px-3 text-center">{d.maximum_marks}</td>
                      <td className="py-2.5 px-3 text-center">{d.passing_marks}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {d.attendance_status === 'ABSENT'
                          ? 'ABS'
                          : d.obtained_marks !== null
                          ? d.obtained_marks
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{d.grade || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant={d.is_pass ? 'emerald' : 'rose'}>
                          {d.is_pass ? 'PASS' : 'FAIL'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Publish Examination Results"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Publishing will certify all calculated scores, percentages, and grades. Once published, student report cards become certified for viewing and printing.
          </p>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Examination:</span>
              <span className="font-bold text-slate-900">{exams.find((e) => e.id === selectedExamId)?.exam_name || 'Selected Exam'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Class:</span>
              <span className="font-bold text-slate-900">{classes.find((c) => c.id === selectedClassId)?.display_name || 'Class'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Total Candidates:</span>
              <span className="font-bold text-slate-900">{totalStudents} Students</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Performance:</span>
              <span className="font-bold text-emerald-700">{passRate}% Pass ({passedStudents} Passed / {failedStudents} Failed)</span>
            </div>
          </div>

          {pendingMarks > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> {pendingMarks} student marks are still unentered. Unentered subjects will count as unobtained marks.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecutePublish}
              loading={publishing}
              className="flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Certify & Publish Results
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
