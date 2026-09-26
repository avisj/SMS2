// ========================================================================
// StudentAssignmentModule Component
// Operational Student Academic Enrollment and Class-Section Allocation
// Governed by students.class_assign permission and data scopes
// ========================================================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Users,
  MapPin,
  Calendar,
  Layers,
  ArrowRightLeft,
  History,
  ShieldAlert,
  CheckCircle2,
  CheckSquare,
  Square,
  UserPlus,
  UserCheck,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  StudentAcademicEnrollment,
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  AcademicClassSection,
  User,
  AvailableStudentForEnrollment,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface StudentAssignmentModuleProps {
  tabId: string;
}

export const StudentAssignmentModule: React.FC<StudentAssignmentModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermission();

  // Permission Guard
  const canAssign = isSuperAdmin || hasPermission('students.class_assign');

  // Master Selections
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [availableClassSections, setAvailableClassSections] = useState<AcademicClassSection[]>([]);

  // Selected Filter Chain
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Enrolled Students
  const [enrollments, setEnrollments] = useState<StudentAcademicEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [enrolledSearch, setEnrolledSearch] = useState('');

  // Available Students for Enrollment
  const [availableStudents, setAvailableStudents] = useState<AvailableStudentForEnrollment[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [availableSearch, setAvailableSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Action / Feedback State
  const [enrolling, setEnrolling] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<StudentAcademicEnrollment | null>(null);
  const [transferForm, setTransferForm] = useState({
    target_class_id: '',
    target_section_id: '',
    roll_number: '',
  });

  // End Enrollment Modal State
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [endTarget, setEndTarget] = useState<StudentAcademicEnrollment | null>(null);
  const [endReason, setEndReason] = useState('Transfer to another school / Withdrawn');

  // History Drawer/Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<User | null>(null);
  const [studentHistoryRecords, setStudentHistoryRecords] = useState<StudentAcademicEnrollment[]>([]);

  const [submitting, setSubmitting] = useState(false);

  // ----------------------------------------------------------------------
  // 1. Initial Reference Masters
  // ----------------------------------------------------------------------
  const loadInitialMasters = async () => {
    try {
      const [sessData, locData, clsData, secData] = await Promise.all([
        api.get<AcademicSession[]>('/academics/sessions?includeInactive=true'),
        api.get<Location[]>('/locations'),
        api.get<ClassItem[]>('/academics/classes'),
        api.get<SectionItem[]>('/academics/sections'),
      ]);

      setSessions(sessData || []);
      setLocations(locData || []);
      setClasses(clsData || []);
      setSections(secData || []);

      const currentSess = (sessData || []).find(s => s.is_current) || (sessData || [])[0];
      if (currentSess && !selectedSessionId) {
        setSelectedSessionId(currentSess.id);
      }

      const defaultLoc = (locData || []).find(l => l.id === activeBranch?.id) || (locData || [])[0];
      if (defaultLoc && !selectedLocationId) {
        setSelectedLocationId(defaultLoc.id);
      }

      if ((clsData || []).length > 0 && !selectedClassId) {
        setSelectedClassId(clsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load assignment masters:', err);
    }
  };

  // ----------------------------------------------------------------------
  // 2. Load configured sections for the selected session and class
  // ----------------------------------------------------------------------
  const loadConfiguredSections = async () => {
    if (!selectedSessionId || !selectedClassId) {
      setAvailableClassSections([]);
      setSelectedSectionId('');
      return;
    }
    try {
      const offerings = await api.get<AcademicClassSection[]>(
        `/academics/class-sections?sessionId=${selectedSessionId}&classId=${selectedClassId}`
      );
      const validOfferings = offerings || [];
      setAvailableClassSections(validOfferings);

      if (validOfferings.length > 0) {
        const hasCurrentSec = validOfferings.some(o => o.section_id === selectedSectionId);
        if (!hasCurrentSec) {
          setSelectedSectionId(validOfferings[0].section_id);
        }
      } else {
        // No configured sections for this class: strictly clear selected section
        setSelectedSectionId('');
        setEnrollments([]);
        setAvailableStudents([]);
        setSelectedStudentIds(new Set());
      }
    } catch (err) {
      console.error('Failed to load class sections:', err);
      setAvailableClassSections([]);
      setSelectedSectionId('');
      setEnrollments([]);
      setAvailableStudents([]);
    }
  };

  // ----------------------------------------------------------------------
  // 3. Load currently enrolled students for selected combination
  // ----------------------------------------------------------------------
  const loadEnrollments = async () => {
    if (!selectedSessionId || !selectedLocationId || !selectedClassId || !selectedSectionId) {
      setEnrollments([]);
      return;
    }
    setLoadingEnrollments(true);
    try {
      const data = await api.get<StudentAcademicEnrollment[]>(
        `/academics/student-enrollments?sessionId=${selectedSessionId}&locationId=${selectedLocationId}&classId=${selectedClassId}&sectionId=${selectedSectionId}&status=ENROLLED`
      );
      setEnrollments(data || []);
    } catch (err: any) {
      console.error('Failed to load enrollments:', err);
      setEnrollments([]);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  // ----------------------------------------------------------------------
  // 4. Load available students eligible for enrollment
  // ----------------------------------------------------------------------
  const loadAvailableStudents = async () => {
    if (!selectedSessionId || !selectedLocationId || !selectedClassId || !selectedSectionId) {
      setAvailableStudents([]);
      return;
    }
    setLoadingAvailable(true);
    try {
      const queryParams = new URLSearchParams({
        sessionId: selectedSessionId,
        locationId: selectedLocationId,
        classId: selectedClassId,
        sectionId: selectedSectionId,
      });
      if (availableSearch.trim()) {
        queryParams.set('search', availableSearch.trim());
      }
      const data = await api.get<AvailableStudentForEnrollment[]>(
        `/academics/student-enrollments/available?${queryParams.toString()}`
      );
      setAvailableStudents(data || []);
    } catch (err: any) {
      console.error('Failed to load available students:', err);
      setAvailableStudents([]);
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Lifecycle effects
  useEffect(() => {
    loadInitialMasters();
  }, [activeBranch]);

  useEffect(() => {
    if (selectedSessionId && selectedClassId) {
      loadConfiguredSections();
    }
  }, [selectedSessionId, selectedClassId]);

  useEffect(() => {
    if (selectedSessionId && selectedLocationId && selectedClassId && selectedSectionId) {
      loadEnrollments();
      loadAvailableStudents();
    } else {
      setEnrollments([]);
      setAvailableStudents([]);
      setSelectedStudentIds(new Set());
    }
  }, [selectedSessionId, selectedLocationId, selectedClassId, selectedSectionId]);

  // Debounced search for available students
  useEffect(() => {
    if (selectedSessionId && selectedLocationId && selectedClassId && selectedSectionId) {
      const timer = setTimeout(() => {
        loadAvailableStudents();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [availableSearch]);

  // ----------------------------------------------------------------------
  // 5. Bulk Enrollment Handler
  // ----------------------------------------------------------------------
  const handleBulkEnroll = async () => {
    if (selectedStudentIds.size === 0) return;
    if (!selectedSessionId || !selectedLocationId || !selectedClassId || !selectedSectionId) return;

    setEnrolling(true);
    setErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      const res = await api.post<{ assignedCount: number; skippedCount: number }>(
        '/academics/student-enrollments/bulk',
        {
          student_ids: Array.from(selectedStudentIds),
          academic_session_id: selectedSessionId,
          location_id: selectedLocationId,
          class_id: selectedClassId,
          section_id: selectedSectionId,
        }
      );

      setActionSuccessMessage(
        `Successfully enrolled ${res.assignedCount} student(s) into ${currentClass?.display_name} - Section ${currentSection?.name}.`
      );
      setSelectedStudentIds(new Set());
      await Promise.all([loadEnrollments(), loadAvailableStudents()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to enroll selected students');
    } finally {
      setEnrolling(false);
    }
  };

  // Selection Toggles
  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const isAllSelected =
    availableStudents.length > 0 &&
    availableStudents.every(s => selectedStudentIds.has(s.student_user_id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds(new Set());
    } else {
      const next = new Set(selectedStudentIds);
      availableStudents.forEach(s => next.add(s.student_user_id));
      setSelectedStudentIds(next);
    }
  };

  // ----------------------------------------------------------------------
  // 6. Transfer Modal & Handler
  // ----------------------------------------------------------------------
  const handleOpenTransfer = (enrollment: StudentAcademicEnrollment) => {
    setTransferTarget(enrollment);
    setTransferForm({
      target_class_id: enrollment.class_id,
      target_section_id: '',
      roll_number: enrollment.roll_number || '',
    });
    setErrorMessage(null);
    setIsTransferModalOpen(true);
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post(`/academics/student-enrollments/${transferTarget.id}/transfer`, {
        target_class_id: transferForm.target_class_id,
        target_section_id: transferForm.target_section_id,
        roll_number: transferForm.roll_number || undefined,
      });
      setIsTransferModalOpen(false);
      setActionSuccessMessage(`Successfully transferred ${transferTarget.student?.first_name} to target section.`);
      await Promise.all([loadEnrollments(), loadAvailableStudents()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to transfer student');
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------
  // 7. End Enrollment Handler
  // ----------------------------------------------------------------------
  const handleOpenEnd = (enrollment: StudentAcademicEnrollment) => {
    setEndTarget(enrollment);
    setEndReason('Transfer to another school / Withdrawn');
    setIsEndModalOpen(true);
  };

  const handleConfirmEnd = async () => {
    if (!endTarget) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post(`/academics/student-enrollments/${endTarget.id}/end`, {
        reason: endReason,
      });
      setIsEndModalOpen(false);
      setActionSuccessMessage(`Ended enrollment for ${endTarget.student?.first_name}. Historical records preserved.`);
      await Promise.all([loadEnrollments(), loadAvailableStudents()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to end enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------
  // 8. Academic History Drawer
  // ----------------------------------------------------------------------
  const handleOpenHistory = async (student: User) => {
    setSelectedHistoryStudent(student);
    try {
      const history = await api.get<StudentAcademicEnrollment[]>(
        `/academics/student-enrollments/student/${student.id}/history`
      );
      setStudentHistoryRecords(history || []);
      setIsHistoryModalOpen(true);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Resolved entities
  const currentSession = sessions.find(s => s.id === selectedSessionId);
  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentSection = sections.find(s => s.id === selectedSectionId);
  const currentLocation = locations.find(l => l.id === selectedLocationId);

  // Enrolled students client-side filter for fast typing
  const filteredEnrollments = useMemo(() => {
    if (!enrolledSearch.trim()) return enrollments;
    const q = enrolledSearch.toLowerCase();
    return enrollments.filter(e =>
      e.admission_number?.toLowerCase().includes(q) ||
      e.roll_number?.toLowerCase().includes(q) ||
      e.student?.first_name?.toLowerCase().includes(q) ||
      e.student?.last_name?.toLowerCase().includes(q) ||
      e.student?.username?.toLowerCase().includes(q)
    );
  }, [enrollments, enrolledSearch]);

  // Permission Denied View
  if (!canAssign) {
    return (
      <Card className="p-8 text-center bg-white border-slate-200">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          You lack the required <span className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded">students.class_assign</span> permission.
          Only authorized admission officers, branch administrators, and directors may manage student class/section assignments.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-600" />
            Student Academic Class Assignment
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative operational workflow for placing students into academic sessions, campuses, classes, and sections.
          </p>
        </div>
      </div>

      {/* Success & Error Banners */}
      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Cascading Filter Bar */}
      <Card className="p-4 bg-white border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* 1. Session */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              1. Academic Session
            </label>
            <select
              value={selectedSessionId}
              onChange={e => {
                setSelectedSessionId(e.target.value);
                setSelectedSectionId('');
                setEnrollments([]);
                setAvailableStudents([]);
                setSelectedStudentIds(new Set());
              }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_current ? '(Current Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Branch / Location */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              2. Branch / Campus
            </label>
            <select
              value={selectedLocationId}
              onChange={e => {
                setSelectedLocationId(e.target.value);
                setEnrollments([]);
                setAvailableStudents([]);
                setSelectedStudentIds(new Set());
              }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.location_name} ({l.location_code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Class */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              3. Class
            </label>
            <select
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
                setSelectedSectionId('');
                setEnrollments([]);
                setAvailableStudents([]);
                setSelectedStudentIds(new Set());
              }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Configured Section */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              4. Configured Section
            </label>
            <select
              value={selectedSectionId}
              onChange={e => {
                setSelectedSectionId(e.target.value);
                setSelectedStudentIds(new Set());
              }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              disabled={availableClassSections.length === 0}
            >
              {availableClassSections.length === 0 ? (
                <option value="">No sections configured for this class</option>
              ) : (
                availableClassSections.map(cs => {
                  const secName = (cs.section?.name || (cs as any).section_name || '').trim();
                  const displaySec = secName ? (/^section\b/i.test(secName) ? secName : `Section ${secName}`) : 'Section';
                  return (
                    <option key={cs.section_id} value={cs.section_id}>
                      {displaySec} {cs.capacity ? `(${cs.capacity} capacity)` : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      </Card>

      {/* Section Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-teal-50/60 border border-teal-200/80 rounded-lg text-xs">
        <div className="flex items-center gap-2 text-teal-900 font-semibold">
          <span>Active View:</span>
          <span className="font-bold text-teal-700">
            {currentSession?.name} • {currentLocation?.location_name} • {currentClass?.display_name}
            {currentSection ? ` — Section ${currentSection.name}` : ' (No section selected)'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-teal-800">
          <span>Enrolled Students: <strong>{enrollments.length}</strong></span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* AVAILABLE STUDENTS WORKFLOW SECTION                                */}
      {/* ================================================================== */}
      <Card className="p-4 bg-white border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-600" />
              Available Students for Enrollment
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select students from the school directory to assign and enroll into {currentClass?.display_name} - Section {currentSection?.name || '...'}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Selected: <strong className="text-teal-700">{selectedStudentIds.size}</strong> student(s)
            </span>
            <Button
              onClick={handleBulkEnroll}
              disabled={
                selectedStudentIds.size === 0 ||
                !selectedSectionId ||
                enrolling ||
                availableClassSections.length === 0
              }
              className="flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              {enrolling ? 'Enrolling...' : `Enroll Selected Students (${selectedStudentIds.size})`}
            </Button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search available students by name or admission no..."
              value={availableSearch}
              onChange={e => setAvailableSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {availableStudents.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"
            >
              {isAllSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {isAllSelected ? 'Deselect All' : 'Select All Eligible'}
            </button>
          )}
        </div>

        {/* Available Students Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-2.5 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={availableStudents.length === 0}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="py-2.5 px-3">Admission No.</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Current Academic Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loadingAvailable ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading available students...
                  </td>
                </tr>
              ) : availableClassSections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-rose-500 font-medium">
                    No sections configured for this class for the selected academic session.
                  </td>
                </tr>
              ) : !selectedSectionId ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Please select a configured section above to view available students.
                  </td>
                </tr>
              ) : availableStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    All eligible students are already enrolled or no eligible students are available.
                  </td>
                </tr>
              ) : (
                availableStudents.map(student => {
                  const isSelected = selectedStudentIds.has(student.student_user_id);
                  return (
                    <tr
                      key={student.student_user_id}
                      onClick={() => toggleSelectStudent(student.student_user_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectStudent(student.student_user_id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-teal-700 text-[11px]">
                        {student.admission_number}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {student.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        @{student.username}
                      </td>
                      <td className="py-2.5 px-3">
                        {student.is_enrolled_other ? (
                          <Badge variant="amber">
                            {student.current_status} (Transfer)
                          </Badge>
                        ) : (
                          <Badge variant="emerald">
                            Not Enrolled
                          </Badge>
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

      {/* ================================================================== */}
      {/* CURRENTLY ENROLLED STUDENTS TABLE                                  */}
      {/* ================================================================== */}
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm space-y-4 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Currently Enrolled Students ({enrollments.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Authoritative enrollments registered in student_academic_enrollments for this academic context.
            </p>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search enrolled students..."
              value={enrolledSearch}
              onChange={e => setEnrolledSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Roll No.</th>
                <th className="py-3 px-4">Admission No.</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Enrollment Status</th>
                <th className="py-3 px-4">Enrolled Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loadingEnrollments ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading student enrollments...
                  </td>
                </tr>
              ) : availableClassSections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-rose-500 font-medium">
                    Target class has no configured sections for this academic session.
                  </td>
                </tr>
              ) : filteredEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No students are currently enrolled in this class and section. Select available students above and click "Enroll Selected Students".
                  </td>
                </tr>
              ) : (
                filteredEnrollments.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {e.roll_number || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-teal-700">
                      {e.admission_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {e.student ? `${e.student.first_name} ${e.student.last_name || ''}` : 'Unknown Student'}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        @{e.student?.username}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          e.enrollment_status === 'ENROLLED'
                            ? 'emerald'
                            : e.enrollment_status === 'PROMOTED'
                            ? 'indigo'
                            : 'amber'
                        }
                      >
                        {e.enrollment_status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {e.start_date ? e.start_date.split('T')[0] : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenTransfer(e)}
                          className="flex items-center gap-1 text-[11px] text-teal-700 hover:bg-teal-50"
                          title="Change / Transfer Class or Section"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          Transfer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEnd(e)}
                          className="flex items-center gap-1 text-[11px] text-rose-600 hover:bg-rose-50"
                          title="End / Withdraw Enrollment"
                        >
                          <XCircle className="w-3 h-3" />
                          End
                        </Button>
                        {e.student && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenHistory(e.student!)}
                            className="flex items-center gap-1 text-[11px] text-slate-600 hover:bg-slate-100"
                            title="View Academic History"
                          >
                            <History className="w-3 h-3" />
                            History
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Transfer Student */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={`Change Class / Section: ${transferTarget?.student?.first_name} ${transferTarget?.student?.last_name || ''}`}
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <p className="font-semibold text-slate-800">Current Academic Placement:</p>
            <p className="text-slate-600">
              {transferTarget?.class?.display_name} — Section {transferTarget?.section?.name} (Roll: {transferTarget?.roll_number || 'N/A'})
            </p>
            <p className="text-[11px] text-slate-400">
              Transfer preserves the historical record with end date and creates a new active enrollment.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class</label>
            <select
              value={transferForm.target_class_id}
              onChange={e => setTransferForm({ ...transferForm, target_class_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              required
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Section</label>
            <select
              value={transferForm.target_section_id}
              onChange={e => setTransferForm({ ...transferForm, target_section_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              required
            >
              <option value="">Select target section...</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="New Roll Number in Target Section (Optional)"
            value={transferForm.roll_number}
            onChange={e => setTransferForm({ ...transferForm, roll_number: e.target.value })}
            placeholder="e.g. 1005"
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Transferring...' : 'Confirm Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: End Enrollment */}
      <Modal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title={`End Academic Enrollment: ${endTarget?.student?.first_name} ${endTarget?.student?.last_name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to end this student's enrollment in{' '}
            <strong>
              {endTarget?.class?.display_name} — Section {endTarget?.section?.name}
            </strong>
            ? The historical enrollment record will be preserved with status <strong>WITHDRAWN</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
            <input
              type="text"
              value={endReason}
              onChange={e => setEndReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
              placeholder="e.g. Relocated to another city"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsEndModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmEnd} disabled={submitting}>
              {submitting ? 'Processing...' : 'Confirm End Enrollment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Student Academic History Progression */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Academic Progression: ${selectedHistoryStudent?.first_name} ${selectedHistoryStudent?.last_name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Multi-year historical academic enrollment ledger preserved without data loss across sessions.
          </p>

          <div className="space-y-3">
            {studentHistoryRecords.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No history records found.</p>
            ) : (
              studentHistoryRecords.map(h => (
                <div
                  key={h.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        Session {h.session?.name}
                      </span>
                      <Badge
                        variant={
                          h.enrollment_status === 'ENROLLED'
                            ? 'emerald'
                            : h.enrollment_status === 'PROMOTED'
                            ? 'indigo'
                            : 'amber'
                        }
                      >
                        {h.enrollment_status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {h.class?.display_name} — Section {h.section?.name} • Roll: {h.roll_number || 'N/A'} • Campus: {h.location?.location_name}
                    </p>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-400">
                    {h.start_date} {h.end_date ? `→ ${h.end_date}` : '(Current)'}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsHistoryModalOpen(false)}>
              Close History
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
