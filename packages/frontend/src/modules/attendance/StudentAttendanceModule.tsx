// ========================================================================
// StudentAttendanceModule Component
// Class & Section Scoped Daily Student Attendance Marking Screen
// Authoritative Roster from student_academic_enrollments
// Follows strict dependency hierarchy: Session -> Branch -> Class -> Section -> Students
// ========================================================================

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  Save,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  Users,
  ShieldAlert,
  MapPin,
  Building,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  AcademicClassSection,
  EnrolledStudentAttendanceItem,
  AttendanceSummaryMetrics,
  AttendanceStatus,
  StudentRosterResponse,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

function formatSectionDisplay(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Section';
  if (/^section\b/i.test(trimmed)) return trimmed;
  return `Section ${trimmed}`;
}

interface StudentAttendanceModuleProps {
  tabId: string;
}

export const StudentAttendanceModule: React.FC<StudentAttendanceModuleProps> = () => {
  const { userContext, branches, activeBranch, switchBranch } = useAuth();
  const { hasPermission } = usePermission();
  const [, startTransition] = useTransition();

  // Reference Master Dropdown Data
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Selected Filters
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Students & Attendance State
  const [students, setStudents] = useState<EnrolledStudentAttendanceItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryMetrics | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Granular Loading & Error States
  const [loadingMasters, setLoadingMasters] = useState<boolean>(true);
  const [loadingSections, setLoadingSections] = useState<boolean>(false);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [hasQueriedRoster, setHasQueriedRoster] = useState<boolean>(false);

  const [masterError, setMasterError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ------------------------------------------------------------------------
  // Helper: safely unwrap API responses (whether wrapped in { data } or direct)
  // ------------------------------------------------------------------------
  const unwrapData = <T,>(res: any): T => {
    if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
      return res.data as T;
    }
    return res as T;
  };

  // ------------------------------------------------------------------------
  // STEP 1: Initial Master Data Load (Sessions, Branches, Classes)
  // ------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadMasterData() {
      setLoadingMasters(true);
      setMasterError(null);
      try {
        const [sessRes, locRes, clsRes] = await Promise.all([
          api.get<AcademicSession[]>('/academics/sessions?includeInactive=true').catch((err) => {
            console.error('Failed to load academic sessions:', err);
            return [] as AcademicSession[];
          }),
          api.get<Location[]>('/locations').catch((err) => {
            console.error('Failed to load locations:', err);
            return [] as Location[];
          }),
          api.get<ClassItem[]>('/academics/classes').catch((err) => {
            console.error('Failed to load classes:', err);
            return [] as ClassItem[];
          }),
        ]);

        if (!isMounted) return;

        // 1. Process Academic Sessions
        const sessList = unwrapData<AcademicSession[]>(sessRes);
        const validSessions = Array.isArray(sessList) ? sessList : [];
        setSessions(validSessions);

        if (validSessions.length > 0) {
          const activeSess =
            validSessions.find((s) => s.is_current || s.status === 'ACTIVE') || validSessions[0];
          setSelectedSessionId((prev) => prev || activeSess.id);
        } else {
          setMasterError('No academic sessions found for this school.');
        }

        // 2. Process Branches / Locations
        const locList = unwrapData<Location[]>(locRes);
        const validLocations = Array.isArray(locList) && locList.length > 0
          ? locList
          : (branches && branches.length > 0 ? branches : []);
        setLocations(validLocations);

        if (validLocations.length > 0) {
          const defaultLoc =
            (activeBranch && validLocations.some((l) => l.id === activeBranch.id))
              ? activeBranch
              : validLocations[0];
          setSelectedLocationId((prev) => prev || defaultLoc.id);
        }

        // 3. Process Classes
        const clsList = unwrapData<ClassItem[]>(clsRes);
        const validClasses = Array.isArray(clsList) ? clsList : [];
        setClasses(validClasses);

        if (validClasses.length > 0) {
          setSelectedClassId((prev) => prev || validClasses[0].id);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load initial master metadata:', err);
          setMasterError(err.message || 'Unable to load reference masters.');
        }
      } finally {
        if (isMounted) {
          setLoadingMasters(false);
        }
      }
    }

    loadMasterData();

    return () => {
      isMounted = false;
    };
  }, [branches, activeBranch]);

  // Sync with global activeBranch changes from top-right header
  useEffect(() => {
    if (activeBranch?.id && activeBranch.id !== selectedLocationId) {
      setSelectedLocationId(activeBranch.id);
    }
  }, [activeBranch?.id]);

  // ------------------------------------------------------------------------
  // STEP 2: Dependent Load: Sections for selected Session & Class
  // ------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadSectionsForClass() {
      if (!selectedClassId || !selectedSessionId) {
        setSections([]);
        setSelectedSectionId('');
        setStudents([]);
        setSummary(null);
        return;
      }

      setLoadingSections(true);
      setSectionError(null);
      try {
        // 1. Try to fetch specific class-section offerings configured for this session & class
        const offeringsRes = await api
          .get<AcademicClassSection[]>(
            `/academics/class-sections?sessionId=${selectedSessionId}&classId=${selectedClassId}`
          )
          .catch(() => [] as AcademicClassSection[]);

        const offerings = unwrapData<AcademicClassSection[]>(offeringsRes);

        let resolvedSections: SectionItem[] = [];

        if (Array.isArray(offerings) && offerings.length > 0) {
          // Extract sections from offerings with precise names
          resolvedSections = offerings
            .map((o) => {
              const sec = o.section;
              const name = (sec?.name || (o as any).section_name || sec?.code || '').trim();
              const id = o.section_id || sec?.id || o.id;
              return {
                id,
                name: name || 'Section',
                code: sec?.code || (o as any).section_code || '',
                school_id: o.school_id,
                status: 'ACTIVE',
                created_at: sec?.created_at || o.created_at || new Date().toISOString(),
                updated_at: sec?.updated_at || o.updated_at || new Date().toISOString(),
              } as SectionItem;
            })
            .filter((s): s is SectionItem => Boolean(s && s.id));
        }

        if (!isMounted) return;

        setSections(resolvedSections);

        // Auto-select first section or preserve current if still valid
        if (resolvedSections.length > 0) {
          setSelectedSectionId((prev) => {
            const exists = resolvedSections.some((s) => s.id === prev);
            return exists ? prev : resolvedSections[0].id;
          });
        } else {
          setSelectedSectionId('');
          setStudents([]);
          setSummary(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load sections:', err);
          setSectionError(err.message || 'Unable to load sections.');
          setSections([]);
          setSelectedSectionId('');
        }
      } finally {
        if (isMounted) {
          setLoadingSections(false);
        }
      }
    }

    loadSectionsForClass();

    return () => {
      isMounted = false;
    };
  }, [selectedSessionId, selectedClassId]);

  // ------------------------------------------------------------------------
  // STEP 3: Load Enrolled Student Attendance Roster
  // Executes strictly when Session + Branch + Class + Section + Date are ready
  // ------------------------------------------------------------------------
  const loadRoster = useCallback(async () => {
    if (
      !selectedSessionId ||
      !selectedLocationId ||
      !selectedClassId ||
      !selectedSectionId ||
      !attendanceDate
    ) {
      setStudents([]);
      setSummary(null);
      setHasQueriedRoster(false);
      return;
    }

    setLoadingRoster(true);
    setNotification(null);
    setHasQueriedRoster(true);

    try {
      const q = new URLSearchParams({
        sessionId: selectedSessionId,
        locationId: selectedLocationId,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: attendanceDate,
      });

      const res = await api.get<StudentRosterResponse>(`/attendance/students?${q.toString()}`);
      const rosterData = unwrapData<StudentRosterResponse>(res);

      if (rosterData && Array.isArray(rosterData.students)) {
        setStudents(rosterData.students);
        setSummary(rosterData.summary || null);
        setIsLocked(Boolean(rosterData.is_locked));
      } else {
        setStudents([]);
        setSummary(null);
        setIsLocked(false);
      }
    } catch (err: any) {
      console.error('Failed to fetch student attendance roster:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Unable to load student attendance roster.',
      });
      setStudents([]);
      setSummary(null);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedSessionId, selectedLocationId, selectedClassId, selectedSectionId, attendanceDate]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // ------------------------------------------------------------------------
  // Attendance Marking Actions (Bulk & Individual)
  // ------------------------------------------------------------------------
  const handleBulkMark = (targetStatus: AttendanceStatus | 'NOT_MARKED') => {
    if (isLocked) return;
    startTransition(() => {
      const updated = students.map((s) => ({
        ...s,
        status: targetStatus,
      }));
      setStudents(updated);
      recalcSummary(updated);
    });
  };

  const handleIndividualStatusChange = (userId: string, newStatus: AttendanceStatus) => {
    if (isLocked) return;
    startTransition(() => {
      const updated = students.map((s) => (s.user_id === userId ? { ...s, status: newStatus } : s));
      setStudents(updated);
      recalcSummary(updated);
    });
  };

  const handleRemarkChange = (userId: string, remarks: string) => {
    if (isLocked) return;
    const updated = students.map((s) => (s.user_id === userId ? { ...s, remarks } : s));
    setStudents(updated);
  };

  const recalcSummary = (list: EnrolledStudentAttendanceItem[]) => {
    const total = list.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;
    let excused = 0;

    for (const s of list) {
      if (s.status === 'PRESENT') present++;
      else if (s.status === 'ABSENT') absent++;
      else if (s.status === 'LATE') late++;
      else if (s.status === 'HALF_DAY') halfDay++;
      else if (s.status === 'LEAVE') leave++;
      else if (s.status === 'EXCUSED') excused++;
    }

    const marked = present + absent + late + halfDay + leave + excused;
    const positivePresent = present + late + halfDay * 0.5 + excused;
    const pct = marked > 0 ? Math.round((positivePresent / marked) * 100) : 0;

    setSummary({
      total,
      total_count: total,
      total_enrolled: total,
      present,
      present_count: present,
      absent,
      absent_count: absent,
      late,
      late_count: late,
      half_day: halfDay,
      half_day_count: halfDay,
      leave,
      leave_count: leave,
      excused,
      excused_count: excused,
      not_marked: total - marked,
      not_marked_count: total - marked,
      attendance_percentage: pct,
    });
  };

  // ------------------------------------------------------------------------
  // Save Attendance to Backend
  // ------------------------------------------------------------------------
  const handleSaveAttendance = async () => {
    if (!students || students.length === 0) return;
    if (isLocked) return;

    setSaving(true);
    setNotification(null);

    const payload = {
      academic_session_id: selectedSessionId,
      location_id: selectedLocationId,
      class_id: selectedClassId,
      section_id: selectedSectionId,
      attendance_date: attendanceDate,
      records: students
        .filter((s) => s.status !== 'NOT_MARKED')
        .map((s) => ({
          user_id: s.user_id,
          student_enrollment_id: s.student_enrollment_id,
          status: s.status as AttendanceStatus,
          remarks: s.remarks,
        })),
    };

    if (payload.records.length === 0) {
      setNotification({
        type: 'error',
        message: 'Please mark attendance status for at least one student before saving.',
      });
      setSaving(false);
      return;
    }

    try {
      const res = await api.post<any>('/attendance/students', payload);
      const resData = unwrapData<any>(res);

      setNotification({
        type: 'success',
        message:
          resData?.message ||
          `Successfully recorded attendance for ${resData?.saved_count || payload.records.length} students.`,
      });

      // Reload to sync DB state and reload saved attendance
      await loadRoster();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to save attendance.',
      });
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------------
  // Client-Side Search Filter
  // ------------------------------------------------------------------------
  const filteredStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.display_name || '').toLowerCase().includes(q) ||
      (s.roll_number || '').toLowerCase().includes(q) ||
      (s.admission_number || '').toLowerCase().includes(q)
    );
  });

  const getStatusButtonClass = (currentStatus: string, targetStatus: AttendanceStatus) => {
    const isSelected = currentStatus === targetStatus;
    if (!isSelected) {
      return 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
    }
    switch (targetStatus) {
      case 'PRESENT':
        return 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
      case 'ABSENT':
        return 'bg-rose-600 text-white border-rose-700 shadow-sm';
      case 'LATE':
        return 'bg-amber-500 text-white border-amber-600 shadow-sm';
      case 'HALF_DAY':
        return 'bg-purple-600 text-white border-purple-700 shadow-sm';
      case 'LEAVE':
        return 'bg-brand-600 text-white border-brand-700 shadow-sm';
      case 'EXCUSED':
        return 'bg-slate-600 text-white border-slate-700 shadow-sm';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  };

  const isFilterComplete = Boolean(
    selectedSessionId && selectedLocationId && selectedClassId && selectedSectionId
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-600" />
            Student Daily Attendance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative class & section attendance derived strictly from student academic enrollments.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRoster}
            disabled={loadingRoster || !isFilterComplete}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRoster ? 'animate-spin text-brand-600' : ''}`} />
            Reload Roster
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAttendance}
            disabled={saving || isLocked || students.length === 0}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Attendance'}
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4 cursor-pointer text-sm"
          >
            ×
          </button>
        </div>
      )}

      {masterError && (
        <div className="p-3.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{masterError}</span>
        </div>
      )}

      {/* FILTER SELECTION PANEL: Dependent Dropdowns */}
      <Card className="p-5 bg-slate-50/70 border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* 1. Academic Session */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Academic Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              disabled={loadingMasters}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer disabled:bg-slate-100"
            >
              {loadingMasters ? (
                <option value="">Loading sessions...</option>
              ) : sessions.length === 0 ? (
                <option value="">No sessions available</option>
              ) : (
                sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_current ? '(Active)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Branch / Location */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Branch / Campus
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                if (switchBranch) switchBranch(e.target.value);
              }}
              disabled={loadingMasters}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer disabled:bg-slate-100"
            >
              {loadingMasters ? (
                <option value="">Loading branches...</option>
              ) : locations.length === 0 ? (
                <option value="">No branches available</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.location_name || loc.name} ({loc.location_code || loc.code})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3. Attendance Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Attendance Date
            </label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          {/* 4. Class Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSectionId('');
                setStudents([]);
                setSummary(null);
              }}
              disabled={loadingMasters}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer disabled:bg-slate-100"
            >
              {loadingMasters ? (
                <option value="">Loading classes...</option>
              ) : classes.length === 0 ? (
                <option value="">No classes found</option>
              ) : (
                classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.display_name || cls.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 5. Section Dropdown (Depends on selected Class & Session) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={loadingSections || sections.length === 0}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer disabled:bg-slate-100"
            >
              {loadingSections ? (
                <option value="">Loading sections...</option>
              ) : sections.length === 0 ? (
                <option value="">No sections configured for this class</option>
              ) : (
                sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {formatSectionDisplay(sec.name)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </Card>

      {/* Lock Notice */}
      {isLocked && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            This attendance register is locked and cannot be modified. Only administrators can unlock attendance.
          </span>
        </div>
      )}

      {/* Real-time Attendance Summary Cards */}
      {summary && students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500">Total Students</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{summary.total}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
            <div className="text-[11px] font-medium text-emerald-600">Present</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{summary.present}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-rose-100 shadow-2xs">
            <div className="text-[11px] font-medium text-rose-600">Absent</div>
            <div className="text-xl font-bold text-rose-700 mt-0.5">{summary.absent}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-amber-100 shadow-2xs">
            <div className="text-[11px] font-medium text-amber-600">Late</div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{summary.late}</div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-purple-100 shadow-2xs">
            <div className="text-[11px] font-medium text-purple-600">Half Day / Leave</div>
            <div className="text-xl font-bold text-purple-700 mt-0.5">
              {(summary.half_day || 0) + (summary.leave || 0)}
            </div>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-brand-200 shadow-2xs">
            <div className="text-[11px] font-medium text-brand-600">Attendance Rate</div>
            <div className="text-xl font-bold text-brand-700 mt-0.5">
              {summary.attendance_percentage}%
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Controls & Student Search */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5 text-brand-600" /> Bulk Actions:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMark('PRESENT')}
              disabled={isLocked}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium"
            >
              Mark All Present
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMark('ABSENT')}
              disabled={isLocked}
              className="text-rose-700 border-rose-200 hover:bg-rose-50 font-medium"
            >
              Mark All Absent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkMark('NOT_MARKED')}
              disabled={isLocked}
              className="text-slate-600 border-slate-200 hover:bg-slate-50 font-medium"
            >
              Reset
            </Button>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      {/* Student Attendance Roster Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        {loadingRoster ? (
          <div className="p-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2.5">
            <RefreshCw className="w-7 h-7 animate-spin text-brand-600" />
            <span className="font-medium text-slate-700">
              Loading enrolled student attendance roster from Supabase...
            </span>
          </div>
        ) : !isFilterComplete ? (
          <div className="p-16 text-center text-slate-500 text-xs">
            <Filter className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
            <p className="font-bold text-slate-800 text-sm">Select Academic Context</p>
            <p className="mt-1 text-slate-500 max-w-sm mx-auto">
              Choose an academic session, branch, class, and section to load students.
            </p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
            <p className="font-bold text-slate-800 text-sm">
              No active students enrolled in this Class & Section.
            </p>
            <p className="mt-1 text-slate-500 max-w-md mx-auto">
              Ensure students have active enrollment records in Student Academic Enrollments for the selected session and branch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-16">Roll</th>
                  <th className="py-3 px-4 w-28">Admission No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 w-32">Current Status</th>
                  <th className="py-3 px-4 w-96 text-center">Mark Status</th>
                  <th className="py-3 px-4 w-64">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.user_id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Roll Number */}
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {student.roll_number || '-'}
                    </td>

                    {/* Admission Number */}
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {student.admission_number || '-'}
                    </td>

                    {/* Student Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{student.display_name}</div>
                      {student.gender && (
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                          {student.gender}
                        </div>
                      )}
                    </td>

                    {/* Current Status Badge */}
                    <td className="py-3 px-4">
                      {student.status === 'PRESENT' && (
                        <Badge variant="emerald" className="text-[10px] px-2 py-0.5">
                          Present
                        </Badge>
                      )}
                      {student.status === 'ABSENT' && (
                        <Badge variant="rose" className="text-[10px] px-2 py-0.5">
                          Absent
                        </Badge>
                      )}
                      {student.status === 'LATE' && (
                        <Badge variant="amber" className="text-[10px] px-2 py-0.5">
                          Late
                        </Badge>
                      )}
                      {student.status === 'HALF_DAY' && (
                        <Badge variant="purple" className="text-[10px] px-2 py-0.5">
                          Half Day
                        </Badge>
                      )}
                      {student.status === 'LEAVE' && (
                        <Badge variant="primary" className="text-[10px] px-2 py-0.5">
                          Leave
                        </Badge>
                      )}
                      {student.status === 'EXCUSED' && (
                        <Badge variant="slate" className="text-[10px] px-2 py-0.5">
                          Excused
                        </Badge>
                      )}
                      {student.status === 'NOT_MARKED' && (
                        <span className="text-[10px] text-slate-400 italic">Not Marked</span>
                      )}
                    </td>

                    {/* Interactive Status Selector */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE'] as AttendanceStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              onClick={() => handleIndividualStatusChange(student.user_id, st)}
                              disabled={isLocked}
                              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer border ${getStatusButtonClass(
                                student.status,
                                st
                              )}`}
                              title={`Mark as ${st}`}
                            >
                              {st === 'PRESENT'
                                ? 'P'
                                : st === 'ABSENT'
                                ? 'A'
                                : st === 'LATE'
                                ? 'L'
                                : st === 'HALF_DAY'
                                ? 'HD'
                                : 'LV'}
                            </button>
                          )
                        )}
                      </div>
                    </td>

                    {/* Remarks Input */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        placeholder="Optional remarks..."
                        value={student.remarks || ''}
                        onChange={(e) => handleRemarkChange(student.user_id, e.target.value)}
                        disabled={isLocked}
                        className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded-md text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
