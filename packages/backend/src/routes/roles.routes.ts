// ========================================================================
// Roles & Permissions Routes
// Configurable Role Management
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { accessControlService } from '../services/access-control.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const rolesRouter = Router();

rolesRouter.use(authMiddleware);
rolesRouter.use(tenantIsolationMiddleware);

const createRoleSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  permissions: z.array(z.object({
    permissionId: z.string().uuid(),
    dataScopeId: z.string().uuid(),
  })).optional(),
});

rolesRouter.get('/', requirePermission('roles.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = await accessControlService.listRoles(req.userContext!);
    res.json({ success: true, data: roles });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.get('/:id', requirePermission('roles.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await accessControlService.getRoleById(req.params.id as string, req.userContext!);
    if (!role) {
      res.status(404).json({ success: false, error: { message: 'Role not found' } });
      return;
    }
    res.json({ success: true, data: role });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.post('/', requirePermission('roles.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = createRoleSchema.parse(req.body);
    const role = await accessControlService.createRole(validated, req.userContext!);
    res.status(201).json({ success: true, data: role });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.put('/:id', requirePermission('roles.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await accessControlService.updateRole(req.params.id as string, req.body, req.userContext!);
    res.json({ success: true, data: role });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.delete('/:id', requirePermission('roles.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const ok = await accessControlService.deleteRole(req.params.id as string, req.userContext!);
    res.json({ success: true, data: { deleted: ok } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Bulk update permissions for role
rolesRouter.put('/:id/permissions', requirePermission('roles.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      res.status(400).json({ success: false, error: { message: 'permissions array required' } });
      return;
    }
    const result = await accessControlService.setRolePermissionsBulk(req.params.id as string, permissions, req.userContext!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Map permission to role with data scope
rolesRouter.post('/:id/permissions', requirePermission('roles.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { permissionId, dataScopeId } = req.body;
    if (!permissionId || !dataScopeId) {
      res.status(400).json({ success: false, error: { message: 'permissionId and dataScopeId are required' } });
      return;
    }
    const mapping = await accessControlService.setRolePermission(req.params.id as string, permissionId, dataScopeId, req.userContext!);
    res.json({ success: true, data: mapping });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Revoke permission from role
rolesRouter.delete('/:id/permissions/:permissionId', requirePermission('roles.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const ok = await accessControlService.removeRolePermission(req.params.id as string, req.params.permissionId as string, req.userContext!);
    res.json({ success: true, data: { revoked: ok } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// User Role & Location Scope Management Endpoints
// ------------------------------------------------------------------------
rolesRouter.get('/user-assignments/all', requirePermission(['user_roles.view', 'roles.view']), async (req: Request, res: Response): Promise<void> => {
  try {
    const assignments = await accessControlService.getUserRoleAssignments(req.userContext!.school_id || '');
    res.json({ success: true, data: assignments });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.put('/user-assignments/:userId', requirePermission(['user_roles.manage', 'roles.manage']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
      res.status(400).json({ success: false, error: { message: 'roleIds must be an array of strings' } });
      return;
    }
    const result = await accessControlService.updateUserRoles(req.params.userId as string, roleIds, req.userContext!.school_id || '', req.userContext!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.get('/user-scopes/:userId', requirePermission(['access_scope.view', 'roles.view']), async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await accessControlService.getUserLocationAccess(req.params.userId as string);
    res.json({ success: true, data: access });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

rolesRouter.put('/user-scopes/:userId', requirePermission(['access_scope.manage', 'roles.manage']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchIds } = req.body;
    if (!Array.isArray(branchIds)) {
      res.status(400).json({ success: false, error: { message: 'branchIds must be an array of strings' } });
      return;
    }
    const result = await accessControlService.updateUserLocationAccess(req.params.userId as string, branchIds, req.userContext!.school_id || '', req.userContext!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});
