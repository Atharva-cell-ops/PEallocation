import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler, AppError } from './middlewares/errorHandler.js';
import apiRouter from './routes/api.router.js';
const app = express();
app.use(helmet());
app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
app.use('/api/v1', apiRouter);
app.use((req, _res, next) => {
    next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404));
});
app.use(errorHandler);
export default app;
