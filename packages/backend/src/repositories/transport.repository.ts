// ========================================================================
// Transport Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Vehicles, Drivers, Routes, Stops, Assignments & Trips
// ========================================================================

import crypto from 'crypto';
import {
  Vehicle,
  VehicleDriverAssignment,
  TransportRoute,
  TransportRouteStop,
  StudentTransportAssignment,
  TransportTrip,
  VehicleLocationHistory,
  TransportDashboardStats,
  TransportCapacityReportItem,
  User,
  Location,
  AcademicSession,
  MaintenanceStatus,
  TransportDriverProfile,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export interface VehicleFilters {
  locationId?: string;
  status?: string;
  vehicleType?: string;
  search?: string;
}

export interface RouteFilters {
  locationId?: string;
  status?: string;
  search?: string;
}

export interface AssignmentFilters {
  academicSessionId?: string;
  locationId?: string;
  routeId?: string;
  vehicleId?: string;
  status?: string;
  search?: string;
}

export interface TripFilters {
  locationId?: string;
  tripDate?: string;
  routeId?: string;
  vehicleId?: string;
  driverUserId?: string;
  status?: string;
}

export class TransportRepository {
  private mem = getMemoryDbClient();

  // Helper for computing maintenance status based on next_service_due date
  public computeMaintenanceStatus(nextServiceDue?: string | null): MaintenanceStatus {
    if (!nextServiceDue) return 'OK';
    const due = new Date(nextServiceDue).getTime();
    const now = new Date().getTime();
    const diffDays = (due - now) / (1000 * 3600 * 24);

    if (diffDays < 0) return 'OVERDUE';
    if (diffDays <= 7) return 'DUE';
    if (diffDays <= 30) return 'DUE_SOON';
    return 'OK';
  }

  // ======================================================================
  // 1. Vehicles Master
  // ======================================================================

  async findVehicles(
    schoolId: string,
    filters?: VehicleFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Vehicle[]; total: number }> {
    let list: Vehicle[] = [];
    let totalCount = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('vehicles')
          .select('*', { count: 'exact' })
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.vehicleType) q = q.eq('vehicle_type', filters.vehicleType);
        if (filters?.search) {
          q = q.or(`vehicle_number.ilike.%${filters.search}%,registration_number.ilike.%${filters.search}%,make.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);
        }

        q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        const { data, error, count } = await q;
        if (!error && data) {
          list = data as Vehicle[];
          totalCount = count || data.length;
        }
      } catch (err) {
        console.warn('[TransportRepository.findVehicles] Supabase fallback:', err);
      }
    }

    if (list.length === 0 && (!isSupabaseDatabaseActive() || !getSupabaseClient())) {
      const all = this.mem.findAll('vehicles', (v: Vehicle) => {
        if (v.school_id !== schoolId || v.deleted_at) return false;
        if (filters?.locationId && v.location_id !== filters.locationId) return false;
        if (filters?.status && v.status !== filters.status) return false;
        if (filters?.vehicleType && v.vehicle_type !== filters.vehicleType) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          const match =
            v.vehicle_number.toLowerCase().includes(s) ||
            v.registration_number.toLowerCase().includes(s) ||
            (v.make && v.make.toLowerCase().includes(s)) ||
            (v.model && v.model.toLowerCase().includes(s));
          if (!match) return false;
        }
        return true;
      }) as Vehicle[];

      totalCount = all.length;
      list = all.slice(offset, offset + limit);
    }

    // Hydrate each vehicle
    const hydrated = await Promise.all(list.map((v) => this.hydrateVehicle(schoolId, v)));
    return { data: hydrated, total: totalCount };
  }

  async findVehicleById(schoolId: string, id: string): Promise<Vehicle | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('vehicles')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) return this.hydrateVehicle(schoolId, data as Vehicle);
      } catch (err) {
        console.warn('[TransportRepository.findVehicleById] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('vehicles', id) as Vehicle | null;
    if (!item || item.school_id !== schoolId || item.deleted_at) return null;
    return this.hydrateVehicle(schoolId, item);
  }

  async checkDuplicateRegistration(schoolId: string, registrationNumber: string, excludeId?: string): Promise<boolean> {
    const reg = registrationNumber.trim().toUpperCase();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('vehicles')
          .select('id')
          .eq('school_id', schoolId)
          .ilike('registration_number', reg)
          .is('deleted_at', null);
        if (excludeId) q = q.neq('id', excludeId);
        const { data } = await q;
        if (data && data.length > 0) return true;
      } catch (err) {
        console.warn('[TransportRepository.checkDuplicateRegistration] Supabase error:', err);
      }
    }

    const match = this.mem.findAll('vehicles', (v: Vehicle) => {
      if (v.school_id !== schoolId || v.deleted_at) return false;
      if (excludeId && v.id === excludeId) return false;
      return v.registration_number.trim().toUpperCase() === reg;
    });
    return match.length > 0;
  }

  async createVehicle(data: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle> {
    const record: Vehicle = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.mem.insert('vehicles', record);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('vehicles')
          .insert(record)
          .select('*')
          .single();
        if (!error && dbData) return this.hydrateVehicle(record.school_id, dbData as Vehicle);
      } catch (err) {
        console.warn('[TransportRepository.createVehicle] Supabase fallback:', err);
      }
    }

    return this.hydrateVehicle(record.school_id, record);
  }

  async updateVehicle(schoolId: string, id: string, updates: Partial<Vehicle>): Promise<Vehicle | null> {
    const cleanedUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.mem.update('vehicles', id, cleanedUpdates);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('vehicles')
          .update(cleanedUpdates)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select('*')
          .single();
        if (!error && data) return this.hydrateVehicle(schoolId, data as Vehicle);
      } catch (err) {
        console.warn('[TransportRepository.updateVehicle] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('vehicles', id) as Vehicle | null;
    return item ? this.hydrateVehicle(schoolId, item) : null;
  }

  private async hydrateVehicle(schoolId: string, v: Vehicle): Promise<Vehicle> {
    // 1. Location
    let location: Location | undefined;
    if (v.location_id) {
      location = (this.mem.findById('locations', v.location_id) as Location) || undefined;
    }

    // 2. Active Driver assignment
    let currentDriverAssignment: VehicleDriverAssignment | undefined;
    let currentDriver: User | undefined;

    const driverAssignments = this.mem.findAll('vehicle_driver_assignments', (a: VehicleDriverAssignment) =>
      a.school_id === schoolId && a.vehicle_id === v.id && a.status === 'ACTIVE' && !a.deleted_at
    ) as VehicleDriverAssignment[];

    if (driverAssignments.length > 0) {
      currentDriverAssignment = driverAssignments[0];
      const driverUser = this.mem.findById('users', currentDriverAssignment.driver_user_id) as User | null;
      if (driverUser) currentDriver = driverUser;
    }

    // 3. Assigned Route
    let currentRoute: TransportRoute | undefined;
    const routes = this.mem.findAll('transport_routes', (r: TransportRoute) =>
      r.school_id === schoolId && r.assigned_vehicle_id === v.id && r.status === 'ACTIVE' && !r.deleted_at
    ) as TransportRoute[];
    if (routes.length > 0) currentRoute = routes[0];

    // 4. Assigned student count
    const studentAssignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) => {
      const matchVehicle = a.vehicle_id === v.id || Boolean(currentRoute && a.route_id === currentRoute.id);
      return a.school_id === schoolId && matchVehicle && a.status === 'ACTIVE' && !a.deleted_at;
    });
    const assignedCount = studentAssignments.length;
    const capacity = v.capacity || 0;
    const availableSeats = Math.max(0, capacity - assignedCount);
    const utilizationPct = capacity > 0 ? Math.round((assignedCount / capacity) * 100) : 0;
    const maintenanceStatus = this.computeMaintenanceStatus(v.next_service_due);

    return {
      ...v,
      location,
      current_driver: currentDriver,
      current_driver_assignment: currentDriverAssignment,
      current_route: currentRoute,
      assigned_student_count: assignedCount,
      available_seats: availableSeats,
      utilization_percentage: utilizationPct,
      maintenance_status: maintenanceStatus,
    };
  }

  // ======================================================================
  // 2. Driver / Staff Integration
  // ======================================================================

  async assignDriverToVehicle(
    schoolId: string,
    vehicleId: string,
    driverUserId: string,
    options?: {
      licenseNumber?: string;
      licenseExpiry?: string;
      startDate?: string;
      createdBy?: string;
    }
  ): Promise<VehicleDriverAssignment> {
    // 1. Deactivate existing active assignments for this vehicle
    const existingActive = this.mem.findAll('vehicle_driver_assignments', (a: VehicleDriverAssignment) =>
      a.school_id === schoolId && a.vehicle_id === vehicleId && a.status === 'ACTIVE'
    ) as VehicleDriverAssignment[];

    const nowIso = new Date().toISOString();
    const todayDate = new Date().toISOString().split('T')[0];

    for (const a of existingActive) {
      this.mem.update('vehicle_driver_assignments', a.id, {
        status: 'INACTIVE',
        end_date: todayDate,
        updated_at: nowIso,
      });
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('vehicle_driver_assignments')
          .update({ status: 'INACTIVE', end_date: todayDate, updated_at: nowIso })
          .eq('school_id', schoolId)
          .eq('vehicle_id', vehicleId)
          .eq('status', 'ACTIVE');
      } catch (err) {
        console.warn('[TransportRepository.assignDriverToVehicle] Error in deactivating:', err);
      }
    }

    // 2. Insert new assignment
    const newRecord: VehicleDriverAssignment = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      vehicle_id: vehicleId,
      driver_user_id: driverUserId,
      license_number: options?.licenseNumber || null,
      license_expiry: options?.licenseExpiry || null,
      start_date: options?.startDate || todayDate,
      end_date: null,
      is_primary: true,
      status: 'ACTIVE',
      created_by: options?.createdBy || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.mem.insert('vehicle_driver_assignments', newRecord);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('vehicle_driver_assignments')
          .insert(newRecord)
          .select('*')
          .single();
        if (!error && data) return data as VehicleDriverAssignment;
      } catch (err) {
        console.warn('[TransportRepository.assignDriverToVehicle] Supabase fallback:', err);
      }
    }

    return newRecord;
  }

  async findDriverAssignments(schoolId: string, vehicleId?: string): Promise<VehicleDriverAssignment[]> {
    let list: VehicleDriverAssignment[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('vehicle_driver_assignments')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);
        if (vehicleId) q = q.eq('vehicle_id', vehicleId);
        q = q.order('created_at', { ascending: false });
        const { data, error } = await q;
        if (!error && data) list = data as VehicleDriverAssignment[];
      } catch (err) {
        console.warn('[TransportRepository.findDriverAssignments] Supabase error:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('vehicle_driver_assignments', (a: VehicleDriverAssignment) => {
        if (a.school_id !== schoolId || a.deleted_at) return false;
        if (vehicleId && a.vehicle_id !== vehicleId) return false;
        return true;
      }) as VehicleDriverAssignment[];
    }

    // Hydrate driver user details
    return list.map((a) => ({
      ...a,
      driver: (this.mem.findById('users', a.driver_user_id) as User) || undefined,
      vehicle: (this.mem.findById('vehicles', a.vehicle_id) as Vehicle) || undefined,
    }));
  }

  // ----------------------------------------------------------------------
  // Driver Profiles & Eligibility
  // ----------------------------------------------------------------------
  async findEligibleDrivers(schoolId: string): Promise<Array<User & { driver_profile?: TransportDriverProfile }>> {
    let profiles: TransportDriverProfile[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_driver_profiles')
          .select('*')
          .eq('school_id', schoolId)
          .eq('driver_eligible', true)
          .eq('status', 'ACTIVE')
          .is('deleted_at', null);
        if (!error && data) {
          profiles = data as TransportDriverProfile[];
          for (const p of profiles) {
            if (!this.mem.findById('transport_driver_profiles', p.id)) {
              this.mem.insert('transport_driver_profiles', p);
            }
          }
        }
      } catch (err) {
        console.warn('[TransportRepository.findEligibleDrivers] Supabase error:', err);
      }
    }

    if (profiles.length === 0) {
      profiles = this.mem.findAll('transport_driver_profiles', (p: TransportDriverProfile) => {
        return p.school_id === schoolId && p.driver_eligible && p.status === 'ACTIVE' && !p.deleted_at;
      }) as TransportDriverProfile[];
    }

    // Hydrate matching users
    const eligibleUsers: Array<User & { driver_profile?: TransportDriverProfile }> = [];
    for (const p of profiles) {
      let user = this.mem.findById('users', p.user_id) as User | null;
      if (!user && isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          const { data } = await getSupabaseClient()!.from('users').select('*').eq('id', p.user_id).single();
          if (data) {
            user = data as User;
            this.mem.insert('users', user);
          }
        } catch {}
      }

      if (user && user.status === 'ACTIVE' && !user.deleted_at) {
        eligibleUsers.push({
          ...user,
          driver_profile: p,
        });
      }
    }

    return eligibleUsers;
  }

  async upsertDriverProfile(
    schoolId: string,
    input: Partial<TransportDriverProfile> & { user_id: string }
  ): Promise<TransportDriverProfile> {
    const existing = this.mem.findAll('transport_driver_profiles', (p: TransportDriverProfile) =>
      p.school_id === schoolId && p.user_id === input.user_id
    ) as TransportDriverProfile[];

    const nowIso = new Date().toISOString();
    let saved: TransportDriverProfile;

    if (existing.length > 0) {
      saved = this.mem.update('transport_driver_profiles', existing[0].id, {
        ...input,
        driver_eligible: input.driver_eligible ?? true,
        status: input.status || 'ACTIVE',
        updated_at: nowIso,
      }) as TransportDriverProfile;
    } else {
      saved = this.mem.insert('transport_driver_profiles', {
        id: crypto.randomUUID(),
        school_id: schoolId,
        user_id: input.user_id,
        driver_eligible: input.driver_eligible ?? true,
        license_number: input.license_number || null,
        license_type: input.license_type || 'COMMERCIAL_HEAVY',
        license_expiry: input.license_expiry || null,
        contact_phone: input.contact_phone || null,
        status: input.status || 'ACTIVE',
        remarks: input.remarks || null,
        created_at: nowIso,
        updated_at: nowIso,
      }) as TransportDriverProfile;
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('transport_driver_profiles')
          .upsert(saved, { onConflict: 'school_id, user_id' });
      } catch (err) {
        console.warn('[TransportRepository.upsertDriverProfile] Supabase error:', err);
      }
    }

    return saved;
  }

  // ======================================================================
  // 3. Transport Routes Master
  // ======================================================================

  async findRoutes(
    schoolId: string,
    filters?: RouteFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: TransportRoute[]; total: number }> {
    let list: TransportRoute[] = [];
    let totalCount = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('transport_routes')
          .select('*', { count: 'exact' })
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.search) {
          q = q.or(`route_name.ilike.%${filters.search}%,route_code.ilike.%${filters.search}%,start_point.ilike.%${filters.search}%,end_point.ilike.%${filters.search}%`);
        }

        q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        const { data, error, count } = await q;
        if (!error && data) {
          list = data as TransportRoute[];
          totalCount = count || data.length;
        }
      } catch (err) {
        console.warn('[TransportRepository.findRoutes] Supabase fallback:', err);
      }
    }

    if (list.length === 0 && (!isSupabaseDatabaseActive() || !getSupabaseClient())) {
      const all = this.mem.findAll('transport_routes', (r: TransportRoute) => {
        if (r.school_id !== schoolId || r.deleted_at) return false;
        if (filters?.locationId && r.location_id !== filters.locationId) return false;
        if (filters?.status && r.status !== filters.status) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          const match =
            r.route_name.toLowerCase().includes(s) ||
            r.route_code.toLowerCase().includes(s) ||
            r.start_point.toLowerCase().includes(s) ||
            r.end_point.toLowerCase().includes(s);
          if (!match) return false;
        }
        return true;
      }) as TransportRoute[];

      totalCount = all.length;
      list = all.slice(offset, offset + limit);
    }

    const hydrated = await Promise.all(list.map((r) => this.hydrateRoute(schoolId, r)));
    return { data: hydrated, total: totalCount };
  }

  async findRouteById(schoolId: string, id: string): Promise<TransportRoute | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_routes')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) return this.hydrateRoute(schoolId, data as TransportRoute);
      } catch (err) {
        console.warn('[TransportRepository.findRouteById] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('transport_routes', id) as TransportRoute | null;
    if (!item || item.school_id !== schoolId || item.deleted_at) return null;
    return this.hydrateRoute(schoolId, item);
  }

  async checkDuplicateRouteCode(schoolId: string, routeCode: string, excludeId?: string): Promise<boolean> {
    const code = routeCode.trim().toUpperCase();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('transport_routes')
          .select('id')
          .eq('school_id', schoolId)
          .ilike('route_code', code)
          .is('deleted_at', null);
        if (excludeId) q = q.neq('id', excludeId);
        const { data } = await q;
        if (data && data.length > 0) return true;
      } catch (err) {
        console.warn('[TransportRepository.checkDuplicateRouteCode] Supabase error:', err);
      }
    }

    const match = this.mem.findAll('transport_routes', (r: TransportRoute) => {
      if (r.school_id !== schoolId || r.deleted_at) return false;
      if (excludeId && r.id === excludeId) return false;
      return r.route_code.trim().toUpperCase() === code;
    });
    return match.length > 0;
  }

  async createRoute(data: Omit<TransportRoute, 'id' | 'created_at' | 'updated_at'>): Promise<TransportRoute> {
    const record: TransportRoute = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.mem.insert('transport_routes', record);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('transport_routes')
          .insert(record)
          .select('*')
          .single();
        if (!error && dbData) return this.hydrateRoute(record.school_id, dbData as TransportRoute);
      } catch (err) {
        console.warn('[TransportRepository.createRoute] Supabase fallback:', err);
      }
    }

    return this.hydrateRoute(record.school_id, record);
  }

  async updateRoute(schoolId: string, id: string, updates: Partial<TransportRoute>): Promise<TransportRoute | null> {
    const cleanedUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.mem.update('transport_routes', id, cleanedUpdates);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_routes')
          .update(cleanedUpdates)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select('*')
          .single();
        if (!error && data) return this.hydrateRoute(schoolId, data as TransportRoute);
      } catch (err) {
        console.warn('[TransportRepository.updateRoute] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('transport_routes', id) as TransportRoute | null;
    return item ? this.hydrateRoute(schoolId, item) : null;
  }

  private async hydrateRoute(schoolId: string, r: TransportRoute): Promise<TransportRoute> {
    // 1. Location
    const location = r.location_id ? (this.mem.findById('locations', r.location_id) as Location) || undefined : undefined;

    // 2. Assigned Vehicle
    let assignedVehicle: Vehicle | undefined;
    if (r.assigned_vehicle_id) {
      assignedVehicle = (this.mem.findById('vehicles', r.assigned_vehicle_id) as Vehicle) || undefined;
      if (!assignedVehicle && isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          const { data: dbV } = await getSupabaseClient()!
            .from('vehicles')
            .select('*')
            .eq('school_id', schoolId)
            .eq('id', r.assigned_vehicle_id)
            .is('deleted_at', null)
            .maybeSingle();
          if (dbV) {
            assignedVehicle = dbV as Vehicle;
            if (!this.mem.findById('vehicles', dbV.id)) {
              this.mem.insert('vehicles', dbV);
            }
          }
        } catch (err) {
          console.warn('[TransportRepository.hydrateRoute] Error fetching vehicle:', err);
        }
      }
    }

    // 3. Primary Driver
    let primaryDriver: User | undefined;
    if (r.primary_driver_user_id) {
      primaryDriver = (this.mem.findById('users', r.primary_driver_user_id) as User) || undefined;
    }

    // 4. Stops
    const stops = await this.findStopsByRoute(schoolId, r.id);

    // 5. Assigned students count
    let assignedCount = 0;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { count, error } = await getSupabaseClient()!
          .from('student_transport_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('route_id', r.id)
          .eq('status', 'ACTIVE')
          .is('deleted_at', null);
        if (!error && count !== null) {
          assignedCount = count;
        } else {
          const assignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) =>
            a.school_id === schoolId && a.route_id === r.id && a.status === 'ACTIVE' && !a.deleted_at
          );
          assignedCount = assignments.length;
        }
      } catch {
        const assignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) =>
          a.school_id === schoolId && a.route_id === r.id && a.status === 'ACTIVE' && !a.deleted_at
        );
        assignedCount = assignments.length;
      }
    } else {
      const assignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) =>
        a.school_id === schoolId && a.route_id === r.id && a.status === 'ACTIVE' && !a.deleted_at
      );
      assignedCount = assignments.length;
    }

    const capacity = assignedVehicle?.capacity || 0;
    const availableSeats = Math.max(0, capacity - assignedCount);
    const utilizationPct = capacity > 0 ? Math.round((assignedCount / capacity) * 100) : 0;

    if (assignedVehicle) {
      assignedVehicle = {
        ...assignedVehicle,
        assigned_student_count: assignedCount,
        available_seats: availableSeats,
      };
    }

    return {
      ...r,
      location,
      assigned_vehicle: assignedVehicle,
      primary_driver: primaryDriver,
      stops,
      stops_count: stops.length,
      assigned_student_count: assignedCount,
      capacity,
      available_seats: availableSeats,
      utilization_percentage: utilizationPct,
    };
  }

  // ======================================================================
  // 4. Route Stops
  // ======================================================================

  async findStopsByRoute(schoolId: string, routeId: string): Promise<TransportRouteStop[]> {
    let list: TransportRouteStop[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_route_stops')
          .select('*')
          .eq('school_id', schoolId)
          .eq('route_id', routeId)
          .is('deleted_at', null)
          .order('sequence_number', { ascending: true });
        if (!error && data) list = data as TransportRouteStop[];
      } catch (err) {
        console.warn('[TransportRepository.findStopsByRoute] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('transport_route_stops', (s: TransportRouteStop) =>
        s.school_id === schoolId && s.route_id === routeId && !s.deleted_at
      ) as TransportRouteStop[];
      list.sort((a, b) => a.sequence_number - b.sequence_number);
    }

    return list;
  }

  async createStop(data: Omit<TransportRouteStop, 'id' | 'created_at' | 'updated_at'>): Promise<TransportRouteStop> {
    const record: TransportRouteStop = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.mem.insert('transport_route_stops', record);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('transport_route_stops')
          .insert(record)
          .select('*')
          .single();
        if (!error && dbData) return dbData as TransportRouteStop;
      } catch (err) {
        console.warn('[TransportRepository.createStop] Supabase fallback:', err);
      }
    }

    return record;
  }

  async updateStop(schoolId: string, stopId: string, updates: Partial<TransportRouteStop>): Promise<TransportRouteStop | null> {
    const cleanedUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.mem.update('transport_route_stops', stopId, cleanedUpdates);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_route_stops')
          .update(cleanedUpdates)
          .eq('school_id', schoolId)
          .eq('id', stopId)
          .select('*')
          .single();
        if (!error && data) return data as TransportRouteStop;
      } catch (err) {
        console.warn('[TransportRepository.updateStop] Supabase fallback:', err);
      }
    }

    return this.mem.findById('transport_route_stops', stopId) as TransportRouteStop | null;
  }

  async deleteStop(schoolId: string, stopId: string): Promise<boolean> {
    this.mem.update('transport_route_stops', stopId, { deleted_at: new Date().toISOString() });
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('transport_route_stops')
          .update({ deleted_at: new Date().toISOString() })
          .eq('school_id', schoolId)
          .eq('id', stopId);
      } catch (err) {
        console.warn('[TransportRepository.deleteStop] Supabase error:', err);
      }
    }
    return true;
  }

  async reorderStops(schoolId: string, routeId: string, stopIdsInOrder: string[]): Promise<TransportRouteStop[]> {
    const updatedStops: TransportRouteStop[] = [];

    for (let index = 0; index < stopIdsInOrder.length; index++) {
      const stopId = stopIdsInOrder[index];
      const seq = index + 1;
      this.mem.update('transport_route_stops', stopId, {
        sequence_number: seq,
        updated_at: new Date().toISOString(),
      });

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!
            .from('transport_route_stops')
            .update({ sequence_number: seq, updated_at: new Date().toISOString() })
            .eq('school_id', schoolId)
            .eq('id', stopId);
        } catch (err) {
          console.warn('[TransportRepository.reorderStops] Supabase error:', err);
        }
      }
    }

    return this.findStopsByRoute(schoolId, routeId);
  }

  // ======================================================================
  // 5. Student Transport Assignment
  // ======================================================================

  async findStudentActiveAssignment(schoolId: string, studentUserId: string, academicSessionId?: string): Promise<StudentTransportAssignment | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('student_transport_assignments')
          .select('*')
          .eq('school_id', schoolId)
          .eq('student_user_id', studentUserId)
          .eq('status', 'ACTIVE')
          .is('deleted_at', null);
        if (academicSessionId) q = q.eq('academic_session_id', academicSessionId);
        const { data, error } = await q.maybeSingle();
        if (!error && data) return this.hydrateAssignment(schoolId, data as StudentTransportAssignment);
      } catch (err) {
        console.warn('[TransportRepository.findStudentActiveAssignment] Supabase error:', err);
      }
    }

    const matches = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) => {
      if (a.school_id !== schoolId || a.deleted_at || a.status !== 'ACTIVE') return false;
      if (a.student_user_id !== studentUserId) return false;
      if (academicSessionId && a.academic_session_id !== academicSessionId) return false;
      return true;
    }) as StudentTransportAssignment[];

    if (matches.length === 0) return null;
    return this.hydrateAssignment(schoolId, matches[0]);
  }

  async findAssignments(
    schoolId: string,
    filters?: AssignmentFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: StudentTransportAssignment[]; total: number }> {
    let list: StudentTransportAssignment[] = [];
    let totalCount = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('student_transport_assignments')
          .select('*', { count: 'exact' })
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.routeId) q = q.eq('route_id', filters.routeId);
        if (filters?.vehicleId) q = q.eq('vehicle_id', filters.vehicleId);
        if (filters?.status) q = q.eq('status', filters.status);

        q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        const { data, error, count } = await q;
        if (!error && data) {
          list = data as StudentTransportAssignment[];
          totalCount = count || data.length;
        }
      } catch (err) {
        console.warn('[TransportRepository.findAssignments] Supabase fallback:', err);
      }
    }

    if (list.length === 0 && (!isSupabaseDatabaseActive() || !getSupabaseClient())) {
      const all = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) => {
        if (a.school_id !== schoolId || a.deleted_at) return false;
        if (filters?.academicSessionId && a.academic_session_id !== filters.academicSessionId) return false;
        if (filters?.locationId && a.location_id !== filters.locationId) return false;
        if (filters?.routeId && a.route_id !== filters.routeId) return false;
        if (filters?.vehicleId && a.vehicle_id !== filters.vehicleId) return false;
        if (filters?.status && a.status !== filters.status) return false;
        return true;
      }) as StudentTransportAssignment[];

      totalCount = all.length;
      list = all.slice(offset, offset + limit);
    }

    const hydrated = await Promise.all(list.map((a) => this.hydrateAssignment(schoolId, a)));
    return { data: hydrated, total: totalCount };
  }

  async createAssignment(data: Omit<StudentTransportAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<StudentTransportAssignment> {
    const record: StudentTransportAssignment = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.mem.insert('student_transport_assignments', record);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('student_transport_assignments')
          .insert(record)
          .select('*')
          .single();
        if (!error && dbData) return this.hydrateAssignment(record.school_id, dbData as StudentTransportAssignment);
      } catch (err) {
        console.warn('[TransportRepository.createAssignment] Supabase fallback:', err);
      }
    }

    return this.hydrateAssignment(record.school_id, record);
  }

  async closeAssignment(schoolId: string, id: string, endDate?: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const end = endDate || nowIso.split('T')[0];

    this.mem.update('student_transport_assignments', id, {
      status: 'COMPLETED',
      end_date: end,
      updated_at: nowIso,
    });

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('student_transport_assignments')
          .update({ status: 'COMPLETED', end_date: end, updated_at: nowIso })
          .eq('school_id', schoolId)
          .eq('id', id);
      } catch (err) {
        console.warn('[TransportRepository.closeAssignment] Supabase error:', err);
      }
    }
    return true;
  }

  private async hydrateAssignment(schoolId: string, a: StudentTransportAssignment): Promise<StudentTransportAssignment> {
    const student = (this.mem.findById('users', a.student_user_id) as User) || undefined;
    const session = (this.mem.findById('academic_sessions', a.academic_session_id) as AcademicSession) || undefined;
    const location = (this.mem.findById('locations', a.location_id) as Location) || undefined;
    const route = (this.mem.findById('transport_routes', a.route_id) as TransportRoute) || undefined;
    const pickupStop = a.pickup_stop_id ? (this.mem.findById('transport_route_stops', a.pickup_stop_id) as TransportRouteStop) || undefined : undefined;
    const dropStop = a.drop_stop_id ? (this.mem.findById('transport_route_stops', a.drop_stop_id) as TransportRouteStop) || undefined : undefined;
    const vehicle = a.vehicle_id ? (this.mem.findById('vehicles', a.vehicle_id) as Vehicle) || undefined : undefined;

    // Resolve Class & Section name from student_academic_enrollments for the same session/student
    let className: string | undefined;
    let sectionName: string | undefined;
    let admissionNumber: string | undefined;
    let rollNumber: string | undefined;

    const enrollments = this.mem.findAll('student_academic_enrollments', (e: any) =>
      e.school_id === schoolId && e.student_user_id === a.student_user_id && e.academic_session_id === a.academic_session_id && !e.deleted_at
    );
    if (enrollments.length > 0) {
      const enr = enrollments[0];
      const cls = this.mem.findById('classes', enr.class_id) as any;
      const sec = this.mem.findById('sections', enr.section_id) as any;
      className = cls?.name;
      sectionName = sec?.name;
      admissionNumber = enr.admission_number || student?.username;
      rollNumber = enr.roll_number;
    }

    return {
      ...a,
      student,
      session,
      location,
      route,
      pickup_stop: pickupStop,
      drop_stop: dropStop,
      vehicle,
      class_name: className,
      section_name: sectionName,
      admission_number: admissionNumber,
      roll_number: rollNumber,
    };
  }

  // ======================================================================
  // 6. Daily Transport Trips
  // ======================================================================

  async findTrips(schoolId: string, filters?: TripFilters): Promise<TransportTrip[]> {
    let list: TransportTrip[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('transport_trips')
          .select('*')
          .eq('school_id', schoolId);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.tripDate) q = q.eq('trip_date', filters.tripDate);
        if (filters?.routeId) q = q.eq('route_id', filters.routeId);
        if (filters?.vehicleId) q = q.eq('vehicle_id', filters.vehicleId);
        if (filters?.driverUserId) q = q.eq('driver_user_id', filters.driverUserId);
        if (filters?.status) q = q.eq('status', filters.status);

        q = q.order('created_at', { ascending: false });
        const { data, error } = await q;
        if (!error && data) list = data as TransportTrip[];
      } catch (err) {
        console.warn('[TransportRepository.findTrips] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('transport_trips', (t: TransportTrip) => {
        if (t.school_id !== schoolId) return false;
        if (filters?.locationId && t.location_id !== filters.locationId) return false;
        if (filters?.tripDate && t.trip_date !== filters.tripDate) return false;
        if (filters?.routeId && t.route_id !== filters.routeId) return false;
        if (filters?.vehicleId && t.vehicle_id !== filters.vehicleId) return false;
        if (filters?.driverUserId && t.driver_user_id !== filters.driverUserId) return false;
        if (filters?.status && t.status !== filters.status) return false;
        return true;
      }) as TransportTrip[];
    }

    return Promise.all(list.map((t) => this.hydrateTrip(schoolId, t)));
  }

  async findTripById(schoolId: string, id: string): Promise<TransportTrip | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_trips')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .maybeSingle();
        if (!error && data) return this.hydrateTrip(schoolId, data as TransportTrip);
      } catch (err) {
        console.warn('[TransportRepository.findTripById] Supabase error:', err);
      }
    }

    const item = this.mem.findById('transport_trips', id) as TransportTrip | null;
    if (!item || item.school_id !== schoolId) return null;
    return this.hydrateTrip(schoolId, item);
  }

  async createTrip(data: Omit<TransportTrip, 'id' | 'created_at' | 'updated_at'>): Promise<TransportTrip> {
    const record: TransportTrip = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.mem.insert('transport_trips', record);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('transport_trips')
          .insert(record)
          .select('*')
          .single();
        if (!error && dbData) return this.hydrateTrip(record.school_id, dbData as TransportTrip);
      } catch (err) {
        console.warn('[TransportRepository.createTrip] Supabase fallback:', err);
      }
    }

    return this.hydrateTrip(record.school_id, record);
  }

  async updateTripStatus(
    schoolId: string,
    id: string,
    status: TransportTrip['status'],
    timestamps?: { actualStartAt?: string; actualEndAt?: string; notes?: string }
  ): Promise<TransportTrip | null> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (timestamps?.actualStartAt) updates.actual_start_at = timestamps.actualStartAt;
    if (timestamps?.actualEndAt) updates.actual_end_at = timestamps.actualEndAt;
    if (timestamps?.notes) updates.notes = timestamps.notes;

    this.mem.update('transport_trips', id, updates);

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('transport_trips')
          .update(updates)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select('*')
          .single();
        if (!error && data) return this.hydrateTrip(schoolId, data as TransportTrip);
      } catch (err) {
        console.warn('[TransportRepository.updateTripStatus] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('transport_trips', id) as TransportTrip | null;
    return item ? this.hydrateTrip(schoolId, item) : null;
  }

  private async hydrateTrip(schoolId: string, t: TransportTrip): Promise<TransportTrip> {
    const route = (this.mem.findById('transport_routes', t.route_id) as TransportRoute) || undefined;
    const vehicle = (this.mem.findById('vehicles', t.vehicle_id) as Vehicle) || undefined;
    const driver = (this.mem.findById('users', t.driver_user_id) as User) || undefined;
    const location = t.location_id ? (this.mem.findById('locations', t.location_id) as Location) || undefined : undefined;

    // Count students assigned to this route
    const assignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) =>
      a.school_id === schoolId && a.route_id === t.route_id && a.status === 'ACTIVE' && !a.deleted_at
    );

    return {
      ...t,
      route,
      vehicle,
      driver,
      location,
      student_count: assignments.length,
    };
  }

  // ======================================================================
  // 7. Dashboard KPIs & Reports
  // ======================================================================

  async getDashboardStats(schoolId: string, locationId?: string): Promise<TransportDashboardStats> {
    // 1. Vehicles count & status
    const allVehicles = this.mem.findAll('vehicles', (v: Vehicle) => {
      if (v.school_id !== schoolId || v.deleted_at) return false;
      if (locationId && v.location_id !== locationId) return false;
      return true;
    }) as Vehicle[];

    const totalVehicles = allVehicles.length;
    const activeVehicles = allVehicles.filter((v) => v.status === 'ACTIVE').length;
    const inactiveVehicles = allVehicles.filter((v) => v.status === 'INACTIVE' || v.status === 'RETIRED').length;
    const maintenanceVehicles = allVehicles.filter((v) => v.status === 'MAINTENANCE').length;

    // Capacity sum
    const totalCapacity = allVehicles
      .filter((v) => v.status === 'ACTIVE')
      .reduce((sum, v) => sum + (v.capacity || 0), 0);

    // Document alerts calculation
    const now = new Date().getTime();
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let validCount = 0;
    let maintenanceDueCount = 0;

    for (const v of allVehicles) {
      const dates = [v.insurance_expiry, v.fitness_expiry, v.permit_expiry, v.puc_expiry].filter(Boolean);
      for (const d of dates) {
        const diffDays = (new Date(d!).getTime() - now) / (1000 * 3600 * 24);
        if (diffDays < 0) expiredCount++;
        else if (diffDays <= 30) expiringSoonCount++;
        else validCount++;
      }

      if (v.next_service_due) {
        const diff = (new Date(v.next_service_due).getTime() - now) / (1000 * 3600 * 24);
        if (diff <= 14) maintenanceDueCount++;
      }
    }

    // 2. Routes
    const allRoutes = this.mem.findAll('transport_routes', (r: TransportRoute) => {
      if (r.school_id !== schoolId || r.deleted_at) return false;
      if (locationId && r.location_id !== locationId) return false;
      return true;
    }) as TransportRoute[];

    const totalRoutes = allRoutes.length;
    const activeRoutes = allRoutes.filter((r) => r.status === 'ACTIVE').length;

    // 3. Students using transport
    const allAssignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) => {
      if (a.school_id !== schoolId || a.deleted_at || a.status !== 'ACTIVE') return false;
      if (locationId && a.location_id !== locationId) return false;
      return true;
    });
    const studentsUsingTransport = allAssignments.length;
    const availableSeats = Math.max(0, totalCapacity - studentsUsingTransport);

    // 4. Today's Trips
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTrips = this.mem.findAll('transport_trips', (t: TransportTrip) => {
      if (t.school_id !== schoolId) return false;
      if (locationId && t.location_id !== locationId) return false;
      return t.trip_date === todayStr;
    }) as TransportTrip[];

    const todayTripsCount = todayTrips.length;
    const activeTripsCount = todayTrips.filter((t) => t.status === 'STARTED').length;

    return {
      total_vehicles: totalVehicles,
      active_vehicles: activeVehicles,
      inactive_vehicles: inactiveVehicles,
      maintenance_vehicles: maintenanceVehicles,
      total_routes: totalRoutes,
      active_routes: activeRoutes,
      students_using_transport: studentsUsingTransport,
      today_trips_count: todayTripsCount,
      active_trips_count: activeTripsCount,
      total_capacity: totalCapacity,
      available_seats: availableSeats,
      maintenance_due_count: maintenanceDueCount,
      document_alerts: {
        expired_count: expiredCount,
        expiring_soon_count: expiringSoonCount,
        valid_count: validCount,
      },
      gps_status_counts: {
        online: 0,
        offline: 0,
        not_configured: totalVehicles,
      },
    };
  }

  async getCapacityReport(schoolId: string, locationId?: string): Promise<TransportCapacityReportItem[]> {
    const vehicles = this.mem.findAll('vehicles', (v: Vehicle) => {
      if (v.school_id !== schoolId || v.deleted_at) return false;
      if (locationId && v.location_id !== locationId) return false;
      return true;
    }) as Vehicle[];

    const result: TransportCapacityReportItem[] = [];

    for (const v of vehicles) {
      // Find route
      const routes = this.mem.findAll('transport_routes', (r: TransportRoute) =>
        r.school_id === schoolId && r.assigned_vehicle_id === v.id && !r.deleted_at
      ) as TransportRoute[];
      const r = routes[0];

      // Count assignments
      const assignments = this.mem.findAll('student_transport_assignments', (a: StudentTransportAssignment) => {
        const matchVehicle = a.vehicle_id === v.id || Boolean(r && a.route_id === r.id);
        return a.school_id === schoolId && matchVehicle && a.status === 'ACTIVE' && !a.deleted_at;
      });

      const assigned = assignments.length;
      const cap = v.capacity || 0;
      const avail = Math.max(0, cap - assigned);
      const util = cap > 0 ? Math.round((assigned / cap) * 100) : 0;

      result.push({
        vehicle_id: v.id,
        vehicle_number: v.vehicle_number,
        registration_number: v.registration_number,
        route_name: r?.route_name,
        route_code: r?.route_code,
        capacity: cap,
        assigned_students: assigned,
        available_seats: avail,
        utilization_percentage: util,
        status: v.status,
      });
    }

    return result;
  }
}

export const transportRepository = new TransportRepository();
