// ========================================================================
// Attendance Service
// Business Logic, Multi-Tenant Boundaries, Enrollment Validations,
// Late Minutes Calculations, and Batch Upsert Orchestration.
// ========================================================================

import {
  attendanceRepository,
  AttendanceQueryFilters,
} from '../repositories/attendance.repository.js';
import { academicRepository } from '../repositories/academic.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import {
  MarkStudentAttendancePayload,
  MarkStaffAttendancePayload,
  EnrolledStudentAttendanceItem,
  StaffAttendanceItem,
  AttendanceSummaryMetrics,
  UserAttendance,
  AttendanceStatusMaster,
  AttendanceType,
  AttendanceStatus,
} from '../types/index.js';

export class AttendanceService {
  /**
   * 1. Get Enrolled Students Roster with Attendance for a Class/Section & Date
   */
  async getStudentAttendanceRoster(
    schoolId: string,
    sessionId: string,
    locationId: string,
    classId: string,
    sectionId: string,
    date: string
  ): Promise<{
    date: string;
    class_id: string;
    section_id: string;
    students: EnrolledStudentAttendanceItem[];
    summary: AttendanceSummaryMetrics;
    is_locked: boolean;
  }> {
    this.validateDateFormat(date);

    // 1. Authoritative enrolled students from student_academic_enrollments
    const enrollments = await attendanceRepository.findEnrolledStudents(
      schoolId,
      sessionId,
      locationId,
      classId,
      sectionId
    );

    const userIds = enrollments.map((e) => e.student_user_id);

    // 2. Batch fetch existing attendance for these students on this date (No N+1!)
    const existingAttendanceMap = await attendanceRepository.findExistingAttendanceForUsers(
      schoolId,
      userIds,
      date,
      'STUDENT'
    );

    let isClassLocked = false;
    const studentItems: EnrolledStudentAttendanceItem[] = [];
    const attendanceRecordsForSummary: UserAttendance[] = [];

    for (const enr of enrollments) {
      const studentUser = enr.student;
      const existing = existingAttendanceMap.get(enr.student_user_id);

      if (existing) {
        attendanceRecordsForSummary.push(existing);
        if (existing.is_locked) isClassLocked = true;
      }

      const firstName = studentUser?.first_name || 'Unknown';
      const lastName = studentUser?.last_name || '';
      const displayName = `${firstName} ${lastName}`.trim();

      studentItems.push({
        user_id: enr.student_user_id,
        student_enrollment_id: enr.id,
        admission_number: enr.admission_number || '',
        roll_number: enr.roll_number || '0',
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        gender: (studentUser as any)?.gender || (studentUser as any)?.student_profile?.gender,
        status: (existing?.status as AttendanceStatus) || 'NOT_MARKED',
        attendance_id: existing?.attendance_id,
        remarks: existing?.remarks || undefined,
        is_locked: existing?.is_locked || false,
      });
    }

    const summary = attendanceRepository.calculateSummary(
      attendanceRecordsForSummary,
      enrollments.length
    );

    return {
      date,
      class_id: classId,
      section_id: sectionId,
      students: studentItems,
      summary,
      is_locked: isClassLocked,
    };
  }

  /**
   * 2. Save / Update Student Attendance Batch
   */
  async saveStudentAttendance(
    schoolId: string,
    markedByUserId: string,
    payload: MarkStudentAttendancePayload
  ): Promise<{
    saved_count: number;
    summary: AttendanceSummaryMetrics;
    records: UserAttendance[];
  }> {
    this.validateDateFormat(payload.attendance_date);

    if (!payload.records || payload.records.length === 0) {
      throw new Error('No attendance records provided to save.');
    }

    // Validate active enrollments for this context to guarantee integrity
    const activeEnrollments = await attendanceRepository.findEnrolledStudents(
      schoolId,
      payload.academic_session_id,
      payload.location_id,
      payload.class_id,
      payload.section_id
    );
    const validEnrollmentMap = new Map(activeEnrollments.map((e) => [e.id, e]));

    const validStatuses = new Set([
      'PRESENT',
      'ABSENT',
      'LATE',
      'HALF_DAY',
      'LEAVE',
      'EXCUSED',
    ]);

    const itemsToUpsert = payload.records.map((r) => {
      const enr = validEnrollmentMap.get(r.student_enrollment_id);
      if (!enr) {
        throw new Error(
          `Invalid or unauthorized student enrollment ID [${r.student_enrollment_id}] for this class and academic session.`
        );
      }
      if (enr.student_user_id !== r.user_id) {
        throw new Error(
          `User ID [${r.user_id}] does not match enrollment record [${r.student_enrollment_id}].`
        );
      }

      const statusUpper = r.status.toUpperCase();
      if (!validStatuses.has(statusUpper)) {
        throw new Error(`Invalid attendance status [${r.status}].`);
      }

      return {
        school_id: schoolId,
        user_id: r.user_id,
        attendance_date: payload.attendance_date,
        attendance_type: 'STUDENT' as AttendanceType,
        academic_session_id: payload.academic_session_id,
        location_id: payload.location_id,
        student_enrollment_id: r.student_enrollment_id,
        class_id: payload.class_id,
        section_id: payload.section_id,
        status: statusUpper as AttendanceStatus,
        late_minutes: statusUpper === 'LATE' ? 15 : 0,
        early_departure_minutes: 0,
        remarks: r.remarks || null,
        marked_by: markedByUserId,
        marked_at: new Date().toISOString(),
        updated_by: markedByUserId,
        source: 'MANUAL',
        is_locked: false,
      };
    });

    const savedRecords = await attendanceRepository.upsertAttendanceBatch(
      schoolId,
      itemsToUpsert
    );
    const summary = attendanceRepository.calculateSummary(
      savedRecords,
      activeEnrollments.length
    );

    return {
      saved_count: savedRecords.length,
      summary,
      records: savedRecords,
    };
  }

  /**
   * 3. Get Staff & Faculty Roster with Attendance for a Branch & Date
   */
  async getStaffAttendanceRoster(
    schoolId: string,
    locationId: string,
    date: string,
    department?: string
  ): Promise<{
    date: string;
    location_id: string;
    staff: StaffAttendanceItem[];
    summary: AttendanceSummaryMetrics;
  }> {
    this.validateDateFormat(date);

    // 1. Authoritative staff with access to this location
    const staffRoster = await attendanceRepository.findStaffForLocation(
      schoolId,
      locationId,
      department
    );

    const userIds = staffRoster.map((s) => s.user.id);

    // 2. Batch fetch existing attendance for these staff members on this date
    const existingAttendanceMap = await attendanceRepository.findExistingAttendanceForUsers(
      schoolId,
      userIds,
      date,
      'STAFF'
    );

    const staffItems: StaffAttendanceItem[] = [];
    const attendanceRecordsForSummary: UserAttendance[] = [];

    for (const member of staffRoster) {
      const u = member.user;
      const existing = existingAttendanceMap.get(u.id);

      if (existing) {
        attendanceRecordsForSummary.push(existing);
      }

      const firstName = u.first_name || 'Staff';
      const lastName = u.last_name || '';
      const displayName = `${firstName} ${lastName}`.trim();

      staffItems.push({
        user_id: u.id,
        employee_code: member.profile?.employee_code || u.username || 'EMP-001',
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        email: u.email,
        department: member.profile?.department || 'General',
        designation_name: member.designation?.name || member.profile?.employment_type || 'Staff',
        status: (existing?.status as AttendanceStatus) || 'NOT_MARKED',
        attendance_id: existing?.attendance_id,
        check_in_time: existing?.check_in_time || null,
        check_out_time: existing?.check_out_time || null,
        late_minutes: existing?.late_minutes || 0,
        early_departure_minutes: existing?.early_departure_minutes || 0,
        remarks: existing?.remarks || undefined,
        is_locked: existing?.is_locked || false,
      });
    }

    const summary = attendanceRepository.calculateSummary(
      attendanceRecordsForSummary,
      staffRoster.length
    );

    return {
      date,
      location_id: locationId,
      staff: staffItems,
      summary,
    };
  }

  /**
   * 4. Save / Update Staff Attendance Batch
   */
  async saveStaffAttendance(
    schoolId: string,
    markedByUserId: string,
    payload: MarkStaffAttendancePayload
  ): Promise<{
    saved_count: number;
    summary: AttendanceSummaryMetrics;
    records: UserAttendance[];
  }> {
    this.validateDateFormat(payload.attendance_date);

    if (!payload.records || payload.records.length === 0) {
      throw new Error('No staff attendance records provided to save.');
    }

    const staffRoster = await attendanceRepository.findStaffForLocation(
      schoolId,
      payload.location_id,
      payload.department
    );
    const validStaffMap = new Map(staffRoster.map((s) => [s.user.id, s]));

    const validStatuses = new Set([
      'PRESENT',
      'ABSENT',
      'LATE',
      'HALF_DAY',
      'LEAVE',
      'EXCUSED',
    ]);

    // Standard school cutoff time e.g. 08:30
    const cutoffMinutes = 8 * 60 + 30; // 08:30 AM = 510 minutes

    const itemsToUpsert = payload.records.map((r) => {
      const member = validStaffMap.get(r.user_id);
      if (!member) {
        throw new Error(
          `Staff member [${r.user_id}] is not assigned or authorized for this branch.`
        );
      }

      const statusUpper = r.status.toUpperCase();
      if (!validStatuses.has(statusUpper)) {
        throw new Error(`Invalid attendance status [${r.status}].`);
      }

      // Calculate late minutes if check-in time is provided
      let lateMinutes = r.late_minutes || 0;
      if (r.check_in_time && !r.late_minutes) {
        const parts = r.check_in_time.split(':');
        if (parts.length >= 2) {
          const checkInMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          if (checkInMins > cutoffMinutes) {
            lateMinutes = checkInMins - cutoffMinutes;
          }
        }
      }

      return {
        school_id: schoolId,
        user_id: r.user_id,
        attendance_date: payload.attendance_date,
        attendance_type: 'STAFF' as AttendanceType,
        location_id: payload.location_id,
        department: member.profile?.department || payload.department || null,
        status: statusUpper as AttendanceStatus,
        check_in_time: r.check_in_time || null,
        check_out_time: r.check_out_time || null,
        late_minutes: lateMinutes,
        early_departure_minutes: r.early_departure_minutes || 0,
        remarks: r.remarks || null,
        marked_by: markedByUserId,
        marked_at: new Date().toISOString(),
        updated_by: markedByUserId,
        source: 'MANUAL',
        is_locked: false,
      };
    });

    const savedRecords = await attendanceRepository.upsertAttendanceBatch(
      schoolId,
      itemsToUpsert
    );
    const summary = attendanceRepository.calculateSummary(
      savedRecords,
      staffRoster.length
    );

    return {
      saved_count: savedRecords.length,
      summary,
      records: savedRecords,
    };
  }

  /**
   * 5. Query Attendance History
   */
  async getAttendanceHistory(
    schoolId: string,
    filters: AttendanceQueryFilters
  ): Promise<{
    records: UserAttendance[];
    summary: AttendanceSummaryMetrics;
  }> {
    const records = await attendanceRepository.findAttendance(schoolId, filters);
    const summary = attendanceRepository.calculateSummary(records, records.length);
    return { records, summary };
  }

  /**
   * 6. Executive Attendance Dashboard
   */
  async getAttendanceDashboard(
    schoolId: string,
    locationId: string,
    date: string,
    sessionId?: string
  ): Promise<{
    date: string;
    location_id: string;
    student_summary: AttendanceSummaryMetrics;
    staff_summary: AttendanceSummaryMetrics;
    class_breakdown: Array<{
      class_id: string;
      class_name: string;
      section_name: string;
      total: number;
      present: number;
      absent: number;
      percentage: number;
    }>;
  }> {
    this.validateDateFormat(date);

    // 1. Fetch today's student records
    const studentRecords = await attendanceRepository.findAttendance(schoolId, {
      date,
      locationId,
      attendanceType: 'STUDENT',
      academicSessionId: sessionId,
    });

    // 2. Fetch today's staff records
    const staffRecords = await attendanceRepository.findAttendance(schoolId, {
      date,
      locationId,
      attendanceType: 'STAFF',
    });

    // 3. Compute class-wise breakdown
    const classMap = new Map<string, { class_name: string; section_name: string; total: number; present: number; absent: number }>();
    for (const r of studentRecords) {
      const key = `${r.class_id || ''}-${r.section_id || ''}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          class_name: r.class_name || 'Class',
          section_name: r.section_name || 'Sec',
          total: 0,
          present: 0,
          absent: 0,
        });
      }
      const entry = classMap.get(key)!;
      entry.total++;
      const s = (r.status || '').toUpperCase();
      if (s === 'PRESENT' || s === 'LATE' || s === 'EXCUSED') entry.present++;
      else if (s === 'ABSENT') entry.absent++;
    }

    const classBreakdown = Array.from(classMap.entries()).map(([key, val]) => {
      const [class_id] = key.split('-');
      const pct = val.total > 0 ? Math.round((val.present / val.total) * 100) : 0;
      return {
        class_id,
        class_name: val.class_name,
        section_name: val.section_name,
        total: val.total,
        present: val.present,
        absent: val.absent,
        percentage: pct,
      };
    });

    return {
      date,
      location_id: locationId,
      student_summary: attendanceRepository.calculateSummary(studentRecords, studentRecords.length),
      staff_summary: attendanceRepository.calculateSummary(staffRecords, staffRecords.length),
      class_breakdown: classBreakdown,
    };
  }

  /**
   * 7. Attendance Status Master
   */
  async getStatusMasters(schoolId: string, type?: AttendanceType): Promise<AttendanceStatusMaster[]> {
    return attendanceRepository.findStatusMaster(schoolId, type);
  }

  // Helper
  private validateDateFormat(dateStr: string): void {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new Error(`Invalid date format [${dateStr}]. Expected YYYY-MM-DD.`);
    }
  }
}

export const attendanceService = new AttendanceService();
