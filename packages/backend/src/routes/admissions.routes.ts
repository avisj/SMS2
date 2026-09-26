// ========================================================================
// Admissions & Enquiry CRM Routes
// REST API v1 for Sources, Enquiries, Follow-ups, Applications, Conversion,
// and Public Enquiry Lead Capture
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { admissionsService } from '../services/admissions.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const admissionsRouter = Router();

// Simple in-memory IP rate limiter for public lead generation endpoint
const publicIpLimiter = new Map<string, { count: number; resetAt: number }>();
function checkPublicRateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = publicIpLimiter.get(ip);
  if (!record || record.resetAt < now) {
    publicIpLimiter.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) {
    return false;
  }
  record.count += 1;
  return true;
}

// ----------------------------------------------------------------------
// 0. Public Website Enquiry Endpoint (Unauthenticated, Rate-limited)
// ----------------------------------------------------------------------
admissionsRouter.post('/public/enquiry', async (req: Request, res: Response): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkPublicRateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
    });
    return;
  }

  try {
    const schema = z.object({
      school_id: z.string().uuid(),
      student_first_name: z.string().min(1).max(100),
      student_last_name: z.string().max(100).optional(),
      parent_name: z.string().min(1).max(150),
      primary_phone: z.string().min(5).max(30),
      email: z.string().email().optional(),
      seeking_class_id: z.string().uuid().optional(),
      notes: z.string().max(1000).optional(),
    });

    const parsed = schema.parse(req.body);
    const result = await admissionsService.createPublicEnquiry(parsed.school_id, parsed);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// Authenticated & Tenant-Isolated Routes
// ----------------------------------------------------------------------
admissionsRouter.use(authMiddleware);
admissionsRouter.use(tenantIsolationMiddleware);

// 1. Dashboard Metrics
admissionsRouter.get(
  '/dashboard-metrics',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const sessionId = req.query.session_id as string | undefined;
      const metrics = await admissionsService.getDashboardMetrics(schoolId, sessionId, req.userContext!);
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// 2. Lead Sources
admissionsRouter.get(
  '/sources',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const sources = await admissionsService.listSources(schoolId, req.userContext!);
      res.json({ success: true, data: sources });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.post(
  '/sources',
  requirePermission(['users.create', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        name: z.string().min(1).max(100),
        code: z.string().min(1).max(50),
      });
      const parsed = schema.parse(req.body);
      const created = await admissionsService.createSource(schoolId, parsed, req.userContext!);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// 3. Enquiries / CRM Leads
admissionsRouter.get(
  '/enquiries',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        status: req.query.status as string | undefined,
        source_type: req.query.source_type as string | undefined,
        sessionId: req.query.session_id as string | undefined,
        search: req.query.search as string | undefined,
      };
      const enquiries = await admissionsService.listEnquiries(schoolId, filters, req.userContext!);
      res.json({ success: true, data: enquiries });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.get(
  '/enquiries/:id',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const enquiry = await admissionsService.getEnquiry(schoolId, req.params.id as string, req.userContext!);
      if (!enquiry) {
        res.status(404).json({ success: false, error: { message: 'Enquiry not found' } });
        return;
      }
      res.json({ success: true, data: enquiry });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.post(
  '/enquiries',
  requirePermission(['users.create', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const created = await admissionsService.createEnquiry(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.put(
  '/enquiries/:id',
  requirePermission(['users.update', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const updated = await admissionsService.updateEnquiry(schoolId, req.params.id as string, req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// 4. Follow-ups
admissionsRouter.get(
  '/enquiries/:id/followups',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const followups = await admissionsService.listFollowups(schoolId, req.params.id as string, req.userContext!);
      res.json({ success: true, data: followups });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.post(
  '/enquiries/:id/followups',
  requirePermission(['users.create', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const followup = await admissionsService.addFollowup(
        schoolId,
        req.params.id as string,
        req.body,
        req.userContext!
      );
      res.status(201).json({ success: true, data: followup });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// 5. Applications
admissionsRouter.get(
  '/applications',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        status: req.query.status as string | undefined,
        classId: req.query.class_id as string | undefined,
        sessionId: req.query.session_id as string | undefined,
        search: req.query.search as string | undefined,
      };
      const applications = await admissionsService.listApplications(schoolId, filters, req.userContext!);
      res.json({ success: true, data: applications });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.get(
  '/applications/:id',
  requirePermission(['users.view', 'academics.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const app = await admissionsService.getApplication(schoolId, req.params.id as string, req.userContext!);
      if (!app) {
        res.status(404).json({ success: false, error: { message: 'Application not found' } });
        return;
      }
      res.json({ success: true, data: app });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.post(
  '/applications',
  requirePermission(['users.create', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const created = await admissionsService.createApplication(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

admissionsRouter.put(
  '/applications/:id',
  requirePermission(['users.update', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const updated = await admissionsService.updateApplication(schoolId, req.params.id as string, req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// 6. Application Conversion to Student
admissionsRouter.post(
  '/applications/:id/convert',
  requirePermission(['users.create', 'academics.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const result = await admissionsService.convertApplicationToStudent(
        schoolId,
        req.params.id as string,
        req.body,
        req.userContext!
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);
