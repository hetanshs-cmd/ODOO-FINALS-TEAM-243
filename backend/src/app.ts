import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health.routes';

const app = express();

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  },
});
app.use(limiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request Logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1', healthRouter);

// TODO: Register module routers here after Phase 0 analysis
// Example:
// app.use('/api/v1/users', usersRouter);

// ── Not Found Handler ─────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global Error Handler ─────────────────────────────────────────────────────
// Must be last middleware — 4 parameters required by Express
app.use(errorHandler);

export { app };
