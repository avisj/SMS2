// ========================================================================
// Express Application Assembly
// Production Multi-Tenant School Management System SaaS
// ========================================================================

import express from 'express';
import cors from 'cors';
import { env, isDatabaseConfigured } from './config/env.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { seedInMemoryDatabase } from './db/seed.js';

import { authRouter } from './routes/auth.routes.js';
import { schoolsRouter } from './routes/schools.routes.js';
import { locationsRouter } from './routes/locations.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { rolesRouter } from './routes/roles.routes.js';
import { permissionsRouter } from './routes/permissions.routes.js';
import { configRouter } from './routes/config.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { peopleRouter } from './routes/people.routes.js';
import academicRouter from './routes/academic.routes.js';
import timetableRouter from './routes/timetable.routes.js';
import attendanceRouter from './routes/attendance.routes.js';
import feesRouter from './routes/fees.routes.js';
import examsRouter from './routes/exams.routes.js';
import communicationRouter from './routes/communication.routes.js';
import { transportRouter } from './routes/transport.routes.js';
import { inventoryRouter } from './routes/inventory.routes.js';
import { assetRouter } from './routes/asset.routes.js';
import { libraryRouter } from './routes/library.routes.js';
import { admissionsRouter } from './routes/admissions.routes.js';

import { getDatabaseClient, PostgresDatabaseClient, SupabaseDatabaseClient, isCloudDatabaseActive } from './db/client.js';

export function createApp() {
  const app = express();

  // Always seed in-memory DB as a reliable fallback/cache
  seedInMemoryDatabase();

  // Global Middleware
  const configuredOrigins = env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((s) => s.trim()) : [];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/health', async (_req, res) => {
    let dbMode = 'in-memory';
    let dbStatus = 'connected';
    let dbDetails: string | null = 'In-Memory Relational Engine';
    if (isCloudDatabaseActive()) {
      const client = getDatabaseClient();
      if (client instanceof PostgresDatabaseClient || client instanceof SupabaseDatabaseClient) {
        dbMode = client instanceof PostgresDatabaseClient ? 'postgresql' : 'supabase';
        const test = await client.testConnection();
        dbStatus = test.ok ? 'connected' : 'error';
        dbDetails = test.ok ? (test.message || 'ok') : (test.error || 'error');
      }
    }
    res.json({
      status: 'ok',
      database: {
        mode: dbMode,
        status: dbStatus,
        details: dbDetails,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // REST API v1 Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/schools', schoolsRouter);
  app.use('/api/v1/locations', locationsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/config', configRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/people', peopleRouter);
  app.use('/api/v1/academics', academicRouter);
  app.use('/api/v1/timetables', timetableRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/fees', feesRouter);
  app.use('/api/v1/exams', examsRouter);
  app.use('/api/v1/communication', communicationRouter);
  app.use('/api/v1/transport', transportRouter);
  app.use('/api/v1/inventory', inventoryRouter);
  app.use('/api/v1/assets', assetRouter);
  app.use('/api/v1/library', libraryRouter);
  app.use('/api/v1/admissions', admissionsRouter);

  // Error Handler
  app.use(errorMiddleware);

  return app;
}
