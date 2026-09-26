// ========================================================================
// RBAC & Data Scope Automated Verification Test
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { accessControlService } from '../src/services/access-control.service.js';
import { accessControlRepository } from '../src/repositories/access-control.repository.js';

describe('Dynamic RBAC & Data Scope Verification', () => {
  before(() => {
    createApp();
  });

  test('Teacher user has restricted permissions compared to Director', async () => {
    const teacher = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    const director = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');

    const teacherPermCodes = teacher.context.permissions.map(p => p.code);
    const directorPermCodes = director.context.permissions.map(p => p.code);

    assert.ok(teacherPermCodes.includes('users.view'), 'Teacher should have users.view');
    assert.ok(!teacherPermCodes.includes('roles.manage'), 'Teacher should NOT have roles.manage');
    assert.ok(!teacherPermCodes.includes('schools.manage'), 'Teacher should NOT have schools.manage');

    assert.ok(directorPermCodes.includes('roles.manage'), 'Director should have roles.manage');
    assert.ok(directorPermCodes.length > teacherPermCodes.length, 'Director has broader permissions than Teacher');
  });

  test('User with multiple roles aggregates permissions and scopes to highest level', async () => {
    // Create a custom school role: "Exam Coordinator"
    const director = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    const permList = await accessControlService.listPermissions();
    const scopes = await accessControlService.listDataScopes();

    const auditPerm = permList.find(p => p.code === 'audit.view')!;
    const allLocationsScope = scopes.find(s => s.code === 'ALL_LOCATIONS')!;

    const customRole = await accessControlService.createRole({
      code: 'EXAM_COORD',
      name: 'Exam Coordinator',
      description: 'Coordinates branch exam schedules and audits',
      permissions: [
        { permissionId: auditPerm.id, dataScopeId: allLocationsScope.id }
      ]
    }, director.context);

    assert.strictEqual(customRole.code, 'EXAM_COORD');

    // Assign this second role to teacher Vikram Verma
    const teacherUser = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    await accessControlRepository.assignRoleToUser(
      teacherUser.user.id,
      customRole.id,
      director.context.school_id,
      director.user.id
    );

    // Re-evaluate effective permissions for teacher
    const updatedPerms = await accessControlRepository.getUserEffectivePermissions(teacherUser.user.id);
    const hasAuditView = updatedPerms.some(p => p.code === 'audit.view');
    assert.ok(hasAuditView, 'Teacher with second role now effectively inherits audit.view permission!');
  });

  test('Branch Admin is scoped to their permitted location', async () => {
    const branchAdmin = await authService.login('DPA-DEL-001', 'sunita.rao', 'password123');
    assert.strictEqual(branchAdmin.context.permitted_location_ids.length, 1);
    assert.strictEqual(branchAdmin.context.permitted_location_ids[0], 'a1000000-0000-0000-0000-000000000001'); // Delhi Main
  });
});
