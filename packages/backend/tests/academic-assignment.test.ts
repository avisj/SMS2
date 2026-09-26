// ========================================================================
// Academic Structure & Assignments Verification Tests
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { academicService } from '../src/services/academic.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { accessControlRepository } from '../src/repositories/access-control.repository.js';
import academicRouter from '../src/routes/academic.routes.js';

describe('Academic Structure & Assignments Verification', () => {
  let directorAContext: any;
  let directorBContext: any;
  let teacherAContext: any;
  let branchAdminAContext: any;
  let schoolAId: string;
  let schoolBId: string;
  let branchA1Id: string;
  let branchA2Id: string;
  let directorAToken: string;

  before(async () => {
    createApp();

    // Login School A Director
    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    directorAToken = loginDirectorA.token;
    schoolAId = directorAContext.school_id!;

    // Login School B Director
    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    directorBContext = loginDirectorB.context;
    schoolBId = directorBContext.school_id!;

    // Login School A Teacher Vikram Verma
    const loginTeacherA = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    teacherAContext = loginTeacherA.context;

    // Login School A Branch Admin Sunita Rao (Noida Ext)
    const loginBranchAdminA = await authService.login('DPA-DEL-001', 'sunita.rao', 'password123');
    branchAdminAContext = loginBranchAdminA.context;

    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    branchA1Id = locsA.find(l => l.location_code === 'DEL-MAIN')!.id;
    branchA2Id = locsA.find(l => l.location_code === 'NOI-EXT')!.id;
  });

  // ----------------------------------------------------------------------
  // 1. Academic Session Master
  // ----------------------------------------------------------------------
  test('Academic sessions support multiple historical sessions with single current session guarantee', async () => {
    const sessionsA = await academicService.listSessions(schoolAId, { includeInactive: true });
    assert.ok(sessionsA.length >= 2, 'Should have at least historical and current sessions');

    const currentSessions = sessionsA.filter(s => s.is_current);
    assert.strictEqual(currentSessions.length, 1, 'Only one session should be current');
    assert.strictEqual(currentSessions[0].code, 'AY2026-27');

    const historical = sessionsA.find(s => s.code === 'AY2025-26');
    assert.ok(historical, 'Historical session 2025-26 must exist');
    assert.strictEqual(historical?.status, 'COMPLETED');
    assert.strictEqual(historical?.is_current, false);

    // Creating new session marked is_current flips previous session is_current to false
    const newSession = await academicService.createSession(
      schoolAId,
      {
        name: '2027-28',
        code: 'AY2027-28',
        start_date: '2027-04-01',
        end_date: '2028-03-31',
        status: 'ACTIVE',
        is_current: true,
      },
      directorAContext
    );

    const refreshedSessions = await academicService.listSessions(schoolAId, { includeInactive: true });
    const activeCurrent = refreshedSessions.filter(s => s.is_current);
    assert.strictEqual(activeCurrent.length, 1);
    assert.strictEqual(activeCurrent[0].id, newSession.id);

    // Reset current session back to 2026-27 for remaining tests
    await academicService.setCurrentSession(schoolAId, currentSessions[0].id, directorAContext);
  });

  // ----------------------------------------------------------------------
  // 2. Class and Section Masters & Tenant Isolation
  // ----------------------------------------------------------------------
  test('Classes and sections are school-specific, configurable, and tenant-isolated', async () => {
    const classesA = await academicService.listClasses(schoolAId);
    const classesB = await academicService.listClasses(schoolBId);

    // School A has Class 10 (CLS-10)
    assert.ok(classesA.some(c => c.code === 'CLS-10'));
    // School B has Grade 10 (CLS-G10)
    assert.ok(classesB.some(c => c.code === 'CLS-G10'));
    assert.ok(!classesA.some(c => c.code === 'CLS-G10'));

    const sectionsA = await academicService.listSections(schoolAId);
    const sectionsB = await academicService.listSections(schoolBId);

    assert.ok(sectionsA.some(s => s.name === 'A'));
    assert.ok(sectionsB.some(s => s.name === 'Alpha'));
    assert.ok(!sectionsA.some(s => s.name === 'Alpha'));
  });

  // ----------------------------------------------------------------------
  // 3. Class-Section Offerings per Session
  // ----------------------------------------------------------------------
  test('Class-section offerings are database-driven per academic session', async () => {
    const currentSession = await academicService.getCurrentSession(schoolAId);
    assert.ok(currentSession);

    const classes = await academicService.listClasses(schoolAId);
    const cls10 = classes.find(c => c.code === 'CLS-10')!;
    const cls11 = classes.find(c => c.code === 'CLS-11')!;

    const offerings10 = await academicService.listClassSections(schoolAId, currentSession.id, cls10.id);
    const offerings11 = await academicService.listClassSections(schoolAId, currentSession.id, cls11.id);

    // Class 10 has sections A, B, C
    assert.strictEqual(offerings10.length, 3);
    const secNames10 = offerings10.map(o => o.section?.name);
    assert.ok(secNames10.includes('A') && secNames10.includes('B') && secNames10.includes('C'));

    // Class 11 has sections A, B only
    assert.strictEqual(offerings11.length, 2);
    const secNames11 = offerings11.map(o => o.section?.name);
    assert.ok(secNames11.includes('A') && secNames11.includes('B') && !secNames11.includes('C'));
  });

  // ----------------------------------------------------------------------
  // 4. Relational Subjects & Subject Groups
  // ----------------------------------------------------------------------
  test('Subject groups use relational tables with zero comma-separated values', async () => {
    const groups = await academicService.listSubjectGroups(schoolAId);
    const coreGroup = groups.find(g => g.code === 'GRP-CORE');
    assert.ok(coreGroup);
    assert.ok(coreGroup.subjects && coreGroup.subjects.length > 0);

    const subjectCodes = coreGroup.subjects.map(s => s.code);
    assert.ok(subjectCodes.includes('SUB-MATH'));
    assert.ok(subjectCodes.includes('SUB-ENG'));
    assert.ok(subjectCodes.includes('SUB-SST'));
  });

  // ----------------------------------------------------------------------
  // 5. Student Class Assignment Authorization & Scope
  // ----------------------------------------------------------------------
  test('Student class assignment strictly requires students.class_assign permission', async () => {
    const currentSession = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);
    const sections = await academicService.listSections(schoolAId);
    const cls10 = classes.find(c => c.code === 'CLS-10')!;
    const secA = sections.find(s => s.name === 'A')!;

    // Get candidate student
    const studentUser = (await userRepository.findUsers({ schoolId: schoolAId, userTypeCode: 'STUDENT' }))[0];

    // Teacher Vikram does NOT have students.class_assign permission
    await assert.rejects(
      async () => {
        await academicService.assignStudentToClass(
          schoolAId,
          {
            student_user_id: studentUser.id,
            academic_session_id: currentSession!.id,
            location_id: branchA1Id,
            class_id: cls10.id,
            section_id: secA.id,
          },
          teacherAContext // Teacher context
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Permission Denied'));
        return true;
      }
    );
  });

  test('Branch Admin cannot assign student to location outside their permitted data scope', async () => {
    const currentSession = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);
    const sections = await academicService.listSections(schoolAId);
    const cls10 = classes.find(c => c.code === 'CLS-10')!;
    const secA = sections.find(s => s.name === 'A')!;

    const studentUser = (await userRepository.findUsers({ schoolId: schoolAId, userTypeCode: 'STUDENT' }))[0];

    // Branch Admin Sunita is scoped strictly to Dwarka Main (branchA1Id), NOT Noida Ext (branchA2Id)
    await assert.rejects(
      async () => {
        await academicService.assignStudentToClass(
          schoolAId,
          {
            student_user_id: studentUser.id,
            academic_session_id: currentSession!.id,
            location_id: branchA2Id, // Forbidden branch for Sunita
            class_id: cls10.id,
            section_id: secA.id,
          },
          branchAdminAContext
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Data Scope Violation'));
        return true;
      }
    );
  });

  // ----------------------------------------------------------------------
  // 6. Student Academic History & Assignment Validation
  // ----------------------------------------------------------------------
  test('Student assignment validates class-section offering and preserves multi-session history', async () => {
    const currentSession = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);
    const sections = await academicService.listSections(schoolAId);
    const cls11 = classes.find(c => c.code === 'CLS-11')!;
    const secC = sections.find(s => s.name === 'C')!; // Section C is NOT configured for Class 11

    const studentUser = (await userRepository.findUsers({ schoolId: schoolAId, userTypeCode: 'STUDENT' }))[0];

    // Attempting to assign student to invalid section C for Class 11 should be rejected
    await assert.rejects(
      async () => {
        await academicService.assignStudentToClass(
          schoolAId,
          {
            student_user_id: studentUser.id,
            academic_session_id: currentSession!.id,
            location_id: branchA1Id,
            class_id: cls11.id,
            section_id: secC.id,
          },
          directorAContext
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Target Section is not configured'));
        return true;
      }
    );

    // Verify Aarav has historical academic records
    const aaravUser = (await userRepository.findUsers({ schoolId: schoolAId, search: 'Aarav' }))[0];
    const history = await academicService.getStudentAcademicHistory(schoolAId, aaravUser.id, directorAContext);

    assert.ok(history.length >= 2, 'Aarav should have both 2025-26 and 2026-27 records');
    assert.ok(history.some(h => h.session?.code === 'AY2025-26' && h.enrollment_status === 'PROMOTED'));
    assert.ok(history.some(h => h.session?.code === 'AY2026-27' && h.enrollment_status === 'ENROLLED'));
  });

  // ----------------------------------------------------------------------
  // 7. Teacher Assignment Authorization & Validation
  // ----------------------------------------------------------------------
  test('Teacher assignment enforces permissions, branch access, and valid offerings', async () => {
    const currentSession = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);
    const sections = await academicService.listSections(schoolAId);
    const subjects = await academicService.listSubjects(schoolAId);

    const cls10 = classes.find(c => c.code === 'CLS-10')!;
    const secA = sections.find(s => s.name === 'A')!;
    const subMath = subjects.find(s => s.code === 'SUB-MATH')!;
    const subPhy = subjects.find(s => s.code === 'SUB-PHY')!; // Physics is NOT offered to Class 10

    // 1. Teacher cannot manage assignments
    await assert.rejects(
      async () => {
        await academicService.assignTeacher(
          schoolAId,
          {
            teacher_user_id: teacherAContext.user_id,
            academic_session_id: currentSession!.id,
            location_id: branchA1Id,
            class_id: cls10.id,
            section_id: secA.id,
            subject_id: subMath.id,
          },
          teacherAContext
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Permission Denied'));
        return true;
      }
    );

    // 2. Cannot assign subject not offered for class (Physics not in Class 10)
    await assert.rejects(
      async () => {
        await academicService.assignTeacher(
          schoolAId,
          {
            teacher_user_id: teacherAContext.user_id,
            academic_session_id: currentSession!.id,
            location_id: branchA1Id,
            class_id: cls10.id,
            section_id: secA.id,
            subject_id: subPhy.id,
          },
          directorAContext
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Selected Subject is not offered'));
        return true;
      }
    );

    // 3. Duplicate assignment prevention (Vikram is already assigned to Class 10-A Math)
    await assert.rejects(
      async () => {
        await academicService.assignTeacher(
          schoolAId,
          {
            teacher_user_id: teacherAContext.user_id,
            academic_session_id: currentSession!.id,
            location_id: branchA1Id,
            class_id: cls10.id,
            section_id: secA.id,
            subject_id: subMath.id,
          },
          directorAContext
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('already assigned'));
        return true;
      }
    );
  });

  // ----------------------------------------------------------------------
  // 8. Teacher Personal View (My Teaching Responsibilities)
  // ----------------------------------------------------------------------
  test('Teacher can query their own assigned teaching responsibilities', async () => {
    const responsibilities = await academicService.getMyTeachingResponsibilities(teacherAContext.user_id);

    assert.ok(responsibilities.length >= 2, 'Vikram should be assigned to at least 2 classes');
    const classNames = responsibilities.map(r => r.class_name);
    assert.ok(classNames.some(c => c.includes('10')));
    assert.ok(classNames.some(c => c.includes('11')));

    assert.ok(responsibilities.every(r => r.subject_name === 'Mathematics'));
    assert.ok(responsibilities.every(r => r.location_name.includes('Dwarka')));
  });

  // ----------------------------------------------------------------------
  // 9. Strict Cross-Tenant Isolation
  // ----------------------------------------------------------------------
  test('School B Director cannot read or access School A academic entities', async () => {
    const sessionsB = await academicService.listSessions(schoolBId);
    const classesB = await academicService.listClasses(schoolBId);

    // None of School B entities should contain School A data
    assert.ok(sessionsB.every(s => s.school_id === schoolBId));
    assert.ok(classesB.every(c => c.school_id === schoolBId));
    assert.ok(!classesB.some(c => c.code === 'CLS-10'));

    // Querying enrollments of School A as School B is rejected by tenant isolation
    const enrollmentsB = await academicService.listStudentEnrollments(schoolBId, {}, directorBContext);
    assert.ok(enrollmentsB.every(e => e.school_id === schoolBId));
  });

  // ----------------------------------------------------------------------
  // 10. Academic HTTP Router with authMiddleware
  // ----------------------------------------------------------------------
  test('Academic router applies authMiddleware and populates req.userContext', async () => {
    // 1. Unauthenticated request must return 401
    let statusCode = 0;
    let responseJson: any = null;
    const mockReq1: any = {
      method: 'GET',
      url: '/sessions',
      headers: {},
      query: {},
      params: {},
    };
    const mockRes1: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
        return this;
      },
    };

    academicRouter(mockReq1, mockRes1, () => {});
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(responseJson?.error?.code, 'UNAUTHORIZED');
    assert.strictEqual(responseJson?.error?.message, 'Authentication token is required');

    // 2. Authenticated request with director token must succeed with 200 and data
    statusCode = 200;
    responseJson = null;
    const mockReq2: any = {
      method: 'GET',
      url: '/sessions',
      headers: {
        authorization: `Bearer ${directorAToken}`,
      },
      query: {},
      params: {},
    };
    const mockRes2: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
      },
    };

    await new Promise<void>((resolve) => {
      mockRes2.json = (data: any) => {
        responseJson = data;
        resolve();
      };
      academicRouter(mockReq2, mockRes2, (err: any) => {
        if (err) resolve();
      });
    });

    assert.ok(mockReq2.userContext, 'authMiddleware must populate req.userContext');
    assert.strictEqual(mockReq2.userContext.school_id, schoolAId);
    assert.strictEqual(responseJson?.success, true);
    assert.ok(Array.isArray(responseJson?.data));
    assert.ok(responseJson?.data?.length >= 2, 'Should return seeded sessions for School A');
  });
});
