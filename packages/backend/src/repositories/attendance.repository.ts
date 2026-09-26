// ========================================================================
// Attendance Repository
// Universal Attendance Data Access Layer (Supabase PostgreSQL + Memory Client)
// Single Authoritative Engine for Student and Staff/Faculty Attendance
// ========================================================================

import crypto from 'crypto';
import {
  UserAttendance,
  AttendanceStatusMaster,
  AttendanceAuditLog,
  AttendanceType,
  AttendanceSummaryMetrics,
  StudentAcademicEnrollment,
  User,
  StaffProfile,
  Designation,
} from '../types/index.js';
import {
  getDatabaseClient,
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export interface AttendanceQueryFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  attendanceType?: AttendanceType;
  academicSessionId?: string;
  locationId?: string;
  classId?: string;
  sectionId?: string;
  userId?: string;
  department?: string;
  status?: string;
  includeLocked?: boolean;
}

export class AttendanceRepository {
  private pg = getDatabaseClient();
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // 1. Attendance Status Master
  // ----------------------------------------------------------------------
  async findStatusMaster(schoolId: string, type?: AttendanceType): Promise<AttendanceStatusMaster[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('attendance_status_master')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (type) {
        q = q.in('attendance_type', ['ALL', type]);
      }
      const { data, error } = await q;
      if (!error && data && data.length > 0) {
        return data as AttendanceStatusMaster[];
      }
    }

    // Memory fallback
    const list = this.mem.findAll('attendance_status_master', (row: AttendanceStatusMaster) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (!row.is_active) return false;
      if (type && row.attendance_type !== 'ALL' && row.attendance_type !== type) return false;
      return true;
    }) as AttendanceStatusMaster[];

    if (list.length > 0) return list;

    // Default canonical statuses if not seeded
    return [
      { id: '1', school_id: schoolId, status_code: 'PRESENT', status_name: 'Present', attendance_type: 'ALL', counts_as_present: true, counts_as_absent: false, counts_as_leave: false, color_code: '#10B981', is_active: true },
      { id: '2', school_id: schoolId, status_code: 'ABSENT', status_name: 'Absent', attendance_type: 'ALL', counts_as_present: false, counts_as_absent: true, counts_as_leave: false, color_code: '#EF4444', is_active: true },
      { id: '3', school_id: schoolId, status_code: 'LATE', status_name: 'Late', attendance_type: 'ALL', counts_as_present: true, counts_as_absent: false, counts_as_leave: false, color_code: '#F59E0B', is_active: true },
      { id: '4', school_id: schoolId, status_code: 'HALF_DAY', status_name: 'Half Day', attendance_type: 'ALL', counts_as_present: true, counts_as_absent: false, counts_as_leave: false, color_code: '#8B5CF6', is_active: true },
      { id: '5', school_id: schoolId, status_code: 'LEAVE', status_name: 'Leave', attendance_type: 'ALL', counts_as_present: false, counts_as_absent: false, counts_as_leave: true, color_code: '#3B82F6', is_active: true },
      { id: '6', school_id: schoolId, status_code: 'EXCUSED', status_name: 'Excused', attendance_type: 'ALL', counts_as_present: true, counts_as_absent: false, counts_as_leave: false, color_code: '#6B7280', is_active: true },
    ];
  }

  // ----------------------------------------------------------------------
  // 2. Universal Attendance Queries
  // ----------------------------------------------------------------------
  async findAttendance(schoolId: string, filters: AttendanceQueryFilters): Promise<UserAttendance[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('user_attendance')
        .select('*')
        .eq('school_id', schoolId)
        .is('deleted_at', null);

      if (filters.date) q = q.eq('attendance_date', filters.date);
      if (filters.startDate) q = q.gte('attendance_date', filters.startDate);
      if (filters.endDate) q = q.lte('attendance_date', filters.endDate);
      if (filters.attendanceType) q = q.eq('attendance_type', filters.attendanceType);
      if (filters.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
      if (filters.locationId) q = q.eq('location_id', filters.locationId);
      if (filters.classId) q = q.eq('class_id', filters.classId);
      if (filters.sectionId) q = q.eq('section_id', filters.sectionId);
      if (filters.userId) q = q.eq('user_id', filters.userId);
      if (filters.department) q = q.eq('department', filters.department);
      if (filters.status) q = q.eq('status', filters.status);

      q = q.order('attendance_date', { ascending: false });

      const { data, error } = await q;
      if (!error && data) {
        return (data as UserAttendance[]).map(d => this.enrichAttendance(d));
      }
      if (error) {
        console.error('[AttendanceRepository.findAttendance] Supabase error:', error.message);
      }
    }

    // Memory fallback
    const list = this.mem.findAll('user_attendance', (row: UserAttendance) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters.date && row.attendance_date !== filters.date) return false;
      if (filters.startDate && row.attendance_date < filters.startDate) return false;
      if (filters.endDate && row.attendance_date > filters.endDate) return false;
      if (filters.attendanceType && row.attendance_type !== filters.attendanceType) return false;
      if (filters.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
      if (filters.locationId && row.location_id !== filters.locationId) return false;
      if (filters.classId && row.class_id !== filters.classId) return false;
      if (filters.sectionId && row.section_id !== filters.sectionId) return false;
      if (filters.userId && row.user_id !== filters.userId) return false;
      if (filters.department && row.department !== filters.department) return false;
      if (filters.status && row.status !== filters.status) return false;
      return true;
    }) as UserAttendance[];

    list.sort((a, b) => (b.attendance_date > a.attendance_date ? 1 : -1));
    return list.map(d => this.enrichAttendance(d));
  }

  /**
   * Batch lookup existing attendance records for given users on a specific date
   * Prevents N+1 database calls
   */
  async findExistingAttendanceForUsers(
    schoolId: string,
    userIds: string[],
    date: string,
    attendanceType: AttendanceType
  ): Promise<Map<string, UserAttendance>> {
    const map = new Map<string, UserAttendance>();
    if (!userIds || userIds.length === 0) return map;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('user_attendance')
        .select('*')
        .eq('school_id', schoolId)
        .eq('attendance_date', date)
        .eq('attendance_type', attendanceType)
        .in('user_id', userIds)
        .is('deleted_at', null);

      if (!error && data) {
        for (const item of data as UserAttendance[]) {
          map.set(item.user_id, this.enrichAttendance(item));
        }
        return map;
      }
    }

    // Memory fallback
    const userSet = new Set(userIds);
    const records = this.mem.findAll('user_attendance', (row: UserAttendance) => {
      return (
        row.school_id === schoolId &&
        row.attendance_date === date &&
        row.attendance_type === attendanceType &&
        userSet.has(row.user_id) &&
        !row.deleted_at
      );
    }) as UserAttendance[];

    for (const item of records) {
      map.set(item.user_id, this.enrichAttendance(item));
    }
    return map;
  }

  // ----------------------------------------------------------------------
  // 3. Authoritative Enrolled Student Roster
  // ----------------------------------------------------------------------
  async findEnrolledStudents(
    schoolId: string,
    sessionId: string,
    locationId: string,
    classId: string,
    sectionId: string
  ): Promise<StudentAcademicEnrollment[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('student_academic_enrollments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_session_id', sessionId)
        .eq('location_id', locationId)
        .eq('class_id', classId)
        .eq('section_id', sectionId)
        .eq('enrollment_status', 'ENROLLED')
        .is('deleted_at', null);

      if (!error && data && data.length > 0) {
        const userIds = data.map((e: any) => e.student_user_id);
        const userMap = new Map<string, any>();
        for (const uid of userIds) {
          const u = this.mem.findById('users', uid);
          if (u) userMap.set(uid, u);
        }
        const missing = userIds.filter((uid: string) => !userMap.has(uid));
        if (missing.length > 0) {
          const { data: dbUsers } = await getSupabaseClient()!
            .from('users')
            .select('*')
            .in('id', missing);
          if (dbUsers) {
            for (const u of dbUsers) userMap.set(u.id, u);
          }
        }
        return (data as StudentAcademicEnrollment[]).map(e => {
          const studentUser = userMap.get(e.student_user_id) as User | null;
          return {
            ...e,
            student: studentUser ? { ...studentUser, password_hash: undefined } : undefined,
          };
        }).sort((a, b) => {
          const rollA = parseInt(a.roll_number || '0', 10);
          const rollB = parseInt(b.roll_number || '0', 10);
          return rollA - rollB;
        });
      }
    }

    // Memory query
    const list = this.mem.findAll('student_academic_enrollments', (row: StudentAcademicEnrollment) => {
      return (
        row.school_id === schoolId &&
        row.academic_session_id === sessionId &&
        row.location_id === locationId &&
        row.class_id === classId &&
        row.section_id === sectionId &&
        row.enrollment_status === 'ENROLLED' &&
        !row.deleted_at
      );
    }) as StudentAcademicEnrollment[];

    return list.map(e => {
      const studentUser = this.mem.findById('users', e.student_user_id) as User | null;
      return {
        ...e,
        student: studentUser ? { ...studentUser, password_hash: undefined } : undefined,
      };
    }).sort((a, b) => {
      const rollA = parseInt(a.roll_number || '0', 10);
      const rollB = parseInt(b.roll_number || '0', 10);
      return rollA - rollB;
    });
  }

  // ----------------------------------------------------------------------
  // 4. Authoritative Staff Roster
  // ----------------------------------------------------------------------
  async findStaffForLocation(
    schoolId: string,
    locationId: string,
    department?: string
  ): Promise<Array<{ user: User; profile?: StaffProfile; designation?: Designation }>> {
    // 1. Get staff users
    // Staff include user_type: STAFF, TEACHER, ADMIN
    const allUsers = this.mem.findAll('users', (u: User) => {
      if (u.school_id !== schoolId) return false;
      if (u.deleted_at) return false;
      if (u.status !== 'ACTIVE') return false;
      return true;
    }) as User[];

    // 2. Check location access
    const userLocAccess = this.mem.findAll('user_location_access', (la: any) => {
      return la.school_id === schoolId && la.location_id === locationId;
    });
    const authorizedUserIds = new Set(userLocAccess.map((la: any) => la.user_id));

    const result: Array<{ user: User; profile?: StaffProfile; designation?: Designation }> = [];

    for (const u of allUsers) {
      // Must have access to this location
      if (!authorizedUserIds.has(u.id)) continue;

      const userType = this.mem.findById('user_types', u.user_type_id);
      const typeCode = (userType?.code || '').toUpperCase();

      // Exclude students and parents from staff roster
      if (typeCode === 'STUDENT' || typeCode === 'PARENT') continue;

      const profile = (this.mem.findAll('staff_profiles', (sp: StaffProfile) => sp.user_id === u.id)[0]) as StaffProfile | undefined;
      let desig: Designation | undefined = undefined;
      if (profile?.designation_id) {
        desig = this.mem.findById('designations', profile.designation_id) as Designation | undefined;
      }

      if (department && department !== 'ALL' && profile?.department !== department) {
        continue;
      }

      result.push({
        user: { ...u, password_hash: undefined },
        profile,
        designation: desig,
      });
    }

    result.sort((a, b) => {
      const nameA = `${a.user.first_name} ${a.user.last_name || ''}`.trim();
      const nameB = `${b.user.first_name} ${b.user.last_name || ''}`.trim();
      return nameA.localeCompare(nameB);
    });

    return result;
  }

  // ----------------------------------------------------------------------
  // 5. Atomic Batch Upsert (Prevent Duplicates)
  // ----------------------------------------------------------------------
  async upsertAttendanceBatch(
    schoolId: string,
    items: Array<Omit<UserAttendance, 'id' | 'attendance_id' | 'created_at' | 'updated_at'> & { id?: string; attendance_id?: string }>
  ): Promise<UserAttendance[]> {
    const saved: UserAttendance[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      // Check existing row by (school_id, user_id, attendance_date, attendance_type)
      const existing = await this.findSingleAttendance(
        schoolId,
        item.user_id,
        item.attendance_date,
        item.attendance_type
      );

      if (existing) {
        // Record audit if status changed
        if (existing.status !== item.status || existing.check_in_time !== item.check_in_time) {
          await this.recordAuditLog({
            school_id: schoolId,
            attendance_id: existing.id,
            user_id: existing.user_id,
            old_status: existing.status,
            new_status: item.status,
            old_check_in: existing.check_in_time || null,
            new_check_in: item.check_in_time || null,
            old_check_out: existing.check_out_time || null,
            new_check_out: item.check_out_time || null,
            changed_by: item.updated_by || item.marked_by || null,
            changed_at: now,
            reason: item.remarks || 'Status update',
          });
        }

        const updates: Partial<UserAttendance> = {
          status: item.status,
          check_in_time: item.check_in_time ?? existing.check_in_time,
          check_out_time: item.check_out_time ?? existing.check_out_time,
          late_minutes: item.late_minutes ?? existing.late_minutes,
          early_departure_minutes: item.early_departure_minutes ?? existing.early_departure_minutes,
          remarks: item.remarks ?? existing.remarks,
          marked_by: item.marked_by ?? existing.marked_by,
          marked_at: now,
          updated_by: item.updated_by ?? existing.updated_by,
          updated_at: now,
          student_enrollment_id: item.student_enrollment_id ?? existing.student_enrollment_id,
          class_id: item.class_id ?? existing.class_id,
          section_id: item.section_id ?? existing.section_id,
          academic_session_id: item.academic_session_id ?? existing.academic_session_id,
          location_id: item.location_id ?? existing.location_id,
          department: item.department ?? existing.department,
        };

        if (isSupabaseDatabaseActive() && getSupabaseClient()) {
          const { data, error } = await getSupabaseClient()!
            .from('user_attendance')
            .update(updates)
            .eq('id', existing.id)
            .select()
            .single();

          if (!error && data) {
            this.mem.update('user_attendance', existing.id, updates);
            saved.push(this.enrichAttendance(data as UserAttendance));
            continue;
          }
        }

        const updatedMem = this.mem.update('user_attendance', existing.id, updates) as UserAttendance;
        saved.push(this.enrichAttendance(updatedMem));
      } else {
        // Insert brand new record
        const newId = item.id || crypto.randomUUID();
        const dateCompact = item.attendance_date.replace(/-/g, '');
        const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
        const attId = item.attendance_id || `ATT-${dateCompact}-${randomHex}`;

        const newRow: UserAttendance = {
          id: newId,
          attendance_id: attId,
          school_id: schoolId,
          user_id: item.user_id,
          attendance_date: item.attendance_date,
          attendance_type: item.attendance_type,
          academic_session_id: item.academic_session_id || null,
          location_id: item.location_id,
          student_enrollment_id: item.student_enrollment_id || null,
          class_id: item.class_id || null,
          section_id: item.section_id || null,
          staff_assignment_id: item.staff_assignment_id || null,
          department: item.department || null,
          status: item.status,
          check_in_time: item.check_in_time || null,
          check_out_time: item.check_out_time || null,
          late_minutes: item.late_minutes || 0,
          early_departure_minutes: item.early_departure_minutes || 0,
          remarks: item.remarks || null,
          marked_by: item.marked_by || null,
          marked_at: now,
          updated_by: item.updated_by || null,
          source: item.source || 'MANUAL',
          is_locked: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };

        if (isSupabaseDatabaseActive() && getSupabaseClient()) {
          const { data, error } = await getSupabaseClient()!
            .from('user_attendance')
            .insert(newRow)
            .select()
            .single();

          if (!error && data) {
            this.mem.insert('user_attendance', newRow);
            saved.push(this.enrichAttendance(data as UserAttendance));
            continue;
          }
          if (error) {
            console.error('[AttendanceRepository.insert] Supabase error:', error.message);
          }
        }

        const insertedMem = this.mem.insert('user_attendance', newRow) as UserAttendance;
        saved.push(this.enrichAttendance(insertedMem));
      }
    }

    return saved;
  }

  async findSingleAttendance(
    schoolId: string,
    userId: string,
    date: string,
    type: AttendanceType
  ): Promise<UserAttendance | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('user_attendance')
        .select('*')
        .eq('school_id', schoolId)
        .eq('user_id', userId)
        .eq('attendance_date', date)
        .eq('attendance_type', type)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) {
        return this.enrichAttendance(data as UserAttendance);
      }
    }

    const matches = this.mem.findAll('user_attendance', (row: UserAttendance) => {
      return (
        row.school_id === schoolId &&
        row.user_id === userId &&
        row.attendance_date === date &&
        row.attendance_type === type &&
        !row.deleted_at
      );
    }) as UserAttendance[];

    return matches.length > 0 ? this.enrichAttendance(matches[0]) : null;
  }

  // ----------------------------------------------------------------------
  // 6. Audit Logging
  // ----------------------------------------------------------------------
  async recordAuditLog(entry: Omit<AttendanceAuditLog, 'id' | 'created_at'>): Promise<void> {
    const auditRecord: AttendanceAuditLog = {
      id: crypto.randomUUID(),
      ...entry,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('attendance_audit_log').insert(auditRecord);
    }
    this.mem.insert('attendance_audit_log', auditRecord);
  }

  // ----------------------------------------------------------------------
  // 7. Metrics & Aggregation
  // ----------------------------------------------------------------------
  calculateSummary(records: UserAttendance[], totalExpected: number): AttendanceSummaryMetrics {
    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let leave = 0;
    let excused = 0;

    for (const r of records) {
      const s = (r.status || '').toUpperCase();
      if (s === 'PRESENT') present++;
      else if (s === 'ABSENT') absent++;
      else if (s === 'LATE') late++;
      else if (s === 'HALF_DAY') halfDay++;
      else if (s === 'LEAVE') leave++;
      else if (s === 'EXCUSED') excused++;
    }

    const markedCount = present + absent + late + halfDay + leave + excused;
    const notMarked = Math.max(0, totalExpected - markedCount);
    const positivePresent = present + late + (halfDay * 0.5) + excused;
    const denominator = markedCount > 0 ? markedCount : (totalExpected > 0 ? totalExpected : 1);
    const pct = Math.round((positivePresent / denominator) * 100);

    return {
      total: totalExpected,
      total_enrolled: totalExpected,
      present,
      absent,
      late,
      half_day: halfDay,
      leave,
      excused,
      not_marked: notMarked,
      total_count: totalExpected,
      present_count: present,
      absent_count: absent,
      late_count: late,
      half_day_count: halfDay,
      leave_count: leave,
      excused_count: excused,
      not_marked_count: notMarked,
      attendance_percentage: Math.min(100, Math.max(0, pct)),
    };
  }

  // ----------------------------------------------------------------------
  // Private Hydration Helper
  // ----------------------------------------------------------------------
  private enrichAttendance(att: UserAttendance): UserAttendance {
    const user = this.mem.findById('users', att.user_id) as User | null;
    const cls = att.class_id ? this.mem.findById('classes', att.class_id) : null;
    const sec = att.section_id ? this.mem.findById('sections', att.section_id) : null;
    const enrollment = att.student_enrollment_id
      ? this.mem.findById('student_academic_enrollments', att.student_enrollment_id)
      : null;
    const staffProf = att.attendance_type === 'STAFF'
      ? (this.mem.findAll('staff_profiles', (sp: StaffProfile) => sp.user_id === att.user_id)[0] as StaffProfile | undefined)
      : null;
    const desig = staffProf?.designation_id
      ? this.mem.findById('designations', staffProf.designation_id) as Designation | null
      : null;

    return {
      ...att,
      user_name: user ? `${user.first_name} ${user.last_name || ''}`.trim() : att.user_id,
      admission_number: enrollment?.admission_number || undefined,
      roll_number: enrollment?.roll_number || undefined,
      class_name: cls?.display_name || cls?.name || undefined,
      section_name: sec?.name || undefined,
      employee_code: staffProf?.employee_code || undefined,
      designation_name: desig?.name || undefined,
    };
  }
}

export const attendanceRepository = new AttendanceRepository();
