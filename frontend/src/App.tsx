import { BrowserRouter, Routes, Route } from 'react-router-dom';

/**
 * App — Root Component
 *
 * Responsible for:
 * - Top-level routing
 * - Global providers (auth context, theme, etc.)
 *
 * DO NOT put business logic here.
 * Keep this file as a clean routing/provider shell.
 *
 * Module pages will be added here after Phase 0 analysis.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaceholderHome />} />
        {/* Module routes will be registered here after Phase 0 */}
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Placeholder home page — replaced after Phase 0.
 * Verifies the React app boots correctly.
 */
function PlaceholderHome() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', color: '#7c3aed' }}>
        🚀 Odoo Hackathon
      </h1>
      <p style={{ color: '#6b7280', maxWidth: '400px', textAlign: 'center' }}>
        Scaffold ready. Awaiting official problem statement.
        <br />
        Complete Phase 0 analysis before building features.
      </p>
      <a
        href="/api/v1/health"
        style={{ color: '#7c3aed', textDecoration: 'underline' }}
      >
        Check API health →
      </a>
    </main>
  );
}

export default App;
