// ========================================================================
// Student Admission & Staff Onboarding + Scope Workflows Acceptance Tests
// Verifies:
// 1. Student admission creates academic placement without granting user_location_access.
// 2. Staff onboarding assigns multi-branch access (with primary) and multiple roles.
// 3. Child entities (records, achievements, qualifications, experience, certs, docs) persist.
// 4. Login creation toggle allows optional password when disabled.
// 5. Access / Data Scope returns accurate location_ids for users.
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { authService } from '../src/services/auth.service.js';
import { peopleService } from '../src/services/people.service.js';
import { academicService } from '../src/services/academic.service.js';
import { accessControlService } from '../src/services/access-control.service.js';
import { accessControlRepository } from '../src/repositories/access-control.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { locationRepository } from '../src/repositories/location.repository.js';
import { credentialsRepository } from '../src/repositories/credentials.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';

describe('Student Admission & Staff Onboarding + Scope Workflows', () => {
  let directorContext: any;
  let schoolAId: string;
  let branchA1Id: string;
  let branchA2Id: string;

  before(async () => {
    createApp();
    seedInMemoryDatabase();

    const loginRes = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorContext = loginRes.context;
    schoolAId = directorContext.school_id!;

    const locs = await locationRepository.findBySchoolId(schoolAId);
    assert.ok(locs.length >= 2, 'Should have at least 2 locations for School A');
    branchA1Id = locs[0].id;
    branchA2Id = locs[1].id;
  });

  test('TEST 1: Student admission does NOT create user_location_access (location is strictly academic)', async () => {
    // Get active academic session and classes
    const session = await academicService.getCurrentSession(schoolAId);
    assert.ok(session, 'Active session required');
    const classes = await academicService.listClasses(schoolAId);
    assert.ok(classes.length > 0, 'Classes required');
    const testClass = classes[0];
    const sections = await academicService.listSections(schoolAId);
    const testSection = sections[0];

    const studentUser = await peopleService.createStudent(
      schoolAId,
      {
        first_name: 'Aarav',
        middle_name: 'Kumar',
        last_name: 'Verma',
        username: 'aarav.verma.2026',
        email: 'aarav.verma@example.com',
        phone: '9876500001',
        gender: 'MALE',
        date_of_birth: '2012-05-15',
        blood_group: 'B+',
        nationality: 'Indian',
        location_id: branchA1Id, // Selected as academic campus
        academic_session_id: session.id,
        class_id: testClass.id,
        section_id: testSection?.id,
        admission_number: 'ADM-2026-9901',
        admission_date: '2026-04-01',
        create_login_access: false,
        previous_academic_records: [
          {
            previous_school_name: 'Greenfield Public School',
            board: 'CBSE',
            class_name: 'Class 5',
            academic_year: '2025-2026',
            marks_grade: '92.5%',
            result: 'PASSED',
            remarks: 'Transferred due to family relocation',
          },
        ],
        achievements: [
          {
            title: 'Inter-School Science Olympiad Gold',
            category: 'Academic',
            level: 'District',
            achievement_date: '2025-11-20',
            description: 'Secured first rank across 45 participating schools',
          },
        ],
        documents: [
          {
            document_type: 'Transfer Certificate',
            document_name: 'Greenfield_TC_Aarav.pdf',
            document_number: 'TC-2026-441',
            file_url: '/uploads/documents/tc-aarav.pdf',
          },
        ],
      },
      directorContext.user_id
    );

    assert.ok(studentUser, 'Student user should be created');
    assert.strictEqual(studentUser.first_name, 'Aarav');

    // CRITICAL: Students do NOT have administrative user_location_access
    const studentLocationAccess = await accessControlRepository.getUserLocationAccess(studentUser.id);
    assert.strictEqual(
      studentLocationAccess.length,
      0,
      'Student must NOT be assigned user_location_access rows! Location belongs strictly to academic placement.'
    );

    // CRITICAL: Academic enrollment must exist with campus placement recorded
    const mem = getMemoryDbClient();
    const enrollments = mem.findAll('student_academic_enrollments', (e: any) => e.student_user_id === studentUser.id);
    assert.strictEqual(enrollments.length, 1, 'Student must have 1 academic enrollment');
    assert.strictEqual(enrollments[0].location_id, branchA1Id, 'Enrollment must record campus location');
    assert.strictEqual(enrollments[0].class_id, testClass.id);
    assert.strictEqual(enrollments[0].admission_number, 'ADM-2026-9901');

    // Hydrated student profile should contain child records
    const hydrated = await userRepository.findById(studentUser.id, schoolAId);
    assert.ok(hydrated?.student_profile, 'Student profile must be present');
    assert.strictEqual(hydrated.student_profile.previous_academic_records?.length, 1);
    assert.strictEqual(
      hydrated.student_profile.previous_academic_records[0].previous_school_name,
      'Greenfield Public School'
    );
    assert.strictEqual(hydrated.student_profile.achievements?.length, 1);
    assert.strictEqual(hydrated.student_profile.achievements[0].title, 'Inter-School Science Olympiad Gold');
    assert.strictEqual(hydrated.student_profile.documents?.length, 1);
    assert.strictEqual(hydrated.student_profile.documents[0].document_name, 'Greenfield_TC_Aarav.pdf');
  });

  test('TEST 2: Student admission with create_login_access: false succeeds without password', async () => {
    const session = await academicService.getCurrentSession(schoolAId);
    const classes = await academicService.listClasses(schoolAId);

    const studentUser = await peopleService.createStudent(
      schoolAId,
      {
        first_name: 'Priya',
        last_name: 'Sharma',
        username: 'priya.sharma.2026',
        email: 'priya.sharma@example.com',
        location_id: branchA1Id,
        academic_session_id: session.id,
        class_id: classes[0].id,
        admission_number: 'ADM-2026-9902',
        create_login_access: false,
        // No login_password provided
      },
      directorContext.user_id
    );

    assert.ok(studentUser.id);
    const creds = await credentialsRepository.findByUserId(studentUser.id);
    assert.strictEqual(creds.length, 0, 'No user_credentials record should exist when login access is disabled');
  });

  test('TEST 3: Staff onboarding with multi-branch assignment, multi-role, and extended records', async () => {
    const roles = await accessControlRepository.getRoles(schoolAId);
    const teacherRole = roles.find(r => r.code === 'TEACHER') || roles[0];
    const examOfficerRole = roles.find(r => r.code === 'EXAM_OFFICER') || roles[1] || teacherRole;

    const designations = await peopleService.listDesignations(schoolAId);
    const pgtDesig = designations[0];

    const staffUser = await peopleService.createStaff(
      schoolAId,
      {
        first_name: 'Sunita',
        middle_name: 'Devi',
        last_name: 'Gupta',
        username: 'sunita.gupta',
        email: 'sunita.gupta@dpa.edu',
        phone: '9811199999',
        gender: 'FEMALE',
        date_of_birth: '1985-08-22',
        user_type_code: 'TEACHER',
        role_ids: [teacherRole.id, examOfficerRole.id],
        location_ids: [branchA1Id, branchA2Id], // MULTI-BRANCH ASSIGNMENT
        primary_location_id: branchA1Id,
        employee_code: 'EMP-9081',
        designation_id: pgtDesig.id,
        department: 'Science & Physics',
        employment_type: 'PERMANENT',
        joining_date: '2026-01-15',
        work_shift: 'Morning (08:00 AM - 02:30 PM)',
        experience_years: 10,
        create_login_access: true,
        login_password: 'StaffPassword@123',
        login_status: 'ACTIVE',
        qualifications: [
          {
            education_level: 'Masters',
            qualification_name: 'M.Sc. Physics',
            institution: 'Delhi University',
            board_university: 'University of Delhi',
            passing_year: 2008,
            marks_grade: 'First Division (8.1 CGPA)',
            specialization: 'Condensed Matter Physics',
          },
          {
            education_level: 'Bachelors',
            qualification_name: 'B.Ed.',
            institution: 'Jamia Millia Islamia',
            board_university: 'Central University',
            passing_year: 2010,
            marks_grade: 'Distinction',
          },
        ],
        experiences: [
          {
            organization: 'St. Mary Senior Secondary School',
            designation: 'PGT Physics Teacher',
            from_date: '2016-04-01',
            to_date: '2025-12-31',
            duration: '9 Years 8 Months',
            responsibilities: 'Taught senior secondary classes 11 and 12, Physics lab head',
          },
        ],
        certifications: [
          {
            certification_name: 'Central Teacher Eligibility Test (CTET Paper II)',
            issuing_organization: 'CBSE',
            credential_number: 'CTET-2015-88219',
            issue_date: '2015-09-10',
          },
        ],
        documents: [
          {
            document_type: 'Resume / CV',
            document_name: 'Sunita_Gupta_Resume.pdf',
            file_url: '/uploads/documents/sunita_resume.pdf',
          },
          {
            document_type: 'Educational Certificate',
            document_name: 'MSc_Physics_Degree.pdf',
            document_number: 'DEG-DU-2008-552',
            file_url: '/uploads/documents/msc_physics.pdf',
          },
        ],
      },
      directorContext.user_id
    );

    assert.ok(staffUser, 'Staff user should be created');

    // CRITICAL: Multi-branch access verified with primary location
    const staffLocAccess = await accessControlRepository.getUserLocationAccess(staffUser.id);
    assert.strictEqual(staffLocAccess.length, 2, 'Staff must have 2 location access records');

    const primaryLoc = staffLocAccess.find(l => l.location_id === branchA1Id);
    const secondaryLoc = staffLocAccess.find(l => l.location_id === branchA2Id);
    assert.ok(primaryLoc?.is_primary, 'Branch A1 must be primary location');
    assert.ok(secondaryLoc && !secondaryLoc.is_primary, 'Branch A2 must be secondary location');

    // Multi-role assignment verified
    const userRoles = await accessControlRepository.getUserRoles(staffUser.id);
    const roleIds = userRoles.map(r => r.id);
    assert.ok(roleIds.includes(teacherRole.id), 'Must have teacher role');
    assert.ok(roleIds.includes(examOfficerRole.id), 'Must have exam officer role');

    // Login credentials created and authenticated
    const creds = await credentialsRepository.findByUserId(staffUser.id);
    assert.strictEqual(creds.length, 1);
    assert.strictEqual(creds[0].username, 'sunita.gupta');

    const authCheck = await authService.login('DPA-DEL-001', 'sunita.gupta', 'StaffPassword@123');
    assert.ok(authCheck.token, 'Staff must be able to log in with created credentials');

    // Hydrated staff profile contains all child entities
    const hydrated = await userRepository.findById(staffUser.id, schoolAId);
    assert.ok(hydrated?.staff_profile, 'Staff profile must exist');
    assert.strictEqual(hydrated.staff_profile.employee_code, 'EMP-9081');
    assert.strictEqual(hydrated.staff_profile.qualifications?.length, 2);
    assert.strictEqual(hydrated.staff_profile.qualifications[0].qualification_name, 'M.Sc. Physics');
    assert.strictEqual(hydrated.staff_profile.experiences?.length, 1);
    assert.strictEqual(hydrated.staff_profile.experiences[0].organization, 'St. Mary Senior Secondary School');
    assert.strictEqual(hydrated.staff_profile.certifications?.length, 1);
    assert.strictEqual(
      hydrated.staff_profile.certifications[0].certification_name,
      'Central Teacher Eligibility Test (CTET Paper II)'
    );
    assert.strictEqual(hydrated.staff_profile.documents?.length, 2);
  });

  test('TEST 4: Access / Data Scope returns actual assigned location_ids (not stale school campus count)', async () => {
    const assignments = await accessControlService.getUserRoleAssignments(schoolAId);
    assert.ok(assignments.length > 0, 'Role assignments must return list of users');

    const sunitaAssignment = assignments.find(a => a.user.username === 'sunita.gupta');
    assert.ok(sunitaAssignment, 'Sunita assignment must exist');
    assert.ok(Array.isArray(sunitaAssignment.location_ids), 'location_ids must be an array');
    assert.strictEqual(
      sunitaAssignment.location_ids.length,
      2,
      'Sunita location_ids must match her 2 assigned branches, not the total school campus count'
    );
    assert.ok(sunitaAssignment.location_ids.includes(branchA1Id));
    assert.ok(sunitaAssignment.location_ids.includes(branchA2Id));
  });

  test('TEST 5: Staff onboarding without login succeeds without password requirement', async () => {
    const designations = await peopleService.listDesignations(schoolAId);

    const staffNoLogin = await peopleService.createStaff(
      schoolAId,
      {
        first_name: 'Anil',
        last_name: 'Kumar',
        username: 'anil.kumar.lab',
        email: 'anil.kumar@dpa.edu',
        user_type_code: 'STAFF',
        location_ids: [branchA1Id],
        primary_location_id: branchA1Id,
        employee_code: 'EMP-9082',
        designation_id: designations[0].id,
        create_login_access: false,
        // No password
      },
      directorContext.user_id
    );

    assert.ok(staffNoLogin.id);
    const creds = await credentialsRepository.findByUserId(staffNoLogin.id);
    assert.strictEqual(creds.length, 0, 'No credentials should exist when create_login_access is false');
  });
});
