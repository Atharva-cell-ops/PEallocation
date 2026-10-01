import { Router } from 'express';
import { Role } from '@prisma/client';
import authRoutes from './auth.routes.js';
import studentRoutes from './student.routes.js';
import adminRoutes from './admin.routes.js';
import { authenticate, authorizeRole } from '../middlewares/auth.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/student', authenticate, authorizeRole([Role.STUDENT]), studentRoutes);
router.use('/admin', authenticate, authorizeRole([Role.ADMIN]), adminRoutes);

export default router;
