// ========================================================================
// AttendanceHistoryModule Component
// Comprehensive Attendance History & Audit Trail Screen
// Allows filtering by date range, student/staff type, class/section, and status
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  UserCheck,
  Briefcase,
  FileText,
  Percent,
} from 'lucide-react';
import { api } from '../../api/client.js';
import {
  UserAttendance,
  AttendanceSummaryMetrics,
  AttendanceType,
  ClassItem,
  SectionItem,
  Location,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface AttendanceHistoryModuleProps {
  tabId: string;
}

export const AttendanceHistoryModule: React.FC<AttendanceHistoryModuleProps> = () => {
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('STUDENT');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [records, setRecords] = useState<UserAttendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [clsRes, secRes] = await Promise.all([
          api.get<ClassItem[]>('/academics/classes'),
          api.get<SectionItem[]>('/academics/sections'),
        ]);
        const clsList = (clsRes as any)?.data !== undefined ? (clsRes as any).data : clsRes;
        const secList = (secRes as any)?.data !== undefined ? (secRes as any).data : secRes;
        setClasses(Array.isArray(clsList) ? clsList : []);
        setSections(Array.isArray(secList) ? secList : []);
      } catch (err: any) {
        console.error('Failed to load classes/sections:', err);
      }
    }
    loadMeta();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      let query = `/attendance/history?attendanceType=${attendanceType}&startDate=${startDate}&endDate=${endDate}`;
      if (attendanceType === 'STUDENT') {
        if (selectedClassId !== 'ALL') query += `&classId=${selectedClassId}`;
        if (selectedSectionId !== 'ALL') query += `&sectionId=${selectedSectionId}`;
      }
      if (statusFilter !== 'ALL') query += `&status=${statusFilter}`;

      const res = await api.get<any>(query);
      const data = (res as any)?.data !== undefined ? (res as any).data : res;

      if (data && Array.isArray(data.records)) {
        setRecords(data.records);
        setSummary(data.summary || null);
      } else {
        setRecords([]);
        setSummary(null);
      }
    } catch (err: any) {
      console.error('Failed to load attendance history:', err);
      setRecords([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [attendanceType, startDate, endDate, selectedClassId, selectedSectionId, statusFilter]);

  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.user_name && r.user_name.toLowerCase().includes(q)) ||
      (r.admission_number && r.admission_number.toLowerCase().includes(q)) ||
      (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q)) ||
      (r.attendance_id && r.attendance_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            Attendance History & Records
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical attendance logs with date range filtering, individual status records, and percentage metrics.
          </p>
        </div>

        {/* Type Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setAttendanceType('STUDENT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              attendanceType === 'STUDENT'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Student History
          </button>
          <button
            type="button"
            onClick={() => setAttendanceType('STAFF')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              attendanceType === 'STAFF'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Staff History
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-slate-50/70 border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {attendanceType === 'STUDENT' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.display_name || cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="md:col-span-2 flex items-center pt-5 text-xs text-slate-500">
              Filtering across all branch staff members
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LEAVE">Leave</option>
              <option value="EXCUSED">Excused</option>
            </select>
          </div>
        </div>
      </Card>

      {/* KPI Metrics */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs text-slate-500 font-medium">Total Records</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{summary.total_count}</div>
          </div>
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-center">
            <div className="text-xs text-emerald-700 font-medium">Present</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{summary.present_count}</div>
          </div>
          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 text-center">
            <div className="text-xs text-rose-700 font-medium">Absent</div>
            <div className="text-xl font-bold text-rose-700 mt-0.5">{summary.absent_count}</div>
          </div>
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-center">
            <div className="text-xs text-amber-700 font-medium">Late</div>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{summary.late_count}</div>
          </div>
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 text-center">
            <div className="text-xs text-blue-700 font-medium">Leave / Excused</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">
              {summary.leave_count + summary.excused_count}
            </div>
          </div>
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-center">
            <div className="text-xs text-indigo-700 font-medium">Average Attendance</div>
            <div className="text-xl font-bold text-indigo-700 mt-0.5">{summary.attendance_percentage}%</div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="flex justify-between items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search person or record ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <Button size="sm" variant="outline" onClick={loadHistory} className="flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* History Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Loading attendance history...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-medium text-slate-700">No attendance history records found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 w-32">Record ID</th>
                  <th className="py-3 px-4">Person</th>
                  <th className="py-3 px-4 w-28">Context</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-32">Time Details</th>
                  <th className="py-3 px-4 w-48">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {rec.attendance_date}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {rec.attendance_id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {rec.user_name}
                      {rec.roll_number && (
                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                          (Roll: {rec.roll_number})
                        </span>
                      )}
                      {rec.employee_code && (
                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                          ({rec.employee_code})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {attendanceType === 'STUDENT' ? (
                        <span>
                          {rec.class_name ? `Class ${rec.class_name}` : ''}{' '}
                          {rec.section_name ? `- Sec ${rec.section_name}` : ''}
                        </span>
                      ) : (
                        <span>{rec.department || rec.designation_name || 'Staff'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {rec.status === 'PRESENT' && <Badge variant="emerald" className="text-[10px]">Present</Badge>}
                      {rec.status === 'ABSENT' && <Badge variant="rose" className="text-[10px]">Absent</Badge>}
                      {rec.status === 'LATE' && <Badge variant="amber" className="text-[10px]">Late</Badge>}
                      {rec.status === 'HALF_DAY' && <Badge variant="purple" className="text-[10px]">Half Day</Badge>}
                      {rec.status === 'LEAVE' && <Badge variant="primary" className="text-[10px]">Leave</Badge>}
                      {rec.status === 'EXCUSED' && <Badge variant="slate" className="text-[10px]">Excused</Badge>}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {rec.check_in_time ? (
                        <span>
                          {rec.check_in_time} - {rec.check_out_time || 'ongoing'}
                          {rec.late_minutes > 0 ? ` (${rec.late_minutes}m late)` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-xs">
                      {rec.remarks || '-'}
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
