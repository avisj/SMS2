// ========================================================================
// StudentFeeAssignmentModule
// Operational Workflow for Generating and Managing Student Fee Demands
// Authoritative Placement from student_academic_enrollments
// ========================================================================

import React, { useEffect, useState, useTransition } from 'react';
import {
  FileText,
  Calendar,
  Layers,
  Users,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Send,
  XCircle,
  Ban,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
  StudentAcademicEnrollment,
  FeeStructure,
  StudentFeeDemand,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface StudentFeeAssignmentModuleProps {
  tabId?: string;
}

export const StudentFeeAssignmentModule: React.FC<StudentFeeAssignmentModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const { activeBranch } = useAuth();
  const [, startTransition] = useTransition();

  // Masters
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);

  // Workflow Selection State
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [billingPeriod, setBillingPeriod] = useState<string>('April 2026');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Enrolled Students Roster
  const [enrolledStudents, setEnrolledStudents] = useState<StudentAcademicEnrollment[]>([]);
  const [selectedStudentUserIds, setSelectedStudentUserIds] = useState<Set<string>>(new Set());
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Existing Demands for View
  const [existingDemands, setExistingDemands] = useState<StudentFeeDemand[]>([]);
  const [loadingDemands, setLoadingDemands] = useState<boolean>(false);

  // Generation status
  const [generating, setGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<{
    message: string;
    generated_count: number;
    skipped_count: number;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // 1. Load Initial Sessions
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const sessRes = await api.get<AcademicSession[]>('/academics/sessions');
        setSessions(sessRes || []);

        const activeSess = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (activeSess) setSelectedSessionId(activeSess.id);
      } catch (err) {
        console.error('[StudentFeeAssignmentModule] Error loading masters:', err);
      }
    };
    loadMasters();
  }, []);

  // 2. Load Class-Sections for Selected Academic Session
  useEffect(() => {
    if (!selectedSessionId) return;

    const loadClassSections = async () => {
      try {
        const csRes = await api.get<AcademicClassSection[]>(
          `/academics/class-sections?sessionId=${selectedSessionId}`
        );
        const validCS = csRes || [];
        setClassSections(validCS);

        // Derive unique classes from class_sections setup
        const mappedClasses: ClassItem[] = Array.from(
          new Map(
            validCS
              .filter((cs) => cs.class && cs.class_id)
              .map((cs) => {
                const c = cs.class!;
                const displayName =
                  c.display_name ||
                  (c as any).display_label ||
                  (c.name.toLowerCase().startsWith('class') ? c.name : `Class ${c.name}`);
                return [cs.class_id, { ...c, display_name: displayName }];
              })
          ).values()
        ).sort(
          (a, b) =>
            (a.numeric_order ?? 99) - (b.numeric_order ?? 99) ||
            a.name.localeCompare(b.name)
        );

        setClasses(mappedClasses);

        if (mappedClasses.length > 0) {
          if (!selectedClassId || !mappedClasses.some((c) => c.id === selectedClassId)) {
            setSelectedClassId(mappedClasses[0].id);
            setSelectedSectionId('');
          }
        } else {
          setSelectedClassId('');
          setSelectedSectionId('');
        }
      } catch (err) {
        console.error('[StudentFeeAssignmentModule] Error loading class sections:', err);
      }
    };

    loadClassSections();
  }, [selectedSessionId]);

  // 3. Update Available Sections When Selected Class Changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      return;
    }

    const classSectionsForSelectedClass = (classSections || []).filter(
      (cs) => cs.class_id === selectedClassId && cs.section
    );
    const derivedSections = classSectionsForSelectedClass.map((cs) => cs.section!);
    setSections(derivedSections);

    if (selectedSectionId && !derivedSections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId('');
    }
  }, [selectedClassId, classSections]);

  // Load structures & enrolled students when session/class/section changes
  useEffect(() => {
    if (!selectedSessionId || !selectedClassId) return;

    const loadContext = async () => {
      try {
        setLoadingStudents(true);
        setLoadingDemands(true);
        setGenerationResult(null);
        setGenerationError(null);

        // 1. Fee structures
        const structs = await api.get<FeeStructure[]>('/fees/structures', {
          academicSessionId: selectedSessionId,
          classId: selectedClassId,
          sectionId: selectedSectionId || undefined,
          status: 'ACTIVE',
        });
        setStructures(structs || []);

        // 2. Authoritative enrollments
        const enrollments = await api.get<StudentAcademicEnrollment[]>('/academics/student-enrollments', {
          sessionId: selectedSessionId,
          locationId: activeBranch?.id || undefined,
          classId: selectedClassId,
          sectionId: selectedSectionId || undefined,
          status: 'ENROLLED',
        });

        setEnrolledStudents(enrollments || []);
        // Select all by default
        setSelectedStudentUserIds(new Set((enrollments || []).map((e) => e.student_user_id)));

        // 3. Demands for this class & session
        const demands = await api.get<StudentFeeDemand[]>('/fees/demands', {
          academicSessionId: selectedSessionId,
          locationId: activeBranch?.id || undefined,
          classId: selectedClassId,
          sectionId: selectedSectionId || undefined,
        });
        setExistingDemands(demands || []);
      } catch (err) {
        console.error('[StudentFeeAssignmentModule] Error loading context:', err);
      } finally {
        setLoadingStudents(false);
        setLoadingDemands(false);
      }
    };

    loadContext();
  }, [selectedSessionId, selectedClassId, selectedSectionId, activeBranch?.id]);

  const handleToggleStudent = (studentUserId: string) => {
    const next = new Set(selectedStudentUserIds);
    if (next.has(studentUserId)) {
      next.delete(studentUserId);
    } else {
      next.add(studentUserId);
    }
    setSelectedStudentUserIds(next);
  };

  const handleToggleAllStudents = () => {
    if (selectedStudentUserIds.size === enrolledStudents.length) {
      setSelectedStudentUserIds(new Set());
    } else {
      setSelectedStudentUserIds(new Set(enrolledStudents.map((e) => e.student_user_id)));
    }
  };

  const handleGenerateDemands = async () => {
    if (selectedStudentUserIds.size === 0) {
      setGenerationError('Please select at least one student to generate fee demands.');
      return;
    }
    if (structures.length === 0) {
      setGenerationError('No active Fee Structures found for this Class. Please add fee structures first.');
      return;
    }

    try {
      setGenerating(true);
      setGenerationError(null);
      setGenerationResult(null);

      const result = await api.post<any>('/fees/demands/generate', {
        academic_session_id: selectedSessionId,
        location_id: activeBranch?.id,
        class_id: selectedClassId,
        section_id: selectedSectionId || undefined,
        student_user_ids: Array.from(selectedStudentUserIds),
        billing_period: billingPeriod,
        issue_date: issueDate,
        due_date: dueDate,
      });

      setGenerationResult(result);

      // Refresh existing demands table
      const refreshedDemands = await api.get<StudentFeeDemand[]>('/fees/demands', {
        academicSessionId: selectedSessionId,
        locationId: activeBranch?.id || undefined,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
      });
      setExistingDemands(refreshedDemands || []);
    } catch (err: any) {
      setGenerationError(err.message || 'Failed to generate fee demands.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCancelDemand = async (demand: StudentFeeDemand) => {
    const reason = window.prompt(`Enter cancellation reason for invoice ${demand.demand_number}:`);
    if (!reason || !reason.trim()) return;

    try {
      await api.post(`/fees/demands/${demand.id}/cancel`, { reason });
      // Refresh
      const refreshedDemands = await api.get<StudentFeeDemand[]>('/fees/demands', {
        academicSessionId: selectedSessionId,
        locationId: activeBranch?.id || undefined,
        classId: selectedClassId,
        sectionId: selectedSectionId || undefined,
      });
      setExistingDemands(refreshedDemands || []);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel demand');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Student Fee Demands & Invoicing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative placement: generate receivables for enrolled students according to class fee blueprints.
          </p>
        </div>
      </div>

      {/* Generation Wizard Card */}
      <Card className="p-5 bg-white border border-slate-200 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          Step 1: Target Academic Class & Billing Period
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Session</label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSectionId('');
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-semibold"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name || (c as any).display_label || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
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

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Billing Period</label>
            <Input
              type="text"
              placeholder="e.g. April 2026"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Applicable Structures Preview */}
        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-700 block mb-2">
            Applicable Fee Structures ({structures.length} heads):
          </span>
          {structures.length === 0 ? (
            <p className="text-xs text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              No fee structures configured for this Class. Please configure fee structures first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {structures.map((st) => (
                <span
                  key={st.id}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 shadow-2xs flex items-center gap-1.5"
                >
                  <span className="font-semibold text-indigo-700">{st.fee_head?.name || 'Fee'}</span>
                  <span className="text-slate-400">|</span>
                  <span className="font-bold text-slate-900">
                    {format(st.amount)}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">({st.frequency})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Enrolled Students Selection Box */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-500" />
              Select Enrolled Students ({selectedStudentUserIds.size} of {enrolledStudents.length} selected):
            </span>
            <button
              type="button"
              onClick={handleToggleAllStudents}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              {selectedStudentUserIds.size === enrolledStudents.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {loadingStudents ? (
            <p className="text-xs text-slate-400 py-3 text-center">Loading enrolled roster...</p>
          ) : enrolledStudents.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>No active students enrolled in this Class & Section. Please enroll students in Academic Assignment first.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-white">
              {enrolledStudents.map((enr) => {
                const isSelected = selectedStudentUserIds.has(enr.student_user_id);
                return (
                  <div
                    key={enr.id}
                    onClick={() => handleToggleStudent(enr.student_user_id)}
                    className={`p-2 rounded border cursor-pointer text-xs flex items-center gap-2 transition-colors ${
                      isSelected ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="font-semibold truncate">
                        {enr.student ? `${enr.student.first_name} ${enr.student.last_name || ''}`.trim() : (enr.student as any)?.full_name || 'Student'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Adm: {enr.admission_number} {enr.roll_number ? `| Roll: ${enr.roll_number}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feedback Alerts */}
        {generationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{generationError}</span>
          </div>
        )}

        {generationResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{generationResult.message}</span>
          </div>
        )}

        {/* Generate Action Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleGenerateDemands}
            disabled={generating || structures.length === 0 || selectedStudentUserIds.size === 0}
            className="flex items-center gap-2 text-xs px-5 py-2.5"
          >
            <Send className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating Demands...' : 'Generate Invoices / Demands'}
          </Button>
        </div>
      </Card>

      {/* Existing Demands Ledger */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Issued Demands / Invoices ({existingDemands.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Authoritative records of fees owed by students</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Demand #</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Adm #</th>
                <th className="px-4 py-3">Fee Head</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Net Amount ({symbol})</th>
                <th className="px-4 py-3 text-right">Paid ({symbol})</th>
                <th className="px-4 py-3 text-right">Outstanding ({symbol})</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingDemands ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    Loading demands records...
                  </td>
                </tr>
              ) : existingDemands.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    No demands generated for this class yet. Use the wizard above to generate.
                  </td>
                </tr>
              ) : (
                existingDemands.map((d) => {
                  const outstanding = Math.max(0, d.net_amount - d.paid_amount);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">{d.demand_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {d.student?.full_name || d.student?.first_name || 'Student'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{d.admission_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{d.fee_head?.name || 'Fee'}</td>
                      <td className="px-4 py-3 text-slate-600">{d.billing_period}</td>
                      <td className="px-4 py-3 text-slate-600">{d.due_date}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {format(d.net_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {format(d.paid_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">
                        {format(outstanding)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            d.status === 'PAID'
                              ? 'success'
                              : d.status === 'PARTIALLY_PAID'
                              ? 'warning'
                              : d.status === 'CANCELLED'
                              ? 'default'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {d.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {d.paid_amount === 0 && d.status !== 'CANCELLED' ? (
                          <button
                            onClick={() => handleCancelDemand(d)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                            title="Cancel Invoice"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
