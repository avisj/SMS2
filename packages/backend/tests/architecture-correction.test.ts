// ========================================================================
// Architecture & Navigation Correction Verification Tests
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { academicService } from '../src/services/academic.service.js';
import { peopleService } from '../src/services/people.service.js';
import { accessControlService } from '../src/services/access-control.service.js';

describe('Architecture & Navigation Correction Verification', () => {
  let directorAContext: any;
  let schoolAId: string;
  let branchA1Id: string;

  before(async () => {
    createApp();

    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    schoolAId = directorAContext.school_id!;
    branchA1Id = directorAContext.branch_id || 'a1000000-0000-0000-0000-000000000001';
  });

  // ----------------------------------------------------------------------
  // 1. Automatic Academic Session Cycle Calculation
  // ----------------------------------------------------------------------
  test('Academic session cycle is dynamically calculated from start and end months', () => {
    // April to March cycle (Indian standard)
    const aprToMar = academicService.calculateSessionWindow(4, 3, new Date('2026-09-01'));
    assert.strictEqual(aprToMar.name, '2026-27');
    assert.strictEqual(aprToMar.code, 'AY2026-27');
    assert.strictEqual(aprToMar.startDate, '2026-04-01');
    assert.strictEqual(aprToMar.endDate, '2027-03-31');

    // January to December cycle (Calendar year)
    const janToDec = academicService.calculateSessionWindow(1, 12, new Date('2026-06-15'));
    assert.strictEqual(janToDec.name, '2026');
    assert.strictEqual(janToDec.code, 'AY2026');
    assert.strictEqual(janToDec.startDate, '2026-01-01');
    assert.strictEqual(janToDec.endDate, '2026-12-31');

    // September to June cycle (American / International standard)
    const sepToJun = academicService.calculateSessionWindow(9, 6, new Date('2026-10-15'));
    assert.strictEqual(sepToJun.name, '2026-27');
    assert.strictEqual(sepToJun.code, 'AY2026-27');
    assert.strictEqual(sepToJun.startDate, '2026-09-01');
    assert.strictEqual(sepToJun.endDate, '2027-06-30');
  });

  // ----------------------------------------------------------------------
  // 2. Dynamic Automatic Academic Session Record Creation in Database
  // ----------------------------------------------------------------------
  test('System automatically creates database session record when cycle rolls over to future date', async () => {
    // Reference date in future cycle: 2029-05-10
    const futureDate = new Date('2029-05-10');
    const futureSession = await academicService.getCurrentSession(schoolAId, futureDate);

    assert.ok(futureSession);
    assert.strictEqual(futureSession.name, '2029-30');
    assert.strictEqual(futureSession.is_current, true);

    // Verify session was persisted in database
    const allSessions = await academicService.listSessions(schoolAId, { includeInactive: true });
    const match = allSessions.find(s => s.name === '2029-30');
    assert.ok(match, 'Auto-generated session 2029-30 must be saved in database');
    assert.strictEqual(match?.id, futureSession.id);

    // Revert current session back to 2026-27 for test isolation
    const sess2026 = allSessions.find(s => s.name === '2026-27');
    if (sess2026) {
      await academicService.setCurrentSession(schoolAId, sess2026.id, directorAContext);
    }
  });

  // ----------------------------------------------------------------------
  // 3. Student Admission Auto-Assigns to Current Dynamic Session
  // ----------------------------------------------------------------------
  test('Student creation automatically resolves and assigns to current academic session when omitted', async () => {
    const currentSession = await academicService.getCurrentSession(schoolAId);
    assert.ok(currentSession, 'Current academic session must exist');

    const uniqueId = Date.now().toString().slice(-4);
    const student = await peopleService.createStudent(
      schoolAId,
      {
        username: `tanvi.kapoor.${uniqueId}`,
        first_name: 'Tanvi',
        last_name: 'Kapoor',
        email: `tanvi.kapoor.${uniqueId}@test.edu`,
        location_id: branchA1Id,
        gender: 'FEMALE',
        admission_number: `ADM-AUTO-${uniqueId}`,
        class_name: 'Class 10',
        section_name: 'Section A',
        // Note: academic_session is intentionally omitted here!
      },
      directorAContext.user_id
    );

    assert.ok(student);
    assert.ok(student.student_profile);
    assert.strictEqual(student.student_profile.academic_session, currentSession.name);
  });

  // ----------------------------------------------------------------------
  // 4. Masters Listing Sorted Newest-First (created_at DESC) without display_order
  // ----------------------------------------------------------------------
  test('Master listings sort newest-first and operate without display_order', async () => {
    // Create two new classes with timestamp gap
    const clsA = await academicService.createClass(
      schoolAId,
      { name: 'Class Alpha Test', code: `CLS-TEST-A-${Date.now()}` },
      directorAContext
    );
    // Slight pause to ensure distinct creation timestamp
    await new Promise(r => setTimeout(r, 20));

    const clsB = await academicService.createClass(
      schoolAId,
      { name: 'Class Beta Test', code: `CLS-TEST-B-${Date.now()}` },
      directorAContext
    );

    const classes = await academicService.listClasses(schoolAId);
    const indexB = classes.findIndex(c => c.id === clsB.id);
    const indexA = classes.findIndex(c => c.id === clsA.id);

    // Newer class clsB must appear BEFORE older class clsA (newest first)
    assert.ok(indexB !== -1 && indexA !== -1, 'Both test classes must exist in listing');
    assert.ok(indexB < indexA, `Newer class (index ${indexB}) must be before older class (index ${indexA})`);

    // Verify none of the items require or return display_order
    assert.strictEqual((clsA as any).display_order, undefined);
    assert.strictEqual((clsB as any).display_order, undefined);
  });

  // ----------------------------------------------------------------------
  // 5. Unified Roles & Rights Architecture Verification
  // ----------------------------------------------------------------------
  test('Role-Rights assignment supports bulk update, user roles, and data scope management', async () => {
    const permissions = await accessControlService.listPermissions();
    const scopes = await accessControlService.listDataScopes();
    assert.ok(permissions.length > 0, 'Permissions / Rights catalog must not be empty');
    assert.ok(scopes.length > 0, 'Data scopes catalog must not be empty');

    // 1. Create a custom operational role
    const testRole = await accessControlService.createRole(
      {
        code: `ROLE_TEST_${Date.now()}`,
        name: 'Custom Test Coordinator',
        description: 'Test role for role-rights matrix verification',
      },
      directorAContext
    );
    assert.ok(testRole);

    // 2. Bulk assign rights / permissions to role
    const rightsToAssign = [
      { permissionId: permissions[0].id, dataScopeId: scopes[0].id },
      { permissionId: permissions[1].id, dataScopeId: scopes[0].id },
    ];
    const updatedRole = await accessControlService.setRolePermissionsBulk(testRole.id, rightsToAssign, directorAContext);
    assert.ok(updatedRole);
    assert.strictEqual(updatedRole.permissions.length, 2);

    // 3. User Role assignments
    const assignments = await accessControlService.getUserRoleAssignments(schoolAId);
    assert.ok(Array.isArray(assignments));
    assert.ok(assignments.length > 0);

    // 4. Update user roles
    const targetUser = assignments[0].user;
    const userRolesBefore = assignments[0].roles.map(r => r.id);
    const updatedUserRoles = await accessControlService.updateUserRoles(
      targetUser.id,
      [...userRolesBefore, testRole.id],
      schoolAId,
      directorAContext
    );
    assert.ok(updatedUserRoles.some(r => r.id === testRole.id), 'Assigned test role must be in user roles');

    // 5. Clean up role assignment
    await accessControlService.updateUserRoles(targetUser.id, userRolesBefore, schoolAId, directorAContext);
    await accessControlService.deleteRole(testRole.id, directorAContext);
  });
});
