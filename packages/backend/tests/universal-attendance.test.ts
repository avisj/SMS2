// ========================================================================
// Universal Attendance Module Tests
// Verification of Single Authoritative Engine for Student & Staff Attendance
// Tests 33 Core Scenarios, Tenant/Branch Isolation, and Historical Context
// ========================================================================

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { getMemoryDbClient } from '../src/db/client.js';
import { attendanceService } from '../src/services/attendance.service.js';
import { attendanceRepository } from '../src/repositories/attendance.repository.js';
import { academicRepository } from '../src/repositories/academic.repository.js';
import { School, AcademicSession, Location, ClassItem, SectionItem, User, StudentAcademicEnrollment } from '../src/types/index.js';

describe('Universal Attendance Module - Student & Staff/Faculty Engine', () => {
  let mem: ReturnType<typeof getMemoryDbClient>;
  let schoolA: School;
  let schoolB: School;
  let locA1: Location;
  let locA2: Location;
  let sessA2: AcademicSession;
  let sessA1: AcademicSession;
  let cls10: ClassItem;
  let cls9: ClassItem;
  let secA: SectionItem;
  let secB: SectionItem;
  let uAarav: User;
  let uDiya: User;
  let uRajesh: User;
  let uVikram: User;
  let uSuperA: User;
  let enrollAarav10A: StudentAcademicEnrollment;
  let enrollDiya10A: StudentAcademicEnrollment;

  beforeEach(() => {
    seedInMemoryDatabase();
    mem = getMemoryDbClient();

    const schools = mem.findAll('schools') as School[];
    schoolA = schools.find((s) => s.school_code === 'DPA')!;
    schoolB = schools.find((s) => s.school_code === 'GWI')!;

    const locations = mem.findAll('locations', (l: Location) => l.school_id === schoolA.id) as Location[];
    locA1 = locations.find((l) => l.location_code === 'DEL-MAIN')!;
    locA2 = locations.find((l) => l.location_code === 'NOI-EXT')!;

    const sessions = mem.findAll('academic_sessions', (s: AcademicSession) => s.school_id === schoolA.id) as AcademicSession[];
    sessA2 = sessions.find((s) => s.name === '2026-27')!;
    sessA1 = sessions.find((s) => s.name === '2025-26')!;

    const classes = mem.findAll('classes', (c: ClassItem) => c.school_id === schoolA.id) as ClassItem[];
    cls10 = classes.find((c) => c.code === 'CLS-10')!;
    cls9 = classes.find((c) => c.code === 'CLS-9')!;

    const sections = mem.findAll('sections', (s: SectionItem) => s.school_id === schoolA.id) as SectionItem[];
    secA = sections.find((s) => s.name === 'A')!;
    secB = sections.find((s) => s.name === 'B')!;

    const users = mem.findAll('users', (u: User) => u.school_id === schoolA.id) as User[];
    uAarav = users.find((u) => u.username === 'aarav.sharma')!;
    uDiya = users.find((u) => u.username === 'diya.patel')!;
    uRajesh = users.find((u) => u.username === 'rajesh.sharma')!;
    uVikram = users.find((u) => u.username === 'vikram.verma')!;
    uSuperA = users.find((u) => u.username === 'superadmin')!;

    const enrollments = mem.findAll('student_academic_enrollments', (e: StudentAcademicEnrollment) => {
      return (
        e.school_id === schoolA.id &&
        e.academic_session_id === sessA2.id &&
        e.class_id === cls10.id &&
        e.section_id === secA.id
      );
    }) as StudentAcademicEnrollment[];

    enrollAarav10A = enrollments.find((e) => e.student_user_id === uAarav.id)!;
    enrollDiya10A = enrollments.find((e) => e.student_user_id === uDiya.id)!;
  });

  // ----------------------------------------------------------------------
  // 1. Universal Table Architecture
  // ----------------------------------------------------------------------
  test('1. Universal Table: Both Student and Staff attendance reside in user_attendance table', async () => {
    const studentRecords = mem.findAll('user_attendance', (a: any) => a.attendance_type === 'STUDENT');
    const staffRecords = mem.findAll('user_attendance', (a: any) => a.attendance_type === 'STAFF');

    assert.ok(studentRecords.length > 0, 'Must have student attendance records in user_attendance');
    assert.ok(staffRecords.length > 0, 'Must have staff attendance records in user_attendance');

    // Both are keyed by user_id
    assert.strictEqual(studentRecords[0].user_id, uAarav.id);
    assert.strictEqual(staffRecords[0].user_id, uRajesh.id);

    // No separate student_attendance or staff_attendance tables exist
    assert.strictEqual(mem.getTable('student_attendance').size, 0);
    assert.strictEqual(mem.getTable('staff_attendance').size, 0);
  });

  // ----------------------------------------------------------------------
  // 2. Student Attendance Roster & Enrollment Source
  // ----------------------------------------------------------------------
  test('2. Student Roster: Derived strictly from student_academic_enrollments for session/branch/class/section', async () => {
    const result = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-09'
    );

    assert.strictEqual(result.students.length, 2, 'Should load exactly the 2 enrolled students in 10-A');
    const aaravItem = result.students.find((s) => s.user_id === uAarav.id);
    const diyaItem = result.students.find((s) => s.user_id === uDiya.id);

    assert.ok(aaravItem, 'Aarav must be in roster');
    assert.ok(diyaItem, 'Diya must be in roster');
    assert.strictEqual(aaravItem?.student_enrollment_id, enrollAarav10A.id);
    assert.strictEqual(diyaItem?.student_enrollment_id, enrollDiya10A.id);
  });

  test('3. Reload Attendance: Existing saved attendance values are preserved and not reset to Present', async () => {
    const result = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-09'
    );

    const aarav = result.students.find((s) => s.user_id === uAarav.id)!;
    const diya = result.students.find((s) => s.user_id === uDiya.id)!;

    assert.strictEqual(aarav.status, 'PRESENT', 'Aarav should be PRESENT from seed');
    assert.strictEqual(diya.status, 'LATE', 'Diya should be LATE from seed, not reset to Present');
  });

  // ----------------------------------------------------------------------
  // 3. Mark, Save, Bulk, and Individual Override
  // ----------------------------------------------------------------------
  test('4. Mark & Save Attendance: Saves attendance with valid student enrollment context', async () => {
    const saveResult = await attendanceService.saveStudentAttendance(schoolA.id, uRajesh.id, {
      academic_session_id: sessA2.id,
      location_id: locA1.id,
      class_id: cls10.id,
      section_id: secA.id,
      attendance_date: '2026-09-10',
      records: [
        {
          user_id: uAarav.id,
          student_enrollment_id: enrollAarav10A.id,
          status: 'PRESENT',
          remarks: 'Present on time',
        },
        {
          user_id: uDiya.id,
          student_enrollment_id: enrollDiya10A.id,
          status: 'ABSENT',
          remarks: 'Sick leave',
        },
      ],
    });

    assert.strictEqual(saveResult.saved_count, 2);
    assert.strictEqual(saveResult.summary.present_count, 1);
    assert.strictEqual(saveResult.summary.absent_count, 1);
    assert.strictEqual(saveResult.summary.attendance_percentage, 50);

    // Verify persisted in database
    const loaded = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-10'
    );

    const aarav = loaded.students.find((s) => s.user_id === uAarav.id)!;
    const diya = loaded.students.find((s) => s.user_id === uDiya.id)!;
    assert.strictEqual(aarav.status, 'PRESENT');
    assert.strictEqual(diya.status, 'ABSENT');
  });

  test('5. Duplicate Prevention: Updating attendance modifies the existing row without creating duplicates', async () => {
    const beforeCount = mem.findAll('user_attendance').length;

    // Change Diya from ABSENT to PRESENT for 2026-09-10
    await attendanceService.saveStudentAttendance(schoolA.id, uRajesh.id, {
      academic_session_id: sessA2.id,
      location_id: locA1.id,
      class_id: cls10.id,
      section_id: secA.id,
      attendance_date: '2026-09-10',
      records: [
        {
          user_id: uDiya.id,
          student_enrollment_id: enrollDiya10A.id,
          status: 'PRESENT',
          remarks: 'Attended after medical checkup',
        },
      ],
    });

    const afterCount = mem.findAll('user_attendance').length;
    assert.strictEqual(afterCount, beforeCount, 'Total rows in user_attendance must remain identical on edit');

    const loaded = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-10'
    );
    const diya = loaded.students.find((s) => s.user_id === uDiya.id)!;
    assert.strictEqual(diya.status, 'PRESENT');
  });

  // ----------------------------------------------------------------------
  // 4. Isolation Boundaries (Class, Section, Session, Branch, Tenant)
  // ----------------------------------------------------------------------
  test('6. Class & Section Isolation: Class 10-A attendance does not appear in Class 10-B or Class 9-A', async () => {
    const roster10B = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secB.id,
      '2026-09-09'
    );
    assert.strictEqual(roster10B.students.length, 0, 'No students enrolled in 10-B should match 10-A');

    const roster9A = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls9.id,
      secA.id,
      '2026-09-09'
    );
    assert.strictEqual(roster9A.students.length, 0, 'No students enrolled in 9-A should match 10-A');
  });

  test('7. Academic Session Isolation: Historical 2025-26 enrollment attendance is separate from 2026-27', async () => {
    const roster2025 = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA1.id,
      locA1.id,
      cls9.id,
      secB.id,
      '2026-09-09'
    );
    // On 2026-09-09, the 2025-26 session has no attendance
    assert.strictEqual(roster2025.summary.present_count, 0);
  });

  test('8. Multi-Tenant Isolation: School B cannot view or modify School A attendance', async () => {
    const schoolBRoster = await attendanceService.getStudentAttendanceRoster(
      schoolB.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-09'
    );
    assert.strictEqual(schoolBRoster.students.length, 0, 'School B must see 0 students for School A context');

    await assert.rejects(
      async () => {
        await attendanceService.saveStudentAttendance(schoolB.id, 'intruder-id', {
          academic_session_id: sessA2.id,
          location_id: locA1.id,
          class_id: cls10.id,
          section_id: secA.id,
          attendance_date: '2026-09-09',
          records: [
            {
              user_id: uAarav.id,
              student_enrollment_id: enrollAarav10A.id,
              status: 'PRESENT',
            },
          ],
        });
      },
      /Invalid or unauthorized student enrollment ID/,
      'School B must not be able to save attendance for School A enrollment'
    );
  });

  // ----------------------------------------------------------------------
  // 5. Staff & Faculty Attendance
  // ----------------------------------------------------------------------
  test('9. Staff Roster: Loads staff members assigned to the branch', async () => {
    const result = await attendanceService.getStaffAttendanceRoster(schoolA.id, locA1.id, '2026-09-09');

    assert.ok(result.staff.length > 0, 'Staff roster must have entries for locA1');
    const rajesh = result.staff.find((s) => s.user_id === uRajesh.id);
    const vikram = result.staff.find((s) => s.user_id === uVikram.id);

    assert.ok(rajesh, 'Teacher Rajesh must appear as staff');
    assert.ok(vikram, 'Teacher Vikram must appear as staff');
    assert.strictEqual(rajesh?.check_in_time, '08:42');
    assert.strictEqual(rajesh?.check_out_time, '16:35');
    assert.strictEqual(rajesh?.late_minutes, 12);
  });

  test('10. Staff Save & Late Calculation: Check-in after 08:30 calculates late arrival minutes', async () => {
    const saveResult = await attendanceService.saveStaffAttendance(schoolA.id, uSuperA.id, {
      location_id: locA1.id,
      attendance_date: '2026-09-10',
      records: [
        {
          user_id: uRajesh.id,
          status: 'LATE',
          check_in_time: '08:45',
          check_out_time: '16:30',
        },
        {
          user_id: uVikram.id,
          status: 'PRESENT',
          check_in_time: '08:20',
          check_out_time: '16:30',
        },
      ],
    });

    assert.strictEqual(saveResult.saved_count, 2);
    const loaded = await attendanceService.getStaffAttendanceRoster(schoolA.id, locA1.id, '2026-09-10');
    const rajesh = loaded.staff.find((s) => s.user_id === uRajesh.id)!;
    const vikram = loaded.staff.find((s) => s.user_id === uVikram.id)!;

    assert.strictEqual(rajesh.late_minutes, 15, '08:45 check-in should result in 15 late minutes (cutoff 08:30)');
    assert.strictEqual(vikram.late_minutes, 0, '08:20 check-in is on time');
  });

  // ----------------------------------------------------------------------
  // 6. Attendance History & Dashboard
  // ----------------------------------------------------------------------
  test('11. Attendance History: Computes accurate summary metrics across date range', async () => {
    const history = await attendanceService.getAttendanceHistory(schoolA.id, {
      startDate: '2026-09-01',
      endDate: '2026-09-15',
      attendanceType: 'STUDENT',
      userId: uAarav.id,
    });

    assert.ok(history.records.length >= 2, 'Aarav should have multiple attendance records');
    assert.ok(history.summary.attendance_percentage >= 50);
  });

  test('12. Attendance Dashboard: Returns KPIs for both students and staff', async () => {
    const dashboard = await attendanceService.getAttendanceDashboard(schoolA.id, locA1.id, '2026-09-09', sessA2.id);

    assert.strictEqual(dashboard.date, '2026-09-09');
    assert.ok(dashboard.student_summary.total_count >= 2);
    assert.ok(dashboard.staff_summary.total_count >= 2);
    assert.ok(dashboard.class_breakdown.length > 0);
  });

  // ----------------------------------------------------------------------
  // 7. Security & Validation Rules
  // ----------------------------------------------------------------------
  test('13. Validation: Rejects invalid attendance status', async () => {
    await assert.rejects(
      async () => {
        await attendanceService.saveStudentAttendance(schoolA.id, uRajesh.id, {
          academic_session_id: sessA2.id,
          location_id: locA1.id,
          class_id: cls10.id,
          section_id: secA.id,
          attendance_date: '2026-09-10',
          records: [
            {
              user_id: uAarav.id,
              student_enrollment_id: enrollAarav10A.id,
              status: 'PARTYING',
            },
          ],
        });
      },
      /Invalid attendance status/,
      'Must reject unrecognized status'
    );
  });

  test('14. Audit Log: Modifying attendance records change reason and audit trail', async () => {
    await attendanceService.saveStudentAttendance(schoolA.id, uRajesh.id, {
      academic_session_id: sessA2.id,
      location_id: locA1.id,
      class_id: cls10.id,
      section_id: secA.id,
      attendance_date: '2026-09-10',
      records: [
        {
          user_id: uAarav.id,
          student_enrollment_id: enrollAarav10A.id,
          status: 'ABSENT',
          remarks: 'Reported fever by parent',
        },
      ],
    });

    const auditLogs = mem.findAll('attendance_audit_log', (log: any) => log.user_id === uAarav.id);
    assert.ok(auditLogs.length > 0, 'Audit log must be created when status is modified');
    assert.strictEqual(auditLogs[auditLogs.length - 1].new_status, 'ABSENT');
  });

  // ----------------------------------------------------------------------
  // 8. Master Data Integration & Roster Dependency Tests
  // ----------------------------------------------------------------------
  test('15. Master Data Integration: Authoritative sessions, branches, classes, and sections match school context', async () => {
    // School A must have session 2026-27 and Dwarka Main branch
    const sessions = mem.findAll('academic_sessions', (s: AcademicSession) => s.school_id === schoolA.id);
    assert.ok(sessions.some((s) => s.name === '2026-27' && s.is_current), 'Active session 2026-27 must be present');

    const locations = mem.findAll('locations', (l: Location) => l.school_id === schoolA.id);
    assert.ok(locations.some((l) => l.location_code === 'DEL-MAIN'), 'Dwarka Main Campus must be present');

    const classes = mem.findAll('classes', (c: ClassItem) => c.school_id === schoolA.id);
    assert.ok(classes.some((c) => c.name === '10' || c.display_name === 'Class 10' || c.name === 'Class 10'), 'Class 10 must be present');
  });

  test('16. Class-Section Dependency: Querying roster requires matching class and section from enrollments', async () => {
    // Class 10-A has 2 enrolled students (Aarav, Diya)
    const roster10A = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-11'
    );
    assert.strictEqual(roster10A.students.length, 2, 'Class 10-A must have 2 enrolled students');

    // Class 10-B has 0 students enrolled in 2026-27 at Dwarka Main
    const roster10B = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secB.id,
      '2026-09-11'
    );
    assert.strictEqual(roster10B.students.length, 0, 'Class 10-B must have 0 enrolled students');
  });

  test('17. Student Roster Hydration: Full name, admission number, roll number, and status properly populated', async () => {
    const roster = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      cls10.id,
      secA.id,
      '2026-09-11'
    );

    const aarav = roster.students.find((s) => s.user_id === uAarav.id);
    assert.ok(aarav, 'Aarav must be present in roster');
    assert.strictEqual(aarav.display_name, 'Aarav Sharma');
    assert.strictEqual(aarav.admission_number, 'DPA-2026-0001');
    assert.strictEqual(aarav.roll_number, '1001');
    assert.ok(aarav.status, 'Status must be defined');
  });

  test('18. Empty State Isolation: Non-existent class/section yields empty roster without crashing', async () => {
    const fakeClassId = 'c0000000-0000-0000-0000-000000000999';
    const fakeSectionId = 'd0000000-0000-0000-0000-000000000999';

    const roster = await attendanceService.getStudentAttendanceRoster(
      schoolA.id,
      sessA2.id,
      locA1.id,
      fakeClassId,
      fakeSectionId,
      '2026-09-11'
    );

    assert.strictEqual(roster.students.length, 0, 'Non-existent class/section must return 0 students');
    assert.strictEqual(roster.summary.total, 0, 'Summary total must be 0');
  });

  test('19. Academic Class-Section Offerings: Hydrates section and section_name correctly', async () => {
    const offerings = await academicRepository.findClassSections(schoolA.id, sessA2.id, cls10.id);
    assert.ok(offerings.length > 0, 'Class 10 must have configured offerings');
    for (const off of offerings) {
      assert.ok(off.section, 'Section object must be hydrated on class-section offering');
      assert.ok(off.section.name, 'Section name must not be empty or undefined');
      assert.notStrictEqual(off.section.name, 'Section', 'Section name must not be the fallback placeholder "Section"');
      assert.ok(['A', 'B', 'C'].includes(off.section.name), `Expected section name to be A, B, or C, got: ${off.section.name}`);
      assert.strictEqual(off.section_name, off.section.name, 'section_name must match section.name');
    }
  });
});
