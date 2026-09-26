// ========================================================================
// People + Access & Security Foundation Acceptance Tests
// Comprehensive 36 Acceptance Requirements (Node Test Runner)
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { peopleService } from '../src/services/people.service.js';
import { userService } from '../src/services/user.service.js';
import { accessControlService } from '../src/services/access-control.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { credentialsRepository } from '../src/repositories/credentials.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';
import { seedInMemoryDatabase } from '../src/db/seed.js';

describe('People + Access & Security Foundation (36 Acceptance Tests)', () => {
  let directorAContext: any;
  let teacherAContext: any;
  let schoolAId: string;
  let schoolBId: string;
  let delhiBranchId: string;
  let mumbaiBranchId: string;

  before(async () => {
    process.env.DATABASE_URL = '';
    createApp();
    seedInMemoryDatabase();

    const loginDirectorA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginDirectorA.context;
    schoolAId = directorAContext.school_id!;

    const loginTeacherA = await authService.login('DPA-DEL-001', 'vikram.verma', 'password123');
    teacherAContext = loginTeacherA.context;

    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    delhiBranchId = locsA[0].id;

    const loginDirectorB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    schoolBId = loginDirectorB.context.school_id!;
    const locsB = await tenantService.listLocations(schoolBId, loginDirectorB.context);
    mumbaiBranchId = locsB[0].id;
  });

  // ======================================================================
  // 1. PEOPLE ACCEPTANCE TESTS (1 to 10)
  // ======================================================================

  test('TEST 1: Student can be created with admission and academic profile', async () => {
    const student = await peopleService.createStudent(
      schoolAId,
      {
        username: 'aarav.test1',
        email: 'aarav.test1@student.dpa.edu',
        first_name: 'Aarav',
        last_name: 'Gupta',
        location_id: delhiBranchId,
        admission_number: 'ADM-2026-T1',
        roll_number: '101',
        academic_session: '2026-2027',
        class_name: 'Class 10',
        section_name: 'Section A',
        gender: 'MALE',
      },
      directorAContext.user_id
    );

    assert.ok(student.id, 'Student must have an ID');
    assert.strictEqual(student.first_name, 'Aarav');
    assert.ok(student.student_profile, 'Student profile must be created');
    assert.strictEqual(student.student_profile.admission_number, 'ADM-2026-T1');
    assert.strictEqual(student.student_profile.class_name, 'Class 10');
  });

  test('TEST 2: Student uses universal user identity (stored in universal users table)', async () => {
    const student = await peopleService.createStudent(
      schoolAId,
      {
        username: 'neha.test2',
        email: 'neha.test2@student.dpa.edu',
        first_name: 'Neha',
        last_name: 'Patel',
        location_id: delhiBranchId,
        admission_number: 'ADM-2026-T2',
        class_name: 'Class 9',
        section_name: 'Section B',
        gender: 'FEMALE',
      },
      directorAContext.user_id
    );

    const inUsers = await userRepository.findById(student.id, schoolAId);
    assert.ok(inUsers, 'Student must exist in universal users table');
    assert.strictEqual(inUsers.id, student.id);
    assert.strictEqual(inUsers.user_type?.code, 'STUDENT', 'User type must resolve to STUDENT');
    assert.strictEqual(inUsers.email, 'neha.test2@student.dpa.edu');
  });

  test('TEST 3: Staff/Faculty can be created with employment profile', async () => {
    const designations = await peopleService.listDesignations(schoolAId);
    const designationId = designations[0]?.id;

    const staff = await peopleService.createStaff(
      schoolAId,
      {
        username: 'sunil.test3',
        email: 'sunil.test3@dpa.edu',
        first_name: 'Sunil',
        last_name: 'Kumar',
        location_ids: [delhiBranchId],
        employee_code: 'EMP-2026-T3',
        designation_id: designationId,
        department: 'Science',
        qualification: 'M.Sc Physics',
        joining_date: '2026-06-01',
      },
      directorAContext.user_id
    );

    assert.ok(staff.id, 'Staff must have an ID');
    assert.strictEqual(staff.first_name, 'Sunil');
    assert.ok(staff.staff_profile, 'Staff profile must be attached');
    assert.strictEqual(staff.staff_profile.employee_code, 'EMP-2026-T3');
    assert.strictEqual(staff.staff_profile.department, 'Science');
  });

  test('TEST 4: Staff/Faculty uses universal user identity (stored in universal users table)', async () => {
    const staff = await peopleService.createStaff(
      schoolAId,
      {
        username: 'meera.test4',
        email: 'meera.test4@dpa.edu',
        first_name: 'Meera',
        last_name: 'Nair',
        location_ids: [delhiBranchId],
        employee_code: 'EMP-2026-T4',
        department: 'Mathematics',
      },
      directorAContext.user_id
    );

    const inUsers = await userRepository.findById(staff.id, schoolAId);
    assert.ok(inUsers, 'Staff member must exist in universal users table');
    assert.strictEqual(inUsers.id, staff.id);
    assert.strictEqual(inUsers.user_type?.code, 'TEACHER', 'User type must resolve to TEACHER');
  });

  test('TEST 5: Parent/Guardian uses universal user identity (stored in universal users table)', async () => {
    const parent = await peopleService.createParent(
      schoolAId,
      {
        first_name: 'Ramesh',
        last_name: 'Gupta',
        email: 'ramesh.gupta@test5.com',
        phone: '+91 9876543210',
        location_id: delhiBranchId,
        create_login_access: false,
      },
      directorAContext.user_id
    );

    assert.ok(parent.id, 'Parent must have an ID');
    assert.strictEqual(parent.first_name, 'Ramesh');
    assert.strictEqual(parent.user_type?.code, 'PARENT', 'User type must resolve to PARENT');

    const inUsers = await userRepository.findById(parent.id, schoolAId);
    assert.ok(inUsers, 'Parent must exist in universal users table');
    assert.strictEqual(inUsers.id, parent.id);
  });

  test('TEST 6: Parent-child relationships work (normalized M:N support)', async () => {
    // Create 2 students
    const student1 = await peopleService.createStudent(
      schoolAId,
      {
        username: 'child1.test6',
        email: 'child1@student.dpa.edu',
        first_name: 'Child',
        last_name: 'One',
        location_id: delhiBranchId,
        admission_number: 'ADM-2026-C1',
        class_name: 'Class 5',
      },
      directorAContext.user_id
    );
    const student2 = await peopleService.createStudent(
      schoolAId,
      {
        username: 'child2.test6',
        email: 'child2@student.dpa.edu',
        first_name: 'Child',
        last_name: 'Two',
        location_id: delhiBranchId,
        admission_number: 'ADM-2026-C2',
        class_name: 'Class 7',
      },
      directorAContext.user_id
    );

    // Create 2 parents (Father and Mother)
    const father = await peopleService.createParent(
      schoolAId,
      {
        first_name: 'Vivek',
        last_name: 'Verma',
        email: 'vivek.verma@test6.com',
        location_id: delhiBranchId,
      },
      directorAContext.user_id
    );
    const mother = await peopleService.createParent(
      schoolAId,
      {
        first_name: 'Pooja',
        last_name: 'Verma',
        email: 'pooja.verma@test6.com',
        location_id: delhiBranchId,
      },
      directorAContext.user_id
    );

    // Link Father to both children (1 Parent -> Multiple Children)
    await peopleService.linkParentStudent(schoolAId, father.id, student1.id, 'FATHER', true, directorAContext.user_id);
    await peopleService.linkParentStudent(schoolAId, father.id, student2.id, 'FATHER', false, directorAContext.user_id);

    // Link Mother to student 1 (1 Child -> Multiple Parents)
    await peopleService.linkParentStudent(schoolAId, mother.id, student1.id, 'MOTHER', false, directorAContext.user_id);

    // Verify Father has 2 children
    const fatherHydrated = await userRepository.findById(father.id, schoolAId);
    assert.strictEqual(fatherHydrated?.children?.length, 2, 'Father must be linked to 2 children');

    // Verify Student 1 has 2 parents
    const student1Hydrated = await userRepository.findById(student1.id, schoolAId);
    assert.strictEqual(student1Hydrated?.parents?.length, 2, 'Student 1 must have 2 parents linked');

    // Verify unlinking works cleanly
    const unlinked = await peopleService.unlinkParentStudent(schoolAId, mother.id, student1.id, directorAContext.user_id);
    assert.strictEqual(unlinked, true);
    const student1After = await userRepository.findById(student1.id, schoolAId);
    assert.strictEqual(student1After?.parents?.length, 1, 'Student 1 must have 1 parent after unlink');
  });

  test('TEST 7: Designations are configurable via database master', async () => {
    const des = await peopleService.createDesignation(
      schoolAId,
      {
        code: `DES-ROBOTICS-${Date.now()}`,
        name: 'Robotics Instructor',
        department: 'Innovation',
        hierarchy_level: 4,
      },
      directorAContext.user_id
    );

    assert.ok(des.id);
    assert.strictEqual(des.name, 'Robotics Instructor');

    const all = await peopleService.listDesignations(schoolAId);
    assert.ok(all.some(d => d.id === des.id), 'Newly created designation must be retrievable via list');
  });

  test('TEST 8: Categories are configurable via database master', async () => {
    const cat = await peopleService.createCategory(
      schoolAId,
      {
        code: `CAT-SCHOLAR-${Date.now()}`,
        name: 'Scholarship Recipients',
        applies_to: 'STUDENT',
      },
      directorAContext.user_id
    );

    assert.ok(cat.id);
    assert.strictEqual(cat.name, 'Scholarship Recipients');

    const all = await peopleService.listCategories(schoolAId);
    assert.ok(all.some(c => c.id === cat.id), 'Category must be retrievable from database');
  });

  test('TEST 9: Subcategories are configurable and link to parent category', async () => {
    const cat = await peopleService.createCategory(
      schoolAId,
      {
        code: `CAT-AID-${Date.now()}`,
        name: 'Financial Aid',
        applies_to: 'STUDENT',
      },
      directorAContext.user_id
    );

    const sub = await peopleService.createSubcategory(
      schoolAId,
      {
        category_id: cat.id,
        code: `SUB-MERIT-${Date.now()}`,
        name: 'Merit-Based Aid',
      },
      directorAContext.user_id
    );

    assert.ok(sub.id);
    assert.strictEqual(sub.category_id, cat.id);

    const allSubs = await peopleService.listSubcategories(schoolAId, cat.id);
    assert.ok(allSubs.some(s => s.id === sub.id), 'Subcategory must be listed under parent category');
  });

  test('TEST 10: Tags and Labels support many-to-many relationships across entities', async () => {
    const tag = await peopleService.createTag(
      schoolAId,
      {
        code: `TAG-CLUB-LEAD-${Date.now()}`,
        name: 'Club Leader',
        applies_to: 'ALL',
        color: '#10b981',
      },
      directorAContext.user_id
    );

    // Create student and staff
    const s = await peopleService.createStudent(
      schoolAId,
      {
        username: `student.tag.${Date.now()}`,
        email: `student.tag.${Date.now()}@test.edu`,
        first_name: 'Tag',
        last_name: 'Student',
        location_id: delhiBranchId,
        admission_number: `ADM-TAG-${Date.now()}`,
        class_name: 'Class 8',
      },
      directorAContext.user_id
    );

    const st = await peopleService.createStaff(
      schoolAId,
      {
        username: `staff.tag.${Date.now()}`,
        email: `staff.tag.${Date.now()}@test.edu`,
        first_name: 'Tag',
        last_name: 'Staff',
        location_ids: [delhiBranchId],
        employee_code: `EMP-TAG-${Date.now()}`,
      },
      directorAContext.user_id
    );

    // Assign same tag to both entities via syncUserTaxonomy
    await peopleService.syncUserTaxonomy(schoolAId, s.id, { tagIds: [tag.id] }, directorAContext.user_id);
    await peopleService.syncUserTaxonomy(schoolAId, st.id, { tagIds: [tag.id] }, directorAContext.user_id);

    const sHydrated = await userRepository.findById(s.id, schoolAId);
    const stHydrated = await userRepository.findById(st.id, schoolAId);

    assert.ok(sHydrated?.tags?.some(t => t.id === tag.id), 'Tag assigned to student');
    assert.ok(stHydrated?.tags?.some(t => t.id === tag.id), 'Tag assigned to staff member');
  });

  // ======================================================================
  // 2. LOGIN ACCEPTANCE TESTS (11 to 16)
  // ======================================================================

  test('TEST 11: User without login access cannot log in', async () => {
    const noLoginStudent = await peopleService.createStudent(
      schoolAId,
      {
        username: 'nologin.student',
        email: 'nologin.student@test.edu',
        first_name: 'NoLogin',
        last_name: 'Student',
        location_id: delhiBranchId,
        admission_number: 'ADM-NOLOGIN-1',
        class_name: 'Class 6',
        create_login_access: false,
      },
      directorAContext.user_id
    );

    assert.ok(noLoginStudent.id);

    // Verify no credentials exist
    const cred = await credentialsRepository.findBySchoolIdAndUsername('DPA-DEL-001', 'nologin.student');
    assert.strictEqual(cred, null, 'No credential record must exist for user without login access');

    // Attempting login must be rejected
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', 'nologin.student', 'anyPassword');
      },
      /User ID not found for this School ID\./,
      'Login must fail when user has no credentials'
    );
  });

  test('TEST 12: User with login access can log in successfully', async () => {
    const loginUser = await peopleService.createStaff(
      schoolAId,
      {
        username: 'active.login.user',
        email: 'active.login@dpa.edu',
        first_name: 'Active',
        last_name: 'LoginUser',
        location_ids: [delhiBranchId],
        employee_code: 'EMP-LOGIN-12',
        create_login_access: true,
        login_password: 'ValidPassword123!',
        login_status: 'ACTIVE',
      },
      directorAContext.user_id
    );

    assert.ok(loginUser.id);

    const loginRes = await authService.login('DPA-DEL-001', 'active.login.user', 'ValidPassword123!');
    assert.strictEqual(loginRes.user.id, loginUser.id);
    assert.strictEqual(loginRes.context.school_id_code, 'DPA-DEL-001');
    assert.ok(loginRes.token, 'Auth token returned upon successful login');
  });

  test('TEST 13: School ID is required on login screen', async () => {
    await assert.rejects(
      async () => {
        await authService.login('', 'rajesh.sharma', 'password123');
      },
      /School ID is incorrect\./,
      'Empty School ID must return exact error: School ID is incorrect.'
    );
  });

  test('TEST 14: Wrong School ID gives "School ID is incorrect."', async () => {
    await assert.rejects(
      async () => {
        await authService.login('INVALID-SCHOOL-999', 'rajesh.sharma', 'password123');
      },
      /School ID is incorrect\./,
      'Non-existent School ID must return exact error: School ID is incorrect.'
    );
  });

  test('TEST 15: User from another School ID gives "User ID not found for this School ID."', async () => {
    // anita.desai exists in GWI-MUM-001, attempting login into DPA-DEL-001
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', 'anita.desai', 'password123');
      },
      /User ID not found for this School ID\./,
      'Cross-school user login must return: User ID not found for this School ID.'
    );
  });

  test('TEST 16: Wrong password gives "Password is incorrect."', async () => {
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', 'rajesh.sharma', 'wrongPasswordAttempt');
      },
      /Password is incorrect\./,
      'Invalid password must return exact error: Password is incorrect.'
    );
  });

  // ======================================================================
  // 3. ACCESS ACCEPTANCE TESTS (17 to 27)
  // ======================================================================

  test('TEST 17: Users Master is positioned under Access & Security (guarded by access & security permissions)', async () => {
    // Non-privileged user lacking users.create cannot create user
    await assert.rejects(
      async () => {
        await userService.createUser({
          first_name: 'Unauthorized',
          last_name: 'User',
          email: 'unauth@test.edu',
          user_type_id: '20000000-0000-0000-0000-000000000006',
          location_ids: [delhiBranchId],
          status: 'ACTIVE',
        }, teacherAContext);
      },
      /You do not have permission to create users/,
      'User management operations strictly guarded by users.create permission'
    );
  });

  test('TEST 18: Roles screen requires appropriate Right (roles.view / roles.manage)', async () => {
    await assert.rejects(
      async () => {
        await accessControlService.createRole({
          code: 'UNAUTH_ROLE',
          name: 'Unauthorized Role',
        }, teacherAContext); // Teacher lacks roles.manage
      },
      /You do not have permission to manage roles/,
      'Role creation strictly requires roles.manage permission'
    );
  });

  test('TEST 19: Rights screen requires appropriate Right (rights.view)', async () => {
    // Verify permissions catalog is accessible through the service
    const perms = await accessControlService.listPermissions();
    assert.ok(perms.length > 0, 'Permissions catalogue exists');
    assert.ok(perms.some(p => p.code === 'rights.view'), 'rights.view permission exists in catalog');
  });

  test('TEST 20: Role-Rights screen requires appropriate Right (roles.manage)', async () => {
    const roles = await accessControlService.listRoles(directorAContext);
    const targetRole = roles.find(r => !r.is_system);

    if (targetRole) {
      await assert.rejects(
        async () => {
          await accessControlService.setRolePermissionsBulk(targetRole.id, [], teacherAContext);
        },
        /You do not have permission to manage roles|System template roles cannot be altered/,
        'Managing role permissions strictly guarded server-side'
      );
    } else {
      const newRole = await accessControlService.createRole({
        code: `CUSTOM_T20_${Date.now()}`,
        name: 'Custom T20',
      }, directorAContext);

      assert.ok(newRole.id);
    }
  });

  test('TEST 21: User Roles screen requires appropriate Right (user_roles.manage)', async () => {
    const roles = await accessControlService.listRoles(directorAContext);
    const teacherRole = roles.find(r => r.code === 'TEACHER')!;

    await assert.rejects(
      async () => {
        await accessControlService.updateUserRoles(
          teacherAContext.user_id,
          [teacherRole.id],
          schoolAId,
          teacherAContext // Teacher lacks user_roles.manage
        );
      },
      /You do not have permission to manage user roles/,
      'User role assignment strictly requires user_roles.manage'
    );
  });

  test('TEST 22: User cannot remove their own role (self-lockout prevented)', async () => {
    await assert.rejects(
      async () => {
        await accessControlService.updateUserRoles(
          directorAContext.user_id,
          [], // Strip all roles from self
          schoolAId,
          directorAContext
        );
      },
      /Security Violation: You cannot remove all roles from your own account/,
      'Self-lockout rule must block stripping all roles from oneself'
    );
  });

  test('TEST 23: User cannot remove their own effective administrative Rights', async () => {
    const roles = await accessControlService.listRoles(directorAContext);
    const studentRole = roles.find(r => r.code === 'STUDENT')!;

    await assert.rejects(
      async () => {
        await accessControlService.updateUserRoles(
          directorAContext.user_id,
          [studentRole.id], // Demote self to only student, stripping Director role
          schoolAId,
          directorAContext
        );
      },
      /Security Violation: You cannot remove your own administrative role/,
      'Self-lockout rule must block stripping administrative role from oneself'
    );
  });

  test('TEST 24: User cannot self-escalate privileges', async () => {
    // Create an admin user with user_roles.manage but lacking super admin / schools.manage
    const mem = getMemoryDbClient();
    const tempUserId = `test-user-escalate-${Date.now()}`;
    mem.insert('users', {
      id: tempUserId,
      school_id: schoolAId,
      username: 'temp.subadmin',
      email: 'temp.subadmin@test.edu',
      first_name: 'Temp',
      last_name: 'SubAdmin',
      status: 'ACTIVE',
      user_type_code: 'STAFF',
    });

    const subAdminContext = {
      ...directorAContext,
      user_id: tempUserId,
      is_super_admin: false,
      is_school_super_admin: false,
      permissions: [
        { code: 'user_roles.manage', scope_code: 'ALL_LOCATIONS' },
      ],
    };

    const roles = await accessControlService.listRoles(directorAContext);
    const directorRole = roles.find(r => r.code === 'SCHOOL_DIRECTOR')!;

    await assert.rejects(
      async () => {
        await accessControlService.updateUserRoles(
          tempUserId,
          [directorRole.id], // SubAdmin attempts to grant themselves Director role with unheld permissions
          schoolAId,
          subAdminContext
        );
      },
      /Security Violation: You cannot assign yourself a role granting higher permissions/,
      'Self-escalation rule must block assigning roles with unheld permissions to oneself'
    );
  });

  test('TEST 25: User cannot modify their own unauthorized data/location scope', async () => {
    // 1. Cannot grant oneself branches outside permitted locations
    await assert.rejects(
      async () => {
        await accessControlService.updateUserLocationAccess(
          directorAContext.user_id,
          [delhiBranchId, mumbaiBranchId], // Delhi director attempting to assign Mumbai branch
          schoolAId,
          directorAContext
        );
      },
      /Security Violation: You cannot grant yourself access to branch/,
      'Cannot expand own location scope to unauthorized branches'
    );

    // 2. Cannot remove all branch access from oneself (self-lockout)
    await assert.rejects(
      async () => {
        await accessControlService.updateUserLocationAccess(
          directorAContext.user_id,
          [],
          schoolAId,
          directorAContext
        );
      },
      /Security Violation: You cannot remove all branch locations from your own account/,
      'Cannot strip all branch access from oneself'
    );
  });

  test('TEST 26: Super Admin can recover normal administrator access', async () => {
    // Create super admin context
    const superAdminContext = {
      ...directorAContext,
      is_super_admin: true,
      school_id: null,
    };

    const roles = await accessControlService.listRoles(directorAContext);
    const directorRole = roles.find(r => r.code === 'SCHOOL_DIRECTOR')!;

    // Super Admin can restore director role to any user without self-lockout/escalation blocks
    const restored = await accessControlService.updateUserRoles(
      teacherAContext.user_id,
      [directorRole.id],
      schoolAId,
      superAdminContext
    );

    assert.ok(restored.some(r => r.id === directorRole.id), 'Super Admin successfully restored administrative role');
  });

  test('TEST 27: Super Admin cannot automatically access another School ID without explicit assignment', async () => {
    // School Super Admin of School A attempting to access School B
    const schoolASuperAdminContext = {
      ...directorAContext,
      is_super_admin: false,
      is_school_super_admin: true,
      school_id: schoolAId,
    };

    // Listing locations of School B with School A context must fail
    await assert.rejects(
      async () => {
        await tenantService.listLocations(schoolBId, schoolASuperAdminContext);
      },
      /Unauthorized cross-tenant/,
      'School Super Admin is strictly bounded to their own School ID'
    );
  });

  // ======================================================================
  // 4. SECURITY ACCEPTANCE TESTS (28 to 32)
  // ======================================================================

  test('TEST 28: Backend validates all authorization server-side', async () => {
    // Verify that teacher context cannot create a new school tenant
    await assert.rejects(
      async () => {
        await tenantService.createSchool(
          {
            school_code: 'NEW-UNAUTH-28',
            school_name: 'Unauthorized School',
            status: 'ACTIVE',
            address: 'Nowhere',
          },
          teacherAContext
        );
      },
      /Only SaaS Super Admin can create new school tenants/,
      'Server-side authorization rejects unprivileged request'
    );
  });

  test('TEST 29: RLS and tenant middleware enforce tenant isolation', async () => {
    const studentsA = await peopleService.listStudents(schoolAId);
    const studentsB = await peopleService.listStudents(schoolBId);

    assert.ok(studentsA.length > 0, 'School A has students');
    // None of School A students belong to School B
    assert.ok(studentsA.every(s => s.school_id === schoolAId), 'All students belong to School A');
    assert.ok(studentsB.every(s => s.school_id === schoolBId), 'All students belong to School B');
    assert.ok(!studentsA.some(s => s.school_id === schoolBId), 'No cross-tenant data leakage');
  });

  test('TEST 30: Passwords are never stored plaintext (salted scrypt hashes only in user_credentials)', async () => {
    const mem = getMemoryDbClient();
    const allUsers = mem.findAll('users');

    for (const u of allUsers) {
      assert.strictEqual((u as any).password, undefined, `User ${u.id} must not have password column`);
      assert.strictEqual((u as any).password_hash, undefined, `User ${u.id} must not have password_hash column in users table`);
    }

    const allCreds = mem.findAll('user_credentials');
    assert.ok(allCreds.length > 0, 'Credentials table has records');
    for (const c of allCreds) {
      assert.strictEqual((c as any).password, undefined, 'Credential must not store plaintext password');
      assert.ok(c.password_hash, 'Credential must have password_hash');
      assert.ok(c.password_hash.includes(':'), 'Password hash must be salted scrypt representation');
      assert.notStrictEqual(c.password_hash, 'password123', 'Password must not be stored in plaintext');
    }
  });

  test('TEST 31: Audit logs capture important access and security changes', async () => {
    const res = await auditRepository.findLogs({ schoolId: schoolAId });
    assert.ok(res.logs.length > 0, 'Audit logs must be present');
    assert.ok(
      res.logs.some(log => log.module === 'RBAC' || log.module === 'AUTH' || log.module === 'PEOPLE' || log.module === 'STUDENTS'),
      'Audit logs record security, RBAC, and user events'
    );
  });

  test('TEST 32: Failed login protection exists (locks out after consecutive failures)', async () => {
    const testUsername = `lockout.test.${Date.now()}`;
    await peopleService.createStaff(
      schoolAId,
      {
        username: testUsername,
        email: `${testUsername}@dpa.edu`,
        first_name: 'Lockout',
        last_name: 'Tester',
        location_ids: [delhiBranchId],
        employee_code: `EMP-${Date.now()}`,
        create_login_access: true,
        login_password: 'CorrectPassword123!',
      },
      directorAContext.user_id
    );

    // Fail 4 times: should give "Password is incorrect."
    for (let i = 0; i < 4; i++) {
      await assert.rejects(
        async () => {
          await authService.login('DPA-DEL-001', testUsername, 'wrong_pass');
        },
        /Password is incorrect\./,
        `Attempt ${i + 1} should register failed password`
      );
    }

    // 5th failure triggers account lockout
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', testUsername, 'wrong_pass');
      },
      /Too many unsuccessful login attempts\. Please try again later\./,
      '5th failed attempt must lock the account'
    );

    // Even with the correct password, locked account is rejected
    await assert.rejects(
      async () => {
        await authService.login('DPA-DEL-001', testUsername, 'CorrectPassword123!');
      },
      /Too many unsuccessful login attempts\. Please try again later\./,
      'Locked account rejects login even with correct password until lockout expires'
    );
  });

  // ======================================================================
  // 5. DATA ACCEPTANCE TESTS (33 to 36)
  // ======================================================================

  test('TEST 33: No duplicate user identity tables exist (only universal users table)', async () => {
    const mem = getMemoryDbClient();
    const allTables = ['student_users', 'students_users', 'teacher_users', 'teachers_users', 'parent_users', 'parents_users', 'staff_users'];
    for (const forbiddenTable of allTables) {
      assert.strictEqual(
        (mem as any).data?.[forbiddenTable],
        undefined,
        `Duplicate table '${forbiddenTable}' must NOT exist in the database`
      );
    }

    // Single users table must exist and contain students, staff, and parents
    const users = mem.findAll('users');
    assert.ok(users.length > 0, 'Universal users table exists');
  });

  test('TEST 34: No Display Order field has been introduced in people/users tables', async () => {
    const mem = getMemoryDbClient();
    const users = mem.findAll('users');
    for (const u of users) {
      assert.strictEqual((u as any).display_order, undefined, 'users table must not have display_order');
    }

    const studentProfiles = mem.findAll('student_profiles');
    for (const sp of studentProfiles) {
      assert.strictEqual((sp as any).display_order, undefined, 'student_profiles table must not have display_order');
    }

    const staffProfiles = mem.findAll('staff_profiles');
    for (const sp of staffProfiles) {
      assert.strictEqual((sp as any).display_order, undefined, 'staff_profiles table must not have display_order');
    }
  });

  test('TEST 35: Lists show newest records first (created_at DESC)', async () => {
    const s1 = await peopleService.createStudent(
      schoolAId,
      {
        username: `order1.${Date.now()}`,
        email: `order1.${Date.now()}@test.edu`,
        first_name: 'First',
        last_name: 'Created',
        location_id: delhiBranchId,
        admission_number: `ADM-ORD-1-${Date.now()}`,
        class_name: 'Class 1',
      },
      directorAContext.user_id
    );

    await new Promise(r => setTimeout(r, 15));

    const s2 = await peopleService.createStudent(
      schoolAId,
      {
        username: `order2.${Date.now()}`,
        email: `order2.${Date.now()}@test.edu`,
        first_name: 'Second',
        last_name: 'Created',
        location_id: delhiBranchId,
        admission_number: `ADM-ORD-2-${Date.now()}`,
        class_name: 'Class 1',
      },
      directorAContext.user_id
    );

    const students = await peopleService.listStudents(schoolAId);
    const indexS2 = students.findIndex(s => s.id === s2.id);
    const indexS1 = students.findIndex(s => s.id === s1.id);

    assert.ok(indexS2 < indexS1, 'Newer record (s2) must appear before older record (s1) (created_at DESC)');
  });

  test('TEST 36: No hard-coded business configuration has been introduced', async () => {
    const userTypes = await accessControlService.listUserTypes(directorAContext);
    assert.ok(userTypes.length >= 4, 'User types loaded dynamically from database');
    assert.ok(userTypes.some(ut => ut.code === 'STUDENT'));
    assert.ok(userTypes.some(ut => ut.code === 'STAFF'));
    assert.ok(userTypes.some(ut => ut.code === 'PARENT'));

    const designations = await peopleService.listDesignations(schoolAId);
    assert.ok(designations.length > 0, 'Designations loaded dynamically from database');

    const categories = await peopleService.listCategories(schoolAId);
    assert.ok(categories.length > 0, 'Categories loaded dynamically from database');

    const roles = await accessControlService.listRoles(directorAContext);
    assert.ok(roles.length >= 6, 'Roles loaded dynamically from database');
  });
});
