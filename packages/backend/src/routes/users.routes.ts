// ========================================================================
// Users Routes (Universal Users Model)
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { userService } from '../services/user.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const usersRouter = Router();

usersRouter.use(authMiddleware);
usersRouter.use(tenantIsolationMiddleware);

const createUserSchema = z.object({
  school_id: z.string().uuid().optional(),
  user_type_id: z.string().uuid('Valid user type ID is required'),
  username: z.string().min(3).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  password: z.string().optional(),
  role_ids: z.array(z.string().uuid()).optional(),
  location_ids: z.array(z.string().uuid()).optional(),
  primary_location_id: z.string().uuid().optional(),
  create_login_access: z.boolean().optional(),
  login_password: z.string().optional(),
  login_status: z.enum(['ACTIVE', 'DISABLED']).optional(),
}).superRefine((data, ctx) => {
  if (data.create_login_access) {
    const pwd = data.login_password || data.password;
    if (!pwd || pwd.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must be at least 6 characters when login access is enabled',
        path: ['login_password'],
      });
    }
  }
});

usersRouter.get('/', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      search: req.query.search as string | undefined,
      userTypeId: req.query.user_type_id as string | undefined,
      locationId: req.query.location_id as string | undefined,
      status: req.query.status as string | undefined,
    };
    const users = await userService.listUsers(filters, req.userContext!);
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.get('/:id', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userService.getUserById(req.params.id as string, req.userContext!);
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.post('/', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = createUserSchema.parse(req.body);
    const user = await userService.createUser(validated, req.userContext!);
    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.put('/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userService.updateUser(req.params.id as string, req.body, req.userContext!);
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.delete('/:id', requirePermission('users.delete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const ok = await userService.archiveUser(req.params.id as string, req.userContext!);
    res.json({ success: true, data: { archived: ok } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Role Assignment
usersRouter.post('/:id/roles', requirePermission('users.assign_roles'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleId } = req.body;
    if (!roleId) {
      res.status(400).json({ success: false, error: { message: 'roleId is required' } });
      return;
    }
    const result = await userService.assignRole(req.params.id as string, roleId, req.userContext!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.delete('/:id/roles/:roleId', requirePermission('users.assign_roles'), async (req: Request, res: Response): Promise<void> => {
  try {
    const ok = await userService.revokeRole(req.params.id as string, req.params.roleId as string, req.userContext!);
    res.json({ success: true, data: { revoked: ok } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Branch Location Assignment
usersRouter.post('/:id/locations', requirePermission('users.assign_locations'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { locationId, isPrimary } = req.body;
    if (!locationId) {
      res.status(400).json({ success: false, error: { message: 'locationId is required' } });
      return;
    }
    const result = await userService.assignLocation(req.params.id as string, locationId, !!isPrimary, req.userContext!);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// User Login Access Management
usersRouter.get('/:id/login-access', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await userService.getUserLoginAccess(req.params.id as string, req.userContext!);
    res.json({ success: true, data: access });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.post('/:id/login-access', requirePermission('users.manage_login'), async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await userService.createUserLoginAccess(req.params.id as string, req.body, req.userContext!);
    res.status(201).json({ success: true, data: access });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.put('/:id/login-access/status', requirePermission('users.manage_login'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      res.status(400).json({ success: false, error: { message: 'Status must be ACTIVE or DISABLED' } });
      return;
    }
    const access = await userService.toggleUserLoginAccess(req.params.id as string, status, req.userContext!);
    res.json({ success: true, data: access });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

usersRouter.post('/:id/login-access/reset-password', requirePermission('users.manage_login'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ success: false, error: { message: 'New password is required' } });
      return;
    }
    const ok = await userService.resetUserPassword(req.params.id as string, password, req.userContext!);
    res.json({ success: true, data: { reset: ok } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});
