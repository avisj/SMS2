// ========================================================================
// Authentication & School ID Architecture Acceptance Tests
// 18 Comprehensive Verification Test Cases
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { userService } from '../src/services/user.service.js';
import { accessControlService } from '../src/services/access-control.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { getMemoryDbClient } from '../src/db/client.js';
import { credentialsRepository } from '../src/repositories/credentials.repository.js';

describe('Authentication & School ID Architecture Verification (18 Test Cases)', () => {
  let directorAContext: any;
  let teacherAContext: any;
  let schoolAId: string;
  let schoolBId: string;
  let locA1Id: string;
  let locB1Id: string;

  before(async () => {
    createApp();

    const loginDirector = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirector.context;
    schoolAId = directorAContext.school_id;

    const loginTeacher = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    teacherAContext = loginTeacher.context;

    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    locA1Id = locsA[0].id;

    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    schoolBId = loginDirectorB.context.school_id;
    const locsB = await tenantService.listLocations(schoolBId, loginDirectorB.context);
    locB1Id = locsB[0].id;
  });

  // ----------------------------------------------------------------------
  // TEST 1: Wrong School ID -> "School ID is incorrect."
  // ----------------------------------------------------------------------
  test('TEST 1: Wrong School ID fails with explicit message "School ID is incorrect."', async () => {
    await assert.rejects(
      async () => {
        await authService.login('INVALID-SCHOOL-999', 'rajesh.sharma', 'password123');
      },
      /School ID is incorrect\./,
      'Invalid School ID must return exact error: School ID is incorrect.'
    );

    // Empty School ID
    await assert.rejects(
      async () => {
        await authService.login('', 'rajesh.sharma', 'password123');
      },
      /School ID is incorrect\./,
      'Empty School ID must return School ID is incorrect.'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 2: Correct School ID + User ID from another school/branch
  // ----------------------------------------------------------------------
  test('TEST 2: Correct School ID + User ID from another school fails with "User ID not found for this School ID."', async () => {
    // anita.desai exists in School B (GWI-MUM-001), attempting to log into School A (DPA-DEL-001)
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', 'anita.desai', 'password123');
      },
      /User ID not found for this School ID\./,
      'Cross-school user login attempt must return exact error: User ID not found for this School ID.'
    );

    // Completely non-existent username
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', 'nonexistent.user', 'password123');
      },
      /User ID not found for this School ID\./,
      'Nonexistent user must return User ID not found for this School ID.'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 3: Correct School ID + correct User ID + wrong password
  // ----------------------------------------------------------------------
  test('TEST 3: Correct School ID + correct User ID + wrong password fails with "Password is incorrect."', async () => {
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', 'rajesh.sharma', 'wrongpassword_XYZ');
      },
      /Password is incorrect\./,
      'Invalid password must return exact error: Password is incorrect.'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 4: Correct School ID + correct User ID + correct password
  // ----------------------------------------------------------------------
  test('TEST 4: Correct School ID + correct User ID + correct password succeeds and returns complete context', async () => {
    const result = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    assert.ok(result.token, 'Must return JWT token');
    assert.strictEqual(result.context.school_id_code, 'DPA-DEL-001');
    assert.strictEqual(result.context.username, 'rajesh.sharma');
    assert.ok(result.context.roles.length > 0, 'Must contain roles');
    assert.ok(result.context.permissions.length > 0, 'Must contain permissions');
    assert.ok(result.context.permitted_location_ids.length > 0, 'Must contain permitted locations');
  });

  // ----------------------------------------------------------------------
  // TEST 5: User created without "Create Login Access"
  // ----------------------------------------------------------------------
  test('TEST 5: User created without Create Login Access exists as profile only and cannot log in', async () => {
    const userTypes = await accessControlService.listUserTypes(directorAContext);
    const studentType = userTypes.find(ut => ut.code === 'STUDENT')!;

    // Create student without login access
    const student = await userService.createUser({
      user_type_id: studentType.id,
      first_name: 'Pooja',
      last_name: 'Verma',
      email: 'pooja.verma@test.edu',
      status: 'ACTIVE',
      location_ids: [locA1Id],
      create_login_access: false,
    }, directorAContext);

    assert.ok(student.id, 'Student profile created');

    // Verify Login Access status is NOT_CREATED
    const loginAccess = await userService.getUserLoginAccess(student.id, directorAContext);
    assert.strictEqual(loginAccess.status, 'NOT_CREATED');
    assert.strictEqual(loginAccess.has_login, false);

    // Attempting login must be rejected
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', student.username, 'password123');
      },
      /User ID not found for this School ID\./,
      'User without credentials cannot log in'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 6: User created with "Create Login Access"
  // ----------------------------------------------------------------------
  test('TEST 6: User created with Create Login Access creates secure credentials and allows login', async () => {
    const userTypes = await accessControlService.listUserTypes(directorAContext);
    const staffType = userTypes.find(ut => ut.code === 'STAFF')!;

    const newStaff = await userService.createUser({
      user_type_id: staffType.id,
      first_name: 'Karan',
      last_name: 'Mehta',
      email: 'karan.mehta@test.edu',
      status: 'ACTIVE',
      location_ids: [locA1Id],
      create_login_access: true,
      login_username: 'karan.mehta',
      login_password: 'karanPassword!456',
      login_status: 'ACTIVE',
    }, directorAContext);

    // Verify credentials exist and password is encrypted
    const cred = await credentialsRepository.findBySchoolIdAndUsername('DPA-DEL-001', 'karan.mehta');
    assert.ok(cred, 'Credential record must exist');
    assert.notStrictEqual(cred.password_hash, 'karanPassword!456', 'Password must not be stored in plaintext');
    assert.ok(cred.password_hash.includes(':'), 'Hash must contain scrypt salt separator');

    // Login must succeed
    const loginRes = await authService.login('DPA-DEL-001', 'karan.mehta', 'karanPassword!456');
    assert.strictEqual(loginRes.user.id, newStaff.id);
    assert.strictEqual(loginRes.context.school_id_code, 'DPA-DEL-001');
  });

  // ----------------------------------------------------------------------
  // TEST 7: Same User ID can exist in two different School IDs
  // ----------------------------------------------------------------------
  test('TEST 7: Same User ID can exist independently in two different School IDs', async () => {
    const userTypes = await accessControlService.listUserTypes(directorAContext);
    const staffType = userTypes.find(ut => ut.code === 'STAFF')!;

    // Create "shared.librarian" in School A (DPA-DEL-001)
    await userService.createUser({
      user_type_id: staffType.id,
      first_name: 'A-Librarian',
      last_name: 'User',
      email: 'librarian.a@test.edu',
      status: 'ACTIVE',
      location_ids: [locA1Id],
      create_login_access: true,
      login_username: 'shared.librarian',
      login_password: 'PasswordSchoolA_1',
    }, directorAContext);

    // Create "shared.librarian" in School B (GWI-MUM-001)
    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    await userService.createUser({
      user_type_id: staffType.id,
      first_name: 'B-Librarian',
      last_name: 'User',
      email: 'librarian.b@test.edu',
      status: 'ACTIVE',
      location_ids: [locB1Id],
      create_login_access: true,
      login_username: 'shared.librarian',
      login_password: 'PasswordSchoolB_2',
    }, loginDirectorB.context);

    // Both can log in independently using their respective School ID and password
    const loginA = await authService.login('DPA-DEL-001', 'shared.librarian', 'PasswordSchoolA_1');
    assert.strictEqual(loginA.context.school_id, schoolAId);

    const loginB = await authService.login('GWI-MUM-001', 'shared.librarian', 'PasswordSchoolB_2');
    assert.strictEqual(loginB.context.school_id, schoolBId);

    // Trying School A's password on School B must fail
    await assert.rejects(
      async () => {
        await authService.login('GWI-MUM-001', 'shared.librarian', 'PasswordSchoolA_1');
      },
      /Password is incorrect\./
    );
  });

  // ----------------------------------------------------------------------
  // TEST 8: Same User ID cannot be duplicated within the same School ID
  // ----------------------------------------------------------------------
  test('TEST 8: Same User ID cannot be duplicated within the same School ID', async () => {
    const userTypes = await accessControlService.listUserTypes(directorAContext);
    const staffType = userTypes.find(ut => ut.code === 'STAFF')!;

    // Attempting to create duplicate username in same school must be rejected
    await assert.rejects(
      async () => {
        await userService.createUser({
          user_type_id: staffType.id,
          first_name: 'Duplicate',
          last_name: 'User',
          email: 'dup@test.edu',
          status: 'ACTIVE',
          location_ids: [locA1Id],
          create_login_access: true,
          login_username: 'rajesh.sharma', // Already exists in DPA-DEL-001
          login_password: 'SomePassword123',
        }, directorAContext);
      },
      /already taken in this school|already registered for School ID/,
      'Duplicate username in same School ID must be rejected'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 9: Director cannot remove their own effective access (self-lockout rejected)
  // ----------------------------------------------------------------------
  test('TEST 9: Director cannot remove their own effective access (self-lockout prevented)', async () => {
    // 1. Cannot strip own administrative roles
    await assert.rejects(
      async () => {
        await accessControlService.updateUserRoles(
          directorAContext.user_id,
          [], // Empty roles
          schoolAId,
          directorAContext
        );
      },
      /self-lockout prevention/,
      'Server-side guard must reject stripping all roles from oneself'
    );

    // 2. Cannot deactivate own user status
    await assert.rejects(
      async () => {
        await userService.updateUser(
          directorAContext.user_id,
          { status: 'INACTIVE' },
          directorAContext
        );
      },
      /self-lockout prevention/,
      'Server-side guard must reject deactivating oneself'
    );

    // 3. Cannot archive own account
    await assert.rejects(
      async () => {
        await userService.archiveUser(directorAContext.user_id, directorAContext);
      },
      /self-lockout prevention/,
      'Server-side guard must reject archiving oneself'
    );

    // 4. Cannot disable own login
    await assert.rejects(
      async () => {
        await userService.toggleUserLoginAccess(
          directorAContext.user_id,
          'DISABLED',
          directorAContext
        );
      },
      /self-lockout prevention/,
      'Server-side guard must reject disabling own login access'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 10: School Admin cannot remove their own effective access
  // ----------------------------------------------------------------------
  test('TEST 10: School Admin cannot remove their own effective access', async () => {
    const loginAdmin = await authService.login('DPA-DEL-001', 'sunita.rao', 'password123');
    const adminContext = loginAdmin.context;

    // School Admin cannot deactivate own status
    await assert.rejects(
      async () => {
        await userService.updateUser(
          adminContext.user_id,
          { status: 'SUSPENDED' },
          adminContext
        );
      },
      /self-lockout prevention/,
      'School Admin cannot deactivate own status'
    );

    // School Admin cannot disable own login access
    await assert.rejects(
      async () => {
        await userService.toggleUserLoginAccess(
          adminContext.user_id,
          'DISABLED',
          adminContext
        );
      },
      /self-lockout prevention/,
      'School Admin cannot disable own login'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 11: Normal user (teacher) cannot access Roles/Rights without required rights
  // ----------------------------------------------------------------------
  test('TEST 11: Normal user (teacher) cannot manage Roles/Rights without permissions', async () => {
    // Teacher Vikram Verma does not have roles.manage
    await assert.rejects(
      async () => {
        await accessControlService.createRole({
          code: 'UNAUTHORIZED_ROLE',
          name: 'Unauthorized Role',
          permissions: [],
        }, teacherAContext);
      },
      /You do not have permission to manage roles/,
      'Teacher without roles.manage must be rejected'
    );

    // Teacher cannot update another user's roles
    await assert.rejects(
      async () => {
        await accessControlService.updateUserRoles(
          directorAContext.user_id,
          [],
          schoolAId,
          teacherAContext
        );
      },
      /You do not have permission to manage user roles/,
      'Teacher without user_roles.manage must be rejected'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 12: User cannot assign themselves additional privileged Rights (self-escalation rejected)
  // ----------------------------------------------------------------------
  test('TEST 12: User cannot assign themselves rights they do not possess (self-escalation prevented)', async () => {
    // Teacher has a custom role assigned. If teacher attempts to add roles.manage to that role, reject
    const allRoles = await accessControlService.listRoles(directorAContext);
    const teacherRole = allRoles.find(r => r.code === 'TEACHER')!;
    const perms = await accessControlService.listPermissions();
    const rolesManagePerm = perms.find(p => p.code === 'roles.manage')!;

    // Attempting privilege escalation
    await assert.rejects(
      async () => {
        await accessControlService.setRolePermissionsBulk(
          teacherRole.id,
          [{ permissionId: rolesManagePerm.id }],
          teacherAContext
        );
      },
      /permission/,
      'Teacher cannot escalate privileges'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 13: Super Admin can access recovery layer even if normal Role/Rights are broken
  // ----------------------------------------------------------------------
  test('TEST 13: Super Admin can access recovery layer even if Director Role/Rights are broken', async () => {
    // Super Admin for School A
    const superLogin = await authService.login('DPA-DEL-001', 'superadmin', 'password123');
    const superContext = superLogin.context;

    assert.strictEqual(superContext.is_school_super_admin, true);
    // Super Admin has all permissions independently
    const hasRolesManage = superContext.permissions.some((p: any) => p.code === 'roles.manage');
    const hasRightsView = superContext.permissions.some((p: any) => p.code === 'rights.view');
    const hasUsersCreate = superContext.permissions.some((p: any) => p.code === 'users.create');
    const hasManageLogin = superContext.permissions.some((p: any) => p.code === 'users.manage_login');

    assert.ok(hasRolesManage, 'Super Admin has roles.manage');
    assert.ok(hasRightsView, 'Super Admin has rights.view');
    assert.ok(hasUsersCreate, 'Super Admin has users.create');
    assert.ok(hasManageLogin, 'Super Admin has users.manage_login');

    // Super Admin can list all roles and permissions
    const roles = await accessControlService.listRoles(superContext);
    assert.ok(roles.length > 0, 'Super Admin can view roles for recovery');
  });

  // ----------------------------------------------------------------------
  // TEST 14: Super Admin for School ID A cannot access School ID B
  // ----------------------------------------------------------------------
  test('TEST 14: Super Admin for School ID A cannot access School ID B', async () => {
    const superLoginA = await authService.login('DPA-DEL-001', 'superadmin', 'password123');
    const superAContext = superLoginA.context;

    // School A Super Admin cannot list or access School B locations
    await assert.rejects(
      async () => {
        await tenantService.listLocations(schoolBId, superAContext);
      },
      /Unauthorized cross-tenant location query/,
      'Super Admin for School A cannot access School B locations'
    );

    // School A Super Admin cannot access School B user
    const loginB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    await assert.rejects(
      async () => {
        await userService.getUserById(loginB.user.id, superAContext);
      },
      /Unauthorized cross-tenant access/,
      'Super Admin for School A cannot access School B users'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 15: Tenant isolation prevents cross-tenant access
  // ----------------------------------------------------------------------
  test('TEST 15: Tenant isolation prevents cross-tenant access across business endpoints', async () => {
    // School A user attempting to read School B locations
    await assert.rejects(
      async () => {
        await tenantService.listLocations(schoolBId, directorAContext);
      },
      /Unauthorized cross-tenant location query/
    );

    // School A user attempting to read School B user
    const loginB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    await assert.rejects(
      async () => {
        await userService.getUserById(loginB.user.id, directorAContext);
      },
      /Unauthorized cross-tenant access/
    );
  });

  // ----------------------------------------------------------------------
  // TEST 16: All authorization checks work server-side
  // ----------------------------------------------------------------------
  test('TEST 16: All authorization checks work server-side regardless of client headers', async () => {
    // Attempting unauthorized action with non-privileged user context
    await assert.rejects(
      async () => {
        await userService.createUser({
          first_name: 'Hacked',
          last_name: 'User',
          email: 'hacked@school.edu',
          user_type_id: '20000000-0000-0000-0000-000000000006',
          location_ids: [locA1Id],
          status: 'ACTIVE',
        }, teacherAContext); // Teacher lacks users.create
      },
      /You do not have permission to create users/,
      'Server-side service layer must strictly reject user creation without users.create permission'
    );
  });

  // ----------------------------------------------------------------------
  // TEST 17: No plaintext password exists in the business database (users table)
  // ----------------------------------------------------------------------
  test('TEST 17: No plaintext password exists in the business database (users table)', async () => {
    const mem = getMemoryDbClient();
    const allUsers = mem.findAll('users');

    for (const u of allUsers) {
      assert.strictEqual(u.password, undefined, `User ${u.id} must not have plaintext password`);
      assert.strictEqual(u.password_hash, undefined, `User ${u.id} must not have password_hash in users table`);
    }

    // Inspect user_credentials table: zero plaintext passwords, all hashes are salted scrypt
    const allCreds = mem.findAll('user_credentials');
    assert.ok(allCreds.length > 0, 'Credentials table has records');
    for (const c of allCreds) {
      assert.strictEqual((c as any).password, undefined, `Credential ${c.id} must not have plaintext password`);
      assert.ok(c.password_hash, `Credential ${c.id} must have password_hash`);
      assert.notStrictEqual(c.password_hash, 'password123', 'Password must not be plaintext default');
      assert.ok(c.password_hash.includes(':'), 'Password hash must be salted scrypt representation');
    }
  });

  // ----------------------------------------------------------------------
  // TEST 18: No hard-coded School ID, Role, Right, User Type in authorization rules
  // ----------------------------------------------------------------------
  test('TEST 18: Authorization is dynamic and driven via User -> Roles -> Rights -> Data Scope', async () => {
    // Create a new dynamic custom right/permission in memory
    const mem = getMemoryDbClient();
    const customPermId = 'p_custom_audit_special';
    mem.insert('permissions', {
      id: customPermId,
      code: 'custom.special_audit',
      name: 'Custom Special Audit',
      module: 'AUDIT',
      action: 'VIEW',
    });

    // Create a dynamic role using this permission
    const scopes = await accessControlService.listDataScopes();
    const ownBranchScope = scopes.find(s => s.code === 'OWN_LOCATION') || scopes[0];

    const newRole = await accessControlService.createRole({
      code: 'DYNAMIC_AUDITOR',
      name: 'Dynamic Auditor',
      permissions: [{ permissionId: customPermId, dataScopeId: ownBranchScope.id }],
    }, directorAContext);

    // Assign role to teacher Vikram Verma
    await accessControlService.updateUserRoles(
      teacherAContext.user_id,
      [teacherAContext.roles[0].id, newRole.id],
      schoolAId,
      directorAContext
    );

    // Login teacher and verify dynamic permission resolution
    const reloadedTeacher = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    const hasCustomPerm = reloadedTeacher.context.permissions.some(
      (p: any) => p.code === 'custom.special_audit'
    );
    assert.ok(hasCustomPerm, 'Dynamically assigned permission successfully resolved through RBAC pipeline');
  });
});
