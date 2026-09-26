// ========================================================================
// AttendanceDashboardModule Component
// Executive Attendance Dashboard with Student & Staff KPI Overviews,
// Class-Wise Attendance Visualizations, and Instant Action Buttons
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Users,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  MapPin,
  Building,
  GraduationCap,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import {
  Location,
  AcademicSession,
  AttendanceDashboardResponse,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface AttendanceDashboardModuleProps {
  tabId: string;
}

export const AttendanceDashboardModule: React.FC<AttendanceDashboardModuleProps> = () => {
  const { userContext } = useAuth();
  const { openTab } = useWorkspace();

  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [dashboardDate, setDashboardDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [data, setData] = useState<AttendanceDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load locations and academic sessions
  useEffect(() => {
    async function loadMeta() {
      try {
        const [locRes, sessRes] = await Promise.all([
          api.get<any>('/locations'),
          api.get<any>('/academics/sessions'),
        ]);

        const locList = (locRes as any)?.locations || (locRes as any)?.data || (Array.isArray(locRes) ? locRes : []);
        setLocations(locList);
        if (locList.length > 0) {
          const defaultLoc = userContext?.location_id || locList[0].id;
          setSelectedLocationId(defaultLoc);
        }

        const sessList = (sessRes as any)?.academicSessions || (sessRes as any)?.sessions || (sessRes as any)?.data || (Array.isArray(sessRes) ? sessRes : []);
        setSessions(sessList);
        const activeSess = sessList.find((s: AcademicSession) => s.is_current || s.status === 'ACTIVE') || sessList[0];
        if (activeSess) {
          setSelectedSessionId(activeSess.id);
        }
      } catch (err: any) {
        console.error('Failed to load dashboard metadata:', err);
      }
    }
    loadMeta();
  }, [userContext?.location_id]);

  const fetchDashboard = async () => {
    if (!selectedLocationId || !dashboardDate) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        locationId: selectedLocationId,
        date: dashboardDate,
      });
      if (selectedSessionId) q.append('sessionId', selectedSessionId);

      const res = await api.get<any>(`/attendance/dashboard?${q.toString()}`);
      setData((res as any)?.data || res);
    } catch (err: any) {
      console.error('Failed to fetch attendance dashboard:', err);
      setError(err.message || 'Failed to fetch attendance dashboard metrics.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedLocationId, selectedSessionId, dashboardDate]);

  const studentSummary = data?.student_summary;
  const staffSummary = data?.staff_summary;
  const classBreakdown = data?.class_breakdown || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Context Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Attendance Executive Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-tenant snapshot of student and staff presence, punctuality, and class registers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.location_name || loc.name} ({loc.location_code || loc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Academic Session Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
            >
              {sessions.map((sess) => (
                <option key={sess.id} value={sess.id}>
                  {sess.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={dashboardDate}
              onChange={(e) => setDashboardDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Launch Action Shortcuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => openTab('student_attendance', 'Student Attendance', 'GraduationCap')}
          className="flex items-center justify-between p-3.5 bg-white border border-brand-100 hover:border-brand-300 rounded-xl hover:shadow-sm transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-brand-700">Mark Students</div>
              <div className="text-[10px] text-slate-500">By class & section</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => openTab('staff_attendance', 'Staff & Faculty Attendance', 'Briefcase')}
          className="flex items-center justify-between p-3.5 bg-white border border-blue-100 hover:border-blue-300 rounded-xl hover:shadow-sm transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Mark Staff</div>
              <div className="text-[10px] text-slate-500">Check-in & punctuality</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => openTab('attendance_history', 'Attendance History', 'Clock')}
          className="flex items-center justify-between p-3.5 bg-white border border-purple-100 hover:border-purple-300 rounded-xl hover:shadow-sm transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700">Audit & History</div>
              <div className="text-[10px] text-slate-500">Timeline & log ledger</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => openTab('attendance_reports', 'Attendance Reports', 'FileSpreadsheet')}
          className="flex items-center justify-between p-3.5 bg-white border border-amber-100 hover:border-amber-300 rounded-xl hover:shadow-sm transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700">Reports & Export</div>
              <div className="text-[10px] text-slate-500">Registers, monthly, print</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* SECTION 1: STUDENT ATTENDANCE OVERVIEW */}
      <Card>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Student Attendance Snapshot</h2>
              <p className="text-[11px] text-slate-500">Derived from active student academic enrollments</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">
              {studentSummary?.attendance_percentage ?? 0}%
            </span>
            <span className="text-xs font-medium text-slate-500 ml-1">Overall Present Rate</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 md:grid-cols-6 gap-3 bg-slate-50/50">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">Total Enrolled</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {studentSummary?.total_enrolled || studentSummary?.total || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Present
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">
              {studentSummary?.present || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-rose-100">
            <div className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Absent
            </div>
            <div className="text-xl font-bold text-rose-700 mt-0.5">
              {studentSummary?.absent || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-amber-100">
            <div className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Late Arrivals
            </div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">
              {studentSummary?.late || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-orange-100">
            <div className="text-[11px] font-medium text-orange-600">Half Day</div>
            <div className="text-xl font-bold text-orange-700 mt-0.5">
              {studentSummary?.half_day || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-sky-100">
            <div className="text-[11px] font-medium text-sky-600">Leave / Excused</div>
            <div className="text-xl font-bold text-sky-700 mt-0.5">
              {(studentSummary?.leave || 0) + (studentSummary?.excused || 0)}
            </div>
          </div>
        </div>

        {/* Progress bar visual */}
        <div className="px-5 pb-5 pt-2">
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${studentSummary?.attendance_percentage || 0}%` }}
              title={`Present: ${studentSummary?.attendance_percentage || 0}%`}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{
                width: `${
                  studentSummary?.total ? ((studentSummary.late || 0) / studentSummary.total) * 100 : 0
                }%`,
              }}
              title={`Late: ${studentSummary?.late || 0}`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{
                width: `${
                  studentSummary?.total ? ((studentSummary.absent || 0) / studentSummary.total) * 100 : 0
                }%`,
              }}
              title={`Absent: ${studentSummary?.absent || 0}`}
            />
          </div>
        </div>
      </Card>

      {/* SECTION 2: STAFF & FACULTY ATTENDANCE OVERVIEW */}
      <Card>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Staff & Faculty Punctuality Snapshot</h2>
              <p className="text-[11px] text-slate-500">Universal users with staff profile and branch access</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">
              {staffSummary?.attendance_percentage ?? 0}%
            </span>
            <span className="text-xs font-medium text-slate-500 ml-1">Staff Present Rate</span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 md:grid-cols-6 gap-3 bg-slate-50/50">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">Total Staff</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {staffSummary?.total_enrolled || staffSummary?.total || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Present
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">
              {staffSummary?.present || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-rose-100">
            <div className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Absent
            </div>
            <div className="text-xl font-bold text-rose-700 mt-0.5">
              {staffSummary?.absent || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-amber-100">
            <div className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Late Check-in
            </div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">
              {staffSummary?.late || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-purple-100">
            <div className="text-[11px] font-medium text-purple-600">On Leave</div>
            <div className="text-xl font-bold text-purple-700 mt-0.5">
              {staffSummary?.leave || 0}
            </div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500">Avg Punctuality</div>
            <div className="text-xl font-bold text-slate-700 mt-0.5">
              {(staffSummary?.late || 0) > 0 ? `${staffSummary?.late} late` : '100% On-time'}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-2">
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-600 h-full transition-all duration-500"
              style={{ width: `${staffSummary?.attendance_percentage || 0}%` }}
              title={`Present: ${staffSummary?.attendance_percentage || 0}%`}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{
                width: `${staffSummary?.total ? ((staffSummary.late || 0) / staffSummary.total) * 100 : 0}%`,
              }}
              title={`Late: ${staffSummary?.late || 0}`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{
                width: `${staffSummary?.total ? ((staffSummary.absent || 0) / staffSummary.total) * 100 : 0}%`,
              }}
              title={`Absent: ${staffSummary?.absent || 0}`}
            />
          </div>
        </div>
      </Card>

      {/* SECTION 3: CLASS & SECTION ATTENDANCE BREAKDOWN */}
      <Card>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Class-Wise Register Breakdown</h2>
              <p className="text-[11px] text-slate-500">Attendance percentages recorded for {dashboardDate}</p>
            </div>
          </div>
          <Badge variant={classBreakdown.length > 0 ? 'emerald' : 'slate'}>
            {classBreakdown.length} Registers Active
          </Badge>
        </div>

        <div className="p-0 overflow-x-auto">
          {classBreakdown.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <div className="text-xs font-medium text-slate-600">No attendance registered for this date yet.</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Click "Mark Students" above to mark attendance for classes.
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4 text-center">Total Students</th>
                  <th className="py-3 px-4 text-center">Present</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4">Attendance Rate</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classBreakdown.map((c) => {
                  const pct = c.percentage;
                  const barColor =
                    pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-rose-500';

                  return (
                    <tr key={`${c.class_id}-${c.section_name}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {c.class_name} - {c.section_name}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 font-medium">{c.total}</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-bold">{c.present}</td>
                      <td className="py-3 px-4 text-center text-rose-700 font-bold">{c.absent}</td>
                      <td className="py-3 px-4 w-52">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 w-9 text-right">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTab('student_attendance', 'Student Attendance', 'GraduationCap')}
                          className="text-brand-700 hover:text-brand-900 hover:bg-brand-50"
                        >
                          View / Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
