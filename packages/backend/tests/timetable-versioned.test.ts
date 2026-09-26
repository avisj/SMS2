// ========================================================================
// Student Timetable Module - Automated Verification Test Suite
// Tests for dynamic period calculation, immutable versioning, complete snapshot replication,
// teacher eligibility validation, teacher double-booking conflicts, and tenant isolation.
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { authService } from '../src/services/auth.service.js';
import { academicService } from '../src/services/academic.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { timetableService } from '../src/services/timetable.service.js';
import { timetableRepository } from '../src/repositories/timetable.repository.js';
import { academicRepository } from '../src/repositories/academic.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';

describe('Student Timetable Module - Dynamic Engine & Versioned Snapshots', () => {
  let directorAContext: any;
  let directorBContext: any;
  let schoolAId: string;
  let schoolBId: string;
  let branchA1Id: string;
  let currentSessionAId: string;
  let class10Id: string;
  let sectionAId: string;
  let sectionBId: string;
  let mathSubjectId: string;
  let engSubjectId: string;
  let teacherVikramId: string;
  let teacherPriyaId: string;

  before(async () => {
    seedInMemoryDatabase();
    createApp();

    // Login School A Director
    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    schoolAId = directorAContext.school_id!;

    // Login School B Director
    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    directorBContext = loginDirectorB.context;
    schoolBId = directorBContext.school_id!;

    // Get Branch A1 (Delhi Main)
    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    branchA1Id = locsA.find((l) => l.location_code === 'DEL-MAIN')!.id;

    // Get Current Session for School A
    const currSession = await academicService.getCurrentSession(schoolAId);
    assert.ok(currSession, 'School A should have a current academic session');
    currentSessionAId = currSession.id;

    // Get Classes & Sections
    const classes = await academicService.listClasses(schoolAId);
    const cls10 = classes.find((c) => c.code === 'CLS-10');
    assert.ok(cls10, 'Class 10 should exist');
    class10Id = cls10.id;

    const sections = await academicService.listSections(schoolAId);
    const secA = sections.find((s) => s.code === 'SEC-A');
    const secB = sections.find((s) => s.code === 'SEC-B');
    assert.ok(secA && secB, 'Sections A and B should exist');
    sectionAId = secA.id;
    sectionBId = secB.id;

    // Get Subjects
    const subjects = await academicService.listSubjects(schoolAId);
    const mathSub = subjects.find((s) => s.code === 'SUB-MATH');
    const engSub = subjects.find((s) => s.code === 'SUB-ENG');
    assert.ok(mathSub && engSub, 'Math and English subjects should exist');
    mathSubjectId = mathSub.id;
    engSubjectId = engSub.id;

    // Get Teachers
    const assignments = await academicRepository.findTeacherAssignments(schoolAId, {
      sessionId: currentSessionAId,
    });
    assert.ok(assignments.length > 0, 'Should have teacher assignments seeded');

    // Find Vikram Verma (Mathematics)
    const mathAssign = assignments.find(
      (a) => a.class_id === class10Id && a.section_id === sectionAId && a.subject_id === mathSubjectId
    );
    assert.ok(mathAssign, 'Teacher should be assigned to Math for Class 10-A');
    teacherVikramId = mathAssign.teacher_user_id;

    // Find Priya Nair and assign to English for Class 10-A
    const userPriya = await userRepository.findByUsername('priya.nair', schoolAId);
    assert.ok(userPriya, 'Priya Nair user should exist');
    teacherPriyaId = userPriya.id;

    await academicRepository.createTeacherAssignment({
      school_id: schoolAId,
      academic_session_id: currentSessionAId,
      location_id: branchA1Id,
      class_id: class10Id,
      section_id: sectionAId,
      subject_id: engSubjectId,
      teacher_user_id: teacherPriyaId,
      is_primary_teacher: true,
      status: 'ACTIVE',
    });
  });

  // ----------------------------------------------------------------------
  // 1. Dynamic Period Generation
  // ----------------------------------------------------------------------
  describe('1. Dynamic Period Engine', () => {
    test('Calculates chronological periods and cleanly separates lunch break', () => {
      // 08:00 to 14:00, 45 mins period, lunch 11:00 to 11:45
      // 08:00 - 08:45 (P1)
      // 08:45 - 09:30 (P2)
      // 09:30 - 10:15 (P3)
      // 10:15 - 11:00 (P4)
      // 11:00 - 11:45 (Lunch)
      // 11:45 - 12:30 (P5)
      // 12:30 - 13:15 (P6)
      // 13:15 - 14:00 (P7)
      const periods = timetableService.calculateDynamicPeriods('08:00', '14:00', 45, '11:00', '11:45');
      assert.strictEqual(periods.length, 8, 'Should produce 8 slots (7 teaching + 1 lunch)');

      const lunch = periods.find((p) => p.is_lunch);
      assert.ok(lunch, 'Lunch break should be present');
      assert.strictEqual(lunch.start_time, '11:00');
      assert.strictEqual(lunch.end_time, '11:45');
      assert.strictEqual(lunch.period_no, 5);

      const teachingPeriods = periods.filter((p) => !p.is_lunch);
      assert.strictEqual(teachingPeriods.length, 7);
      assert.strictEqual(teachingPeriods[0].start_time, '08:00');
      assert.strictEqual(teachingPeriods[0].end_time, '08:45');
      assert.strictEqual(teachingPeriods[6].start_time, '13:15');
      assert.strictEqual(teachingPeriods[6].end_time, '14:00');
    });

    test('Rejects invalid time format', () => {
      assert.throws(
        () => timetableService.calculateDynamicPeriods('8:00', '14:00', 45, '11:00', '11:45'),
        /Invalid time format/
      );
    });

    test('Rejects lunch outside day window', () => {
      assert.throws(
        () => timetableService.calculateDynamicPeriods('08:00', '14:00', 45, '07:30', '08:15'),
        /strictly within the school day/
      );
    });

    test('Rejects period duration that does not cleanly align before lunch', () => {
      // 08:00 to 11:00 is 180m. 50m periods will leave 30m remainder!
      assert.throws(
        () => timetableService.calculateDynamicPeriods('08:00', '14:00', 50, '11:00', '11:45'),
        /overshoots lunch start/
      );
    });

    test('Rejects period duration that does not cleanly align with day end', () => {
      // 11:45 to 14:00 is 135m. 40m periods will leave 15m remainder!
      assert.throws(
        () => timetableService.calculateDynamicPeriods('08:00', '14:00', 40, '10:00', '10:45'),
        /overshoots last period end time/
      );
    });
  });

  // ----------------------------------------------------------------------
  // 2. Timetable Configuration & Initial Version Creation
  // ----------------------------------------------------------------------
  describe('2. Timetable Configuration & Master Versioning', () => {
    let savedMasterV1: any;

    test('Saves initial timetable configuration creating V001 with ACTIVE status', async () => {
      const config = {
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        first_period_start_time: '08:00',
        last_period_end_time: '14:00',
        period_duration_minutes: 45,
        lunch_start_time: '11:00',
        lunch_end_time: '11:45',
        effective_from: '2026-04-01',
      };

      const result = await timetableService.saveConfiguration(schoolAId, config, directorAContext);
      savedMasterV1 = result.master;

      assert.ok(savedMasterV1, 'Saved master should not be null');
      assert.strictEqual(savedMasterV1.version_no, 1);
      assert.strictEqual(savedMasterV1.status, 'ACTIVE');
      assert.match(savedMasterV1.timetable_id, /^TT-.*-V001$/);
      assert.strictEqual(savedMasterV1.working_days.length, 6);
      assert.strictEqual(result.periods.length, 8);
    });

    test('Saving new configuration generates V002 and archives V001', async () => {
      const config = {
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        first_period_start_time: '08:00',
        last_period_end_time: '14:00',
        period_duration_minutes: 45,
        lunch_start_time: '11:00',
        lunch_end_time: '11:45',
      };

      const result = await timetableService.saveConfiguration(schoolAId, config, directorAContext);
      const savedMasterV2 = result.master;

      assert.strictEqual(savedMasterV2.version_no, 2);
      assert.strictEqual(savedMasterV2.status, 'ACTIVE');
      assert.match(savedMasterV2.timetable_id, /^TT-.*-V002$/);

      // Verify V001 is now ARCHIVED
      const oldV1 = await timetableRepository.findMasterById(savedMasterV1.id, schoolAId);
      assert.strictEqual(oldV1?.status, 'ARCHIVED');
    });

    test('Version history shows both V002 and V001 in descending order', async () => {
      const history = await timetableService.listVersionHistory(schoolAId, currentSessionAId, branchA1Id);
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].version_no, 2);
      assert.strictEqual(history[1].version_no, 1);
      assert.strictEqual(history[0].status, 'ACTIVE');
      assert.strictEqual(history[1].status, 'ARCHIVED');
    });
  });

  // ----------------------------------------------------------------------
  // 3. Cell Assignment & Versioned Snapshot Immutability
  // ----------------------------------------------------------------------
  describe('3. Cell Assignment & Snapshot Immutability', () => {
    let activeMaster: any;

    before(async () => {
      const active = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      activeMaster = active.master;
      assert.ok(activeMaster, 'Should have active master');
    });

    test('Assigning a cell creates a NEW timetable version V003 and copies all snapshot data', async () => {
      const assignInput = {
        day_of_week: 'Monday',
        period_no: 1,
        class_id: class10Id,
        section_id: sectionAId,
        subject_id: mathSubjectId,
        teacher_id: teacherVikramId,
        room_id: 'Room 101',
        remarks: 'Algebra Foundation',
      };

      const res = await timetableService.assignCell(schoolAId, activeMaster.id, assignInput, directorAContext);
      assert.strictEqual(res.master.version_no, 3);
      assert.strictEqual(res.master.status, 'ACTIVE');
      assert.match(res.master.timetable_id, /^TT-.*-V003$/);

      // Verify cell is assigned in details
      assert.strictEqual(res.details.length, 1);
      const assigned = res.details[0];
      assert.strictEqual(assigned.day_of_week, 'Monday');
      assert.strictEqual(assigned.period_no, 1);
      assert.strictEqual(assigned.subject_id, mathSubjectId);
      assert.strictEqual(assigned.teacher_id, teacherVikramId);
      assert.strictEqual(assigned.room_id, 'Room 101');

      // Verify previous version V002 is ARCHIVED and unchanged (0 details)
      const prevV2 = await timetableRepository.findMasterById(activeMaster.id, schoolAId);
      assert.strictEqual(prevV2?.status, 'ARCHIVED');
      const v2Details = await timetableRepository.findDetails(activeMaster.id, schoolAId);
      assert.strictEqual(v2Details.length, 0);

      // Update activeMaster reference to V3
      activeMaster = res.master;
    });

    test('Assigning second cell creates V004 with BOTH cells in the new snapshot', async () => {
      const assignInput2 = {
        day_of_week: 'Monday',
        period_no: 2,
        class_id: class10Id,
        section_id: sectionAId,
        subject_id: engSubjectId,
        teacher_id: teacherPriyaId,
        room_id: 'English Lab 1',
      };

      const res = await timetableService.assignCell(schoolAId, activeMaster.id, assignInput2, directorAContext);
      assert.strictEqual(res.master.version_no, 4);
      assert.strictEqual(res.details.length, 2, 'V004 must contain both assignments in the snapshot');

      const p1 = res.details.find((d) => d.period_no === 1);
      const p2 = res.details.find((d) => d.period_no === 2);
      assert.ok(p1 && p2);
      assert.strictEqual(p1.subject_id, mathSubjectId);
      assert.strictEqual(p2.subject_id, engSubjectId);

      activeMaster = res.master;
    });
  });

  // ----------------------------------------------------------------------
  // 4. Validations & Conflict Prevention
  // ----------------------------------------------------------------------
  describe('4. Strict Validations & Conflict Prevention', () => {
    let activeMaster: any;

    before(async () => {
      const active = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      activeMaster = active.master;
    });

    test('Rejects assignment on a day not in configured working days', async () => {
      await assert.rejects(
        async () => {
          await timetableService.assignCell(
            schoolAId,
            activeMaster.id,
            {
              day_of_week: 'Sunday',
              period_no: 1,
              class_id: class10Id,
              section_id: sectionAId,
              subject_id: mathSubjectId,
              teacher_id: teacherVikramId,
            },
            directorAContext
          );
        },
        /not a configured working day/
      );
    });

    test('Rejects assignment during lunch interval', async () => {
      // Period 5 is lunch (11:00 - 11:45)
      await assert.rejects(
        async () => {
          await timetableService.assignCell(
            schoolAId,
            activeMaster.id,
            {
              day_of_week: 'Monday',
              period_no: 5,
              class_id: class10Id,
              section_id: sectionAId,
              subject_id: mathSubjectId,
              teacher_id: teacherVikramId,
            },
            directorAContext
          );
        },
        /lunch break/
      );
    });

    test('Rejects teacher who is NOT assigned to teach the class/section/subject', async () => {
      // Try assigning Priya Sharma (Science teacher) to teach Math
      await assert.rejects(
        async () => {
          await timetableService.assignCell(
            schoolAId,
            activeMaster.id,
            {
              day_of_week: 'Tuesday',
              period_no: 1,
              class_id: class10Id,
              section_id: sectionAId,
              subject_id: mathSubjectId,
              teacher_id: teacherPriyaId, // Not assigned to teach math
            },
            directorAContext
          );
        },
        /not assigned to teach this subject/
      );
    });

    test('Prevents teacher double-booking in two different classes at the same day + period', async () => {
      // In V004, Vikram Verma is teaching Class 10-A on Monday Period 1.
      // Now assign Vikram Verma to teach Class 10-B also on Monday Period 1.
      // First ensure Vikram is also assigned to teach Class 10-B Math:
      await academicRepository.createTeacherAssignment({
        school_id: schoolAId,
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        class_id: class10Id,
        section_id: sectionBId,
        subject_id: mathSubjectId,
        teacher_user_id: teacherVikramId,
        is_primary_teacher: true,
        status: 'ACTIVE',
      });

      // Now attempting to schedule him on Monday Period 1 for 10-B must trigger a conflict!
      await assert.rejects(
        async () => {
          await timetableService.assignCell(
            schoolAId,
            activeMaster.id,
            {
              day_of_week: 'Monday',
              period_no: 1,
              class_id: class10Id,
              section_id: sectionBId,
              subject_id: mathSubjectId,
              teacher_id: teacherVikramId,
            },
            directorAContext
          );
        },
        /Teacher Conflict: .* is already booked/
      );
    });
  });

  // ----------------------------------------------------------------------
  // 5. Cell Removal & Version Activation
  // ----------------------------------------------------------------------
  describe('5. Cell Removal & Version Activation', () => {
    let activeMaster: any;

    before(async () => {
      const active = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      activeMaster = active.master;
    });

    test('Removing a cell creates a NEW version snapshot without the removed cell', async () => {
      const res = await timetableService.removeCell(
        schoolAId,
        activeMaster.id,
        {
          day_of_week: 'Monday',
          period_no: 2, // remove Science
          class_id: class10Id,
          section_id: sectionAId,
        },
        directorAContext
      );

      assert.strictEqual(res.master.version_no, activeMaster.version_no + 1);
      assert.strictEqual(res.details.length, 1);
      assert.strictEqual(res.details[0].period_no, 1, 'Only Math on Period 1 remains');
    });

    test('Activating a historical version sets it to ACTIVE and archives others', async () => {
      const history = await timetableService.listVersionHistory(schoolAId, currentSessionAId, branchA1Id);
      const v2 = history.find((h) => h.version_no === 2);
      assert.ok(v2);

      const activated = await timetableService.activateVersion(schoolAId, v2.id, directorAContext);
      assert.strictEqual(activated.status, 'ACTIVE');

      // Now check active timetable
      const active = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      assert.strictEqual(active.master?.id, v2.id);
      assert.strictEqual(active.master?.version_no, 2);
    });
  });

  // ----------------------------------------------------------------------
  // 6. Tenant Isolation Boundaries
  // ----------------------------------------------------------------------
  describe('6. Tenant Isolation Boundaries', () => {
    test('School B cannot access or modify School A timetables', async () => {
      const activeA = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      assert.ok(activeA.master);

      // School B attempts to inspect School A's timetable
      await assert.rejects(
        async () => {
          await timetableService.getTimetableVersion(schoolBId, activeA.master.id);
        },
        /not found/
      );

      // School B attempts to assign a cell to School A's timetable
      await assert.rejects(
        async () => {
          await timetableService.assignCell(
            schoolBId,
            activeA.master.id,
            {
              day_of_week: 'Monday',
              period_no: 1,
              class_id: class10Id,
              section_id: sectionAId,
              subject_id: mathSubjectId,
              teacher_id: teacherVikramId,
            },
            directorBContext
          );
        },
        /not found/
      );
    });
  });

  // ----------------------------------------------------------------------
  // 7. Authoritative Active Version Resolution & Configuration Persistence Lifecycle
  // ----------------------------------------------------------------------
  describe('7. Authoritative Active Version Resolution & Configuration Persistence Lifecycle', () => {
    let v12Master: any;
    let v13Master: any;

    test('Step A: Save configuration with Mon, Tue, Wed, Sat, Sun creates ACTIVE version with those exact days', async () => {
      const configA = {
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Saturday', 'Sunday'],
        first_period_start_time: '07:00',
        last_period_end_time: '14:00',
        period_duration_minutes: 60,
        lunch_start_time: '11:00',
        lunch_end_time: '12:00',
      };

      const resultA = await timetableService.saveConfiguration(schoolAId, configA, directorAContext);
      v12Master = resultA.master;

      assert.ok(v12Master);
      assert.strictEqual(v12Master.status, 'ACTIVE');
      assert.deepStrictEqual(v12Master.working_days, [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Saturday',
        'Sunday',
      ]);
      assert.strictEqual(v12Master.first_period_start_time, '07:00');
      assert.strictEqual(v12Master.last_period_end_time, '14:00');
      assert.strictEqual(v12Master.period_duration_minutes, 60);
      assert.strictEqual(v12Master.lunch_start_time, '11:00');
      assert.strictEqual(v12Master.lunch_end_time, '12:00');

      // Student Timetable query for active timetable resolves this master
      const activeResA = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      assert.strictEqual(activeResA.master?.id, v12Master.id);
      assert.deepStrictEqual(activeResA.master?.working_days, [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Saturday',
        'Sunday',
      ]);
      assert.strictEqual(activeResA.periods.length, 7); // 4 before lunch + 1 lunch + 2 after lunch
    });

    test('Step B: Save new configuration with Mon, Tue, Wed, Thu, Fri creates new ACTIVE version; old version is ARCHIVED and preserves original days', async () => {
      const configB = {
        academic_session_id: currentSessionAId,
        location_id: branchA1Id,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        first_period_start_time: '08:00',
        last_period_end_time: '14:00',
        period_duration_minutes: 45,
        lunch_start_time: '11:00',
        lunch_end_time: '11:45',
      };

      const resultB = await timetableService.saveConfiguration(schoolAId, configB, directorAContext);
      v13Master = resultB.master;

      assert.ok(v13Master);
      assert.strictEqual(v13Master.status, 'ACTIVE');
      assert.strictEqual(v13Master.version_no, v12Master.version_no + 1);
      assert.notStrictEqual(v13Master.timetable_id, v12Master.timetable_id);
      assert.deepStrictEqual(v13Master.working_days, [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ]);

      // Verify old version remains unchanged and is ARCHIVED
      const oldV12 = await timetableRepository.findMasterById(v12Master.id, schoolAId);
      assert.strictEqual(oldV12?.status, 'ARCHIVED');
      assert.deepStrictEqual(oldV12?.working_days, [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Saturday',
        'Sunday',
      ]);

      // Verify Student Timetable query returns newly ACTIVE master with Mon-Fri
      const activeResB = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      assert.strictEqual(activeResB.master?.id, v13Master.id);
      assert.strictEqual(activeResB.master?.version_no, v13Master.version_no);
      assert.deepStrictEqual(activeResB.master?.working_days, [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ]);
      assert.strictEqual(activeResB.master?.first_period_start_time, '08:00');
    });

    test('Step C: Version history accurately preserves each version configuration', async () => {
      const history = await timetableService.listVersionHistory(schoolAId, currentSessionAId, branchA1Id);
      const hist13 = history.find((h) => h.id === v13Master.id);
      const hist12 = history.find((h) => h.id === v12Master.id);

      assert.ok(hist13 && hist12);
      assert.strictEqual(hist13.status, 'ACTIVE');
      assert.deepStrictEqual(hist13.working_days, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

      assert.strictEqual(hist12.status, 'ARCHIVED');
      assert.deepStrictEqual(hist12.working_days, ['Monday', 'Tuesday', 'Wednesday', 'Saturday', 'Sunday']);
    });

    test('Step D: Master and Detail consistency validation prevents mixing versions', async () => {
      // Attempt to insert a detail record with mismatching timetable_id against master
      await assert.rejects(
        async () => {
          await timetableRepository.createDetails([
            {
              id: 'test-inconsistent-detail',
              timetable_detail_id: 'TTD-TEST',
              timetable_master_id: v13Master.id,
              timetable_id: v12Master.timetable_id, // Mismatching timetable_id!
              school_id: schoolAId,
              academic_session_id: currentSessionAId,
              location_id: branchA1Id,
              day_of_week: 'Monday',
              period_no: 1,
              start_time: '08:00',
              end_time: '08:45',
              class_id: class10Id,
              section_id: sectionAId,
              subject_id: mathSubjectId,
              teacher_id: teacherVikramId,
              is_free_period: false,
              is_lunch: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
        },
        /Data Integrity Error: Detail timetable_id .* does not match master timetable_id/
      );
    });

    test('Step E: Empty state returned when no active timetable is configured for location/session', async () => {
      const dummyLocationId = '00000000-0000-0000-0000-000000000999';
      const emptyRes = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, dummyLocationId);
      assert.strictEqual(emptyRes.master, null);
      assert.deepStrictEqual(emptyRes.periods, []);
      assert.deepStrictEqual(emptyRes.details, []);
    });

    test('Step F: Configuration preview does not alter database state', async () => {
      const beforeActive = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);

      const previewPeriods = timetableService.previewPeriods({
        first_period_start_time: '09:00',
        last_period_end_time: '15:00',
        period_duration_minutes: 60,
        lunch_start_time: '12:00',
        lunch_end_time: '13:00',
      });
      assert.strictEqual(previewPeriods.length, 6);

      const afterActive = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA1Id);
      assert.strictEqual(beforeActive.master?.id, afterActive.master?.id);
      assert.strictEqual(afterActive.master?.first_period_start_time, '08:00', 'Active master must not change from preview');
    });

    test('Step G: Canonical week ordering is enforced regardless of input order', async () => {
      // Pass days in random reversed order
      const randomOrderDays = ['Sunday', 'Wednesday', 'Monday', 'Friday'];
      const res = await timetableService.saveConfiguration(
        schoolAId,
        {
          academic_session_id: currentSessionAId,
          location_id: branchA1Id,
          working_days: randomOrderDays,
          first_period_start_time: '08:00',
          last_period_end_time: '14:00',
          period_duration_minutes: 45,
          lunch_start_time: '11:00',
          lunch_end_time: '11:45',
        },
        directorAContext
      );

      // Must be sorted in standard calendar sequence Monday -> Sunday
      assert.deepStrictEqual(res.master.working_days, ['Monday', 'Wednesday', 'Friday', 'Sunday']);
    });

    test('Step H: Branch and Academic Session Isolation ensures timetables do not leak across scopes', async () => {
      const locsA = await tenantService.listLocations(schoolAId, directorAContext);
      if (locsA.length > 1) {
        const branchA2Id = locsA[1].id;
        const branch2Timetable = await timetableService.getActiveTimetable(schoolAId, currentSessionAId, branchA2Id);
        // If branch 2 has no timetable configured, it returns null and not Branch 1's timetable
        if (!branch2Timetable.master) {
          assert.strictEqual(branch2Timetable.master, null);
        } else {
          assert.strictEqual(branch2Timetable.master.location_id, branchA2Id);
        }
      }

      // Check session isolation
      const sessions = await academicService.listSessions(schoolAId);
      const otherSession = sessions.find((s) => s.id !== currentSessionAId);
      if (otherSession) {
        const otherSessionTimetable = await timetableService.getActiveTimetable(schoolAId, otherSession.id, branchA1Id);
        if (!otherSessionTimetable.master) {
          assert.strictEqual(otherSessionTimetable.master, null);
        } else {
          assert.strictEqual(otherSessionTimetable.master.academic_session_id, otherSession.id);
        }
      }
    });

    test('Step I: Multiple ACTIVE versions cannot exist concurrently for same school/session/branch', async () => {
      const allMasters = await timetableRepository.listMasterVersions(schoolAId, currentSessionAId, branchA1Id);
      const activeMasters = allMasters.filter((m) => m.status === 'ACTIVE');
      assert.strictEqual(activeMasters.length, 1, 'Strictly exactly ONE version must be ACTIVE at any time');
    });
  });
});

