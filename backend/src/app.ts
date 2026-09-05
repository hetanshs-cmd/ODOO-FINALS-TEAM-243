import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { portalRouter } from './modules/auth/portal.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { quotationsRouter } from './modules/quotations/quotations.routes';
import { discountEngineRouter } from './modules/discount-engine/discount-engine.routes';
import { approvalsRouter } from './modules/approvals/approvals.routes';
import {
  quotationConversionRouter,
  salesOrdersRouter,
} from './modules/sales-orders/sales-orders.routes';
import {
  salesOrderFulfillmentRouter,
  fulfillmentsRouter,
} from './modules/fulfillment/fulfillment.routes';
import { salesOrderBillingRouter, invoicesRouter } from './modules/billing/billing.routes';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes';
import {
  quotationNegotiationsRouter,
  negotiationsRouter,
} from './modules/negotiations/negotiations.routes';
import {
  quotationDealHealthRouter,
  dealHealthAlertsRouter,
} from './modules/deal-health/deal-health.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { upsellRouter } from './modules/upsell/upsell.routes';
import { reportingRouter } from './modules/reporting/reporting.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { usersRouter } from './modules/users/users.routes';
import { creditNotesRouter } from './modules/credit-notes/credit-notes.routes';
import { backordersRouter } from './modules/fulfillment/backorders.routes';
import { portalResourcesRouter } from './modules/portal/portal.routes';
import { aiRouter } from './modules/ai/ai.routes';

const app = express();

// Trust the first hop's X-Forwarded-For/CF-Connecting-IP (Cloudflare tunnel
// or any other reverse proxy in front of this process). Without this,
// req.ip is always the proxy's loopback address, which collapses every
// distinct client behind the proxy into a single rate-limit bucket below.
app.set('trust proxy', 1);

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
app.use('/api/v1', authRouter);
app.use('/api/v1', portalRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/quotations', quotationsRouter);
// Mounted at the same base path as quotationsRouter — discount-engine owns
// only the /:id/check-discounts route, kept as its own module per
// docs/architecture.md's module boundaries.
app.use('/api/v1/quotations', discountEngineRouter);
app.use('/api/v1/approvals', approvalsRouter);
// Converting a quotation into a sales order is a quotation-scoped action
// (POST /quotations/:id/convert), same "own its own routes but mount
// alongside quotations" pattern as discount-engine above.
app.use('/api/v1/quotations', quotationConversionRouter);
app.use('/api/v1/sales-orders', salesOrdersRouter);
// fulfillment, billing, and deal-health each contribute routes under both
// /sales-orders/:id/* (order-scoped actions) and their own top-level base —
// same pattern as above.
app.use('/api/v1/sales-orders', salesOrderFulfillmentRouter);
app.use('/api/v1/fulfillments', fulfillmentsRouter);
app.use('/api/v1/sales-orders', salesOrderBillingRouter);
app.use('/api/v1/invoices', invoicesRouter);
app.use('/api/v1/subscriptions', subscriptionsRouter);
// Opening a negotiation is a quotation-scoped action (POST
// /quotations/:id/negotiations); everything else on an existing negotiation
// (read, post a message) lives under /negotiations/:id/*.
app.use('/api/v1/quotations', quotationNegotiationsRouter);
app.use('/api/v1/negotiations', negotiationsRouter);
app.use('/api/v1/quotations', quotationDealHealthRouter);
app.use('/api/v1/deal-health', dealHealthAlertsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/products', upsellRouter);
app.use('/api/v1/reports', reportingRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/credit-notes', creditNotesRouter);
app.use('/api/v1/backorders', backordersRouter);
app.use('/api/v1/portal', portalResourcesRouter);
app.use('/api/v1/ai', aiRouter);

// ── Not Found Handler ─────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global Error Handler ─────────────────────────────────────────────────────
// Must be last middleware — 4 parameters required by Express
app.use(errorHandler);

export { app };
