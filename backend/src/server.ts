import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

async function startServer() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL database connected successfully.');

    app.listen(env.PORT, () => {
      console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
