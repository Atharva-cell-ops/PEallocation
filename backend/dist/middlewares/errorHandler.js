import { ZodError } from 'zod';
import { env } from '../config/env.js';
export class AppError extends Error {
    statusCode;
    details;
    constructor(message, statusCode = 400, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            details: err.details ?? null,
        });
        return;
    }
    if (err instanceof ZodError) {
        const issues = err.issues || err.errors || [];
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: issues.map((e) => ({
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
