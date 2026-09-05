/**
 * DealFlow360 Design System Tokens
 * Master token specifications for typography, surfaces, semantics, spacing, and AI accents.
 */

export const TOKENS = {
  // Brand
  brand: {
    primary: '#1E3A8A', // Deep Trust Navy (Enterprise anchor)
    primaryHover: '#172554',
    secondary: '#0F766E', // Refined Slate Teal
    secondaryHover: '#115E59',
  },

  // Surfaces & Backgrounds
  surfaces: {
    appBackground: '#F8FAFC', // Slate 50 (Sophisticated cool neutral canvas)
    surface: '#FFFFFF', // Pure White Card Canvas
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#F1F5F9', // Slate 100
    border: '#E2E8F0', // Slate 200
    borderMuted: '#CBD5E1', // Slate 300
    divider: '#E2E8F0',
  },

  // Typography Colors
  text: {
    primary: '#0F172A', // Slate 900
    secondary: '#334155', // Slate 700
    muted: '#64748B', // Slate 500
    disabled: '#94A3B8', // Slate 400
    inverse: '#FFFFFF',
  },

  // Semantic Status Colors
  semantic: {
    neutral: {
      bg: '#F1F5F9',
      text: '#475569',
      border: '#CBD5E1',
    },
    info: {
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
    },
    success: {
      bg: '#ECFDF5',
      text: '#047857',
      border: '#A7F3D0',
    },
    warning: {
      bg: '#FFFBEB',
      text: '#B45309',
      border: '#FDE68A',
    },
    danger: {
      bg: '#FEF2F2',
      text: '#B91C1C',
      border: '#FECACA',
    },
  },

  // Dedicated AI Accent (Strictly reserved for AI-derived insights / recommendations)
  ai: {
    accent: '#6D28D9', // Deep Violet 700
    accentLight: '#EDE9FE', // Violet 100
    accentBorder: '#C4B5FD', // Violet 300
    accentDark: '#4C1D95', // Violet 900
  },

  // Radii
  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },

  // Control Heights
  heights: {
    inputSm: '32px',
    inputMd: '38px',
    inputLg: '44px',
    buttonSm: '32px',
    buttonMd: '38px',
    buttonLg: '44px',
  },
} as const;

export type TokenKeys = typeof TOKENS;
