import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { prisma } from '../config/prisma.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../middlewares/errorHandler.js';
import { env } from '../config/env.js';

// Validation Schema for Login Request
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { student: true },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await argon2.verify(user.passwordHash, password);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT payload
    const token = signToken({
      userId: user.id,
      role: user.role,
      studentId: user.student?.id,
    });

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    // Return safe user details (No password hashes!)
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        student: user.student
          ? {
              id: user.student.id,
              name: user.student.name,
              rollNumber: user.student.rollNumber,
              department: user.student.department,
              semester: user.student.semester,
              cgpa: user.student.cgpa,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// Endpoint used by frontend on boot to check active session
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id; // Guaranteed by `authenticate` middleware

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        student: user.student
          ? {
              id: user.student.id,
              name: user.student.name,
              rollNumber: user.student.rollNumber,
              department: user.student.department,
              semester: user.student.semester,
              cgpa: user.student.cgpa,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
