# Backend — Odoo Hackathon

Node.js + Express + TypeScript backend API.

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL (or Docker Compose)

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your local values

# Run migrations
npm run migrate

# Seed development data (optional)
npm run seed
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:4000` by default.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start compiled production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint errors |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Coverage report |
| `npm run migrate` | Run pending migrations |
| `npm run seed` | Seed development data |
| `npm run typecheck` | TypeScript type check only |

## Architecture

```
src/
├── app.ts              # Express app setup (middleware, routes)
├── server.ts           # Bootstrap (DB verify, listen, graceful shutdown)
├── config/
│   ├── env.ts          # Zod-validated environment config
│   └── database.ts     # PostgreSQL connection pool
├── errors/
│   └── AppError.ts     # Typed application error class
├── middleware/
│   ├── errorHandler.ts # Global error handler (must be last)
│   ├── requestLogger.ts
│   ├── notFoundHandler.ts
│   └── validate.ts     # Zod validation middleware factory
├── routes/
│   └── health.routes.ts
├── utils/
│   ├── response.ts     # Response helpers
│   └── pagination.ts   # Pagination utilities
└── modules/            # Domain modules (created after Phase 0)
    └── <module>/
        ├── <module>.routes.ts
        ├── <module>.controller.ts
        ├── <module>.service.ts
        ├── <module>.repository.ts
        ├── <module>.validator.ts
        └── <module>.model.ts
```

## API Conventions

- Base path: `/api/v1/`
- Response envelope: `{ success, data, message }`
- Error envelope: `{ success: false, error, message, details }`

See [`docs/api.md`](../docs/api.md) for full reference.

## Environment Variables

See `.env.example` for all required variables.

## Testing

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```
