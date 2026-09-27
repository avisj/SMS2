// ========================================================================
// Error Middleware
// Standardized JSON error response without exposing sensitive internals
// ========================================================================

import { Request, Response, NextFunction } from 'express';

export function formatErrorMessage(msg: any): string {
  if (typeof msg !== 'string') return String(msg || '');
  if ((msg.startsWith('[') || msg.startsWith('{')) && msg.includes('"message"')) {
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => {
          const field = item.path?.filter(Boolean).join('.') || 'Field';
          return `${field}: ${item.message}`;
        }).join(', ');
      } else if (parsed && typeof parsed === 'object' && parsed.message) {
        return parsed.message;
      }
    } catch {}
  }
  return msg;
}

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const rawMessage = err.message || 'An unexpected internal error occurred';
  const message = formatErrorMessage(rawMessage);
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
