// ========================================================================
// Transport Routes
// REST API v1 for Vehicles, Drivers, Routes, Stops, Assignments, Trips, Reports & GPS
// Strict Transport-specific capability authorization (Zero academic classes.create fallback)
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { transportService } from '../services/transport.service.js';
import { academicRepository } from '../repositories/academic.repository.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const transportRouter = Router();

transportRouter.use(authMiddleware);
transportRouter.use(tenantIsolationMiddleware);

// Safe helper for request parameter access
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

// Reusable Zod helper for optional/nullable UUID with empty string preprocessing
const optionalUuidSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().uuid().nullable().optional()
);

// ----------------------------------------------------------------------
// 1. Dashboard Stats
// ----------------------------------------------------------------------
transportRouter.get(
  '/dashboard',
  requirePermission(['transport.dashboard.view', 'transport.vehicle.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const stats = await transportService.getDashboardStats(schoolId, locationId);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 2. Vehicle Master
// ----------------------------------------------------------------------
transportRouter.get(
  '/vehicles',
  requirePermission('transport.vehicle.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        locationId: (req.query.location_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
        vehicleType: (req.query.vehicle_type as string)?.trim() || undefined,
        search: (req.query.search as string)?.trim() || undefined,
      };
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await transportService.listVehicles(schoolId, filters, limit, offset);
      res.json({ success: true, data: result.data, total: result.total });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.get(
  '/vehicles/:id',
  requirePermission('transport.vehicle.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const vehicle = await transportService.getVehicle(schoolId, getParam(req, 'id'));
      res.json({ success: true, data: vehicle });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/vehicles',
  requirePermission('transport.vehicle.create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        vehicle_number: z.string().min(1).max(50),
        registration_number: z.string().min(2).max(50),
        vehicle_type: z.enum(['SCHOOL_BUS', 'VAN', 'MINI_BUS', 'OTHER']).optional(),
        location_id: optionalUuidSchema,
        make: z.string().optional(),
        model: z.string().optional(),
        capacity: z.number().int().min(1).max(200).optional(),
        fuel_type: z.string().optional(),
        purchase_date: z.string().optional(),
        insurance_expiry: z.string().optional(),
        fitness_expiry: z.string().optional(),
        permit_expiry: z.string().optional(),
        puc_expiry: z.string().optional(),
        gps_device_id: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
        next_service_due: z.string().optional(),
        remarks: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const resolvedLocationId =
        parsed.location_id || (req.headers['x-branch-id'] as string) || req.userContext?.active_location_id || null;

      const created = await transportService.createVehicle(
        schoolId,
        {
          ...parsed,
          location_id: resolvedLocationId,
        },
        req.userContext!.user_id,
        req.userContext
      );
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/vehicles/:id',
  requirePermission('transport.vehicle.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        vehicle_number: z.string().min(1).max(50).optional(),
        registration_number: z.string().min(2).max(50).optional(),
        vehicle_type: z.enum(['SCHOOL_BUS', 'VAN', 'MINI_BUS', 'OTHER']).optional(),
        location_id: optionalUuidSchema,
        make: z.string().optional(),
        model: z.string().optional(),
        capacity: z.number().int().min(1).max(200).optional(),
        fuel_type: z.string().optional(),
        purchase_date: z.string().optional(),
        insurance_expiry: z.string().optional(),
        fitness_expiry: z.string().optional(),
        permit_expiry: z.string().optional(),
        puc_expiry: z.string().optional(),
        gps_device_id: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
        next_service_due: z.string().optional(),
        remarks: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const updated = await transportService.updateVehicle(
        schoolId,
        getParam(req, 'id'),
        parsed,
        req.userContext!.user_id,
        req.userContext
      );
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 3. Driver / Transport Staff (Eligible Drivers Only)
// ----------------------------------------------------------------------
transportRouter.get(
  '/drivers/available',
  requirePermission(['transport.driver.view', 'transport.vehicle.create', 'transport.route.create']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      // Query ONLY eligible transport drivers from driver profiles (Zero teachers or directors)
      const drivers = await transportService.getEligibleDrivers(schoolId);
      res.json({ success: true, data: drivers });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/drivers/profile',
  requirePermission('transport.driver.assign'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        user_id: z.string().uuid(),
        license_number: z.string().min(3),
        license_type: z.string().optional(),
        license_expiry: z.string().optional(),
        contact_number: z.string().optional(),
        badge_number: z.string().optional(),
        years_experience: z.number().int().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
        notes: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const profile = await transportService.registerDriverProfile(req.userContext!.school_id!, parsed);
      res.status(201).json({ success: true, data: profile });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/vehicles/:id/assign-driver',
  requirePermission('transport.driver.assign'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        driver_user_id: z.string().uuid(),
        license_number: z.string().optional(),
        license_expiry: z.string().optional(),
        start_date: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      const assignment = await transportService.assignDriver(
        req.userContext!.school_id!,
        getParam(req, 'id'),
        parsed.driver_user_id,
        {
          licenseNumber: parsed.license_number,
          licenseExpiry: parsed.license_expiry,
          startDate: parsed.start_date,
        },
        req.userContext!.user_id
      );
      res.json({ success: true, data: assignment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.get(
  '/vehicles/:id/drivers',
  requirePermission('transport.driver.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const assignments = await transportService.listDriverAssignments(req.userContext!.school_id!, getParam(req, 'id'));
      res.json({ success: true, data: assignments });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 4. Route Master
// ----------------------------------------------------------------------
transportRouter.get(
  '/routes',
  requirePermission('transport.route.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        locationId: (req.query.location_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
        search: (req.query.search as string)?.trim() || undefined,
      };
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await transportService.listRoutes(schoolId, filters, limit, offset);
      res.json({ success: true, data: result.data, total: result.total });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.get(
  '/routes/:id',
  requirePermission('transport.route.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const route = await transportService.getRoute(schoolId, getParam(req, 'id'));
      res.json({ success: true, data: route });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/routes',
  requirePermission('transport.route.create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        route_name: z.string().min(2).max(150),
        route_code: z.string().min(2).max(50),
        location_id: optionalUuidSchema,
        route_type: z.enum(['PICKUP', 'DROP', 'BOTH']).optional(),
        start_point: z.string().min(1).max(150),
        end_point: z.string().min(1).max(150),
        estimated_duration_mins: z.number().int().optional(),
        distance_km: z.number().optional(),
        assigned_vehicle_id: optionalUuidSchema,
        primary_driver_user_id: optionalUuidSchema,
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
        notes: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const resolvedLocationId =
        parsed.location_id || (req.headers['x-branch-id'] as string) || req.userContext?.active_location_id || null;

      const created = await transportService.createRoute(
        schoolId,
        {
          ...parsed,
          location_id: resolvedLocationId,
        },
        req.userContext!.user_id,
        req.userContext
      );
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/routes/:id',
  requirePermission('transport.route.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        route_name: z.string().min(2).max(150).optional(),
        route_code: z.string().min(2).max(50).optional(),
        location_id: optionalUuidSchema,
        route_type: z.enum(['PICKUP', 'DROP', 'BOTH']).optional(),
        start_point: z.string().min(1).max(150).optional(),
        end_point: z.string().min(1).max(150).optional(),
        estimated_duration_mins: z.number().int().optional(),
        distance_km: z.number().optional(),
        assigned_vehicle_id: optionalUuidSchema,
        primary_driver_user_id: optionalUuidSchema,
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
        notes: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const updated = await transportService.updateRoute(
        schoolId,
        getParam(req, 'id'),
        parsed,
        req.userContext!.user_id,
        req.userContext
      );
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 5. Route Stops
// ----------------------------------------------------------------------
transportRouter.get(
  '/routes/:id/stops',
  requirePermission('transport.route_stops.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const stops = await transportService.listRouteStops(req.userContext!.school_id!, getParam(req, 'id'));
      res.json({ success: true, data: stops });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/routes/:id/stops',
  requirePermission('transport.route_stops.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        stop_name: z.string().min(1).max(150),
        stop_code: z.string().optional(),
        address_landmark: z.string().optional(),
        sequence_number: z.number().int().optional(),
        pickup_time: z.string().optional(),
        drop_time: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        notes: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      const stop = await transportService.addRouteStop(req.userContext!.school_id!, getParam(req, 'id'), parsed);
      res.status(201).json({ success: true, data: stop });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/routes/:id/stops/:stopId',
  requirePermission('transport.route_stops.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const stop = await transportService.updateRouteStop(
        req.userContext!.school_id!,
        getParam(req, 'id'),
        getParam(req, 'stopId'),
        req.body
      );
      res.json({ success: true, data: stop });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.delete(
  '/routes/:id/stops/:stopId',
  requirePermission('transport.route_stops.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const deleted = await transportService.deleteRouteStop(
        req.userContext!.school_id!,
        getParam(req, 'id'),
        getParam(req, 'stopId')
      );
      res.json({ success: true, data: { deleted } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/routes/:id/stops/reorder',
  requirePermission('transport.route_stops.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        stop_ids: z.array(z.string().uuid()),
      });
      const parsed = schema.parse(req.body);
      const reordered = await transportService.reorderRouteStops(req.userContext!.school_id!, getParam(req, 'id'), parsed.stop_ids);
      res.json({ success: true, data: reordered });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 6. Student Transport Assignment & Enrollment Lookup
// ----------------------------------------------------------------------
transportRouter.get(
  '/students/enrollment-lookup',
  requirePermission(['transport.student_assignment.create', 'transport.student_assignment.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        sessionId: (req.query.session_id as string)?.trim() || undefined,
        locationId: (req.query.location_id as string)?.trim() || undefined,
        classId: (req.query.class_id as string)?.trim() || undefined,
        sectionId: (req.query.section_id as string)?.trim() || undefined,
        search: (req.query.search as string)?.trim() || undefined,
        status: 'ENROLLED' as const,
      };
      const enrollments = await academicRepository.findEnrollments(schoolId, filters);
      res.json({ success: true, data: enrollments });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.get(
  '/student-assignments',
  requirePermission('transport.student_assignment.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        academicSessionId: (req.query.academic_session_id as string)?.trim() || undefined,
        locationId: (req.query.location_id as string)?.trim() || undefined,
        routeId: (req.query.route_id as string)?.trim() || undefined,
        vehicleId: (req.query.vehicle_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
        search: (req.query.search as string)?.trim() || undefined,
      };
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await transportService.listAssignments(schoolId, filters, limit, offset);
      res.json({ success: true, data: result.data, total: result.total });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/student-assignments',
  requirePermission('transport.student_assignment.create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        academic_session_id: optionalUuidSchema,
        location_id: optionalUuidSchema,
        student_user_id: z.string().uuid(),
        route_id: z.string().uuid(),
        pickup_stop_id: optionalUuidSchema,
        drop_stop_id: optionalUuidSchema,
        vehicle_id: optionalUuidSchema,
        start_date: z.string().optional(),
        remarks: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const resolvedLocationId =
        parsed.location_id || (req.headers['x-branch-id'] as string) || req.userContext?.active_location_id || null;

      const created = await transportService.assignStudentTransport(
        schoolId,
        {
          ...parsed,
          location_id: resolvedLocationId,
        },
        req.userContext!.user_id,
        req.userContext
      );
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/student-assignments/:id/end',
  requirePermission('transport.student_assignment.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const endDate = req.body?.end_date as string | undefined;
      const ok = await transportService.closeStudentAssignment(req.userContext!.school_id!, getParam(req, 'id'), endDate);
      res.json({ success: true, data: { closed: ok } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 7. Daily Trips
// ----------------------------------------------------------------------
transportRouter.get(
  '/trips',
  requirePermission('transport.trip.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        locationId: (req.query.location_id as string)?.trim() || undefined,
        tripDate: (req.query.trip_date as string)?.trim() || undefined,
        routeId: (req.query.route_id as string)?.trim() || undefined,
        vehicleId: (req.query.vehicle_id as string)?.trim() || undefined,
        driverUserId: (req.query.driver_user_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
      };
      const trips = await transportService.listTrips(schoolId, filters);
      res.json({ success: true, data: trips });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.post(
  '/trips',
  requirePermission('transport.trip.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        trip_date: z.string().min(10),
        route_id: z.string().uuid(),
        vehicle_id: optionalUuidSchema,
        driver_user_id: optionalUuidSchema,
        trip_type: z.enum(['PICKUP', 'DROP', 'OTHER']).optional(),
        location_id: optionalUuidSchema,
        scheduled_start_time: z.string().optional(),
        scheduled_end_time: z.string().optional(),
        notes: z.string().optional(),
      });

      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const resolvedLocationId =
        parsed.location_id || (req.headers['x-branch-id'] as string) || req.userContext?.active_location_id || undefined;

      const created = await transportService.createTrip(
        schoolId,
        {
          ...parsed,
          location_id: resolvedLocationId || undefined,
        },
        req.userContext!.user_id,
        req.userContext
      );
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/trips/:id/start',
  requirePermission('transport.trip.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const trip = await transportService.startTrip(req.userContext!.school_id!, getParam(req, 'id'));
      res.json({ success: true, data: trip });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/trips/:id/complete',
  requirePermission('transport.trip.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const trip = await transportService.completeTrip(req.userContext!.school_id!, getParam(req, 'id'));
      res.json({ success: true, data: trip });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

transportRouter.put(
  '/trips/:id/cancel',
  requirePermission('transport.trip.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const notes = req.body?.notes as string | undefined;
      const trip = await transportService.cancelTrip(req.userContext!.school_id!, getParam(req, 'id'), notes);
      res.json({ success: true, data: trip });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 8. GPS / Tracking
// ----------------------------------------------------------------------
transportRouter.get(
  '/tracking',
  requirePermission('transport.gps.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const vehicleId = req.query.vehicle_id as string | undefined;
      const status = await transportService.getTrackingStatus(req.userContext!.school_id!, vehicleId);
      res.json({ success: true, data: status });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 9. Transport Reports
// ----------------------------------------------------------------------
transportRouter.get(
  '/reports/capacity',
  requirePermission('transport.reports.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const locationId = req.query.location_id as string | undefined;
      const report = await transportService.getCapacityReport(req.userContext!.school_id!, locationId);
      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);
