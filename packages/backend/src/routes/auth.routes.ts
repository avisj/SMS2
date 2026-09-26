// ========================================================================
// Auth Routes
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export const authRouter = Router();

const loginSchema = z.object({
  schoolId: z.string().min(1, 'School ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const switchBranchSchema = z.object({
  locationId: z.string().uuid('Valid location ID required'),
});

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(
      validated.schoolId,
      validated.userId,
      validated.password,
      ip,
      userAgent
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: err.message },
    });
  }
});

authRouter.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: req.userContext,
  });
});

authRouter.post('/switch-branch', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = switchBranchSchema.parse(req.body);
    const updatedContext = await authService.switchBranch(req.userContext!, validated.locationId);
    res.json({
      success: true,
      data: updatedContext,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'SWITCH_BRANCH_FAILED', message: err.message },
    });
  }
});
