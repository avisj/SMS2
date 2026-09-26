// ========================================================================
// Audit Routes
// ========================================================================

import { Router, Request, Response } from 'express';
import { auditService } from '../services/audit.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const auditRouter = Router();

auditRouter.use(authMiddleware);
auditRouter.use(tenantIsolationMiddleware);

auditRouter.get('/', requirePermission('audit.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      locationId: req.query.location_id as string | undefined,
      userId: req.query.user_id as string | undefined,
      module: req.query.module as string | undefined,
      action: req.query.action as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await auditService.listAuditLogs(filters, req.userContext!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});
