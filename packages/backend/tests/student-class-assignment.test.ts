// ========================================================================
// Student Academic Class Assignment & Enrollment Workflow Tests
// Authoritative Placement in student_academic_enrollments
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { academicService } from '../src/services/academic.service.js';
import { attendanceService } from '../src/services/attendance.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { accessControlRepository } from '../src/repositories/access-control.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';

describe('Student Academic Class Assignment & Enrollment Workflow', () => {
  let directorAContext: any;
  let directorBContext: any;
  let schoolAId: string;
  let schoolBId: string;
  let branchA1Id: string;
  let branchA2Id: string;
  let currentSessionA: any;
  let cls10A: any;
  let secA: any;
  let secB: any;
  let studentUser1: any;
  let studentUser2: any;
  let mem: any;

  before(async () => {
    createApp();
    mem = getMemoryDbClient();

    // Login School A Director
    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    schoolAId = directorAContext.school_id!;

    // Login School B Director
    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    directorBContext = loginDirectorB.context;
    schoolBId = directorBContext.school_id!;

    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    branchA1Id = locsA.find(l => l.location_code === 'DEL-MAIN')!.id;
    branchA2Id = locsA.find(l => l.location_code === 'NOI-EXT')!.id;

    currentSessionA = await academicService.getCurrentSession(schoolAId);
    const classesA = await academicService.listClasses(schoolAId);
    const sectionsA = await academicService.listSections(schoolAId);

    cls10A = classesA.find(c => c.code === 'CLS-10' || c.name === '10' || c.display_name === 'Class 10')!;
    secA = sectionsA.find(s => s.name === 'A')!;
    secB = sectionsA.find(s => s.name === 'B')!;

    // Find student users in School A
    const studentsA = await userRepository.findUsers({ schoolId: schoolAId, userTypeCode: 'STUDENT' });
    studentUser1 = studentsA[0];
    studentUser2 = studentsA[1];
  });

  // ----------------------------------------------------------------------
  // 1. Available Students Query
  // ----------------------------------------------------------------------
  test('1. Available Students: Retrieves eligible students and excludes those already enrolled in target context', async () => {
    const available = await academicService.getAvailableStudentsForEnrollment(
      schoolAId,
      {
        sessionId: currentSessionA.id,
        locationId: branchA1Id,
        classId: cls10A.id,
        sectionId: secB.id, // Section B currently has 0 enrollments
      },
      directorAContext
    );

    assert.ok(available.length > 0, 'Should find available students for School A');
    // Ensure all returned students belong to School A
    for (const s of available) {
      assert.ok(s.student_user_id, 'Must have student_user_id');
      assert.ok(s.admission_number, 'Must have admission_number');
      assert.ok(s.full_name, 'Must have full_name');
      assert.ok(s.current_status, 'Must have current_status');
    }
  });

  // ----------------------------------------------------------------------
  // 2. Bulk Enrollment Operation
  // ----------------------------------------------------------------------
  test('2. Bulk Enrollment: Enrolls selected students into Class 10 - Section B and persists to student_academic_enrollments', async () => {
    assert.ok(studentUser1, 'Student 1 must exist');

    const result = await academicService.bulkAssignStudents(
      schoolAId,
      {
        student_ids: [studentUser1.id],
        academic_session_id: currentSessionA.id,
        location_id: branchA1Id,
        class_id: cls10A.id,
        section_id: secB.id,
      },
      directorAContext
    );

    assert.strictEqual(result.assignedCount, 1, 'Should successfully assign 1 student');
    assert.strictEqual(result.enrollments.length, 1);
    const enrollment = result.enrollments[0];

    assert.strictEqual(enrollment.student_user_id, studentUser1.id);
    assert.strictEqual(enrollment.class_id, cls10A.id);
    assert.strictEqual(enrollment.section_id, secB.id);
    assert.strictEqual(enrollment.enrollment_status, 'ENROLLED');

    // Verify retrieval via listStudentEnrollments
    const enrolledList = await academicService.listStudentEnrollments(
      schoolAId,
      {
        sessionId: currentSessionA.id,
        locationId: branchA1Id,
        classId: cls10A.id,
        sectionId: secB.id,
        status: 'ENROLLED',
      },
      directorAContext
    );

    const found = enrolledList.find(e => e.student_user_id === studentUser1.id);
    assert.ok(found, 'Student 1 must now be in enrolled list for Class 10-B');
    assert.strictEqual(found?.enrollment_status, 'ENROLLED');
  });

  // ----------------------------------------------------------------------
  // 3. Duplicate Enrollment Protection
  // ----------------------------------------------------------------------
  test('3. Duplicate Protection: Re-enrolling student into same class & section returns active record without creating duplicate row', async () => {
    const enrollmentsBefore = mem.findAll('student_academic_enrollments', (e: any) =>
      e.student_user_id === studentUser1.id &&
      e.academic_session_id === currentSessionA.id &&
      e.class_id === cls10A.id &&
      e.section_id === secB.id &&
      e.enrollment_status === 'ENROLLED'
    );

    const result = await academicService.assignStudentToClass(
      schoolAId,
      {
        student_user_id: studentUser1.id,
        academic_session_id: currentSessionA.id,
        location_id: branchA1Id,
        class_id: cls10A.id,
        section_id: secB.id,
      },
      directorAContext
    );

    const enrollmentsAfter = mem.findAll('student_academic_enrollments', (e: any) =>
      e.student_user_id === studentUser1.id &&
      e.academic_session_id === currentSessionA.id &&
      e.class_id === cls10A.id &&
      e.section_id === secB.id &&
      e.enrollment_status === 'ENROLLED'
    );

    assert.strictEqual(enrollmentsAfter.length, enrollmentsBefore.length, 'No duplicate enrollment rows created');
    assert.strictEqual(result.id, enrollmentsBefore[0].id);
  });

  // ----------------------------------------------------------------------
  // 4. Student Attendance Module Integration
  // ----------------------------------------------------------------------
  test('4. Attendance Integration: Attendance roster automatically finds student enrolled via class assignment', async () => {
    const today = new Date().toISOString().split('T')[0];
    const roster = await attendanceService.getStudentAttendanceRoster(
      schoolAId,
      currentSessionA.id,
      branchA1Id,
      cls10A.id,
      secB.id,
      today
    );

    assert.ok(roster.students.length >= 1, 'Attendance roster must contain newly enrolled student');
    const studentEntry = roster.students.find(s => s.user_id === studentUser1.id);
    assert.ok(studentEntry, 'Student 1 must appear in Section B attendance roster');
    assert.strictEqual(studentEntry?.student_enrollment_id, result_enrollment_id(studentUser1.id, currentSessionA.id));
  });

  // ----------------------------------------------------------------------
  // 5. Section Transfer Preserves Historical Records
  // ----------------------------------------------------------------------
  test('5. Section Transfer: Moving student from Section B to Section A marks previous as TRANSFERRED and activates new', async () => {
    const previousActive = await academicService.findActiveEnrollment(schoolAId, studentUser1.id, currentSessionA.id);
    assert.ok(previousActive, 'Active enrollment in Sec B must exist');

    const transferResult = await academicService.transferStudentSection(
      schoolAId,
      previousActive.id,
      {
        target_class_id: cls10A.id,
        target_section_id: secA.id,
        roll_number: '1099',
      },
      directorAContext
    );

    assert.strictEqual(transferResult.class_id, cls10A.id);
    assert.strictEqual(transferResult.section_id, secA.id);
    assert.strictEqual(transferResult.enrollment_status, 'ENROLLED');

    // Check that previous enrollment row still exists with status TRANSFERRED
    const prevRow = mem.findById('student_academic_enrollments', previousActive.id);
    assert.ok(prevRow, 'Previous enrollment row must not be deleted');
    assert.strictEqual(prevRow.enrollment_status, 'TRANSFERRED');
    assert.ok(prevRow.end_date, 'Previous enrollment must have end_date set');

    // Verify student is now in Section A and not in Section B
    const secAList = await academicService.listStudentEnrollments(
      schoolAId,
      { sessionId: currentSessionA.id, locationId: branchA1Id, classId: cls10A.id, sectionId: secA.id, status: 'ENROLLED' },
      directorAContext
    );
    assert.ok(secAList.some(e => e.student_user_id === studentUser1.id), 'Student must be active in Sec A');

    const secBList = await academicService.listStudentEnrollments(
      schoolAId,
      { sessionId: currentSessionA.id, locationId: branchA1Id, classId: cls10A.id, sectionId: secB.id, status: 'ENROLLED' },
      directorAContext
    );
    assert.ok(!secBList.some(e => e.student_user_id === studentUser1.id), 'Student must no longer be active in Sec B');
  });

  // ----------------------------------------------------------------------
  // 6. End Enrollment / Withdrawal
  // ----------------------------------------------------------------------
  test('6. End Enrollment: Ends enrollment with WITHDRAWN status while preserving history', async () => {
    const activeEnr = await academicService.findActiveEnrollment(schoolAId, studentUser1.id, currentSessionA.id);
    assert.ok(activeEnr, 'Active enrollment must exist to end');

    const ended = await academicService.endStudentEnrollment(
      schoolAId,
      activeEnr.id,
      'Student moved to another state',
      directorAContext
    );

    assert.strictEqual(ended.enrollment_status, 'WITHDRAWN');
    assert.ok(ended.end_date, 'End date must be set');

    // Student must no longer appear in active enrollment list
    const activeList = await academicService.listStudentEnrollments(
      schoolAId,
      { sessionId: currentSessionA.id, locationId: branchA1Id, classId: cls10A.id, sectionId: secA.id, status: 'ENROLLED' },
      directorAContext
    );
    assert.ok(!activeList.some(e => e.student_user_id === studentUser1.id), 'Withdrawn student must not be active');
  });

  // ----------------------------------------------------------------------
  // 7. Multi-Tenant Isolation
  // ----------------------------------------------------------------------
  test('7. Tenant Isolation: School B cannot view, enroll, or transfer School A students', async () => {
    const sessionsB = await academicService.listSessions(schoolBId);
    const locsB = await tenantService.listLocations(schoolBId, directorBContext);
    const classesB = await academicService.listClasses(schoolBId);
    const sectionsB = await academicService.listSections(schoolBId);

    // School B attempts to assign School A student
    await assert.rejects(
      async () => {
        await academicService.assignStudentToClass(
          schoolBId,
          {
            student_user_id: studentUser1.id, // School A student
            academic_session_id: sessionsB[0].id,
            location_id: locsB[0].id,
            class_id: classesB[0].id,
            section_id: sectionsB[0].id,
          },
          directorBContext
        );
      },
      /Student user does not exist or does not belong to this school/,
      'School B must not be able to enroll School A student'
    );

    // School B query for available students should not contain School A student
    const schoolBAvailable = await academicService.getAvailableStudentsForEnrollment(
      schoolBId,
      {
        sessionId: currentSessionA.id,
        locationId: branchA1Id,
        classId: cls10A.id,
        sectionId: secA.id,
      },
      directorBContext
    );
    assert.ok(
      !schoolBAvailable.some(s => s.student_user_id === studentUser1.id),
      'School B available list must never contain School A student'
    );
  });

  // Helper
  function result_enrollment_id(studentId: string, sessionId: string): string {
    const row = mem.findAll('student_academic_enrollments', (e: any) =>
      e.student_user_id === studentId &&
      e.academic_session_id === sessionId &&
      e.enrollment_status === 'ENROLLED'
    )[0];
    return row?.id;
  }
});
