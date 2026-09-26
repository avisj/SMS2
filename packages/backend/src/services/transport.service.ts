// ========================================================================
// Transport Service
// Core Business Logic: Vehicles, Drivers, Routes, Stops, Assignments, Trips & GPS
// Strict Validations: Capacity checks, duplicate active assignment prevention,
// historical preservation, driver license checks, and honest GPS state.
// ========================================================================

import {
  Vehicle,
  VehicleDriverAssignment,
  TransportRoute,
  TransportRouteStop,
  StudentTransportAssignment,
  TransportTrip,
  TransportDashboardStats,
  TransportCapacityReportItem,
  GpsDeviceStatus,
  User,
  TransportDriverProfile,
} from '../types/index.js';
import {
  transportRepository,
  VehicleFilters,
  RouteFilters,
  AssignmentFilters,
  TripFilters,
} from '../repositories/transport.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import { academicRepository } from '../repositories/academic.repository.js';

export class TransportService {
  /**
   * Validate and resolve location ID:
   * 1. If not provided, fallback to userContext.active_location_id.
   * 2. If provided, validate UUID format.
   * 3. Tenant Boundary: verify location exists and belongs to schoolId.
   * 4. User Access Scope: if userContext has restricted permitted_location_ids, verify user has access.
   */
  async validateAndResolveLocation(
    schoolId: string,
    locationId?: string | null,
    userContext?: {
      is_super_admin?: boolean;
      is_school_super_admin?: boolean;
      permitted_location_ids?: string[];
      active_location_id?: string | null;
    } | null
  ): Promise<string | null> {
    let effectiveLocId = (typeof locationId === 'string' && locationId.trim() !== '') ? locationId.trim() : null;

    // Fallback to active location from userContext if not explicitly provided
    if (!effectiveLocId && userContext?.active_location_id) {
      effectiveLocId = userContext.active_location_id;
    }

    if (!effectiveLocId) {
      return null;
    }

    // 1. UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(effectiveLocId)) {
      throw new Error(`Invalid location UUID format: '${effectiveLocId}'`);
    }

    // 2. Existence & Tenant boundary check
    const loc = await locationRepository.findById(effectiveLocId);
    if (!loc) {
      throw new Error(`Location with ID '${effectiveLocId}' was not found.`);
    }
    if (loc.school_id !== schoolId) {
      throw new Error('Location does not belong to this school tenant.');
    }

    // 3. User access scope enforcement
    if (userContext && !userContext.is_super_admin && !userContext.is_school_super_admin) {
      if (userContext.permitted_location_ids && userContext.permitted_location_ids.length > 0) {
        if (!userContext.permitted_location_ids.includes(effectiveLocId)) {
          throw new Error(`Forbidden: User does not have access to location '${loc.location_name || effectiveLocId}'.`);
        }
      }
    }

    return effectiveLocId;
  }

  // ======================================================================
  // 1. Vehicles Master
  // ======================================================================

  async listVehicles(
    schoolId: string,
    filters?: VehicleFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Vehicle[]; total: number }> {
    return transportRepository.findVehicles(schoolId, filters, limit, offset);
  }

  async getVehicle(schoolId: string, id: string): Promise<Vehicle> {
    const v = await transportRepository.findVehicleById(schoolId, id);
    if (!v) {
      throw new Error('Vehicle not found');
    }
    return v;
  }

  async createVehicle(
    schoolId: string,
    data: {
      vehicle_number: string;
      registration_number: string;
      vehicle_type?: Vehicle['vehicle_type'];
      location_id?: string | null;
      make?: string;
      model?: string;
      capacity?: number;
      fuel_type?: string;
      purchase_date?: string;
      insurance_expiry?: string;
      fitness_expiry?: string;
      permit_expiry?: string;
      puc_expiry?: string;
      gps_device_id?: string;
      status?: Vehicle['status'];
      next_service_due?: string;
      remarks?: string;
    },
    userId?: string,
    userContext?: any
  ): Promise<Vehicle> {
    // 1. Validate registration uniqueness
    const isDup = await transportRepository.checkDuplicateRegistration(schoolId, data.registration_number);
    if (isDup) {
      throw new Error(`A vehicle with registration number '${data.registration_number}' already exists in this school.`);
    }

    // 2. Validate and resolve location
    const resolvedLocationId = await this.validateAndResolveLocation(schoolId, data.location_id, userContext);

    return transportRepository.createVehicle({
      school_id: schoolId,
      location_id: resolvedLocationId,
      vehicle_number: data.vehicle_number.trim(),
      registration_number: data.registration_number.trim().toUpperCase(),
      vehicle_type: data.vehicle_type || 'SCHOOL_BUS',
      make: data.make || null,
      model: data.model || null,
      capacity: data.capacity !== undefined ? data.capacity : 40,
      fuel_type: data.fuel_type || null,
      purchase_date: data.purchase_date || null,
      insurance_expiry: data.insurance_expiry || null,
      fitness_expiry: data.fitness_expiry || null,
      permit_expiry: data.permit_expiry || null,
      puc_expiry: data.puc_expiry || null,
      gps_device_id: data.gps_device_id || null,
      status: data.status || 'ACTIVE',
      next_service_due: data.next_service_due || null,
      remarks: data.remarks || null,
      created_by: userId || null,
    });
  }

  async updateVehicle(
    schoolId: string,
    id: string,
    updates: Partial<Vehicle>,
    userId?: string,
    userContext?: any
  ): Promise<Vehicle> {
    const existing = await this.getVehicle(schoolId, id);

    if (updates.registration_number && updates.registration_number.toUpperCase() !== existing.registration_number.toUpperCase()) {
      const isDup = await transportRepository.checkDuplicateRegistration(schoolId, updates.registration_number, id);
      if (isDup) {
        throw new Error(`A vehicle with registration number '${updates.registration_number}' already exists in this school.`);
      }
    }

    let resolvedLocationId = updates.location_id;
    if (updates.location_id !== undefined) {
      resolvedLocationId = (await this.validateAndResolveLocation(schoolId, updates.location_id, userContext)) || null;
    }

    const updated = await transportRepository.updateVehicle(schoolId, id, {
      ...updates,
      ...(updates.location_id !== undefined ? { location_id: resolvedLocationId } : {}),
      updated_by: userId || null,
    });
    if (!updated) {
      throw new Error('Failed to update vehicle');
    }
    return updated;
  }

  // ======================================================================
  // 2. Driver / Staff Integration
  // ======================================================================

  async assignDriver(
    schoolId: string,
    vehicleId: string,
    driverUserId: string,
    options?: {
      licenseNumber?: string;
      licenseExpiry?: string;
      startDate?: string;
    },
    userId?: string
  ): Promise<VehicleDriverAssignment> {
    // 1. Verify vehicle
    const vehicle = await this.getVehicle(schoolId, vehicleId);
    if (vehicle.status === 'RETIRED') {
      throw new Error('Cannot assign driver to a RETIRED vehicle.');
    }

    // 2. Verify driver user exists in current school
    const driverUser = await userRepository.findById(driverUserId, schoolId);
    if (!driverUser || driverUser.school_id !== schoolId) {
      throw new Error('Selected driver does not exist in this school.');
    }

    // Check license expiry warning/validation if provided
    if (options?.licenseExpiry) {
      const exp = new Date(options.licenseExpiry).getTime();
      if (exp < new Date().getTime()) {
        console.warn(`[TransportService.assignDriver] Warning: Driver license ${options.licenseNumber} is expired.`);
      }
    }

    return transportRepository.assignDriverToVehicle(schoolId, vehicleId, driverUserId, {
      licenseNumber: options?.licenseNumber,
      licenseExpiry: options?.licenseExpiry,
      startDate: options?.startDate,
      createdBy: userId,
    });
  }

  async listDriverAssignments(schoolId: string, vehicleId?: string): Promise<VehicleDriverAssignment[]> {
    return transportRepository.findDriverAssignments(schoolId, vehicleId);
  }

  async getEligibleDrivers(schoolId: string): Promise<Array<User & { driver_profile?: TransportDriverProfile }>> {
    return transportRepository.findEligibleDrivers(schoolId);
  }

  async registerDriverProfile(
    schoolId: string,
    input: Partial<TransportDriverProfile> & { user_id: string }
  ): Promise<TransportDriverProfile> {
    return transportRepository.upsertDriverProfile(schoolId, input);
  }

  // ======================================================================
  // 3. Transport Routes Master
  // ======================================================================

  async listRoutes(
    schoolId: string,
    filters?: RouteFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: TransportRoute[]; total: number }> {
    return transportRepository.findRoutes(schoolId, filters, limit, offset);
  }

  async getRoute(schoolId: string, id: string): Promise<TransportRoute> {
    const r = await transportRepository.findRouteById(schoolId, id);
    if (!r) {
      throw new Error('Transport route not found');
    }
    return r;
  }

  async createRoute(
    schoolId: string,
    data: {
      route_name: string;
      route_code: string;
      location_id?: string | null;
      route_type?: TransportRoute['route_type'];
      start_point: string;
      end_point: string;
      estimated_duration_mins?: number;
      distance_km?: number;
      assigned_vehicle_id?: string | null;
      primary_driver_user_id?: string | null;
      status?: TransportRoute['status'];
      notes?: string;
    },
    userId?: string,
    userContext?: any
  ): Promise<TransportRoute> {
    const isDup = await transportRepository.checkDuplicateRouteCode(schoolId, data.route_code);
    if (isDup) {
      throw new Error(`A route with code '${data.route_code}' already exists in this school.`);
    }

    // Validate assigned vehicle if given
    if (data.assigned_vehicle_id) {
      const v = await this.getVehicle(schoolId, data.assigned_vehicle_id);
      if (v.status === 'RETIRED') {
        throw new Error('Cannot assign a RETIRED vehicle to a route.');
      }
    }

    const resolvedLocationId = await this.validateAndResolveLocation(schoolId, data.location_id, userContext);

    return transportRepository.createRoute({
      school_id: schoolId,
      location_id: resolvedLocationId,
      route_name: data.route_name.trim(),
      route_code: data.route_code.trim().toUpperCase(),
      route_type: data.route_type || 'BOTH',
      start_point: data.start_point.trim(),
      end_point: data.end_point.trim(),
      estimated_duration_mins: data.estimated_duration_mins || null,
      distance_km: data.distance_km || null,
      assigned_vehicle_id: data.assigned_vehicle_id || null,
      primary_driver_user_id: data.primary_driver_user_id || null,
      status: data.status || 'ACTIVE',
      notes: data.notes || null,
      created_by: userId || null,
    });
  }

  async updateRoute(
    schoolId: string,
    id: string,
    updates: Partial<TransportRoute>,
    userId?: string,
    userContext?: any
  ): Promise<TransportRoute> {
    const existing = await this.getRoute(schoolId, id);

    if (updates.route_code && updates.route_code.toUpperCase() !== existing.route_code.toUpperCase()) {
      const isDup = await transportRepository.checkDuplicateRouteCode(schoolId, updates.route_code, id);
      if (isDup) {
        throw new Error(`A route with code '${updates.route_code}' already exists in this school.`);
      }
    }

    if (updates.assigned_vehicle_id && updates.assigned_vehicle_id !== existing.assigned_vehicle_id) {
      const v = await this.getVehicle(schoolId, updates.assigned_vehicle_id);
      if (v.status === 'RETIRED') {
        throw new Error('Cannot assign a RETIRED vehicle to a route.');
      }
    }

    let resolvedLocationId = updates.location_id;
    if (updates.location_id !== undefined) {
      resolvedLocationId = (await this.validateAndResolveLocation(schoolId, updates.location_id, userContext)) || null;
    }

    const updated = await transportRepository.updateRoute(schoolId, id, {
      ...updates,
      ...(updates.location_id !== undefined ? { location_id: resolvedLocationId } : {}),
      updated_by: userId || null,
    });
    if (!updated) {
      throw new Error('Failed to update route');
    }
    return updated;
  }

  // ======================================================================
  // 4. Route Stops
  // ======================================================================

  async listRouteStops(schoolId: string, routeId: string): Promise<TransportRouteStop[]> {
    await this.getRoute(schoolId, routeId);
    return transportRepository.findStopsByRoute(schoolId, routeId);
  }

  async addRouteStop(
    schoolId: string,
    routeId: string,
    data: {
      stop_name: string;
      stop_code?: string;
      address_landmark?: string;
      sequence_number?: number;
      pickup_time?: string;
      drop_time?: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }
  ): Promise<TransportRouteStop> {
    await this.getRoute(schoolId, routeId);

    const existingStops = await transportRepository.findStopsByRoute(schoolId, routeId);
    const nextSeq = data.sequence_number || existingStops.length + 1;

    return transportRepository.createStop({
      school_id: schoolId,
      route_id: routeId,
      stop_name: data.stop_name.trim(),
      stop_code: data.stop_code ? data.stop_code.trim().toUpperCase() : null,
      address_landmark: data.address_landmark || null,
      sequence_number: nextSeq,
      pickup_time: data.pickup_time || null,
      drop_time: data.drop_time || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      status: 'ACTIVE',
      notes: data.notes || null,
    });
  }

  async updateRouteStop(
    schoolId: string,
    routeId: string,
    stopId: string,
    updates: Partial<TransportRouteStop>
  ): Promise<TransportRouteStop> {
    await this.getRoute(schoolId, routeId);
    const updated = await transportRepository.updateStop(schoolId, stopId, updates);
    if (!updated) throw new Error('Route stop not found');
    return updated;
  }

  async deleteRouteStop(schoolId: string, routeId: string, stopId: string): Promise<boolean> {
    await this.getRoute(schoolId, routeId);
    return transportRepository.deleteStop(schoolId, stopId);
  }

  async reorderRouteStops(schoolId: string, routeId: string, stopIdsInOrder: string[]): Promise<TransportRouteStop[]> {
    await this.getRoute(schoolId, routeId);
    return transportRepository.reorderStops(schoolId, routeId, stopIdsInOrder);
  }

  // ======================================================================
  // 5. Student Transport Assignment
  // ======================================================================

  async listAssignments(
    schoolId: string,
    filters?: AssignmentFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: StudentTransportAssignment[]; total: number }> {
    return transportRepository.findAssignments(schoolId, filters, limit, offset);
  }

  async assignStudentTransport(
    schoolId: string,
    data: {
      academic_session_id?: string | null;
      location_id?: string | null;
      student_user_id: string;
      route_id: string;
      pickup_stop_id?: string | null;
      drop_stop_id?: string | null;
      vehicle_id?: string | null;
      start_date?: string;
      remarks?: string;
    },
    userId?: string,
    userContext?: any
  ): Promise<StudentTransportAssignment> {
    // 0. Resolve and validate Academic Session
    let resolvedSessionId = (typeof data.academic_session_id === 'string' && data.academic_session_id.trim() !== '')
      ? data.academic_session_id.trim()
      : null;

    if (!resolvedSessionId) {
      const activeEnrollment = await academicRepository.findActiveEnrollmentForStudent(schoolId, data.student_user_id);
      if (activeEnrollment?.academic_session_id) {
        resolvedSessionId = activeEnrollment.academic_session_id;
      } else {
        const sessions = await academicRepository.findSessions(schoolId);
        const currentSess = sessions.find((s) => s.is_current) || sessions[0];
        if (currentSess) {
          resolvedSessionId = currentSess.id;
        } else {
          throw new Error('Academic Session ID is required for student transport assignment.');
        }
      }
    } else {
      const sess = await academicRepository.findSessionById(resolvedSessionId, schoolId);
      if (!sess) {
        const activeEnrollment = await academicRepository.findActiveEnrollmentForStudent(schoolId, data.student_user_id);
        if (activeEnrollment?.academic_session_id) {
          resolvedSessionId = activeEnrollment.academic_session_id;
        }
      }
    }

    // 1. Verify Route is ACTIVE
    const route = await this.getRoute(schoolId, data.route_id);
    if (route.status !== 'ACTIVE') {
      throw new Error(`Route '${route.route_name}' is not ACTIVE.`);
    }

    // Validate and resolve location (fallback to route's location or user context)
    const effectiveLocationInput = data.location_id || route.location_id;
    const resolvedLocationId = await this.validateAndResolveLocation(schoolId, effectiveLocationInput, userContext);
    if (!resolvedLocationId) {
      throw new Error('Location ID is required for student transport assignment.');
    }

    // 2. Resolve Vehicle (from input or route's assigned vehicle)
    const effectiveVehicleId = data.vehicle_id || route.assigned_vehicle_id;
    if (effectiveVehicleId) {
      const vehicle = await this.getVehicle(schoolId, effectiveVehicleId);
      if (vehicle.status === 'RETIRED') {
        throw new Error('Assigned vehicle is RETIRED. Cannot assign student.');
      }

      // 3. Vehicle Capacity Validation
      const currentAssigned = vehicle.assigned_student_count || 0;
      if (vehicle.capacity > 0 && currentAssigned >= vehicle.capacity) {
        throw new Error(`Vehicle capacity has been reached (${currentAssigned}/${vehicle.capacity} seats).`);
      }
    }

    // 4. Duplicate Active Assignment Check
    const activeExisting = await transportRepository.findStudentActiveAssignment(
      schoolId,
      data.student_user_id,
      resolvedSessionId
    );

    if (activeExisting) {
      // If student is already assigned to the same route
      if (activeExisting.route_id === data.route_id) {
        throw new Error('Student is already actively assigned to this transport route.');
      }
      // If assigned to a different route, auto-close previous assignment for historical continuity
      await transportRepository.closeAssignment(schoolId, activeExisting.id);
    }

    // 5. Create new operational transport assignment
    return transportRepository.createAssignment({
      school_id: schoolId,
      academic_session_id: resolvedSessionId,
      location_id: resolvedLocationId,
      student_user_id: data.student_user_id,
      route_id: data.route_id,
      pickup_stop_id: data.pickup_stop_id || null,
      drop_stop_id: data.drop_stop_id || null,
      vehicle_id: effectiveVehicleId || null,
      start_date: data.start_date || new Date().toISOString().split('T')[0],
      end_date: null,
      status: 'ACTIVE',
      remarks: data.remarks || null,
      created_by: userId || null,
    });
  }

  async closeStudentAssignment(schoolId: string, id: string, endDate?: string): Promise<boolean> {
    return transportRepository.closeAssignment(schoolId, id, endDate);
  }

  // ======================================================================
  // 6. Daily Transport Trips
  // ======================================================================

  async listTrips(schoolId: string, filters?: TripFilters): Promise<TransportTrip[]> {
    return transportRepository.findTrips(schoolId, filters);
  }

  async getTrip(schoolId: string, id: string): Promise<TransportTrip> {
    const t = await transportRepository.findTripById(schoolId, id);
    if (!t) throw new Error('Transport trip not found');
    return t;
  }

  async createTrip(
    schoolId: string,
    data: {
      trip_date: string;
      route_id: string;
      vehicle_id?: string | null;
      driver_user_id?: string | null;
      trip_type?: TransportTrip['trip_type'];
      location_id?: string | null;
      scheduled_start_time?: string | null;
      scheduled_end_time?: string | null;
      notes?: string | null;
    },
    userId?: string,
    userContext?: any
  ): Promise<TransportTrip> {
    const route = await this.getRoute(schoolId, data.route_id);
    const effectiveVehicleId = data.vehicle_id || route.assigned_vehicle_id;
    const effectiveDriverUserId = data.driver_user_id || route.primary_driver_user_id;

    if (!effectiveVehicleId) {
      throw new Error('Vehicle must be specified or configured on the route to create a trip.');
    }
    if (!effectiveDriverUserId) {
      throw new Error('Driver must be specified or configured on the route to create a trip.');
    }

    const vehicle = await this.getVehicle(schoolId, effectiveVehicleId);
    if (vehicle.status === 'RETIRED') {
      throw new Error('Cannot schedule a trip with a RETIRED vehicle.');
    }

    let effectiveLocationId = data.location_id || route.location_id || null;
    if (effectiveLocationId) {
      effectiveLocationId = await this.validateAndResolveLocation(schoolId, effectiveLocationId, userContext);
    }

    return transportRepository.createTrip({
      school_id: schoolId,
      location_id: effectiveLocationId,
      trip_date: data.trip_date,
      route_id: data.route_id,
      vehicle_id: effectiveVehicleId,
      driver_user_id: effectiveDriverUserId,
      trip_type: data.trip_type || 'PICKUP',
      scheduled_start_time: data.scheduled_start_time || null,
      scheduled_end_time: data.scheduled_end_time || null,
      status: 'SCHEDULED',
      notes: data.notes || null,
      created_by: userId || null,
    });
  }

  async startTrip(schoolId: string, id: string): Promise<TransportTrip> {
    const trip = await this.getTrip(schoolId, id);
    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw new Error(`Cannot start a trip that is already ${trip.status}.`);
    }

    const updated = await transportRepository.updateTripStatus(schoolId, id, 'STARTED', {
      actualStartAt: new Date().toISOString(),
    });
    if (!updated) throw new Error('Failed to start trip');
    return updated;
  }

  async completeTrip(schoolId: string, id: string): Promise<TransportTrip> {
    const trip = await this.getTrip(schoolId, id);
    if (trip.status !== 'STARTED') {
      throw new Error(`Can only complete a trip that is STARTED (currently ${trip.status}).`);
    }

    const updated = await transportRepository.updateTripStatus(schoolId, id, 'COMPLETED', {
      actualEndAt: new Date().toISOString(),
    });
    if (!updated) throw new Error('Failed to complete trip');
    return updated;
  }

  async cancelTrip(schoolId: string, id: string, notes?: string): Promise<TransportTrip> {
    const trip = await this.getTrip(schoolId, id);
    if (trip.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed trip.');
    }

    const updated = await transportRepository.updateTripStatus(schoolId, id, 'CANCELLED', { notes });
    if (!updated) throw new Error('Failed to cancel trip');
    return updated;
  }

  // ======================================================================
  // 7. GPS Tracking & Live State
  // ======================================================================

  async getTrackingStatus(schoolId: string, vehicleId?: string): Promise<{
    status: GpsDeviceStatus;
    message: string;
    vehicle_id?: string;
    last_known_location: null;
    is_live: false;
  }> {
    // Strictly honest GPS: no fake coordinates or randomized locations
    return {
      status: 'NOT_CONFIGURED',
      message: 'Live GPS tracking is not configured for this vehicle / fleet. Hardware integration interface is ready.',
      vehicle_id: vehicleId,
      last_known_location: null,
      is_live: false,
    };
  }

  // ======================================================================
  // 8. Dashboard & Reports
  // ======================================================================

  async getDashboardStats(schoolId: string, locationId?: string): Promise<TransportDashboardStats> {
    return transportRepository.getDashboardStats(schoolId, locationId);
  }

  async getCapacityReport(schoolId: string, locationId?: string): Promise<TransportCapacityReportItem[]> {
    return transportRepository.getCapacityReport(schoolId, locationId);
  }
}

export const transportService = new TransportService();
