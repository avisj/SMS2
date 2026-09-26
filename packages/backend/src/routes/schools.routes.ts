// ========================================================================
// Schools Routes (Tenant Governance)
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { tenantService } from '../services/tenant.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const schoolsRouter = Router();

schoolsRouter.use(authMiddleware);
schoolsRouter.use(tenantIsolationMiddleware);

const createSchoolSchema = z.object({
  school_code: z.string().min(2).max(30),
  school_name: z.string().min(2).max(255),
  legal_name: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  timezone: z.string().default('Asia/Kolkata'),
  currency: z.string().default('INR'),
  currency_symbol: z.string().optional(),
  currency_position: z.enum(['BEFORE', 'AFTER']).default('BEFORE'),
  decimal_places: z.number().int().min(0).max(4).default(2),
  date_format: z.string().default('DD/MM/YYYY'),
  time_format: z.string().default('12h'),
  locale: z.string().default('en-IN'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
});

schoolsRouter.get('/', requirePermission('schools.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schools = await tenantService.listSchools(req.userContext!);
    res.json({ success: true, data: schools });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

schoolsRouter.get('/:id', requirePermission('schools.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const school = await tenantService.getSchoolById(req.params.id as string, req.userContext!);
    if (!school) {
      res.status(404).json({ success: false, error: { message: 'School not found' } });
      return;
    }
    res.json({ success: true, data: school });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

schoolsRouter.post('/', requirePermission('schools.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = createSchoolSchema.parse(req.body);
    const school = await tenantService.createSchool(validated, req.userContext!);
    res.status(201).json({ success: true, data: school });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

schoolsRouter.put('/:id', requirePermission('schools.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const school = await tenantService.updateSchool(req.params.id as string, req.body, req.userContext!);
    res.json({ success: true, data: school });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});
