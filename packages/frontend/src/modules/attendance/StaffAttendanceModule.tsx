// ========================================================================
// StaffAttendanceModule Component
// Staff & Faculty Attendance Screen
// Authoritative Staff Roster with Time-Tracking (Check-In/Check-Out)
// ========================================================================

import React, { useEffect, useState, useTransition } from 'react';
import {
  Briefcase,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  Save,
  RefreshCw,
  Search,
  CheckCheck,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  Location,
  StaffAttendanceItem,
  AttendanceSummaryMetrics,
  AttendanceStatus,
  StaffRosterResponse,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface StaffAttendanceModuleProps {
  tabId: string;
}

export const StaffAttendanceModule: React.FC<StaffAttendanceModuleProps> = () => {
  const { userContext, branches, activeBranch, switchBranch } = useAuth();
  const { hasPermission } = usePermission();
  const [, startTransition] = useTransition();

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [staff, setStaff] = useState<StaffAttendanceItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Departments list dynamically gathered from loaded staff
  const departments = ['ALL', 'Academics', 'Physics & Science', 'Mathematics', 'Academic Administration', 'Finance & Accounts', 'Executive Management'];

  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await api.get<Location[]>('/locations');
        const locList = (res as any)?.data !== undefined ? (res as any).data : res;
        const validLocs = Array.isArray(locList) && locList.length > 0
          ? locList
          : (branches && branches.length > 0 ? branches : []);
        setLocations(validLocs);
        if (validLocs.length > 0) {
          const defaultLoc = (activeBranch && validLocs.some(l => l.id === activeBranch.id))
            ? activeBranch
            : validLocs[0];
          setSelectedLocationId(defaultLoc.id);
        }
      } catch (err: any) {
        console.error('Failed to load locations for staff attendance:', err);
      }
    }
    loadLocations();
  }, [branches, activeBranch]);

  useEffect(() => {
    if (activeBranch?.id && activeBranch.id !== selectedLocationId) {
      setSelectedLocationId(activeBranch.id);
    }
  }, [activeBranch?.id]);

  const loadStaffRoster = async () => {
    if (!selectedLocationId || !attendanceDate) return;

    setLoading(true);
    setNotification(null);
    try {
      const deptParam = selectedDepartment !== 'ALL' ? `&department=${encodeURIComponent(selectedDepartment)}` : '';
      const res = await api.get<StaffRosterResponse>(
        `/attendance/staff?locationId=${selectedLocationId}&date=${attendanceDate}${deptParam}`
      );
      const rosterData = (res as any)?.data || res;

      if (rosterData && Array.isArray(rosterData.staff)) {
        setStaff(rosterData.staff);
        setSummary(rosterData.summary);
      } else {
        setStaff([]);
        setSummary(null);
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to fetch staff attendance roster.',
      });
      setStaff([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffRoster();
  }, [selectedLocationId, selectedDepartment, attendanceDate]);

  // Bulk Mark All Present
  const handleBulkMark = (targetStatus: AttendanceStatus) => {
    startTransition(() => {
      const updated = staff.map((s) => ({
        ...s,
        status: targetStatus,
        check_in_time: s.check_in_time || (targetStatus === 'PRESENT' ? '08:30' : null),
        check_out_time: s.check_out_time || (targetStatus === 'PRESENT' ? '16:30' : null),
      }));
      setStaff(updated);
      recalcSummary(updated);
    });
  };

  const handleStatusChange = (userId: string, newStatus: AttendanceStatus) => {
    const updated = staff.map((s) => {
      if (s.user_id !== userId) return s;
      return {
        ...s,
        status: newStatus,
        check_in_time: newStatus === 'PRESENT' && !s.check_in_time ? '08:30' : s.check_in_time,
        check_out_time: newStatus === 'PRESENT' && !s.check_out_time ? '16:30' : s.check_out_time,
      };
    });
    setStaff(updated);
    recalcSummary(updated);
  };

  const handleTimeChange = (userId: string, field: 'check_in_time' | 'check_out_time', val: string) => {
    const cutoffMinutes = 8 * 60 + 30; // 08:30 AM
    const updated = staff.map((s) => {
      if (s.user_id !== userId) return s;
      const modified = { ...s, [field]: val };
      if (field === 'check_in_time' && val) {
        const parts = val.split(':');
        if (parts.length >= 2) {
          const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          modified.late_minutes = mins > cutoffMinutes ? mins - cutoffMinutes : 0;
          if (modified.late_minutes > 0 && modified.status === 'PRESENT') {
            modified.status = 'LATE';
          }
        }
      }
      return modified;
    });
    setStaff(updated);
    recalcSummary(updated);
  };

  const handleRemarksChange = (userId: string, remarks: string) => {
    setStaff(staff.map((s) => (s.user_id === userId ? { ...s, remarks } : s)));
  };

  const recalcSummary = (roster: StaffAttendanceItem[]) => {
    let pres = 0, abs = 0, late = 0, half = 0, leave = 0, excused = 0;
    for (const s of roster) {
      if (s.status === 'PRESENT') pres++;
      else if (s.status === 'ABSENT') abs++;
      else if (s.status === 'LATE') late++;
      else if (s.status === 'HALF_DAY') half++;
      else if (s.status === 'LEAVE') leave++;
      else if (s.status === 'EXCUSED') excused++;
    }
    const total = roster.length;
    const marked = pres + abs + late + half + leave + excused;
    const positive = pres + late + (half * 0.5) + excused;
    const pct = total > 0 ? Math.round((positive / total) * 100) : 0;

    setSummary({
      total_count: total,
      present_count: pres,
      absent_count: abs,
      late_count: late,
      half_day_count: half,
      leave_count: leave,
      excused_count: excused,
      not_marked_count: total - marked,
      attendance_percentage: pct,
    });
  };

  const handleSaveAttendance = async () => {
    if (!staff || staff.length === 0) return;

    setSaving(true);
    setNotification(null);

    const payload = {
      location_id: selectedLocationId,
      attendance_date: attendanceDate,
      department: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
      records: staff
        .filter((s) => s.status !== 'NOT_MARKED')
        .map((s) => ({
          user_id: s.user_id,
          status: s.status as AttendanceStatus,
          check_in_time: s.check_in_time,
          check_out_time: s.check_out_time,
          late_minutes: s.late_minutes,
          remarks: s.remarks,
        })),
    };

    if (payload.records.length === 0) {
      setNotification({
        type: 'error',
        message: 'Please mark status for at least one staff member before saving.',
      });
      setSaving(false);
      return;
    }

    try {
      const res = await api.post<any>('/attendance/staff', payload);
      const resData = (res as any)?.data || res;

      setNotification({
        type: 'success',
        message: resData?.message || 'Staff attendance saved successfully.',
      });
      await loadStaffRoster();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to save staff attendance.',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = staff.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.display_name.toLowerCase().includes(q) ||
      s.employee_code.toLowerCase().includes(q) ||
      (s.department && s.department.toLowerCase().includes(q)) ||
      (s.designation_name && s.designation_name.toLowerCase().includes(q))
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
        return 'bg-blue-600 text-white border-blue-700 shadow-sm';
      default:
        return 'bg-slate-700 text-white';
    }
  };

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand-600" />
            Staff & Faculty Attendance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative employee attendance with check-in, check-out, and late arrival calculations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStaffRoster}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAttendance}
            disabled={saving || staff.length === 0}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Attendance'}
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
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
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 bg-slate-50/70 border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Branch / Campus
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.location_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Attendance Date
            </label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'ALL' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Summary KPI Counters */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="text-xs text-slate-500 font-medium">Total Staff</div>
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
            <div className="text-xs text-blue-700 font-medium">On Leave</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{summary.leave_count}</div>
          </div>
          <div className="bg-brand-50 p-3 rounded-xl border border-brand-200 text-center">
            <div className="text-xs text-brand-700 font-medium">Present %</div>
            <div className="text-xl font-bold text-brand-700 mt-0.5">{summary.attendance_percentage}%</div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-1">Quick Action:</span>
          <Button
            size="sm"
            variant="outline"
            disabled={staff.length === 0}
            onClick={() => handleBulkMark('PRESENT')}
            className="text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-300"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Mark All Present
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Staff Roster Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
            <span>Loading staff attendance roster...</span>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-medium text-slate-700">No staff members found for the selected branch / department.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Emp Code</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4 w-40">Department</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-80 text-center">Mark Status</th>
                  <th className="py-3 px-4 w-32 text-center">In / Out</th>
                  <th className="py-3 px-4 w-48">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((member) => (
                  <tr key={member.user_id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Emp Code */}
                    <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                      {member.employee_code}
                    </td>

                    {/* Member Details */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs uppercase">
                          {member.first_name[0] || 'T'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{member.display_name}</div>
                          <div className="text-[10px] text-slate-400">{member.designation_name || 'Staff'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4 text-slate-600">
                      {member.department || 'General'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {member.status === 'PRESENT' && (
                        <Badge variant="emerald" className="text-[10px]">Present</Badge>
                      )}
                      {member.status === 'ABSENT' && (
                        <Badge variant="rose" className="text-[10px]">Absent</Badge>
                      )}
                      {member.status === 'LATE' && (
                        <Badge variant="amber" className="text-[10px]">
                          Late {member.late_minutes ? `(${member.late_minutes}m)` : ''}
                        </Badge>
                      )}
                      {member.status === 'HALF_DAY' && (
                        <Badge variant="purple" className="text-[10px]">Half Day</Badge>
                      )}
                      {member.status === 'LEAVE' && (
                        <Badge variant="primary" className="text-[10px]">Leave</Badge>
                      )}
                      {member.status === 'NOT_MARKED' && (
                        <span className="text-[10px] text-slate-400 italic">Not Marked</span>
                      )}
                    </td>

                    {/* Status Buttons */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE'] as AttendanceStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(member.user_id, st)}
                            className={`px-2 py-1 text-[10px] font-semibold rounded border transition-all ${getStatusButtonClass(
                              member.status,
                              st
                            )}`}
                          >
                            {st === 'HALF_DAY' ? 'Half Day' : st.charAt(0) + st.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* In / Out Times */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 justify-center">
                        <input
                          type="time"
                          value={member.check_in_time || ''}
                          onChange={(e) => handleTimeChange(member.user_id, 'check_in_time', e.target.value)}
                          className="w-20 text-[11px] px-1.5 py-0.5 border border-slate-200 rounded text-slate-700 bg-white"
                          title="Check-In"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="time"
                          value={member.check_out_time || ''}
                          onChange={(e) => handleTimeChange(member.user_id, 'check_out_time', e.target.value)}
                          className="w-20 text-[11px] px-1.5 py-0.5 border border-slate-200 rounded text-slate-700 bg-white"
                          title="Check-Out"
                        />
                      </div>
                    </td>

                    {/* Remarks */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={member.remarks || ''}
                        placeholder="Remarks..."
                        onChange={(e) => handleRemarksChange(member.user_id, e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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
