// ========================================================================
// Auth Middleware
// Validates token and builds security user context
// ========================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { authService } from '../services/auth.service.js';
import { UserContext } from '../types/index.js';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Authentication token is invalid or expired',
        },
      });
      return;
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is not active or no longer exists',
        },
      });
      return;
    }

    // Optional active branch header passed by client
    const headerBranchId = req.headers['x-branch-id'] as string | undefined;

    // Build context
    req.userContext = await authService.buildUserContext(user, headerBranchId);
    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Internal error validating session',
      },
    });
  }
}
