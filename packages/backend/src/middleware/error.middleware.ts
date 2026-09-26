// ========================================================================
// Error Middleware
// Standardized JSON error response without exposing sensitive internals
// ========================================================================

import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal error occurred';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  // Do not expose stack traces or database connection strings to client
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' ? { details: err.details } : {}),
    },
  });
}
