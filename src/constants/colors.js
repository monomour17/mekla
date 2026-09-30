// Reusable shadow presets — import SHADOWS wherever needed
export const SHADOWS = {
  // Soft floating card — default for white surface cards
  card: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  // Stronger lift — FABs, bottom sheets, modals
  elevated: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  // Subtle — list items, chips
  subtle: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
};

export const COLORS = {
  // Primary
  primary: '#6C47FF',
  primaryLight: '#ede9fe',
  primaryShadow: '#6C47FF',

  // Text
  textDark: '#1f2937',
  textBody: '#374151',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textPlaceholder: '#d1d5db',

  // Backgrounds
  background: '#f9fafb',
  backgroundLight: '#f8f8f8',
  surface: '#fff',
  inputBackground: '#f3f4f6',

  // Borders
  border: '#e5e7eb',
  divider: '#f3f4f6',

  // Status
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',

  // Avatar
  avatarFallback: '#a78bfa',

  // Online
  online: '#22c55e',

  // Misc
  white: '#fff',
  black: '#000',
  overlay: 'rgba(0,0,0,0.4)',
};
