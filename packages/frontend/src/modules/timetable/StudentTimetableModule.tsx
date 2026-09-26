// ========================================================================
// Student Timetable Module
// Authoritative Student Timetable Grid with Versioned Snapshot Management,
// Dynamic Period Scheduling, Strict Teacher Eligibility, and Conflict Prevention.
// ========================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarRange,
  Clock,
  Layers,
  Grid,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  History,
  X,
  UserCheck,
  Building,
  Utensils,
  Eye,
  Check,
  RefreshCw,
  Printer,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  AcademicClassSubject,
  TeacherSubjectAssignment,
  TimetableMaster,
  TimetableDetail,
  GeneratedPeriod,
  TimetableCellAssignmentInput,
} from '../../types/index.js';

interface StudentTimetableModuleProps {
  tabId: string;
}

export const StudentTimetableModule: React.FC<StudentTimetableModuleProps> = ({ tabId }) => {
  const { openTab, tabs, activeTabId } = useWorkspace();
  const currentTab = tabs.find((t) => t.id === tabId);

  // Scope & Filter Selectors
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Timetable Data
  const [activeMaster, setActiveMaster] = useState<TimetableMaster | null>(null);
  const [currentViewingMaster, setCurrentViewingMaster] = useState<TimetableMaster | null>(null);
  const [periods, setPeriods] = useState<GeneratedPeriod[]>([]);
  const [details, setDetails] = useState<TimetableDetail[]>([]);
  const [versionHistory, setVersionHistory] = useState<TimetableMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [gridLoading, setGridLoading] = useState<boolean>(false);

  // Subject offerings for selected class
  const [classSubjects, setClassSubjects] = useState<AcademicClassSubject[]>([]);

  // Cell Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedCell, setSelectedCell] = useState<{
    day: string;
    period: GeneratedPeriod;
    existingDetail?: TimetableDetail;
  } | null>(null);

  const [modalSubjectId, setModalSubjectId] = useState<string>('');
  const [modalTeacherId, setModalTeacherId] = useState<string>('');
  const [modalRoom, setModalRoom] = useState<string>('');
  const [modalRemarks, setModalRemarks] = useState<string>('');
  const [eligibleTeachers, setEligibleTeachers] = useState<TeacherSubjectAssignment[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<boolean>(false);

  // Version History Drawer State
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Initial Master Data Loading
  useEffect(() => {
    async function loadScopeData() {
      try {
        setLoading(true);
        const [sessList, locList, clsList, secList] = await Promise.all([
          api.get<AcademicSession[]>('/academics/sessions'),
          api.get<Location[]>('/locations'),
          api.get<ClassItem[]>('/academics/classes'),
          api.get<SectionItem[]>('/academics/sections'),
        ]);

        setSessions(sessList || []);
        setLocations(locList || []);
        setClasses(clsList || []);
        setSections(secList || []);

        const paramSession = currentTab?.params?.sessionId;
        const paramLocation = currentTab?.params?.locationId;

        const currSess =
          (sessList || []).find((s) => s.id === paramSession) ||
          (sessList || []).find((s) => s.is_current) ||
          (sessList || [])[0];
        if (currSess) setSelectedSessionId(currSess.id);

        const targetLoc =
          (locList || []).find((l) => l.id === paramLocation) || (locList || [])[0];
        if (targetLoc) setSelectedLocationId(targetLoc.id);

        if (clsList && clsList.length > 0) setSelectedClassId(clsList[0].id);
        if (secList && secList.length > 0) setSelectedSectionId(secList[0].id);
      } catch (err) {
        console.error('Failed to load scope data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadScopeData();
  }, []);

  // 2. Load Class Subjects Offerings when Session or Class changes
  useEffect(() => {
    if (!selectedSessionId || !selectedClassId) {
      setClassSubjects([]);
      return;
    }

    async function loadOfferings() {
      try {
        const subjects = await api.get<AcademicClassSubject[]>('/academics/class-subjects', {
          sessionId: selectedSessionId,
          classId: selectedClassId,
        });
        setClassSubjects(subjects || []);
      } catch (err) {
        console.error('Failed to load class subjects:', err);
        setClassSubjects([]);
      }
    }
    loadOfferings();
  }, [selectedSessionId, selectedClassId]);

  // 3. Load Active Timetable and Version History
  const fetchActiveSchedule = async () => {
    if (!selectedSessionId || !selectedLocationId) return;

    try {
      setGridLoading(true);
      const [schedData, histList] = await Promise.all([
        api.get<{
          master: TimetableMaster | null;
          periods: GeneratedPeriod[];
          details: TimetableDetail[];
        }>('/timetables/active', {
          sessionId: selectedSessionId,
          locationId: selectedLocationId,
          classId: selectedClassId || undefined,
          sectionId: selectedSectionId || undefined,
        }),
        api.get<TimetableMaster[]>('/timetables/history', {
          sessionId: selectedSessionId,
          locationId: selectedLocationId,
        }),
      ]);

      if (schedData?.master) {
        setActiveMaster(schedData.master);
        setCurrentViewingMaster(schedData.master);
        setPeriods(schedData.periods || []);
        setDetails(schedData.details || []);
      } else {
        setActiveMaster(null);
        setCurrentViewingMaster(null);
        setPeriods([]);
        setDetails([]);
      }

      if (histList) {
        setVersionHistory(histList);
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
      setActiveMaster(null);
      setCurrentViewingMaster(null);
      setPeriods([]);
      setDetails([]);
    } finally {
      setGridLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSchedule();
  }, [selectedSessionId, selectedLocationId, selectedClassId, selectedSectionId]);

  // Reactive cross-tab listener for timetable updates
  useEffect(() => {
    const handleTimetableUpdated = (e: Event) => {
      const custom = e as CustomEvent;
      if (
        !custom.detail?.sessionId ||
        (custom.detail.sessionId === selectedSessionId && custom.detail.locationId === selectedLocationId)
      ) {
        fetchActiveSchedule();
      }
    };

    window.addEventListener('sms:timetable-updated', handleTimetableUpdated);
    return () => window.removeEventListener('sms:timetable-updated', handleTimetableUpdated);
  }, [selectedSessionId, selectedLocationId, selectedClassId, selectedSectionId]);

  // Refetch when tab becomes active in workspace to avoid stale cache
  const isTabActive = activeTabId === tabId;
  useEffect(() => {
    if (isTabActive && selectedSessionId && selectedLocationId) {
      fetchActiveSchedule();
    }
  }, [isTabActive]);

  // 4. View a specific historical version
  const handleViewVersion = async (versionMasterId: string) => {
    try {
      setGridLoading(true);
      const data = await api.get<{
        master: TimetableMaster;
        periods: GeneratedPeriod[];
        details: TimetableDetail[];
      }>(`/timetables/${versionMasterId}`, {
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
      });

      if (data) {
        setCurrentViewingMaster(data.master);
        setPeriods(data.periods || []);
        setDetails(data.details || []);
        setHistoryDrawerOpen(false);
      }
    } catch (err) {
      console.error('Failed to load historical version:', err);
    } finally {
      setGridLoading(false);
    }
  };

  // 5. Activate a version
  const handleActivateVersion = async (versionMasterId: string) => {
    try {
      const data = await api.post<TimetableMaster>(`/timetables/${versionMasterId}/activate`);

      setActionSuccess(`Version ${data.version_no} (${data.timetable_id}) activated successfully!`);
      setHistoryDrawerOpen(false);
      await fetchActiveSchedule();

      // Broadcast update
      window.dispatchEvent(
        new CustomEvent('sms:timetable-updated', {
          detail: {
            sessionId: selectedSessionId,
            locationId: selectedLocationId,
            masterId: data.id,
            timetableId: data.timetable_id,
            versionNo: data.version_no,
          },
        })
      );

      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to activate version');
    }
  };

  // 6. Open Assign Modal
  const handleOpenAssignModal = (day: string, period: GeneratedPeriod, existingDetail?: TimetableDetail) => {
    setSelectedCell({ day, period, existingDetail });
    setAssignError(null);

    if (existingDetail) {
      setModalSubjectId(existingDetail.subject_id);
      setModalTeacherId(existingDetail.teacher_id);
      setModalRoom(existingDetail.room_id || '');
      setModalRemarks(existingDetail.remarks || '');
    } else {
      setModalSubjectId('');
      setModalTeacherId('');
      setModalRoom('');
      setModalRemarks('');
    }
    setAssignModalOpen(true);
  };

  // 7. Fetch eligible teachers when Subject changes in modal
  useEffect(() => {
    if (!modalSubjectId || !selectedSessionId || !selectedLocationId || !selectedClassId || !selectedSectionId) {
      setEligibleTeachers([]);
      return;
    }

    async function loadTeachers() {
      try {
        setLoadingTeachers(true);
        const teachers = await api.get<TeacherSubjectAssignment[]>('/academics/teacher-assignments', {
          sessionId: selectedSessionId,
          locationId: selectedLocationId,
          classId: selectedClassId,
          sectionId: selectedSectionId,
          subjectId: modalSubjectId,
          status: 'ACTIVE',
        });

        if (Array.isArray(teachers)) {
          setEligibleTeachers(teachers);
          // Auto-select if only 1 eligible teacher
          if (teachers.length === 1 && !modalTeacherId) {
            setModalTeacherId(teachers[0].teacher_user_id);
          }
        } else {
          setEligibleTeachers([]);
        }
      } catch (err) {
        console.error('Failed to load eligible teachers:', err);
        setEligibleTeachers([]);
      } finally {
        setLoadingTeachers(false);
      }
    }
    loadTeachers();
  }, [modalSubjectId, selectedSessionId, selectedLocationId, selectedClassId, selectedSectionId]);

  // 8. Submit Assignment (Generates new timetable version)
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentViewingMaster || !selectedCell) return;

    if (!modalSubjectId) {
      setAssignError('Please select a subject offered for this class.');
      return;
    }
    if (!modalTeacherId) {
      setAssignError('Please select an eligible teacher assigned to this subject.');
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);

      const payload: TimetableCellAssignmentInput = {
        day_of_week: selectedCell.day,
        period_no: selectedCell.period.period_no,
        class_id: selectedClassId,
        section_id: selectedSectionId,
        subject_id: modalSubjectId,
        teacher_id: modalTeacherId,
        room_id: modalRoom || null,
        remarks: modalRemarks || null,
      };

      const data = await api.post<{
        master: TimetableMaster;
        periods: GeneratedPeriod[];
        details: TimetableDetail[];
      }>(`/timetables/${currentViewingMaster.id}/assign`, payload);

      setAssignModalOpen(false);
      setActiveMaster(data.master);
      setCurrentViewingMaster(data.master);
      setPeriods(data.periods || []);
      setDetails(data.details || []);
      setActionSuccess(
        `Assignment saved! Generated new Version ${data.master.version_no} (${data.master.timetable_id}).`
      );

      // Refresh history list
      api.get<TimetableMaster[]>('/timetables/history', {
        sessionId: selectedSessionId,
        locationId: selectedLocationId,
      }).then((histList) => {
        if (histList) setVersionHistory(histList);
      }).catch((err) => console.error('Failed to refresh history:', err));

      // Broadcast update across tabs
      window.dispatchEvent(
        new CustomEvent('sms:timetable-updated', {
          detail: {
            sessionId: selectedSessionId,
            locationId: selectedLocationId,
            masterId: data.master.id,
            timetableId: data.master.timetable_id,
            versionNo: data.master.version_no,
          },
        })
      );

      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setAssignError(err.message || 'Error saving assignment');
    } finally {
      setAssigning(false);
    }
  };

  // 9. Remove Cell Assignment
  const handleRemoveCell = async (day: string, periodNo: number) => {
    if (!currentViewingMaster) return;
    if (!confirm(`Are you sure you want to clear this assignment on ${day} Period ${periodNo}? This will create a new timetable version.`)) {
      return;
    }

    try {
      setGridLoading(true);
      const data = await api.post<{
        master: TimetableMaster;
        periods: GeneratedPeriod[];
        details: TimetableDetail[];
      }>(`/timetables/${currentViewingMaster.id}/remove-cell`, {
        day_of_week: day,
        period_no: periodNo,
        class_id: selectedClassId,
        section_id: selectedSectionId,
      });

      setActiveMaster(data.master);
      setCurrentViewingMaster(data.master);
      setPeriods(data.periods || []);
      setDetails(data.details || []);
      setActionSuccess(`Cell cleared! Generated new Version ${data.master.version_no}.`);

      api.get<TimetableMaster[]>('/timetables/history', {
        sessionId: selectedSessionId,
        locationId: selectedLocationId,
      }).then((histList) => {
        if (histList) setVersionHistory(histList);
      }).catch((err) => console.error('Failed to refresh history:', err));

      // Broadcast update across tabs
      window.dispatchEvent(
        new CustomEvent('sms:timetable-updated', {
          detail: {
            sessionId: selectedSessionId,
            locationId: selectedLocationId,
            masterId: data.master.id,
            timetableId: data.master.timetable_id,
            versionNo: data.master.version_no,
          },
        })
      );

      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to clear cell');
    } finally {
      setGridLoading(false);
    }
  };

  // Find cell assignment
  const getCellDetail = (day: string, periodNo: number): TimetableDetail | undefined => {
    return details.find(
      (d) =>
        d.day_of_week.toLowerCase() === day.toLowerCase() &&
        d.period_no === periodNo &&
        d.class_id === selectedClassId &&
        d.section_id === selectedSectionId
    );
  };

  const isHistorical = currentViewingMaster && activeMaster && currentViewingMaster.id !== activeMaster.id;

  const currentClassName = classes.find((c) => c.id === selectedClassId)?.name || 'Class';
  const currentSectionName = sections.find((s) => s.id === selectedSectionId)?.name || 'Section';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-sm font-medium text-slate-600">Loading timetable workspace...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <CalendarRange className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Student Timetable</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
              Authoritative Master Schedule
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            View and manage classroom schedules. Every edit strictly validates teacher assignments and produces a new versioned snapshot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Schedule
          </button>

          <button
            onClick={() => setHistoryDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-xs transition-colors"
          >
            <History className="w-4 h-4" />
            Version History ({versionHistory.length})
          </button>
        </div>
      </div>

      {/* Selectors Bar: Branch, Session, Class, Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Academic Session
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.is_current ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
            Branch / Location
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name || `Class ${c.name}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center gap-3 text-xs font-semibold text-emerald-800 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Historical View Warning Banner */}
      {isHistorical && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-900">
                Viewing Historical Snapshot: Version {currentViewingMaster?.version_no} ({currentViewingMaster?.timetable_id})
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                This archived version is read-only. To modify it, activate this version or return to the active version.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleActivateVersion(currentViewingMaster!.id)}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Activate This Version
            </button>
            <button
              onClick={() => handleViewVersion(activeMaster!.id)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Return to Active
            </button>
          </div>
        </div>
      )}

      {/* Active Version Info Bar */}
      {currentViewingMaster ? (
        <div className="bg-white px-5 py-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
              {currentViewingMaster.timetable_id}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                currentViewingMaster.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {currentViewingMaster.status}
            </span>
            <span className="text-xs text-slate-500">
              Schedule for: <strong className="text-slate-800">Class {currentClassName} - Section {currentSectionName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              Timings: <strong className="text-slate-700 font-mono">{currentViewingMaster.first_period_start_time} - {currentViewingMaster.last_period_end_time}</strong>
            </span>
            <span>•</span>
            <span>
              Period: <strong className="text-slate-700">{currentViewingMaster.period_duration_minutes} mins</strong>
            </span>
            <span>•</span>
            <span>
              Lunch: <strong className="text-slate-700 font-mono">{currentViewingMaster.lunch_start_time} - {currentViewingMaster.lunch_end_time}</strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center space-y-3">
          <Clock className="w-10 h-10 text-amber-600 mx-auto" />
          <h3 className="text-base font-bold text-amber-900">No Timetable Configured</h3>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            There is no active timetable schedule configured for this branch and academic session yet.
          </p>
          <button
            onClick={() => openTab('timetable_config', 'Timetable Configuration', 'Clock')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-brand-foreground text-xs font-semibold rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Clock className="w-4 h-4" />
            Setup Timetable Configuration
          </button>
        </div>
      )}

      {/* The Dynamic Timetable Grid */}
      {currentViewingMaster && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {gridLoading && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              Updating schedule grid...
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 border-r border-slate-200 w-36 min-w-[140px]">
                    Period & Timing
                  </th>
                  {currentViewingMaster.working_days.map((day) => (
                    <th key={day} className="py-3 px-4 border-r border-slate-200 min-w-[170px] text-center">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {periods.map((period) => {
                  // Lunch Break Row
                  if (period.is_lunch) {
                    return (
                      <tr key={period.period_no} className="bg-amber-50/80">
                        <td className="py-3 px-4 border-r border-amber-200 font-mono font-bold text-amber-900">
                          <div className="flex items-center gap-1.5">
                            <Utensils className="w-4 h-4 text-amber-600" />
                            <span>Lunch Break</span>
                          </div>
                          <span className="text-[10px] text-amber-700 block font-normal mt-0.5">
                            {period.start_time} - {period.end_time}
                          </span>
                        </td>
                        <td
                          colSpan={currentViewingMaster.working_days.length}
                          className="py-3 px-4 text-center text-xs font-bold text-amber-800 uppercase tracking-wider"
                        >
                          Non-Teaching Interval • Refuel & Recreation ({period.start_time} - {period.end_time})
                        </td>
                      </tr>
                    );
                  }

                  // Standard Teaching Period Row
                  return (
                    <tr key={period.period_no} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-4 border-r border-slate-200 bg-slate-50/40 align-top">
                        <span className="font-bold text-slate-900 block">{period.label}</span>
                        <span className="text-[11px] font-mono text-indigo-600 font-semibold block mt-0.5">
                          {period.start_time} - {period.end_time}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Slot #{period.period_no}
                        </span>
                      </td>

                      {currentViewingMaster.working_days.map((day) => {
                        const detail = getCellDetail(day, period.period_no);

                        return (
                          <td
                            key={`${day}-${period.period_no}`}
                            className="py-2 px-2.5 border-r border-slate-200 align-top h-24 relative group"
                          >
                            {detail ? (
                              <div className="h-full rounded-lg bg-brand-50 border border-brand-200 p-2.5 flex flex-col justify-between hover:shadow-xs transition-shadow">
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-brand-600 text-brand-foreground rounded shadow-2xs">
                                      {detail.subject_code || 'SUB'}
                                    </span>
                                    {detail.room_id && (
                                      <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-1 py-0.2 rounded font-mono">
                                        {detail.room_id}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-900 mt-1.5 leading-tight">
                                    {detail.subject_name}
                                  </h4>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-1">
                                    <UserCheck className="w-3 h-3 text-indigo-600 flex-shrink-0" />
                                    <span className="truncate">{detail.teacher_name}</span>
                                  </div>
                                  {detail.remarks && (
                                    <p className="text-[10px] text-slate-500 italic mt-1 truncate">
                                      "{detail.remarks}"
                                    </p>
                                  )}
                                </div>

                                {!isHistorical && (
                                  <div className="flex items-center justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      title="Edit Assignment"
                                      onClick={() => handleOpenAssignModal(day, period, detail)}
                                      className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      title="Clear Slot"
                                      onClick={() => handleRemoveCell(day, period.period_no)}
                                      className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-full rounded-lg border border-dashed border-slate-200 flex items-center justify-center hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors">
                                {!isHistorical && (
                                  <button
                                    onClick={() => handleOpenAssignModal(day, period)}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 rounded flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Assign
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assignModalOpen && selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedCell.existingDetail ? 'Edit Timetable Slot' : 'Assign Subject & Faculty'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedCell.day} • {selectedCell.period.label} ({selectedCell.period.start_time} - {selectedCell.period.end_time})
                </p>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="p-5 space-y-4">
              {/* Context Summary */}
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Class & Section:</span>
                  <strong className="text-slate-900">Class {currentClassName} - Section {currentSectionName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled Time Slot:</span>
                  <strong className="font-mono text-indigo-700">
                    {selectedCell.period.start_time} - {selectedCell.period.end_time}
                  </strong>
                </div>
              </div>

              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{assignError}</span>
                </div>
              )}

              {/* Subject Selection (Strict Offering Validation) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subject (Offered for Class {currentClassName}) *
                </label>
                <select
                  value={modalSubjectId}
                  onChange={(e) => {
                    setModalSubjectId(e.target.value);
                    setModalTeacherId('');
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">-- Choose Subject Offering --</option>
                  {classSubjects.map((cs) => (
                    <option key={cs.subject_id} value={cs.subject_id}>
                      {cs.subject?.name} ({cs.subject?.code})
                    </option>
                  ))}
                </select>
                {classSubjects.length === 0 && (
                  <span className="text-[11px] text-amber-600 block mt-1">
                    No subjects are offered for Class {currentClassName} in this session. Configure offerings in Subject & Offering first.
                  </span>
                )}
              </div>

              {/* Teacher Selection (Strict Teacher Class Assignment Validation) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Faculty / Teacher (Assigned to {currentClassName}-{currentSectionName}) *
                </label>
                {loadingTeachers ? (
                  <div className="p-2 text-xs text-slate-500 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    Finding eligible faculty allocations...
                  </div>
                ) : (
                  <select
                    value={modalTeacherId}
                    onChange={(e) => setModalTeacherId(e.target.value)}
                    disabled={!modalSubjectId || eligibleTeachers.length === 0}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:opacity-60"
                    required
                  >
                    <option value="">-- Choose Assigned Faculty --</option>
                    {eligibleTeachers.map((t) => (
                      <option key={t.teacher_user_id} value={t.teacher_user_id}>
                        {t.teacher?.first_name} {t.teacher?.last_name || ''} {t.is_primary_teacher ? '(Primary Teacher)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {modalSubjectId && !loadingTeachers && eligibleTeachers.length === 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 mt-1">
                    ⚠️ No teacher is allocated to teach this subject for Class {currentClassName} - Section {currentSectionName}. Please assign a teacher in Teacher Class Assignment.
                  </div>
                )}
              </div>

              {/* Room & Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Room / Lab (Optional)</label>
                  <input
                    type="text"
                    value={modalRoom}
                    onChange={(e) => setModalRoom(e.target.value)}
                    placeholder="e.g. Room 102"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                  <input
                    type="text"
                    value={modalRemarks}
                    onChange={(e) => setModalRemarks(e.target.value)}
                    placeholder="e.g. Lab Session"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/60 rounded-lg text-[11px] text-indigo-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <span>
                  Saving will generate a <strong>new timetable version</strong> snapshot (V{currentViewingMaster ? currentViewingMaster.version_no + 1 : 1}) and check for double-booking conflicts across other classes.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !modalSubjectId || !modalTeacherId}
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 text-brand-foreground rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {assigning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Creating Version...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save & Create Version
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {historyDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Timetable Version History</h3>
                  <p className="text-xs text-slate-500">All historical snapshots for this branch and session</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {versionHistory.map((ver) => {
                const isActive = ver.status === 'ACTIVE';
                const isViewing = currentViewingMaster?.id === ver.id;

                return (
                  <div
                    key={ver.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isViewing
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Version {ver.version_no}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ver.status}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                          {ver.timetable_id}
                        </span>
                      </div>

                      {isViewing && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                          Viewing
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                      <div>Created: {new Date(ver.created_at).toLocaleString()}</div>
                      {ver.created_by_name && <div>By: {ver.created_by_name}</div>}
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
                      {!isViewing && (
                        <button
                          onClick={() => handleViewVersion(ver.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Snapshot
                        </button>
                      )}

                      {!isActive && (
                        <button
                          onClick={() => handleActivateVersion(ver.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
