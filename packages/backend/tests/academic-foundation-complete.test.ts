// ========================================================================
// Academic Foundation Complete - Acceptance Verification Tests
// Tests the 8 core acceptance criteria from the audit & correction phase
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { authService } from '../src/services/auth.service.js';
import { academicService } from '../src/services/academic.service.js';
import { peopleService } from '../src/services/people.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { academicRepository } from '../src/repositories/academic.repository.js';
import academicRouter from '../src/routes/academic.routes.js';

describe('Academic Foundation Complete Verification (Phase 19)', () => {
  let directorAContext: any;
  let teacherAContext: any;
  let schoolAId: string;
  let branchA1Id: string;
  let directorAToken: string;
  let teacherAToken: string;

  before(async () => {
    createApp();

    // Login Director A (Full permissions)
    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    directorAToken = loginDirectorA.token;
    schoolAId = directorAContext.school_id!;
    branchA1Id = directorAContext.branch_id || 'a1000000-0000-0000-0000-000000000001';

    // Login Teacher A (Restricted permissions)
    const loginTeacherA = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    teacherAContext = loginTeacherA.context;
    teacherAToken = loginTeacherA.token;
  });

  // ----------------------------------------------------------------------
  // Requirement 1: ClassSectionSetupModule endpoint & payload verification
  // ----------------------------------------------------------------------
  test('Requirement 1: POST /academics/class-sections creates class section mapping with academic_session_id', async () => {
    const session = await academicService.getCurrentSession(schoolAId);
    const sections = await academicService.listSections(schoolAId);

    // Create a new class section pairing
    const newClass = await academicService.createClass(
      schoolAId,
      { name: 'Grade Test R1', code: `CLS-R1-${Date.now()}` },
      directorAContext
    );

    let responseData: any = null;
    let statusCode = 200;

    const mockReq: any = {
      method: 'POST',
      url: '/class-sections',
      headers: { authorization: `Bearer ${directorAToken}` },
      query: {},
      params: {},
      body: {
        academic_session_id: session.id,
        class_id: newClass.id,
        section_id: sections[0].id,
        capacity: 45,
      },
    };

    await new Promise<void>((resolve) => {
      const mockRes: any = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { responseData = data; resolve(); },
      };
      academicRouter(mockReq, mockRes, () => resolve());
    });

    assert.strictEqual(statusCode, 201, 'Should return 201 Created');
    assert.strictEqual(responseData?.success, true);
    assert.strictEqual(responseData?.data?.academic_session_id, session.id);
    assert.strictEqual(responseData?.data?.class_id, newClass.id);
    assert.strictEqual(responseData?.data?.section_id, sections[0].id);
    assert.strictEqual(responseData?.data?.capacity, 45);
  });

  // ----------------------------------------------------------------------
  // Requirement 2: SubjectOfferingsModule endpoint & payload verification
  // ----------------------------------------------------------------------
  test('Requirement 2: POST /academics/class-subjects creates subject offering with academic_session_id', async () => {
    const session = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);
    const subjects = await academicService.listSubjects(schoolAId);

    let responseData: any = null;
    let statusCode = 200;

    const mockReq: any = {
      method: 'POST',
      url: '/class-subjects',
      headers: { authorization: `Bearer ${directorAToken}` },
      query: {},
      params: {},
      body: {
        academic_session_id: session.id,
        class_id: classes[0].id,
        subject_id: subjects[0].id,
        is_required: true,
        subject_type: 'THEORY',
        credits: 3,
        max_marks: 100,
      },
    };

    await new Promise<void>((resolve) => {
      const mockRes: any = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { responseData = data; resolve(); },
      };
      academicRouter(mockReq, mockRes, () => resolve());
    });

    assert.strictEqual(statusCode, 201, 'Should return 201 Created');
    assert.strictEqual(responseData?.success, true);
    assert.strictEqual(responseData?.data?.academic_session_id, session.id);
    assert.strictEqual(responseData?.data?.class_id, classes[0].id);
    assert.strictEqual(responseData?.data?.subject_id, subjects[0].id);
  });

  // ----------------------------------------------------------------------
  // Requirement 3: MyTeachingScheduleModule endpoint verification
  // ----------------------------------------------------------------------
  test('Requirement 3: GET /academics/my-teaching-responsibilities returns teacher responsibilities', async () => {
    let responseData: any = null;
    let statusCode = 200;

    const mockReq: any = {
      method: 'GET',
      url: '/my-teaching-responsibilities',
      headers: { authorization: `Bearer ${teacherAToken}` },
      query: {},
      params: {},
    };

    await new Promise<void>((resolve) => {
      const mockRes: any = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { responseData = data; resolve(); },
      };
      academicRouter(mockReq, mockRes, () => resolve());
    });

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData?.success, true);
    assert.ok(Array.isArray(responseData?.data), 'Returns an array of responsibilities');
    assert.ok(responseData.data.length >= 1, 'Teacher Vikram has seeded responsibilities');
    const first = responseData.data[0];
    assert.ok(first.class_name, 'Responsibility includes class_name');
    assert.ok(first.section_name, 'Responsibility includes section_name');
    assert.ok(first.subject_name, 'Responsibility includes subject_name');
    assert.ok(first.session_name, 'Responsibility includes session_name');
  });

  // ----------------------------------------------------------------------
  // Requirement 4: Onboarding student auto-creates authoritative enrollment
  // ----------------------------------------------------------------------
  test('Requirement 4: Student creation automatically produces authoritative student_academic_enrollments record', async () => {
    const uniqueId = Date.now().toString().slice(-4);
    const student = await peopleService.createStudent(
      schoolAId,
      {
        username: `admit.test.${uniqueId}`,
        first_name: 'Admitted',
        last_name: 'Student',
        email: `admit.${uniqueId}@test.dpa.edu`,
        location_id: branchA1Id,
        gender: 'MALE',
        admission_number: `ADM-REQ4-${uniqueId}`,
        class_name: 'Class 10',
        section_name: 'A',
      },
      directorAContext.user_id
    );

    assert.ok(student);
    assert.strictEqual(student.student_profile?.admission_number, `ADM-REQ4-${uniqueId}`);

    // Verify record in student_academic_enrollments table
    const activeEnrollment = await academicRepository.findActiveEnrollmentForStudent(schoolAId, student.id);
    assert.ok(activeEnrollment, 'Must have active enrollment in student_academic_enrollments');
    assert.strictEqual(activeEnrollment.student_user_id, student.id);
    assert.strictEqual(activeEnrollment.admission_number, `ADM-REQ4-${uniqueId}`);
    assert.strictEqual(activeEnrollment.enrollment_status, 'ENROLLED');
  });

  // ----------------------------------------------------------------------
  // Requirement 5: Section transfer keeps student_profiles synchronized
  // ----------------------------------------------------------------------
  test('Requirement 5: Section transfer keeps student_profiles in sync with target class and section', async () => {
    // Look up an existing enrolled student in School A (e.g. Aarav)
    const aarav = await userRepository.findByUsername('aarav.sharma');
    assert.ok(aarav);
    const initialEnrollment = await academicRepository.findActiveEnrollmentForStudent(schoolAId, aarav.id);
    assert.ok(initialEnrollment);

    // Get Class 10 and Section B
    const classes = await academicService.listClasses(schoolAId);
    const sections = await academicService.listSections(schoolAId);
    const cls10 = classes.find(c => c.code === 'CLS-10')!;
    const secB = sections.find(s => s.name === 'B')!;

    // Perform section transfer to Section B
    const transferred = await academicService.transferStudentSection(
      schoolAId,
      initialEnrollment.id,
      { target_class_id: cls10.id, target_section_id: secB.id, roll_number: '1099' },
      directorAContext
    );

    assert.strictEqual(transferred.section_id, secB.id);
    assert.strictEqual(transferred.roll_number, '1099');

    // Re-fetch hydrated student from userRepository
    const hydratedAarav = await userRepository.findById(aarav.id, schoolAId);
    assert.ok(hydratedAarav?.student_profile);
    assert.ok(hydratedAarav.student_profile.section_name.includes('B'), 'student_profile.section_name must reflect new section B');
    assert.strictEqual(hydratedAarav.student_profile.roll_number, '1099');
  });

  // ----------------------------------------------------------------------
  // Requirement 6: student_academic_enrollments is authoritative across sessions
  // ----------------------------------------------------------------------
  test('Requirement 6: student_academic_enrollments preserves historical progression across sessions', async () => {
    const aarav = await userRepository.findByUsername('aarav.sharma');
    assert.ok(aarav);

    const history = await academicRepository.findStudentAcademicHistory(schoolAId, aarav.id);
    assert.ok(history.length >= 2, 'Aarav has at least 2 sessions of enrollment history');

    // Check that historical session (2025-26) and current session (2026-27) both exist
    const has2025 = history.some(h => h.session?.code === 'AY2025-26');
    const has2026 = history.some(h => h.session?.code === 'AY2026-27');
    assert.ok(has2025, 'History must include 2025-26 enrollment');
    assert.ok(has2026, 'History must include 2026-27 enrollment');
  });

  // ----------------------------------------------------------------------
  // Requirement 7: Rights Master permission enforcement rejects unauthorized users
  // ----------------------------------------------------------------------
  test('Requirement 7: Backend rejects unauthorized mutations with 403 Forbidden', async () => {
    // Teacher Vikram has classes.view but NOT classes.manage or sections.manage
    let statusCode = 200;
    let responseData: any = null;

    const mockReq: any = {
      method: 'POST',
      url: '/classes',
      headers: { authorization: `Bearer ${teacherAToken}` },
      query: {},
      params: {},
      body: { name: 'Unauthorized Class', code: 'CLS-UNAUTH' },
    };

    await new Promise<void>((resolve) => {
      const mockRes: any = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { responseData = data; resolve(); },
      };
      academicRouter(mockReq, mockRes, () => resolve());
    });

    assert.strictEqual(statusCode, 403, 'Must return 403 Forbidden for missing classes.manage permission');
    assert.strictEqual(responseData?.error?.code, 'PERMISSION_DENIED');
  });

  // ----------------------------------------------------------------------
  // Requirement 8: Rights Master student assignment permission enforcement
  // ----------------------------------------------------------------------
  test('Requirement 8: Student enrollment strictly requires students.class_assign permission', async () => {
    let statusCode = 200;
    let responseData: any = null;

    const session = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);
    const sections = await academicService.listSections(schoolAId);

    const mockReq: any = {
      method: 'POST',
      url: '/student-enrollments',
      headers: { authorization: `Bearer ${teacherAToken}` },
      query: {},
      params: {},
      body: {
        student_user_id: 'some-id',
        academic_session_id: session.id,
        location_id: branchA1Id,
        class_id: classes[0].id,
        section_id: sections[0].id,
      },
    };

    await new Promise<void>((resolve) => {
      const mockRes: any = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { responseData = data; resolve(); },
      };
      academicRouter(mockReq, mockRes, () => resolve());
    });

    assert.strictEqual(statusCode, 403, 'Must return 403 Forbidden for missing students.class_assign permission');
  });
});
