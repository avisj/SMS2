// ========================================================================
// Teacher Timetable / My Teaching Schedule - Automated Test Suite
// Verifies derived schedule from Timetable Master + Details, dynamic working days,
// teacher filtering, security/authorization, multi-branch, and tenant isolation.
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { authService } from '../src/services/auth.service.js';
import { academicService } from '../src/services/academic.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { timetableService } from '../src/services/timetable.service.js';
import { academicRepository } from '../src/repositories/academic.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { timetableRepository } from '../src/repositories/timetable.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';
import { hashPassword } from '../src/utils/password.js';

describe('Teacher Timetable / My Teaching Schedule (Derived Architecture)', () => {
  let directorAContext: any;
  let teacherVikramContext: any;
  let teacherPriyaContext: any;
  let directorBContext: any;

  let schoolAId: string;
  let schoolBId: string;
  let branchA1Id: string;
  let branchA2Id: string;
  let unauthorizedBranchId: string;
  let currentSessionAId: string;

  let class10Id: string;
  let sectionAId: string;
  let mathSubjectId: string;
  let engSubjectId: string;

  let teacherVikramId: string;
  let teacherPriyaId: string;

  let activeMasterId: string;

  before(async () => {
    seedInMemoryDatabase();
    createApp();

    // 1. Authenticate Director for School A
    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    schoolAId = directorAContext.school_id!;

    // 2. Authenticate Director for School B
    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    directorBContext = loginDirectorB.context;
    schoolBId = directorBContext.school_id!;

    // 3. Resolve School A Locations
    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    const delMain = locsA.find((l) => l.location_code === 'DEL-MAIN');
    assert.ok(delMain, 'DEL-MAIN location must exist');
    branchA1Id = delMain.id;

    // Second location (Noida Extension Campus) that Vikram also has access to in seed
    const delNoi = locsA.find((l) => l.location_code === 'NOI-EXT');
    assert.ok(delNoi, 'Noida location must exist');
    branchA2Id = delNoi.id;

    // Third location (South Campus) that Vikram does NOT have access to
    const loc3 = await tenantService.createLocation(
      schoolAId,
      {
        location_code: 'DEL-SOUTH',
        location_name: 'Delhi South Campus',
        status: 'ACTIVE',
      },
      directorAContext
    );
    unauthorizedBranchId = loc3.id;

    // 4. Resolve Current Session
    const currSession = await academicService.getCurrentSession(schoolAId);
    assert.ok(currSession, 'Current academic session must exist');
    currentSessionAId = currSession.id;

    // 5. Resolve Class, Section, Subjects
    const classes = await academicService.listClasses(schoolAId);
    const cls10 = classes.find((c) => c.code === 'CLS-10');
    assert.ok(cls10, 'Class 10 must exist');
    class10Id = cls10.id;

    const sections = await academicService.listSections(schoolAId);
    const secA = sections.find((s) => s.code === 'SEC-A');
    assert.ok(secA, 'Section A must exist');
    sectionAId = secA.id;

    const subjects = await academicService.listSubjects(schoolAId);
    const mathSub = subjects.find((s) => s.code === 'SUB-MATH');
    const engSub = subjects.find((s) => s.code === 'SUB-ENG');
    assert.ok(mathSub && engSub, 'Math and English subjects must exist');
    mathSubjectId = mathSub.id;
    engSubjectId = engSub.id;

    // 6. Find Vikram Verma and Priya Nair
    const userVikram = await userRepository.findByUsername('vikram.verma', schoolAId);
    assert.ok(userVikram, 'Vikram Verma user must exist');
    teacherVikramId = userVikram.id;

    const userPriya = await userRepository.findByUsername('priya.nair', schoolAId);
    assert.ok(userPriya, 'Priya Nair user must exist');
    teacherPriyaId = userPriya.id;

    // Login Vikram Verma
    const loginVikram = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    teacherVikramContext = loginVikram.context;

    // Create login credential for Priya Nair
    const mem = getMemoryDbClient();
    mem.insert('user_credentials', {
      id: crypto.randomUUID(),
      user_id: userPriya.id,
      school_id: schoolAId,
      location_id: branchA1Id,
      school_id_code: 'DPA-DEL-001',
      username: 'priya.nair',
      password_hash: hashPassword('password123'),
      login_status: 'ACTIVE',
      is_super_admin: false,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      password_changed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Login Priya Nair
    const loginPriya = await authService.login('DPA-DEL-001', 'priya.nair', 'password123');
    teacherPriyaContext = loginPriya.context;

    // 7. Ensure teacher subject assignments exist
    await academicRepository.createTeacherAssignment({
      school_id: schoolAId,
      academic_session_id: currentSessionAId,
      location_id: branchA1Id,
      class_id: class10Id,
      section_id: sectionAId,
      subject_id: mathSubjectId,
      teacher_user_id: teacherVikramId,
      is_primary_teacher: true,
      status: 'ACTIVE',
    });

    await academicRepository.createTeacherAssignment({
      school_id: schoolAId,
      academic_session_id: currentSessionAId,
      location_id: branchA1Id,
      class_id: class10Id,
      section_id: sectionAId,
      subject_id: engSubjectId,
      teacher_user_id: teacherPriyaId,
      is_primary_teacher: false,
      status: 'ACTIVE',
    });

    // 8. Create and Activate an Initial Timetable Master for School A
    const master = await timetableService.saveConfiguration(
      schoolAId,
      {
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        first_period_start_time: '08:00',
        last_period_end_time: '14:00',
        period_duration_minutes: 60,
        lunch_start_time: '11:00',
        lunch_end_time: '12:00',
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      directorAContext
    );
    activeMasterId = master.master.id;

    // Assign Period 1 on Monday to Vikram (Math)
    const assign1 = await timetableService.assignCell(
      schoolAId,
      activeMasterId,
      {
        day_of_week: 'Monday',
        period_no: 1,
        class_id: class10Id,
        section_id: sectionAId,
        subject_id: mathSubjectId,
        teacher_id: teacherVikramId,
        room_id: 'RM-101',
      },
      directorAContext
    );
    activeMasterId = assign1.master.id;

    // Assign Period 2 on Monday to Priya (English)
    const assign2 = await timetableService.assignCell(
      schoolAId,
      activeMasterId,
      {
        day_of_week: 'Monday',
        period_no: 2,
        class_id: class10Id,
        section_id: sectionAId,
        subject_id: engSubjectId,
        teacher_id: teacherPriyaId,
        room_id: 'RM-102',
      },
      directorAContext
    );
    activeMasterId = assign2.master.id;
  });

  // ======================================================================
  // Test 1: Authenticated Teacher Schedule Retrieval
  // ======================================================================
  test('Scenario 1: Authenticated teacher fetches their own schedule derived from Timetable Master', async () => {
    const result = await timetableService.getTeacherSchedule(schoolAId, teacherVikramContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
    });

    assert.ok(result.master, 'Active timetable master must be present');
    assert.strictEqual(result.master.id, activeMasterId);
    assert.strictEqual(result.working_days.length, 5);
    assert.deepStrictEqual(result.working_days, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

    // Check teacher details
    assert.strictEqual(result.teacher.id, teacherVikramId);
    assert.strictEqual(result.teacher.first_name, 'Vikram');

    // Check periods calculation
    assert.ok(result.periods.length > 0, 'Dynamic periods must be generated');
    const lunchPeriod = result.periods.find((p) => p.is_lunch);
    assert.ok(lunchPeriod, 'Lunch period must exist');
    assert.strictEqual(lunchPeriod.start_time, '11:00');
    assert.strictEqual(lunchPeriod.end_time, '12:00');

    // Details must ONLY contain Vikram's assigned cell, NOT Priya's
    assert.strictEqual(result.details.length, 1, 'Vikram should only have 1 period assigned');
    assert.strictEqual(result.details[0].teacher_id, teacherVikramId);
    assert.strictEqual(result.details[0].period_no, 1);
    assert.strictEqual(result.details[0].day_of_week, 'Monday');
    assert.strictEqual(result.details[0].subject_id, mathSubjectId);
    assert.strictEqual(result.details[0].room_id, 'RM-101');
  });

  // ======================================================================
  // Test 2: Derived Architecture & Single Source of Truth
  // ======================================================================
  test('Scenario 2: Cell assignment updates in student timetable instantly propagate to teacher schedule', async () => {
    // Check Priya's schedule before new assignment
    const priyaSchedBefore = await timetableService.getTeacherSchedule(schoolAId, teacherPriyaContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
    });
    assert.strictEqual(priyaSchedBefore.details.length, 1);
    assert.strictEqual(priyaSchedBefore.details[0].period_no, 2);

    // Assign Priya to Period 3 on Tuesday
    const assignRes = await timetableService.assignCell(
      schoolAId,
      activeMasterId,
      {
        day_of_week: 'Tuesday',
        period_no: 3,
        class_id: class10Id,
        section_id: sectionAId,
        subject_id: engSubjectId,
        teacher_id: teacherPriyaId,
        room_id: 'LAB-1',
      },
      directorAContext
    );
    activeMasterId = assignRes.master.id;

    // Immediately fetch Priya's schedule: must show 2 assigned periods
    const priyaSchedAfter = await timetableService.getTeacherSchedule(schoolAId, teacherPriyaContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
    });

    assert.strictEqual(priyaSchedAfter.master!.id, activeMasterId);
    assert.strictEqual(priyaSchedAfter.details.length, 2, 'Priya should now have 2 periods');
    const tuePeriod = priyaSchedAfter.details.find((d) => d.day_of_week === 'Tuesday');
    assert.ok(tuePeriod);
    assert.strictEqual(tuePeriod.period_no, 3);
    assert.strictEqual(tuePeriod.room_id, 'LAB-1');

    // Vikram's schedule should still strictly have his 1 assignment
    const vikramSched = await timetableService.getTeacherSchedule(schoolAId, teacherVikramContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
    });
    assert.strictEqual(vikramSched.details.length, 1);
  });

  // ======================================================================
  // Test 3: Dynamic Working Days from Timetable Configuration
  // ======================================================================
  test('Scenario 3: 6-day or custom working schedule configuration correctly reflected in teacher timetable', async () => {
    // Create new master with 6 working days (Mon-Sat)
    const master6Days = await timetableService.saveConfiguration(
      schoolAId,
      {
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        first_period_start_time: '08:30',
        last_period_end_time: '13:25',
        period_duration_minutes: 50,
        lunch_start_time: '11:00',
        lunch_end_time: '11:45',
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      },
      directorAContext
    );

    // Assign Vikram on Saturday Period 1
    const satAssign = await timetableService.assignCell(
      schoolAId,
      master6Days.master.id,
      {
        day_of_week: 'Saturday',
        period_no: 1,
        class_id: class10Id,
        section_id: sectionAId,
        subject_id: mathSubjectId,
        teacher_id: teacherVikramId,
      },
      directorAContext
    );
    activeMasterId = satAssign.master.id;

    // Fetch Vikram's schedule
    const sched = await timetableService.getTeacherSchedule(schoolAId, teacherVikramContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
    });

    assert.strictEqual(sched.master!.id, activeMasterId);
    assert.strictEqual(sched.working_days.length, 6);
    assert.ok(sched.working_days.includes('Saturday'));
    assert.strictEqual(sched.master!.period_duration_minutes, 50);

    const satSlot = sched.details.find((d) => d.day_of_week === 'Saturday');
    assert.ok(satSlot, 'Vikram must have an assignment on Saturday');
    assert.strictEqual(satSlot.period_no, 1);
  });

  // ======================================================================
  // Test 4: Free Periods and Lunch Break Non-Teaching Status
  // ======================================================================
  test('Scenario 4: Free periods are unassigned slots, lunch break is strictly non-teaching', async () => {
    const sched = await timetableService.getTeacherSchedule(schoolAId, teacherVikramContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
    });

    // Verify lunch period exists and has no teaching detail
    const lunch = sched.periods.find((p) => p.is_lunch);
    assert.ok(lunch, 'Lunch period must exist');
    assert.strictEqual(lunch.start_time, sched.master!.lunch_start_time);
    assert.strictEqual(lunch.end_time, sched.master!.lunch_end_time);

    // No detail row should ever match lunch
    const lunchDetails = sched.details.filter((d) => d.period_no === lunch.period_no);
    assert.strictEqual(lunchDetails.length, 0, 'No teaching assignments should exist during lunch');

    // Verify free periods
    const teachingPeriods = sched.periods.filter((p) => !p.is_lunch);
    const totalPossibleSlots = teachingPeriods.length * sched.working_days.length;
    const assignedSlots = sched.details.length;
    const freeSlots = totalPossibleSlots - assignedSlots;

    assert.ok(freeSlots > 0, 'Teacher must have unassigned free periods in the weekly schedule');
  });

  // ======================================================================
  // Test 5: Multi-Branch & Location Permissions
  // ======================================================================
  test('Scenario 5: Multi-branch access and isolation for teachers', async () => {
    // School A Director can view both branches
    const dirSchedA1 = await timetableService.getTeacherSchedule(schoolAId, directorAContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
      teacherId: teacherVikramId,
    });
    assert.ok(dirSchedA1.location);
    assert.strictEqual(dirSchedA1.location.id, branchA1Id);

    // Branch A2 (Noida Campus) has no master configured yet
    const dirSchedA2 = await timetableService.getTeacherSchedule(schoolAId, directorAContext, {
      sessionId: currentSessionAId,
      locationId: branchA2Id,
      teacherId: teacherVikramId,
    });
    assert.strictEqual(dirSchedA2.master, null, 'Branch A2 should have no active timetable yet');
    assert.strictEqual(dirSchedA2.periods.length, 0);
    assert.strictEqual(dirSchedA2.details.length, 0);

    // Vikram cannot access unauthorized branch where he is not assigned
    await assert.rejects(
      async () => {
        await timetableService.getTeacherSchedule(schoolAId, teacherVikramContext, {
          sessionId: currentSessionAId,
          locationId: unauthorizedBranchId,
        });
      },
      /is not accessible for this teacher/,
      'Teacher should not access branch without authorization'
    );
  });

  // ======================================================================
  // Test 6: Security & Authorization Hooks (Impersonation Prevention)
  // ======================================================================
  test('Scenario 6: Regular teacher cannot spoof teacherId query param to spy on others', async () => {
    await assert.rejects(
      async () => {
        await timetableService.getTeacherSchedule(schoolAId, teacherVikramContext, {
          sessionId: currentSessionAId,
          locationId: branchA1Id,
          teacherId: teacherPriyaId, // Vikram attempting to inspect Priya's schedule
        });
      },
      /Access denied: You are not authorized to view schedules of other teachers/,
      'Non-admin should be prohibited from spoofing teacherId'
    );
  });

  test('Scenario 7: Administrator CAN pass teacherId to inspect any teacher schedule', async () => {
    const result = await timetableService.getTeacherSchedule(schoolAId, directorAContext, {
      sessionId: currentSessionAId,
      locationId: branchA1Id,
      teacherId: teacherPriyaId,
    });

    assert.ok(result);
    assert.strictEqual(result.teacher.id, teacherPriyaId);
  });

  // ======================================================================
  // Test 7: Tenant Isolation
  // ======================================================================
  test('Scenario 8: Cross-tenant isolation - School B user cannot query School A timetable', async () => {
    await assert.rejects(
      async () => {
        // User from School B tries to query School A
        await timetableService.getTeacherSchedule(schoolAId, directorBContext, {
          sessionId: currentSessionAId,
          locationId: branchA1Id,
        });
      },
      /Teacher with ID .+ not found in this school/,
      'User from School B must not be found in School A'
    );
  });
});
