// ========================================================================
// Permissions & Data Scopes Catalog Routes
// ZERO hardcoded permission lists on frontend
// ========================================================================

import { Router, Request, Response } from 'express';
import { accessControlService } from '../services/access-control.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const permissionsRouter = Router();

permissionsRouter.use(authMiddleware);

permissionsRouter.get('/', requirePermission(['rights.view', 'roles.view']), async (_req: Request, res: Response): Promise<void> => {
  try {
    const permissions = await accessControlService.listPermissions();
    res.json({ success: true, data: permissions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

permissionsRouter.get('/scopes', requirePermission(['access_scope.view', 'roles.view']), async (_req: Request, res: Response): Promise<void> => {
  try {
    const scopes = await accessControlService.listDataScopes();
    res.json({ success: true, data: scopes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

