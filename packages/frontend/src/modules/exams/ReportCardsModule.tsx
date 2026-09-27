// ========================================================================
// ReportCardsModule
// Professional School Report Card Generation & Print-Ready Layout
// Clean Layout, School Profile Stamping, Subject Matrix & Signature Blocks
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Search,
  Users,
  Award,
  AlertCircle,
  Building,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  ExamMaster,
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
  StudentAcademicEnrollment,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface ReportCardsModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const ReportCardsModule: React.FC<ReportCardsModuleProps> = ({ onNavigate }) => {
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();

  // Filters
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<ExamMaster[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);
  const [students, setStudents] = useState<StudentAcademicEnrollment[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedStudentUserId, setSelectedStudentUserId] = useState<string>('');

  // Report Card Payload
  const [reportCard, setReportCard] = useState<any | null>(null);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [showDraftPreview, setShowDraftPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        console.error('[ReportCardsModule] Error loading initial masters:', err);
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
        console.error('[ReportCardsModule] Error loading class sections:', err);
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
    if (matchedSections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(matchedSections[0].id);
    }
  }, [selectedClassId, classSections]);

  // 4. Load Enrolled Students for Selected Class & Section
  useEffect(() => {
    if (!selectedSessionId || !selectedClassId) {
      setStudents([]);
      setSelectedStudentUserId('');
      return;
    }

    const loadEnrollments = async () => {
      try {
        setLoadingStudents(true);
        const enrList = await api.get<StudentAcademicEnrollment[]>('/academics/student-enrollments', {
          sessionId: selectedSessionId,
          locationId: activeBranch?.id || undefined,
          classId: selectedClassId,
          sectionId: selectedSectionId || undefined,
          status: 'ENROLLED',
        });

        setStudents(enrList || []);
        if (enrList && enrList.length > 0) {
          setSelectedStudentUserId(enrList[0].student_user_id);
        } else {
          setSelectedStudentUserId('');
        }
      } catch (err) {
        console.error('[ReportCardsModule] Error loading students:', err);
      } finally {
        setLoadingStudents(false);
      }
    };

    loadEnrollments();
  }, [selectedSessionId, selectedClassId, selectedSectionId, activeBranch?.id]);

  // 5. Load Report Card for Student
  const loadReportCard = async () => {
    if (!selectedExamId || !selectedStudentUserId) {
      setReportCard(null);
      setIsPublished(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res: any = await api.get(`/exams/report-card/${selectedStudentUserId}`, {
        examId: selectedExamId,
      });

      const card = res?.reportCard || res?.data || (res?.student ? res : null);
      const isPub = res?.is_published !== undefined
        ? Boolean(res.is_published)
        : (card?.summary?.is_published !== undefined ? Boolean(card.summary.is_published) : false);

      setReportCard(card);
      setIsPublished(isPub);
    } catch (err: any) {
      console.error('[ReportCardsModule] Error loading report card:', err);
      setError(err.message || 'Failed to generate report card.');
      setReportCard(null);
      setIsPublished(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportCard();
  }, [selectedExamId, selectedStudentUserId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Action Header - Hidden during print */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-brand-600" />
            Student Report Card
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official printable progress report card, subject breakdown, and grade certification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReportCard}
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </Button>

          <Button
            variant="primary"
            onClick={handlePrint}
            disabled={!reportCard}
            className="flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Filter Row - Hidden during print */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

        {/* Student */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Student</label>
          <select
            value={selectedStudentUserId}
            onChange={(e) => setSelectedStudentUserId(e.target.value)}
            className="w-full text-xs bg-brand-50 px-3 py-2 rounded-lg border border-brand-300 text-brand-900 font-semibold focus:outline-hidden"
          >
            {students.map((enr) => {
              const name = enr.student
                ? `${enr.student.first_name} ${enr.student.last_name || ''}`.trim()
                : 'Student';
              return (
                <option key={enr.student_user_id} value={enr.student_user_id}>
                  {enr.roll_number ? `[Roll ${enr.roll_number}] ` : ''}{name} ({enr.admission_number})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {error && (
        <div className="print:hidden p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Card Canvas */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Rendering official student report card...</div>
      ) : !reportCard ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200 p-8">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Report Card Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Please select an enrolled student and examination to view the certified report card.
          </p>
        </div>
      ) : !isPublished && !showDraftPreview ? (
        <div className="py-16 text-center bg-white rounded-xl border border-amber-200 p-8 max-w-xl mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Result Not Published Yet</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
            Result has not been published for this examination yet. Review the Results Ledger and click <strong>Publish Results</strong> to certify and generate official report cards.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('exam-results');
                } else {
                  openTab('exam-results', 'Results Ledger', 'Award');
                }
              }}
              className="flex items-center gap-1.5 shadow-2xs"
            >
              <Award className="w-4 h-4" />
              Go to Results Ledger
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDraftPreview(true)}
              className="text-slate-700 border-slate-300"
            >
              Preview Unofficial Draft
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 md:p-12 rounded-xl border border-slate-300 shadow-md max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
          {/* Draft Preview Indicator */}
          {!isPublished && (
            <div className="print:hidden mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span><strong>UNOFFICIAL DRAFT PREVIEW:</strong> Results for this examination have not been officially published yet.</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDraftPreview(false)}
                className="h-7 text-[11px] text-amber-800 border-amber-300"
              >
                Hide Preview
              </Button>
            </div>
          )}

          {/* Institutional Header */}
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
            <h2 className="text-2xl font-black tracking-wide text-slate-900 uppercase">
              {reportCard.school?.name || 'Delhi Public Academy'}
            </h2>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              {reportCard.location?.name || 'Dwarka Main Campus'} • School Code: {reportCard.school?.school_code || 'DPA'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {reportCard.school?.address || 'Dwarka, New Delhi'} • Tel: {reportCard.school?.phone || '+91 11 2805 1200'}
            </p>
            <div className={`mt-4 inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isPublished ? 'bg-slate-900 text-white' : 'bg-amber-600 text-white'
            }`}>
              {isPublished ? 'OFFICIAL STUDENT PROGRESS REPORT CARD' : 'PROVISIONAL REPORT CARD (UNOFFICIAL DRAFT)'}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-6">
            <div className="space-y-1.5">
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900 w-28 inline-block">Student Name:</span>
                <span className="font-bold text-slate-900 text-sm">{reportCard.student?.full_name}</span>
              </p>
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900 w-28 inline-block">Admission No:</span>
                <span className="font-mono font-medium">{reportCard.student?.admission_number || '—'}</span>
              </p>
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900 w-28 inline-block">Roll Number:</span>
                <span className="font-mono font-bold">{reportCard.student?.roll_number || '—'}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900 w-28 inline-block">Academic Session:</span>
                <span className="font-medium">{reportCard.exam?.session_name || '2026-27'}</span>
              </p>
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900 w-28 inline-block">Class & Section:</span>
                <span className="font-medium">{reportCard.student?.class_name} — {reportCard.student?.section_name}</span>
              </p>
              <p className="text-slate-600">
                <span className="font-semibold text-slate-900 w-28 inline-block">Examination:</span>
                <span className="font-bold text-slate-900">{reportCard.exam?.name}</span>
              </p>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Subject Name</th>
                  <th className="py-3 px-4 text-center">Max Marks</th>
                  <th className="py-3 px-4 text-center">Pass Marks</th>
                  <th className="py-3 px-4 text-center">Marks Obtained</th>
                  <th className="py-3 px-4 text-center">Grade</th>
                  <th className="py-3 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(reportCard.subjects || []).map((sub: any) => (
                  <tr key={sub.subject_id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {sub.subject_name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{sub.maximum_marks}</td>
                    <td className="py-3 px-4 text-center font-mono">{sub.passing_marks}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      {sub.attendance_status === 'ABSENT'
                        ? 'ABS'
                        : sub.obtained_marks !== null
                        ? sub.obtained_marks
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-black">
                      {sub.grade || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      <span className={sub.is_pass ? 'text-emerald-700' : 'text-rose-700'}>
                        {sub.is_pass ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Aggregate Summary Box */}
          <div className="border-2 border-slate-900 rounded-xl p-5 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-10">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Marks</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {reportCard.summary?.total_obtained} / {reportCard.summary?.total_maximum}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Percentage</span>
              <p className="text-xl font-black text-brand-800 mt-0.5">
                {reportCard.summary?.percentage}%
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Overall Grade</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {reportCard.summary?.grade}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Result Status</span>
              <p
                className={`text-xl font-black mt-0.5 ${
                  reportCard.summary?.result_status === 'PASS'
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {reportCard.summary?.result_status}
              </p>
            </div>
          </div>

          {/* Signatures & Certification Area */}
          <div className="grid grid-cols-3 gap-8 pt-12 text-center text-xs text-slate-700">
            <div>
              <div className="border-b border-slate-400 pb-1 mb-2 font-medium italic">
                Class Teacher
              </div>
              <p className="text-[11px] text-slate-500">Signature</p>
            </div>

            <div>
              <div className="border-b border-slate-400 pb-1 mb-2 font-medium italic">
                Examination In-Charge
              </div>
              <p className="text-[11px] text-slate-500">Verified & Sealed</p>
            </div>

            <div>
              <div className="border-b border-slate-400 pb-1 mb-2 font-medium italic">
                Principal / Director
              </div>
              <p className="text-[11px] text-slate-500">Authorized Signatory</p>
            </div>
          </div>

          {/* Footer stamp */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Generated securely via eSchool SMS • Date: {new Date().toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
};
