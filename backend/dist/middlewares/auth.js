import { verifyToken } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';
// Middleware to verify JWT cookie and attach user to Request
export const authenticate = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return next(new AppError('Authentication required. Please log in.', 401));
    }
    try {
        const payload = verifyToken(token);
        req.user = {
            id: payload.userId,
            role: payload.role,
            studentId: payload.studentId,
        };
        next();
    }
    catch (error) {
        next(new AppError('Invalid or expired token. Please log in again.', 401));
    }
};
// Middleware factory for Role-Based Access Control
export const authorizeRole = (allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            next(new AppError('You do not have permission to perform this action.', 403));
            return;
        }
        next();
    };
};
