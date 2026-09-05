/**
 * Single source of truth for "where is X" navigation questions — used by
 * navAnswer.ts (the chat widget's instant, no-LLM fast path) so it can give
 * a factually correct location every time, even if the local AI model is
 * down.
 *
 * This intentionally does NOT replace the hand-built nav arrays in
 * InternalShell.tsx (the spec-locked sidebar, "Exact 9 navigation items in
 * required order") or CommandPalette.tsx — those are left untouched to
 * avoid any risk of regressing their exact order/behavior. This registry is
 * a superset, hand-kept in sync with both. If a page moves, update its
 * entry here too.
 */
export interface NavEntry {
  id: string;
  label: string;
  path: string;
  /** Human phrase describing where to find it, spoken back to the user. */
  location: string;
  /** Extra search terms so "quotes"/"deals" etc. also match "Quotations". */
  keywords: string[];
}

export const navRegistry: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', location: 'the Left Sidebar, at the top', keywords: ['home', 'overview'] },
  { id: 'quotations', label: 'Quotations', path: '/quotations', location: 'the Left Sidebar', keywords: ['quotes', 'deals', 'proposals', 'pipeline'] },
  { id: 'approvals', label: 'Approvals', path: '/approvals', location: 'the Left Sidebar', keywords: ['approve', 'governance', 'discount review'] },
  { id: 'fulfillment', label: 'Fulfillment', path: '/fulfillment', location: 'the Left Sidebar', keywords: ['warehouse', 'shipping', 'backorder', 'split'] },
  { id: 'subscriptions', label: 'Subscriptions', path: '/subscriptions', location: 'the Left Sidebar', keywords: ['recurring', 'billing plan'] },
  { id: 'invoices', label: 'Invoices', path: '/invoices', location: 'the Left Sidebar', keywords: ['billing', 'payment', 'settlement'] },
  { id: 'negotiations', label: 'Negotiations', path: '/negotiations', location: 'the Left Sidebar', keywords: ['inbox', 'messages', 'counter-offer', 'reply'] },
  { id: 'deal-health', label: 'Deal Health', path: '/deal-health', location: 'the Left Sidebar', keywords: ['alerts', 'anomaly', 'stalled', 'risk'] },
  { id: 'reports', label: 'Reports', path: '/reports', location: 'the Left Sidebar', keywords: ['analytics', 'kpi', 'export'] },
  { id: 'products', label: 'Products', path: '/products', location: 'the Left Sidebar', keywords: ['catalog', 'pricing', 'sku'] },
  { id: 'command-center', label: 'AI Command Center', path: '/command-center', location: 'the Top Bar, the "AI Assist" button', keywords: ['ai assist', 'ask ai', 'workspace question'] },
  { id: 'new-quotation', label: 'New Quotation', path: '/quotations/new', location: 'the bottom of the Left Sidebar, the "New Quotation" button', keywords: ['create quote', 'add quotation', 'start a deal'] },
  { id: 'customer-portal', label: 'Customer Portal', path: '/portal/quotation', location: 'the bottom of the Left Sidebar, the "Customer Portal" link', keywords: ['portal', 'customer view'] },
  { id: 'admin-products', label: 'Back-end / Admin', path: '/admin/products', location: 'the Top Bar, the "Back-end" link', keywords: ['admin', 'configuration', 'settings', 'discount tiers', 'warehouses'] },
];

/** Simple case-insensitive substring match over label/keywords/id. */
export function findNavEntry(query: string): NavEntry | null {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const scored = navRegistry
    .map((entry) => {
      const haystack = `${entry.label} ${entry.id} ${entry.keywords.join(' ')}`.toLowerCase();
      const matches = tokens.filter((t) => haystack.includes(t)).length;
      return { entry, matches };
    })
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => b.matches - a.matches);

  return scored[0]?.entry ?? null;
}
