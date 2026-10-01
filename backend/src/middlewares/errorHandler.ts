import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details ?? null,
    });
    return;
  }

  if (err instanceof ZodError) {
    const issues = err.issues || (err as any).errors || [];
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: issues.map((e: any) => ({
        field: Array.isArray(e.path) ? e.path.join('.') : '',
        message: e.message,
      })),
    });
    return;
  }

  console.error('[Unhandled Internal Error]:', err);

  res.status(500).json({
    success: false,
    message: 'An internal server error occurred',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
