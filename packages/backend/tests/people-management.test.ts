// ========================================================================
// People & Taxonomy Masters Automated Verification Tests
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { peopleService } from '../src/services/people.service.js';
import { tenantService } from '../src/services/tenant.service.js';
import { userRepository } from '../src/repositories/user.repository.js';

describe('People & Taxonomy Masters Verification', () => {
  let directorAContext: any;
  let directorBContext: any;
  let schoolAId: string;
  let schoolBId: string;
  let delhiBranchId: string;

  before(async () => {
    createApp();
    const loginA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorAContext = loginA.context;
    schoolAId = directorAContext.school_id!;

    const loginB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    directorBContext = loginB.context;
    schoolBId = directorBContext.school_id!;

    const locsA = await tenantService.listLocations(schoolAId, directorAContext);
    delhiBranchId = locsA[0].id;
  });

  // 1. Taxonomy Tenant Isolation
  test('Designations and categories maintain strict tenant isolation', async () => {
    const designationsA = await peopleService.listDesignations(schoolAId);
    const designationsB = await peopleService.listDesignations(schoolBId);

    assert.ok(designationsA.length > 0);
    assert.ok(designationsB.length > 0);

    // School A has PGT Teacher
    assert.ok(designationsA.some(d => d.code === 'DES-PGT'));
    // School B does NOT have PGT Teacher
    assert.ok(!designationsB.some(d => d.code === 'DES-PGT'));
    // All returned designations belong strictly to their respective tenant
    assert.ok(designationsA.every(d => d.school_id === schoolAId));
    assert.ok(designationsB.every(d => d.school_id === schoolBId));
  });

  // 2. Student Onboarding into Universal Users Table
  test('Create student in universal users table with student_profiles record', async () => {
    const student = await peopleService.createStudent(
      schoolAId,
      {
        username: 'kavya.singh',
        email: 'kavya.singh@student.dpa.edu',
        first_name: 'Kavya',
        last_name: 'Singh',
        location_id: delhiBranchId,
        admission_number: 'ADM-2026-999',
        roll_number: '501',
        academic_session: '2026-2027',
        class_name: 'Class 9',
        section_name: 'Section B',
        house: 'Yellow',
        medium: 'English',
        gender: 'FEMALE',
      },
      directorAContext.user_id
    );

    assert.ok(student.id);
    assert.strictEqual(student.school_id, schoolAId);
    assert.strictEqual(student.username, 'kavya.singh');
    assert.strictEqual(student.user_type?.code, 'STUDENT');
    assert.ok(student.student_profile);
    assert.strictEqual(student.student_profile.admission_number, 'ADM-2026-999');
    assert.strictEqual(student.student_profile.class_name, 'Class 9');

    // Confirm it exists in universal users table
    const inUsersTable = await userRepository.findById(student.id, schoolAId);
    assert.ok(inUsersTable);
    assert.strictEqual(inUsersTable.email, 'kavya.singh@student.dpa.edu');
  });

  // 3. Specialized Student Query Filtering
  test('Filter students by academic dimensions (Class, Section, House)', async () => {
    const class10Students = await peopleService.listStudents(schoolAId, {
      className: 'Class 10',
    });
    assert.ok(class10Students.length >= 2);
    assert.ok(class10Students.every(s => s.student_profile?.class_name === 'Class 10'));

    const class10SecA = await peopleService.listStudents(schoolAId, {
      className: 'Class 10',
      sectionName: 'Section A',
    });
    assert.ok(class10SecA.length >= 2);
    assert.ok(class10SecA.every(s => s.student_profile?.section_name === 'Section A'));
  });

  // 4. Duplicate Admission Number Prevention
  test('Prevent duplicate admission number within same tenant', async () => {
    await assert.rejects(
      async () => {
        await peopleService.createStudent(
          schoolAId,
          {
            username: 'duplicate.student',
            email: 'dup@student.dpa.edu',
            first_name: 'Duplicate',
            last_name: 'Test',
            location_id: delhiBranchId,
            admission_number: 'ADM-2026-999', // Already used
            academic_session: '2026-2027',
            class_name: 'Class 9',
          },
          directorAContext.user_id
        );
      },
      /already registered in this school/
    );
  });

  // 5. Staff Onboarding with Designation & Department
  test('Create staff member in universal users table with staff_profiles record', async () => {
    const designations = await peopleService.listDesignations(schoolAId);
    const labAssistantDesig = designations.find(d => d.code === 'DES-LAB')!;

    const staffUser = await peopleService.createStaff(
      schoolAId,
      {
        username: 'sunil.kumar',
        email: 'sunil.kumar@dpa.edu',
        first_name: 'Sunil',
        last_name: 'Kumar',
        location_ids: [delhiBranchId],
        primary_location_id: delhiBranchId,
        user_type_code: 'STAFF',
        employee_code: 'EMP-099',
        designation_id: labAssistantDesig.id,
        department: 'Science Laboratories',
        employment_type: 'PERMANENT',
        joining_date: '2023-01-15',
        experience_years: 5,
      },
      directorAContext.user_id
    );

    assert.ok(staffUser.id);
    assert.strictEqual(staffUser.username, 'sunil.kumar');
    assert.strictEqual(staffUser.user_type?.code, 'STAFF');
    assert.ok(staffUser.staff_profile);
    assert.strictEqual(staffUser.staff_profile.employee_code, 'EMP-099');
    assert.strictEqual(staffUser.staff_profile.department, 'Science Laboratories');
    assert.strictEqual(staffUser.staff_profile.designation_id, labAssistantDesig.id);
  });

  // 6. Specialized Staff Query Filtering
  test('Filter staff by department and designation', async () => {
    const scienceStaff = await peopleService.listStaff(schoolAId, {
      department: 'Science Laboratories',
    });
    assert.ok(scienceStaff.length >= 1);
    assert.strictEqual(scienceStaff[0].username, 'sunil.kumar');
  });

  // 7. Taxonomy Synchronization & Aggregated Profile View
  test('Assign taxonomy tags and labels, and retrieve aggregated detailed profile', async () => {
    const students = await peopleService.listStudents(schoolAId, { search: 'Aarav' });
    assert.ok(students.length >= 1);
    const aarav = students[0];

    // Verify hydrated taxonomy tags on Aarav
    assert.ok(aarav.tags && aarav.tags.length > 0);
    assert.ok(aarav.labels && aarav.labels.length > 0);
    assert.strictEqual(aarav.tags[0].name, 'Day Scholar');
    assert.strictEqual(aarav.labels[0].name, 'Merit Scholar');

    // Retrieve full detailed profile
    const detailed = await peopleService.getUserDetailedProfile(schoolAId, aarav.id);
    assert.ok(detailed.user);
    assert.strictEqual(detailed.user.id, aarav.id);
    assert.ok(detailed.student_profile);
    assert.strictEqual(detailed.student_profile.admission_number, 'ADM-2024-001');
    assert.ok(Array.isArray(detailed.audit_history));
  });
});
