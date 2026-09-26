// ========================================================================
// Locations / Branches Routes
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { tenantService } from '../services/tenant.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const locationsRouter = Router();

locationsRouter.use(authMiddleware);
locationsRouter.use(tenantIsolationMiddleware);

const createLocationSchema = z.object({
  school_id: z.string().uuid().optional(),
  location_code: z.string().min(2).max(30),
  location_name: z.string().min(2).max(255),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

locationsRouter.get('/', requirePermission('locations.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!schoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID is required to list branches' } });
      return;
    }
    const locations = await tenantService.listLocations(schoolId, req.userContext!);
    res.json({ success: true, data: locations });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

locationsRouter.get('/:id', requirePermission('locations.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await tenantService.getLocationById(req.params.id as string, req.userContext!);
    if (!location) {
      res.status(404).json({ success: false, error: { message: 'Branch location not found' } });
      return;
    }
    res.json({ success: true, data: location });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

locationsRouter.post('/', requirePermission('locations.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = createLocationSchema.parse(req.body);
    const targetSchoolId = req.userContext!.is_super_admin 
      ? (validated.school_id || req.userContext!.school_id!) 
      : req.userContext!.school_id!;

    const location = await tenantService.createLocation({
      ...validated,
      school_id: targetSchoolId,
    }, req.userContext!);
    res.status(201).json({ success: true, data: location });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

locationsRouter.put('/:id', requirePermission('locations.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await tenantService.updateLocation(req.params.id as string, req.body, req.userContext!);
    res.json({ success: true, data: location });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});
