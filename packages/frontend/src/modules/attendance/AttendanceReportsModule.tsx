// ========================================================================
// AttendanceReportsModule Component
// Comprehensive Reporting Engine for Attendance Registers & Analysis:
// 1. Daily Class Register
// 2. Monthly Student Attendance Matrix
// 3. Absentee & Defaulters Roster
// 4. Staff Punctuality & Late Arrival Ledger
// Supports Native Print & CSV Export
// ========================================================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Filter,
  Users,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Location,
  AcademicSession,
  ClassItem,
  SectionItem,
  UserAttendance,
  AttendanceSummaryMetrics,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface AttendanceReportsModuleProps {
  tabId: string;
}

type ReportType = 'DAILY_REGISTER' | 'MONTHLY_MATRIX' | 'ABSENTEE_LIST' | 'STAFF_PUNCTUALITY';

export const AttendanceReportsModule: React.FC<AttendanceReportsModuleProps> = () => {
  const { userContext } = useAuth();

  // Active report tab
  const [activeReport, setActiveReport] = useState<ReportType>('DAILY_REGISTER');

  // Metadata dropdowns
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Filter state
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Data states
  const [records, setRecords] = useState<UserAttendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load locations, sessions, classes
  useEffect(() => {
    async function loadMeta() {
      try {
        const [locRes, sessRes, classRes] = await Promise.all([
          api.get<any>('/locations'),
          api.get<any>('/academics/sessions'),
          api.get<any>('/academics/classes'),
        ]);

        const locList = (locRes as any)?.locations || (locRes as any)?.data || (Array.isArray(locRes) ? locRes : []);
        setLocations(locList);
        if (locList.length > 0) {
          setSelectedLocationId(userContext?.location_id || locList[0].id);
        }

        const sessList = (sessRes as any)?.academicSessions || (sessRes as any)?.sessions || (sessRes as any)?.data || (Array.isArray(sessRes) ? sessRes : []);
        setSessions(sessList);
        const activeSess = sessList.find((s: AcademicSession) => s.is_current || s.status === 'ACTIVE') || sessList[0];
        if (activeSess) setSelectedSessionId(activeSess.id);

        const classList = (classRes as any)?.classes || (classRes as any)?.data || (Array.isArray(classRes) ? classRes : []);
        setClasses(classList);
        if (classList.length > 0) {
          setSelectedClassId(classList[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load report filters:', err);
      }
    }
    loadMeta();
  }, [userContext?.location_id]);

  // Load sections when class or session changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      return;
    }
    async function loadSections() {
      try {
        let secList: SectionItem[] = [];
        if (selectedSessionId) {
          const offeringsRes = await api.get<any>(
            `/academics/class-sections?sessionId=${selectedSessionId}&classId=${selectedClassId}`
          ).catch(() => []);
          const rawOfferings = (offeringsRes as any)?.data !== undefined ? (offeringsRes as any).data : offeringsRes;
          if (Array.isArray(rawOfferings) && rawOfferings.length > 0) {
            secList = rawOfferings
              .map((o: any) => o.section || { id: o.section_id, name: 'Section' })
              .filter((s: any) => Boolean(s && s.id));
          }
        }
        if (secList.length === 0) {
          const allSecRes = await api.get<any>('/academics/sections').catch(() => []);
          const rawAll = (allSecRes as any)?.data !== undefined ? (allSecRes as any).data : allSecRes;
          if (Array.isArray(rawAll)) {
            secList = rawAll;
          }
        }
        setSections(secList);
        if (secList.length > 0) {
          setSelectedSectionId(secList[0].id);
        } else {
          setSelectedSectionId('');
        }
      } catch (err: any) {
        console.error('Failed to load sections for class:', err);
        setSections([]);
      }
    }
    loadSections();
  }, [selectedSessionId, selectedClassId]);

  // Fetch Report Data based on active report
  const fetchReportData = async () => {
    if (!selectedLocationId) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        locationId: selectedLocationId,
      });

      if (activeReport === 'DAILY_REGISTER') {
        q.append('attendanceType', 'STUDENT');
        q.append('date', selectedDate);
        if (selectedSessionId) q.append('sessionId', selectedSessionId);
        if (selectedClassId) q.append('classId', selectedClassId);
        if (selectedSectionId) q.append('sectionId', selectedSectionId);
      } else if (activeReport === 'MONTHLY_MATRIX') {
        q.append('attendanceType', 'STUDENT');
        if (selectedSessionId) q.append('sessionId', selectedSessionId);
        if (selectedClassId) q.append('classId', selectedClassId);
        if (selectedSectionId) q.append('sectionId', selectedSectionId);

        // Calculate month start & end
        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const lastDay = new Date(year, month, 0).getDate();
        q.append('startDate', `${selectedMonth}-01`);
        q.append('endDate', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
      } else if (activeReport === 'ABSENTEE_LIST') {
        q.append('date', selectedDate);
        q.append('status', 'ABSENT');
        if (selectedClassId && selectedClassId !== 'ALL') q.append('classId', selectedClassId);
      } else if (activeReport === 'STAFF_PUNCTUALITY') {
        q.append('attendanceType', 'STAFF');
        q.append('date', selectedDate);
        if (departmentFilter !== 'ALL') q.append('department', departmentFilter);
      }

      const res = await api.get<any>(`/attendance/history?${q.toString()}`);
      const fetchedRecords = (res as any)?.records || (res as any)?.data?.records || [];
      const fetchedSummary = (res as any)?.summary || (res as any)?.data?.summary || null;
      setRecords(fetchedRecords);
      setSummary(fetchedSummary);
    } catch (err: any) {
      console.error('Failed to load report data:', err);
      setError(err.message || 'Failed to generate report.');
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [
    activeReport,
    selectedLocationId,
    selectedSessionId,
    selectedClassId,
    selectedSectionId,
    selectedDate,
    selectedMonth,
    departmentFilter,
  ]);

  // Handle Native Print
  const handlePrint = () => {
    window.print();
  };

  // Handle CSV Download
  const handleExportCSV = () => {
    if (records.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeReport === 'DAILY_REGISTER') {
      headers = ['Roll No', 'Name', 'Class', 'Section', 'Date', 'Status', 'Remarks', 'Marked By'];
      rows = records.map((r) => [
        r.roll_number || '-',
        `"${r.user_name || 'Student'}"`,
        r.class_name || '-',
        r.section_name || '-',
        r.attendance_date,
        r.status,
        `"${r.remarks || ''}"`,
        r.marked_by || 'System',
      ]);
    } else if (activeReport === 'MONTHLY_MATRIX') {
      headers = ['Student Name', 'Roll No', 'Class', 'Date', 'Status'];
      rows = records.map((r) => [
        `"${r.user_name || 'Student'}"`,
        r.roll_number || '-',
        r.class_name || '-',
        r.attendance_date,
        r.status,
      ]);
    } else if (activeReport === 'ABSENTEE_LIST') {
      headers = ['Name', 'Type', 'Class/Dept', 'Date', 'Status', 'Remarks'];
      rows = records.map((r) => [
        `"${r.user_name || 'Person'}"`,
        r.attendance_type,
        r.attendance_type === 'STUDENT' ? `${r.class_name || ''} ${r.section_name || ''}` : r.department || '-',
        r.attendance_date,
        r.status,
        `"${r.remarks || ''}"`,
      ]);
    } else if (activeReport === 'STAFF_PUNCTUALITY') {
      headers = ['Staff Name', 'Department', 'Date', 'Status', 'Check In', 'Check Out', 'Late Minutes', 'Remarks'];
      rows = records.map((r) => [
        `"${r.user_name || 'Staff'}"`,
        r.department || '-',
        r.attendance_date,
        r.status,
        r.check_in_time || '-',
        r.check_out_time || '-',
        String(r.late_minutes || 0),
        `"${r.remarks || ''}"`,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_${activeReport.toLowerCase()}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Matrix Pivot calculation for Monthly Matrix
  const monthlyMatrixData = useMemo(() => {
    if (activeReport !== 'MONTHLY_MATRIX' || records.length === 0) return { days: [], students: [] };

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Group by user_id
    const studentMap = new Map<string, {
      user_id: string;
      name: string;
      roll_no: string;
      attendanceByDay: Record<number, string>;
      totalPresent: number;
      totalAbsent: number;
    }>();

    for (const r of records) {
      if (!studentMap.has(r.user_id)) {
        studentMap.set(r.user_id, {
          user_id: r.user_id,
          name: r.user_name || 'Student',
          roll_no: r.roll_number || '-',
          attendanceByDay: {},
          totalPresent: 0,
          totalAbsent: 0,
        });
      }

      const st = studentMap.get(r.user_id)!;
      const dayNum = parseInt(r.attendance_date.split('-')[2], 10);
      st.attendanceByDay[dayNum] = r.status;
      if (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'EXCUSED') {
        st.totalPresent++;
      } else if (r.status === 'ABSENT') {
        st.totalAbsent++;
      }
    }

    return {
      days,
      students: Array.from(studentMap.values()),
    };
  }, [activeReport, records, selectedMonth]);

  const activeClassName = classes.find((c) => c.id === selectedClassId)?.name || 'Class';
  const activeSectionName = sections.find((s) => s.id === selectedSectionId)?.name || 'Section';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Print Styling injected inline */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header with Report Type Tabs */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-brand-600" />
              Attendance Reports & Registers
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Official institutional registers, monthly matrix, absentee tracking, and staff punctuality records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loading || records.length === 0}
              className="flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Print Register
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || records.length === 0}
              className="flex items-center gap-1.5 text-brand-700 border-brand-200 bg-brand-50/50 hover:bg-brand-100/50"
            >
              <Download className="w-3.5 h-3.5 text-brand-600" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Report Selector Pills */}
        <div className="flex items-center gap-2 mt-5 border-b border-slate-200 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveReport('DAILY_REGISTER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeReport === 'DAILY_REGISTER'
                ? 'bg-brand-600 text-brand-foreground shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Daily Class Register
          </button>
          <button
            onClick={() => setActiveReport('MONTHLY_MATRIX')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeReport === 'MONTHLY_MATRIX'
                ? 'bg-brand-600 text-brand-foreground shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Monthly Attendance Matrix
          </button>
          <button
            onClick={() => setActiveReport('ABSENTEE_LIST')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeReport === 'ABSENTEE_LIST'
                ? 'bg-brand-600 text-brand-foreground shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Absentee & Defaulters List
          </button>
          <button
            onClick={() => setActiveReport('STAFF_PUNCTUALITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeReport === 'STAFF_PUNCTUALITY'
                ? 'bg-brand-600 text-brand-foreground shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Staff Punctuality Ledger
          </button>
        </div>

        {/* Dynamic Filters Bar based on active report */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Branch / Campus
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.location_name || l.name || l.location_code}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Academic Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class (shown for Student reports) */}
          {activeReport !== 'STAFF_PUNCTUALITY' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
              >
                {activeReport === 'ABSENTEE_LIST' && <option value="ALL">All Classes</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section (for Daily and Monthly) */}
          {(activeReport === 'DAILY_REGISTER' || activeReport === 'MONTHLY_MATRIX') && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Section
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker (for Daily, Absentee, Staff) */}
          {activeReport !== 'MONTHLY_MATRIX' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
              />
            </div>
          )}

          {/* Month Picker (for Monthly Matrix) */}
          {activeReport === 'MONTHLY_MATRIX' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
              />
            </div>
          )}

          {/* Department (for Staff Punctuality) */}
          {activeReport === 'STAFF_PUNCTUALITY' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-hidden"
              >
                <option value="ALL">All Departments</option>
                <option value="Academics">Academics</option>
                <option value="Administration">Administration</option>
                <option value="Science">Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Languages">Languages</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* PRINTABLE REPORT CONTAINER */}
      <div id="printable-report-area" className="space-y-4">
        {/* Printable Institution Header */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
          <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">
            eSchool Multi-Tenant Academy
          </h2>
          <div className="text-xs text-slate-600 mt-0.5">
            Official Institutional Attendance Register •{' '}
            {activeReport === 'DAILY_REGISTER' && `Daily Register for ${activeClassName} - ${activeSectionName} (${selectedDate})`}
            {activeReport === 'MONTHLY_MATRIX' && `Monthly Attendance Matrix for ${activeClassName} - ${activeSectionName} (${selectedMonth})`}
            {activeReport === 'ABSENTEE_LIST' && `Institutional Absentee Roster (${selectedDate})`}
            {activeReport === 'STAFF_PUNCTUALITY' && `Staff & Faculty Punctuality Ledger (${selectedDate})`}
          </div>
          {summary && (
            <div className="mt-3 flex items-center justify-center gap-6 text-xs border-t border-slate-100 pt-2 font-medium text-slate-700">
              <span>Total: <strong className="text-slate-900">{summary.total_count ?? summary.total ?? 0}</strong></span>
              <span>Present: <strong className="text-emerald-700">{summary.present_count ?? summary.present ?? 0}</strong></span>
              <span>Absent: <strong className="text-rose-700">{summary.absent_count ?? summary.absent ?? 0}</strong></span>
              <span>Late: <strong className="text-amber-700">{summary.late_count ?? summary.late ?? 0}</strong></span>
              <span>Rate: <strong className="text-brand-700">{summary.attendance_percentage}%</strong></span>
            </div>
          )}
        </div>

        {/* REPORT 1: DAILY CLASS REGISTER TABLE */}
        {activeReport === 'DAILY_REGISTER' && (
          <Card>
            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-brand-600" />
                  Generating Daily Register...
                </div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No attendance records found for this class and date.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Roll No</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Remarks</th>
                      <th className="py-2.5 px-4">Recorded By</th>
                      <th className="py-2.5 px-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-700">
                          {r.roll_number || '-'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {r.user_name || 'Student'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'PRESENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'ABSENT'
                                ? 'bg-rose-100 text-rose-800'
                                : r.status === 'LATE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 italic">
                          {r.remarks || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {r.marked_by || 'System'}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                          {r.marked_at ? new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        {/* REPORT 2: MONTHLY MATRIX GRID */}
        {activeReport === 'MONTHLY_MATRIX' && (
          <Card>
            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-brand-600" />
                  Compiling Monthly Matrix Grid...
                </div>
              ) : monthlyMatrixData.students.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No attendance records recorded for {selectedMonth}.
                </div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3 sticky left-0 bg-slate-50 z-10">Student</th>
                      <th className="py-2 px-2 text-center">Roll</th>
                      {monthlyMatrixData.days.map((d) => (
                        <th key={d} className="py-2 px-1 text-center w-6 font-mono text-[10px]">
                          {d}
                        </th>
                      ))}
                      <th className="py-2 px-2 text-center font-bold text-emerald-700">P</th>
                      <th className="py-2 px-2 text-center font-bold text-rose-700">A</th>
                      <th className="py-2 px-2 text-center font-bold text-brand-700">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyMatrixData.students.map((st) => {
                      const totalMarked = st.totalPresent + st.totalAbsent;
                      const pct = totalMarked > 0 ? Math.round((st.totalPresent / totalMarked) * 100) : 0;

                      return (
                        <tr key={st.user_id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-semibold text-slate-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                            {st.name}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-500">{st.roll_no}</td>
                          {monthlyMatrixData.days.map((d) => {
                            const stStatus = st.attendanceByDay[d];
                            let char = '-';
                            let color = 'text-slate-300';
                            if (stStatus === 'PRESENT') {
                              char = 'P';
                              color = 'text-emerald-700 font-bold bg-emerald-50';
                            } else if (stStatus === 'ABSENT') {
                              char = 'A';
                              color = 'text-rose-700 font-bold bg-rose-50';
                            } else if (stStatus === 'LATE') {
                              char = 'L';
                              color = 'text-amber-700 font-bold bg-amber-50';
                            } else if (stStatus === 'HALF_DAY') {
                              char = 'H';
                              color = 'text-orange-700 font-bold bg-orange-50';
                            } else if (stStatus === 'LEAVE' || stStatus === 'EXCUSED') {
                              char = 'LV';
                              color = 'text-sky-700 font-bold bg-sky-50';
                            }

                            return (
                              <td key={d} className={`py-1 px-0.5 text-center font-mono text-[10px] ${color}`}>
                                {char}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center font-bold text-emerald-700">{st.totalPresent}</td>
                          <td className="py-2 px-2 text-center font-bold text-rose-700">{st.totalAbsent}</td>
                          <td className="py-2 px-2 text-center font-bold text-brand-700">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        {/* REPORT 3: ABSENTEE & DEFAULTERS LIST */}
        {activeReport === 'ABSENTEE_LIST' && (
          <Card>
            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-brand-600" />
                  Scanning Absentee Registry...
                </div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  Outstanding! Zero absentees recorded on {selectedDate}.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Class / Department</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Reason / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-rose-50/20">
                        <td className="py-2.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {r.user_name || 'Person'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.attendance_type === 'STUDENT'
                                ? 'bg-brand-50 text-brand-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {r.attendance_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-medium">
                          {r.attendance_type === 'STUDENT'
                            ? `${r.class_name || ''} - ${r.section_name || ''}`
                            : r.department || 'General Staff'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{r.attendance_date}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            ABSENT
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 italic">
                          {r.remarks || 'No remarks provided'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        {/* REPORT 4: STAFF PUNCTUALITY LEDGER */}
        {activeReport === 'STAFF_PUNCTUALITY' && (
          <Card>
            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-brand-600" />
                  Generating Staff Punctuality Ledger...
                </div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No staff attendance logs found for {selectedDate}.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Staff Member</th>
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4 text-center">Check-In</th>
                      <th className="py-2.5 px-4 text-center">Check-Out</th>
                      <th className="py-2.5 px-4 text-center">Punctuality</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r, idx) => {
                      const isLate = (r.late_minutes || 0) > 0;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {r.user_name || 'Staff'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 font-medium">
                            {r.department || 'Administration'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-medium text-slate-800">
                            {r.check_in_time || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                            {r.check_out_time || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {isLate ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                {r.late_minutes}m Late
                              </span>
                            ) : r.check_in_time ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                On Time
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 italic">
                            {r.remarks || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
