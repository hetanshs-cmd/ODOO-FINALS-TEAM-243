# Frontend — Odoo Hackathon

React + Vite + TypeScript frontend.

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Backend running on `http://localhost:4000`

## Setup

```bash
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.
API calls to `/api/v1/` are proxied to the backend automatically (see `vite.config.ts`).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint errors |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm test` | Run tests |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | TypeScript type check |

## Architecture

```
src/
├── main.tsx            # React entry point
├── App.tsx             # Root routing + providers
├── index.css           # Global CSS + design tokens
├── components/         # Reusable UI components
├── pages/              # Page-level components
├── layouts/            # Layout wrappers
├── hooks/              # Custom React hooks (useAsync, etc.)
├── services/           # API call layer (apiClient)
├── context/            # React context providers
├── utils/              # Pure utility functions
├── validators/         # Client-side validation schemas
├── constants/          # App-wide constants (no magic strings)
└── types/              # Shared TypeScript types
```

## UI Standards

Every data-driven component must handle:
1. **Loading** — Show spinner or skeleton
2. **Empty** — Show useful empty state, not just "No data"
3. **Error** — Show human-readable error with retry
4. **Success** — Show result

## Accessibility

- Semantic HTML
- `<label>` on all inputs
- Keyboard navigation
- Visible focus states
- Proper heading hierarchy

## Design Tokens

CSS custom properties defined in `src/index.css`:

```css
--color-primary
--color-background
--font-family
--space-*
--radius-*
--shadow-*
```
