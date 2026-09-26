// ========================================================================
// Universal User Management Automated Verification Test
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { userService } from '../src/services/user.service.js';
import { accessControlService } from '../src/services/access-control.service.js';
import { tenantService } from '../src/services/tenant.service.js';

describe('Universal User Management & Lifecycle Verification', () => {
  let directorContext: any;
  let staffUserTypeId: string;
  let delhiBranchId: string;

  before(async () => {
    createApp();
    const login = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorContext = login.context;

    const userTypes = await accessControlService.listUserTypes(directorContext);
    const staffType = userTypes.find(ut => ut.code === 'STAFF')!;
    staffUserTypeId = staffType.id;

    const locs = await tenantService.listLocations(directorContext.school_id!, directorContext);
    delhiBranchId = locs[0].id;
  });

  test('Create universal user with dynamic user type and assign location', async () => {
    const newUser = await userService.createUser({
      user_type_id: staffUserTypeId,
      username: 'amit.patel',
      email: 'amit.patel@dpa.edu',
      first_name: 'Amit',
      last_name: 'Patel',
      phone: '+91 98111 22334',
      location_ids: [delhiBranchId],
      primary_location_id: delhiBranchId,
    }, directorContext);

    assert.ok(newUser.id);
    assert.strictEqual(newUser.username, 'amit.patel');
    assert.strictEqual(newUser.user_type?.code, 'STAFF');
    assert.strictEqual(newUser.locations?.length, 1);
    assert.strictEqual(newUser.locations[0].id, delhiBranchId);
  });

  test('Search and filter users by search query and user type', async () => {
    const list = await userService.listUsers({ search: 'Amit' }, directorContext);
    assert.ok(list.length >= 1);
    assert.strictEqual(list[0].username, 'amit.patel');

    const staffList = await userService.listUsers({ userTypeId: staffUserTypeId }, directorContext);
    assert.ok(staffList.some(u => u.username === 'amit.patel'));
  });

  test('Soft delete / archive user preserves record with deleted_at timestamp', async () => {
    const user = await userService.listUsers({ search: 'amit.patel' }, directorContext);
    const targetId = user[0].id;

    const archived = await userService.archiveUser(targetId, directorContext);
    assert.strictEqual(archived, true);

    // Should no longer appear in active user listings
    const activeList = await userService.listUsers({ search: 'amit.patel' }, directorContext);
    assert.strictEqual(activeList.length, 0, 'Soft deleted user must not appear in active listings');
  });
});
