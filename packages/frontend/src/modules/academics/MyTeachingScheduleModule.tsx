// ========================================================================
// MyTeachingScheduleModule Component
// Dedicated Teacher's Personal Teaching Allocation & Weekly Schedule View
// Strictly derived from authoritative Timetable Master + Timetable Details.
// ZERO duplicate timetable structures.
// ========================================================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Layers,
  MapPin,
  RefreshCw,
  UserCheck,
  Utensils,
  Printer,
  Building,
  CheckCircle2,
  Coffee,
  Sparkles,
  ChevronRight,
  AlertCircle,
  LayoutGrid,
  ListFilter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  TeacherScheduleResponse,
  TeacherResponsibility,
  GeneratedPeriod,
  TimetableDetail,
  AcademicSession,
  Location,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Select } from '../../components/common/Select.js';

interface MyTeachingScheduleModuleProps {
  tabId: string;
}

export const MyTeachingScheduleModule: React.FC<MyTeachingScheduleModuleProps> = ({ tabId }) => {
  const { userContext } = useAuth();
  const { activeTabId } = useWorkspace();

  // Active view tab: 'grid' (Weekly Schedule) | 'allocations' (Teaching Allocations)
  const [activeView, setActiveView] = useState<'grid' | 'allocations'>('grid');

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Data
  const [scheduleData, setScheduleData] = useState<TeacherScheduleResponse | null>(null);
  const [allocations, setAllocations] = useState<TeacherResponsibility[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Today's day of week name (e.g. "Monday", "Tuesday", etc.)
  const todayDayName = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  }, []);

  const loadScheduleData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedSessionId) params.sessionId = selectedSessionId;
      if (selectedLocationId) params.locationId = selectedLocationId;

      const [schedResp, allocResp] = await Promise.all([
        api.get<TeacherScheduleResponse>('/academics/my-teaching-schedule', params),
        api.get<TeacherResponsibility[]>('/academics/my-teaching-responsibilities', params).catch(() => []),
      ]);

      setScheduleData(schedResp);
      setAllocations(allocResp || []);

      // Auto-set selected session and location if not yet selected
      if (!selectedSessionId && schedResp.session?.id) {
        setSelectedSessionId(schedResp.session.id);
      }
      if (!selectedLocationId && schedResp.location?.id) {
        setSelectedLocationId(schedResp.location.id);
      }
    } catch (err: any) {
      console.error('Failed to load teacher teaching schedule', err);
      setError(err.message || 'Failed to load teaching schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleData();
  }, [userContext?.user_id, selectedSessionId, selectedLocationId]);

  // Reactive cross-tab listener for timetable updates
  useEffect(() => {
    const handleTimetableUpdated = (e: Event) => {
      const custom = e as CustomEvent;
      if (
        !custom.detail?.sessionId ||
        (custom.detail.sessionId === selectedSessionId &&
          (!custom.detail.locationId || custom.detail.locationId === selectedLocationId))
      ) {
        loadScheduleData();
      }
    };

    window.addEventListener('sms:timetable-updated', handleTimetableUpdated);
    return () => window.removeEventListener('sms:timetable-updated', handleTimetableUpdated);
  }, [selectedSessionId, selectedLocationId]);

  // Refetch when tab becomes active
  const isTabActive = activeTabId === tabId;
  useEffect(() => {
    if (isTabActive && selectedSessionId) {
      loadScheduleData();
    }
  }, [isTabActive]);

  // Quick lookup helper: find teacher's assigned slot for day and period_no
  const getCellDetail = (day: string, periodNo: number): TimetableDetail | undefined => {
    if (!scheduleData?.details) return undefined;
    return scheduleData.details.find(
      (d) => d.day_of_week.toLowerCase() === day.toLowerCase() && d.period_no === periodNo
    );
  };

  // Workload calculations
  const stats = useMemo(() => {
    if (!scheduleData?.master || !scheduleData?.periods) {
      return { totalAssigned: 0, totalTeachingSlots: 0, freeSlots: 0, daysCount: 0 };
    }
    const teachingPeriods = scheduleData.periods.filter((p) => !p.is_lunch);
    const workingDaysCount = scheduleData.working_days.length;
    const totalTeachingSlots = teachingPeriods.length * workingDaysCount;
    const totalAssigned = scheduleData.details.length;
    const freeSlots = Math.max(0, totalTeachingSlots - totalAssigned);

    return {
      totalAssigned,
      totalTeachingSlots,
      freeSlots,
      daysCount: workingDaysCount,
    };
  }, [scheduleData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Header & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              My Teaching Schedule
            </h2>
            {scheduleData?.master && (
              <Badge variant="indigo" className="font-mono text-xs">
                V{scheduleData.master.version_no} (Active)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative, derived weekly timetable schedule and assigned teaching responsibilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200 text-xs">
            <button
              onClick={() => setActiveView('grid')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'grid'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Weekly Schedule
            </button>
            <button
              onClick={() => setActiveView('allocations')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeView === 'allocations'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Allocations ({allocations.length})
            </button>
          </div>

          <Button variant="secondary" onClick={handlePrint} title="Print / Export Schedule">
            <Printer className="w-4 h-4" />
          </Button>

          <Button variant="secondary" onClick={loadScheduleData} title="Refresh Schedule">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Teacher Profile & Filter Bar */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Teacher Identity */}
          {scheduleData?.teacher && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                {scheduleData.teacher.first_name[0]}
                {scheduleData.teacher.last_name?.[0] || ''}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {scheduleData.teacher.first_name} {scheduleData.teacher.last_name}
                  </span>
                  {scheduleData.teacher.designation && (
                    <span className="text-[11px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {scheduleData.teacher.designation}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                  {scheduleData.teacher.employee_code && (
                    <span className="font-mono text-[11px] text-indigo-700 font-medium">
                      EMP: {scheduleData.teacher.employee_code}
                    </span>
                  )}
                  <span>{scheduleData.teacher.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Selectors: Branch & Academic Session */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Campus Branch Switcher */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">Campus:</span>
              <div className="w-48">
                <Select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  options={(scheduleData?.authorized_locations || []).map((l) => ({
                    value: l.id,
                    label: `${l.location_name} ${l.location_code ? `(${l.location_code})` : ''}`,
                  }))}
                />
              </div>
            </div>

            {/* Session Switcher */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700">Session:</span>
              <div className="w-48">
                <Select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  options={(scheduleData?.sessions || []).map((s) => ({
                    value: s.id,
                    label: `${s.name} ${s.is_current ? '(Current)' : ''}`,
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Stat Badges (When Master is Active) */}
      {scheduleData?.master && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Weekly Teaching Load</div>
            <div className="text-xl font-bold text-indigo-950 mt-0.5">
              {stats.totalAssigned}{' '}
              <span className="text-xs font-normal text-indigo-600">periods/wk</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Free / Prep Periods</div>
            <div className="text-xl font-bold text-emerald-950 mt-0.5">
              {stats.freeSlots}{' '}
              <span className="text-xs font-normal text-emerald-600">slots</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Working Schedule</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {stats.daysCount}{' '}
              <span className="text-xs font-normal text-slate-500">days/week</span>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Lunch Break</div>
            <div className="text-sm font-bold font-mono text-amber-950 mt-1">
              {scheduleData.master.lunch_start_time} - {scheduleData.master.lunch_end_time}
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-xs font-semibold text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <Card>
          <div className="text-center py-20 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            Loading your authoritative teaching schedule...
          </div>
        </Card>
      ) : activeView === 'grid' ? (
        /* ================================================================ */
        /* TAB 1: Authoritative Weekly Schedule Grid                        */
        /* ================================================================ */
        !scheduleData?.master ? (
          <Card className="text-center py-16 space-y-3">
            <Clock className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Active Timetable Published</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There is currently no active timetable version published for{' '}
              <strong>{scheduleData?.location?.location_name || 'this campus'}</strong> in{' '}
              <strong>{scheduleData?.session?.name || 'this session'}</strong>.
            </p>
          </Card>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Timetable Configuration Bar */}
            <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Schedule Version:</span>
                <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                  {scheduleData.master.timetable_id} (V{scheduleData.master.version_no})
                </span>
              </div>
              <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                <span>
                  Hours:{' '}
                  <strong className="text-slate-800 font-mono">
                    {scheduleData.master.first_period_start_time} - {scheduleData.master.last_period_end_time}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Duration: <strong className="text-slate-800">{scheduleData.master.period_duration_minutes}m</strong>
                </span>
                <span>•</span>
                <span>
                  Days: <strong className="text-slate-800">{scheduleData.working_days.join(', ')}</strong>
                </span>
              </div>
            </div>

            {/* Authoritative Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-4 border-r border-slate-200 w-36 min-w-[140px]">
                      Period & Timing
                    </th>
                    {scheduleData.working_days.map((day) => {
                      const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                      return (
                        <th
                          key={day}
                          className={`py-3 px-4 border-r border-slate-200 min-w-[180px] text-center ${
                            isToday ? 'bg-indigo-50/80 text-indigo-900 font-extrabold border-b-2 border-b-indigo-600' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{day}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-600 text-white rounded-full uppercase tracking-tight">
                                Today
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {scheduleData.periods.map((period) => {
                    // Lunch Break Row
                    if (period.is_lunch) {
                      return (
                        <tr key={period.period_no} className="bg-amber-50/70">
                          <td className="py-3 px-4 border-r border-amber-200 font-mono font-bold text-amber-900 bg-amber-100/50">
                            <div className="flex items-center gap-1.5">
                              <Utensils className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Lunch Break</span>
                            </div>
                            <span className="text-[10px] text-amber-700 block font-normal mt-0.5">
                              {period.start_time} - {period.end_time}
                            </span>
                          </td>
                          <td
                            colSpan={scheduleData.working_days.length}
                            className="py-3 px-4 text-center text-xs font-bold text-amber-900 uppercase tracking-wider bg-amber-50/60"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Coffee className="w-4 h-4 text-amber-600" />
                              Non-Teaching Interval • Refuel & Recreation ({period.start_time} - {period.end_time})
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    // Regular Teaching Period Row
                    return (
                      <tr key={period.period_no} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-3 px-4 border-r border-slate-200 bg-slate-50/50 align-top">
                          <span className="font-bold text-slate-900 block">{period.label}</span>
                          <span className="text-[11px] font-mono text-indigo-600 font-semibold block mt-0.5">
                            {period.start_time} - {period.end_time}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Slot #{period.period_no}
                          </span>
                        </td>

                        {scheduleData.working_days.map((day) => {
                          const detail = getCellDetail(day, period.period_no);
                          const isToday = day.toLowerCase() === todayDayName.toLowerCase();

                          return (
                            <td
                              key={`${day}-${period.period_no}`}
                              className={`py-2 px-2.5 border-r border-slate-200 align-top h-24 ${
                                isToday ? 'bg-indigo-50/20' : ''
                              }`}
                            >
                              {detail ? (
                                // Teacher is Assigned to Teach in this Slot
                                <div className="h-full rounded-lg bg-indigo-50/80 border border-indigo-200 p-2.5 flex flex-col justify-between hover:shadow-xs hover:border-indigo-300 transition-all">
                                  <div>
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-indigo-600 text-white rounded">
                                        {detail.subject_code || 'SUB'}
                                      </span>
                                      {detail.room_id && (
                                        <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-1 py-0.2 rounded font-mono">
                                          {detail.room_id}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900 mt-1.5 line-clamp-1">
                                      {detail.subject_name || 'Subject'}
                                    </h4>
                                  </div>

                                  <div className="pt-2 border-t border-indigo-100/80 flex items-center justify-between text-[11px] text-indigo-900 font-medium">
                                    <span className="flex items-center gap-1 font-semibold">
                                      <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
                                      {detail.class_name ? `Class ${detail.class_name}` : ''} - Sec {detail.section_name}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                // Free / Unassigned Period
                                <div className="h-full rounded-lg border border-dashed border-slate-200 p-2.5 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/30">
                                  <span className="text-[11px] font-medium text-slate-400 block">
                                    — Free Period —
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    Preparation / Office
                                  </span>
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
        )
      ) : (
        /* ================================================================ */
        /* TAB 2: Teaching Allocations & Responsibilities Cards             */
        /* ================================================================ */
        allocations.length === 0 ? (
          <Card>
            <div className="text-center py-16 text-slate-400 text-xs">
              No teaching allocations assigned for the selected session and campus.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allocations.map((r) => (
              <Card
                key={r.assignment_id}
                className="border border-slate-200/90 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        {r.subject_name || 'Classroom Instruction'}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-400">
                        {r.subject_code || 'HOMEROOM'}
                      </div>
                    </div>
                  </div>
                  {r.is_primary_teacher && (
                    <Badge variant="emerald" className="text-[10px]">
                      Primary Teacher
                    </Badge>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Layers className="w-3.5 h-3.5" />
                      Class & Section:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {r.class_name} - Section {r.section_name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      Campus Branch:
                    </span>
                    <span className="font-medium text-slate-700">
                      {r.location_name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      Session:
                    </span>
                    <span className="font-mono text-[11px] text-indigo-700 font-semibold">
                      {r.session_name}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
};

