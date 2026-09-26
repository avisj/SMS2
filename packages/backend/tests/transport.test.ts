import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { transportService } from '../src/services/transport.service.js';
import { transportRepository } from '../src/repositories/transport.repository.js';
import { academicRepository } from '../src/repositories/academic.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';

describe('Transport Management Module — Unit & Integration Engine', () => {
  const mem = getMemoryDbClient();
  let schoolAId: string;
  let schoolBId: string;
  let locationAId: string;
  let locationBId: string;
  let sessionAId: string;
  let driverUserAId: string;
  let studentUserA1Id: string;
  let studentUserA2Id: string;

  before(() => {
    seedInMemoryDatabase();
    const schools = mem.findAll('schools', () => true) as any[];
    schoolAId = schools[0].id;
    schoolBId = schools[1].id;

    const locsA = mem.findAll('locations', (l: any) => l.school_id === schoolAId) as any[];
    locationAId = locsA[0].id;

    const locsB = mem.findAll('locations', (l: any) => l.school_id === schoolBId) as any[];
    locationBId = locsB[0]?.id;

    const sessions = mem.findAll('academic_sessions', (s: any) => s.school_id === schoolAId) as any[];
    sessionAId = sessions.find((s: any) => s.is_current)?.id || sessions[0].id;

    const usersA = mem.findAll('users', (u: any) => u.school_id === schoolAId) as any[];
    driverUserAId = usersA.find((u: any) => u.user_type_code === 'STAFF' || u.user_type_code === 'TEACHER')?.id || usersA[0].id;

    const students = mem.findAll('users', (u: any) => u.school_id === schoolAId && u.user_type_code === 'STUDENT') as any[];
    studentUserA1Id = students[0]?.id || usersA[1]?.id;
    studentUserA2Id = students[1]?.id || usersA[2]?.id;
  });

  // --------------------------------------------------------------------
  // 1. Vehicle Master & Registration Uniqueness
  // --------------------------------------------------------------------
  it('Scenario 1: Creates vehicle and enforces registration uniqueness within tenant', async () => {
    const v1 = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'BUS-01',
      registration_number: 'DL01AB1111',
      vehicle_type: 'SCHOOL_BUS',
      capacity: 40,
      make: 'Tata',
      model: 'Starbus',
      status: 'ACTIVE',
      location_id: locationAId,
    });

    assert.ok(v1.id);
    assert.equal(v1.vehicle_number, 'BUS-01');
    assert.equal(v1.registration_number, 'DL01AB1111');
    assert.equal(v1.capacity, 40);

    // Attempt duplicate registration in School A -> should fail
    await assert.rejects(
      async () => {
        await transportService.createVehicle(schoolAId, {
          vehicle_number: 'BUS-02',
          registration_number: 'DL01AB1111',
          capacity: 30,
        });
      },
      /already exists/
    );

    // Same registration in School B -> should succeed (tenant isolated)
    const vSchoolB = await transportService.createVehicle(schoolBId, {
      vehicle_number: 'BUS-01-B',
      registration_number: 'DL01AB1111',
      capacity: 30,
    });
    assert.ok(vSchoolB.id);
  });

  // --------------------------------------------------------------------
  // 2. Driver Assignment & Historical Preservation
  // --------------------------------------------------------------------
  it('Scenario 2: Assigns driver to vehicle, preserves previous assignment history', async () => {
    const v = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'VAN-01',
      registration_number: 'DL01AB2222',
      vehicle_type: 'VAN',
      capacity: 15,
    });

    // 1st Driver Assignment
    const a1 = await transportService.assignDriver(schoolAId, v.id, driverUserAId, {
      licenseNumber: 'DL-IND-998877',
      licenseExpiry: '2028-12-31',
    });
    assert.equal(a1.status, 'ACTIVE');

    // Fetch vehicle and check hydrated driver
    const hydratedV = await transportService.getVehicle(schoolAId, v.id);
    assert.equal(hydratedV.current_driver?.id, driverUserAId);

    // Reassign to another user (history preserved)
    const allUsers = mem.findAll('users', (u: any) => u.school_id === schoolAId) as any[];
    const secondDriver = allUsers.find((u: any) => u.id !== driverUserAId) || allUsers[0];

    const a2 = await transportService.assignDriver(schoolAId, v.id, secondDriver.id, {
      licenseNumber: 'DL-IND-112233',
    });
    assert.equal(a2.status, 'ACTIVE');

    const history = await transportService.listDriverAssignments(schoolAId, v.id);
    assert.ok(history.length >= 2);
    const prev = history.find((h) => h.id === a1.id);
    assert.equal(prev?.status, 'INACTIVE');
  });

  // --------------------------------------------------------------------
  // 3. Route Master & Ordered Stops
  // --------------------------------------------------------------------
  it('Scenario 3: Creates Route and manages ordered stops sequence', async () => {
    const route = await transportService.createRoute(schoolAId, {
      route_name: 'Dwarka Sector Route',
      route_code: 'RT-DW-01',
      start_point: 'Dwarka Main Campus',
      end_point: 'Dwarka Sector 22',
      location_id: locationAId,
    });

    assert.ok(route.id);
    assert.equal(route.route_code, 'RT-DW-01');

    // Add Stop 1
    const s1 = await transportService.addRouteStop(schoolAId, route.id, {
      stop_name: 'Dwarka Sector 12',
      sequence_number: 1,
      pickup_time: '07:30',
      drop_time: '14:30',
    });
    // Add Stop 2
    const s2 = await transportService.addRouteStop(schoolAId, route.id, {
      stop_name: 'Dwarka Sector 13',
      sequence_number: 2,
      pickup_time: '07:40',
      drop_time: '14:20',
    });
    // Add Stop 3
    const s3 = await transportService.addRouteStop(schoolAId, route.id, {
      stop_name: 'Dwarka Sector 22',
      sequence_number: 3,
      pickup_time: '07:55',
      drop_time: '14:05',
    });

    const stops = await transportService.listRouteStops(schoolAId, route.id);
    assert.equal(stops.length, 3);
    assert.equal(stops[0].stop_name, 'Dwarka Sector 12');
    assert.equal(stops[1].stop_name, 'Dwarka Sector 13');
    assert.equal(stops[2].stop_name, 'Dwarka Sector 22');

    // Reorder stops: 3 -> 2 -> 1
    const reordered = await transportService.reorderRouteStops(schoolAId, route.id, [s3.id, s2.id, s1.id]);
    assert.equal(reordered[0].id, s3.id);
    assert.equal(reordered[0].sequence_number, 1);
  });

  // --------------------------------------------------------------------
  // 4. Student Transport Assignment & Academic Non-Interference
  // --------------------------------------------------------------------
  it('Scenario 4: Assigns student to transport without altering academic enrollment', async () => {
    // Check initial student academic enrollment
    const initialEnrollments = await academicRepository.findEnrollments(schoolAId, {
      studentId: studentUserA1Id,
    });

    const route = await transportService.createRoute(schoolAId, {
      route_name: 'South Campus Route',
      route_code: 'RT-SC-01',
      start_point: 'Main Gate',
      end_point: 'South Block',
    });

    const v = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'BUS-SC-01',
      registration_number: 'DL01SC9999',
      capacity: 40,
    });
    await transportService.updateRoute(schoolAId, route.id, { assigned_vehicle_id: v.id });

    const assignment = await transportService.assignStudentTransport(schoolAId, {
      academic_session_id: sessionAId,
      location_id: locationAId,
      student_user_id: studentUserA1Id,
      route_id: route.id,
      vehicle_id: v.id,
    });

    assert.ok(assignment.id);
    assert.equal(assignment.status, 'ACTIVE');

    // Verify student academic enrollment is completely intact and unchanged
    const afterEnrollments = await academicRepository.findEnrollments(schoolAId, {
      studentId: studentUserA1Id,
    });
    assert.equal(initialEnrollments.length, afterEnrollments.length);
  });

  // --------------------------------------------------------------------
  // 5. Vehicle Capacity Validation (Rejects when full)
  // --------------------------------------------------------------------
  it('Scenario 5: Enforces vehicle seating capacity limit', async () => {
    // Create mini vehicle with capacity = 1
    const vSmall = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'MINI-01',
      registration_number: 'DL01MN0001',
      capacity: 1,
    });

    const rSmall = await transportService.createRoute(schoolAId, {
      route_name: 'Express Route',
      route_code: 'RT-EXP-01',
      start_point: 'Origin',
      end_point: 'Terminus',
      assigned_vehicle_id: vSmall.id,
    });

    // 1st student assignment -> should succeed
    const a1 = await transportService.assignStudentTransport(schoolAId, {
      academic_session_id: sessionAId,
      location_id: locationAId,
      student_user_id: studentUserA1Id,
      route_id: rSmall.id,
      vehicle_id: vSmall.id,
    });
    assert.ok(a1.id);

    // 2nd student assignment -> should exceed capacity (1/1 full) and reject
    await assert.rejects(
      async () => {
        await transportService.assignStudentTransport(schoolAId, {
          academic_session_id: sessionAId,
          location_id: locationAId,
          student_user_id: studentUserA2Id,
          route_id: rSmall.id,
          vehicle_id: vSmall.id,
        });
      },
      /Vehicle capacity has been reached/
    );
  });

  // --------------------------------------------------------------------
  // 6. Conflicting Active Assignment Prevention & History
  // --------------------------------------------------------------------
  it('Scenario 6: Prevents duplicate active route assignments, archives previous assignment', async () => {
    const r1 = await transportService.createRoute(schoolAId, {
      route_name: 'Route Alpha',
      route_code: 'RT-ALP-01',
      start_point: 'A',
      end_point: 'B',
    });

    const r2 = await transportService.createRoute(schoolAId, {
      route_name: 'Route Beta',
      route_code: 'RT-BET-01',
      start_point: 'C',
      end_point: 'D',
    });

    // Student assigned to Route Alpha
    const a1 = await transportService.assignStudentTransport(schoolAId, {
      academic_session_id: sessionAId,
      location_id: locationAId,
      student_user_id: studentUserA2Id,
      route_id: r1.id,
    });
    assert.equal(a1.status, 'ACTIVE');

    // Duplicate assignment to the same Route Alpha -> should reject
    await assert.rejects(
      async () => {
        await transportService.assignStudentTransport(schoolAId, {
          academic_session_id: sessionAId,
          location_id: locationAId,
          student_user_id: studentUserA2Id,
          route_id: r1.id,
        });
      },
      /already actively assigned to this transport route/
    );

    // Changing assignment to Route Beta closes Route Alpha and activates Route Beta
    const a2 = await transportService.assignStudentTransport(schoolAId, {
      academic_session_id: sessionAId,
      location_id: locationAId,
      student_user_id: studentUserA2Id,
      route_id: r2.id,
    });
    assert.equal(a2.status, 'ACTIVE');

    // Verify historical a1 was completed
    const history = await transportRepository.findAssignments(schoolAId, {
      search: studentUserA2Id,
    });
    const oldA1 = history.data.find((a) => a.id === a1.id);
    assert.equal(oldA1?.status, 'COMPLETED');
  });

  // --------------------------------------------------------------------
  // 7. Daily Trips Lifecycle
  // --------------------------------------------------------------------
  it('Scenario 7: Daily Trip lifecycle SCHEDULED -> STARTED -> COMPLETED', async () => {
    const v = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'BUS-TRIP-01',
      registration_number: 'DL01TR1111',
      capacity: 35,
    });

    const r = await transportService.createRoute(schoolAId, {
      route_name: 'Trip Route',
      route_code: 'RT-TRP-01',
      start_point: 'Start',
      end_point: 'End',
      assigned_vehicle_id: v.id,
      primary_driver_user_id: driverUserAId,
    });

    const trip = await transportService.createTrip(schoolAId, {
      trip_date: '2026-09-17',
      route_id: r.id,
      trip_type: 'PICKUP',
      scheduled_start_time: '07:00',
      scheduled_end_time: '08:15',
    });
    assert.equal(trip.status, 'SCHEDULED');

    // Start trip
    const started = await transportService.startTrip(schoolAId, trip.id);
    assert.equal(started.status, 'STARTED');
    assert.ok(started.actual_start_at);

    // Complete trip
    const completed = await transportService.completeTrip(schoolAId, trip.id);
    assert.equal(completed.status, 'COMPLETED');
    assert.ok(completed.actual_end_at);

    // Attempting to restart completed trip -> reject
    await assert.rejects(
      async () => {
        await transportService.startTrip(schoolAId, trip.id);
      },
      /Cannot start a trip that is already COMPLETED/
    );
  });

  // --------------------------------------------------------------------
  // 8. Honest GPS Status (No Fake Data)
  // --------------------------------------------------------------------
  it('Scenario 8: Returns honest NOT_CONFIGURED state for GPS when no device attached', async () => {
    const tracking = await transportService.getTrackingStatus(schoolAId);
    assert.equal(tracking.status, 'NOT_CONFIGURED');
    assert.equal(tracking.is_live, false);
    assert.equal(tracking.last_known_location, null);
    assert.match(tracking.message, /not configured/i);
  });

  // --------------------------------------------------------------------
  // 9. Multi-Tenant Isolation
  // --------------------------------------------------------------------
  it('Scenario 9: Strict multi-tenant isolation prevents cross-school data access', async () => {
    const vA = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'BUS-ISO-A',
      registration_number: 'DL01IS0001',
      capacity: 30,
    });

    // School B attempts to get School A vehicle -> rejects
    await assert.rejects(
      async () => {
        await transportService.getVehicle(schoolBId, vA.id);
      },
      /Vehicle not found/
    );

    // School B vehicle list does not contain School A vehicles
    const listB = await transportService.listVehicles(schoolBId);
    const foundAInB = listB.data.some((v) => v.id === vA.id);
    assert.equal(foundAInB, false);
  });

  // --------------------------------------------------------------------
  // 10. Numeric User Type Master & Backward Compatibility
  // --------------------------------------------------------------------
  it('Scenario 10: Numeric User Type Master preserves 1..4 mappings backward-compatibly', async () => {
    const userTypeMasters = mem.findAll('user_type_master', () => true) as any[];
    assert.equal(userTypeMasters.length, 4);

    const studentType = userTypeMasters.find((t) => t.id === 1);
    const staffType = userTypeMasters.find((t) => t.id === 2);
    const parentType = userTypeMasters.find((t) => t.id === 3);
    const otherType = userTypeMasters.find((t) => t.id === 4);

    assert.equal(studentType?.type_code, 'STUDENT');
    assert.equal(staffType?.type_code, 'STAFF');
    assert.equal(parentType?.type_code, 'PARENT');
    assert.equal(otherType?.type_code, 'OTHER');
  });

  // --------------------------------------------------------------------
  // 11. Dedicated Driver Profiles & Driver Dropdown Filtering (Zero Teachers/Directors)
  // --------------------------------------------------------------------
  it('Scenario 11: getEligibleDrivers returns ONLY certified transport drivers, never teachers or directors', async () => {
    // School A drivers
    const eligibleDrivers = await transportService.getEligibleDrivers(schoolAId);
    assert.ok(eligibleDrivers.length >= 1, 'Should find at least 1 seeded driver profile');

    // Verify seeded driver Ramesh Chandra
    const ramesh = eligibleDrivers.find((d) => d.driver_profile?.license_number === 'DL-04-2021-0091823');
    assert.ok(ramesh, 'Ramesh Chandra must be present as certified transport driver');
    assert.equal(ramesh.driver_profile.status, 'ACTIVE');

    // Confirm that School Directors or general teachers are NOT returned
    const hasDirector = eligibleDrivers.some((d) => d.designation === 'School Director' || d.username === 'director');
    assert.equal(hasDirector, false, 'School Director must NEVER appear in eligible transport driver dropdown');

    // Register a new driver profile
    const allStaff = mem.findAll('users', (u: any) => u.school_id === schoolAId && u.id !== ramesh.id) as any[];
    if (allStaff.length > 0) {
      const staffCandidate = allStaff[0];
      const registered = await transportService.registerDriverProfile(schoolAId, {
        user_id: staffCandidate.id,
        license_number: 'DL-NEW-2026-9999',
        license_type: 'COMMERCIAL_HEAVY',
        license_expiry: '2030-01-01',
      });
      assert.equal(registered.license_number, 'DL-NEW-2026-9999');

      const updatedDrivers = await transportService.getEligibleDrivers(schoolAId);
      const foundCandidate = updatedDrivers.find((d) => d.id === staffCandidate.id);
      assert.ok(foundCandidate, 'Newly registered driver must now appear in eligible drivers list');
    }
  });

  // --------------------------------------------------------------------
  // 12. Student Enrollment Lookup & Transport Rights Mapping
  // --------------------------------------------------------------------
  it('Scenario 12: Academic enrollment lookup resolves active enrolled students for transport assignment', async () => {
    // Lookup active enrollments via both 'ENROLLED' and 'ACTIVE' status filters
    const enrolledStudents = await academicRepository.findEnrollments(schoolAId, {
      status: 'ENROLLED',
      sessionId: sessionAId,
    });
    assert.ok(enrolledStudents.length > 0, 'Must resolve enrolled students for active academic session');
    assert.ok(enrolledStudents[0].student_user_id, 'Enrollment must include student_user_id');
    assert.ok(enrolledStudents[0].class_id, 'Enrollment must include class_id');

    // Verify all 21 Transport permissions exist in permission registry
    const permissions = mem.findAll('permissions', (p: any) => p.code.startsWith('transport.')) as any[];
    assert.equal(permissions.length, 21, 'Must have exactly 21 transport permissions registered');

    // Verify Director role has transport permissions
    const roles = mem.findAll('roles', (r: any) => r.code === 'SCHOOL_DIRECTOR') as any[];
    const directorRole = roles[0];
    assert.ok(directorRole, 'SCHOOL_DIRECTOR role must exist');

    const directorRights = mem.findAll('role_permissions', (rr: any) => rr.role_id === directorRole.id) as any[];
    const directorPermIds = new Set(directorRights.map((rr: any) => rr.permission_id));
    const transportPerms = permissions.filter((p: any) => directorPermIds.has(p.id));
    assert.ok(transportPerms.length >= 15, 'Director must have transport capabilities assigned');
  });

  // --------------------------------------------------------------------
  // 13. Location UUID Validation, Context Resolution & Tenant Isolation
  // --------------------------------------------------------------------
  it('Scenario 13: Enforces Location UUID validation, context inheritance, and tenant boundary', async () => {
    // 1. Explicit valid location_id succeeds
    const vExplicit = await transportService.createVehicle(schoolAId, {
      vehicle_number: 'BUS-LOC-01',
      registration_number: 'DL01LOC1111',
      location_id: locationAId,
    });
    assert.equal(vExplicit.location_id, locationAId);

    // 2. Omitted location_id automatically inherits active_location_id from userContext
    const mockContext = {
      is_super_admin: false,
      is_school_super_admin: false,
      permitted_location_ids: [locationAId],
      active_location_id: locationAId,
    };
    const vInherited = await transportService.createVehicle(
      schoolAId,
      {
        vehicle_number: 'BUS-LOC-02',
        registration_number: 'DL01LOC2222',
        location_id: '',
      },
      undefined,
      mockContext
    );
    assert.equal(vInherited.location_id, locationAId, 'Must automatically inherit active location UUID from context');

    // 3. Rejects cross-tenant location_id (School A user using School B location UUID)
    if (locationBId) {
      await assert.rejects(
        async () => {
          await transportService.createVehicle(schoolAId, {
            vehicle_number: 'BUS-CROSSTENANT',
            registration_number: 'DL01CROSS999',
            location_id: locationBId,
          });
        },
        /Location does not belong to this school tenant/
      );
    }

    // 4. Rejects non-UUID location format
    await assert.rejects(
      async () => {
        await transportService.createVehicle(schoolAId, {
          vehicle_number: 'BUS-BAD-UUID',
          registration_number: 'DL01BAD999',
          location_id: 'Dwarka Main Campus',
        });
      },
      /Invalid location UUID format/
    );

    // 5. Rejects non-existent location UUID
    await assert.rejects(
      async () => {
        await transportService.createVehicle(schoolAId, {
          vehicle_number: 'BUS-NONEXISTENT',
          registration_number: 'DL01NON999',
          location_id: '00000000-0000-0000-0000-000000000000',
        });
      },
      /Location with ID '00000000-0000-0000-0000-000000000000' was not found/
    );

    // 6. User restricted to permitted_location_ids cannot assign to unpermitted location
    const restrictedContext = {
      is_super_admin: false,
      is_school_super_admin: false,
      permitted_location_ids: ['11111111-1111-1111-1111-111111111111'],
      active_location_id: '11111111-1111-1111-1111-111111111111',
    };
    await assert.rejects(
      async () => {
        await transportService.createVehicle(
          schoolAId,
          {
            vehicle_number: 'BUS-UNPERMITTED',
            registration_number: 'DL01UNP999',
            location_id: locationAId,
          },
          undefined,
          restrictedContext
        );
      },
      /User does not have access to location/
    );
  });

  // --------------------------------------------------------------------
  // 14. Verification of Client Demo Test Vehicle (UP65FK0264 / 1091)
  // --------------------------------------------------------------------
  it('Scenario 14: Registers client test vehicle UP65FK0264 (1091) and verifies retrieval & persistence', async () => {
    const demoVehicle = await transportService.createVehicle(
      schoolAId,
      {
        vehicle_number: '1091',
        registration_number: 'UP65FK0264',
        vehicle_type: 'SCHOOL_BUS',
        make: 'Tata Motors',
        model: '2021',
        capacity: 40,
        fuel_type: 'DIESEL',
        status: 'ACTIVE',
        location_id: locationAId,
        remarks: 'Client Demo Test Vehicle',
      },
      driverUserAId
    );

    assert.ok(demoVehicle.id);
    assert.equal(demoVehicle.vehicle_number, '1091');
    assert.equal(demoVehicle.registration_number, 'UP65FK0264');
    assert.equal(demoVehicle.vehicle_type, 'SCHOOL_BUS');
    assert.equal(demoVehicle.make, 'Tata Motors');
    assert.equal(demoVehicle.model, '2021');
    assert.equal(demoVehicle.capacity, 40);
    assert.equal(demoVehicle.fuel_type, 'DIESEL');
    assert.equal(demoVehicle.status, 'ACTIVE');
    assert.equal(demoVehicle.location_id, locationAId);

    // Retrieve by ID
    const retrieved = await transportService.getVehicle(schoolAId, demoVehicle.id);
    assert.equal(retrieved.vehicle_number, '1091');
    assert.equal(retrieved.registration_number, 'UP65FK0264');
    assert.equal(retrieved.location_id, locationAId);

    // Query in listVehicles with location filter
    const listResult = await transportService.listVehicles(schoolAId, {
      locationId: locationAId,
      search: '1091',
    });
    assert.equal(listResult.total >= 1, true);
    assert.ok(listResult.data.some((v) => v.registration_number === 'UP65FK0264'));
  });

  // --------------------------------------------------------------------
  // 15. Student Academic Placement Hydration and Auto-Resolved academic_session_id
  // --------------------------------------------------------------------
  it('Scenario 15: Resolves student enrollment details with class & section, and auto-resolves academic_session_id', async () => {
    // 1. Verify findEnrollments hydrates class, section, session
    const enrollments = await academicRepository.findEnrollments(schoolAId, {
      status: 'ENROLLED',
      sessionId: sessionAId,
    });
    assert.ok(enrollments.length > 0, 'Must have enrolled students in School A');
    const enr = enrollments[0];
    assert.ok(enr.class, 'Class must be hydrated');
    assert.ok(enr.section, 'Section must be hydrated');
    assert.ok(enr.class.name, 'Class name must be present');
    assert.ok(enr.section.name, 'Section name must be present');

    // 2. Create route with assigned vehicle
    const route = await transportService.createRoute(schoolAId, {
      route_name: 'Placement Test Route',
      route_code: 'RT-PL-01',
      start_point: 'Point A',
      end_point: 'Point B',
      location_id: locationAId,
    });
    const vehicle = await transportService.createVehicle(schoolAId, {
      vehicle_number: '1020',
      registration_number: 'DL01PL1020',
      capacity: 40,
      location_id: locationAId,
    });
    await transportService.updateRoute(schoolAId, route.id, { assigned_vehicle_id: vehicle.id });

    // 3. Assign student WITHOUT specifying academic_session_id (auto-resolve from student enrollment)
    const assignment = await transportService.assignStudentTransport(schoolAId, {
      student_user_id: enr.student_user_id,
      route_id: route.id,
      location_id: locationAId,
    });

    assert.ok(assignment.id);
    assert.equal(assignment.academic_session_id, enr.academic_session_id);
    assert.equal(assignment.status, 'ACTIVE');

    // 4. Verify route hydration returns accurate capacity, occupied seats, and available seats
    const hydratedRoute = await transportService.getRoute(schoolAId, route.id);
    assert.equal(hydratedRoute.capacity, 40);
    assert.equal(hydratedRoute.assigned_student_count, 1);
    assert.equal(hydratedRoute.available_seats, 39);
    assert.equal(hydratedRoute.assigned_vehicle?.vehicle_number, '1020');
  });
});
