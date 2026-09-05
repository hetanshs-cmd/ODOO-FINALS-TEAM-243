/**
 * DealFlow360 — Universal Formatting Utilities
 * Standardized currency, date, percentage, and relative time formatters.
 */

export function formatCurrency(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: val % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(val);
}

/** 'PENDING_APPROVAL' -> 'Pending Approval'. Matches StatusBadge's label cases. */
export function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatPercent(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  const rounded = Math.round(val * 10) / 10;
  return `${rounded}%`;
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  // Compare against current system time
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // If date is slightly in future or < 60s
  if (diffMs < 60 * 1000 && diffMs >= -60 * 1000) {
    return 'Just now';
  }

  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 60) {
    return `${Math.max(1, diffMin)} min ago`;
  }
  if (diffHours === 1) {
    return '1 hr ago';
  }
  if (diffHours < 24) {
    return `${diffHours} hrs ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatExactDateTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatWaitingTime(dateString?: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {
    return `${Math.max(1, diffMin)} min`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'}`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
}
