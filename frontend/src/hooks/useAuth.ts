/**
 * DealFlow360 — Authentication & Session Hook
 *
 * Re-exports the Context-backed implementation in context/AuthContext.tsx
 * so every existing `import { useAuth } from '../hooks/useAuth'` keeps
 * working unchanged. The actual state now lives in one AuthProvider
 * (wrapping <App> in main.tsx) instead of being duplicated per-component —
 * see AuthContext.tsx's top-of-file note for why that matters.
 */
export { useAuth, AuthProvider } from '../context/AuthContext';
export type { AuthContextValue } from '../context/AuthContext';
