export const CHART_COLORS = {
  primary: '#2563eb',
  primaryLight: '#60a5fa',
  secondary: '#0891b2',
  success: '#059669',
  successLight: '#34d399',
  warning: '#d97706',
  warningLight: '#fbbf24',
  error: '#dc2626',
  errorLight: '#f87171',
  neutral: '#64748b',
  neutralLight: '#cbd5e1',
  accent: '#7c3aed',
  teal: '#0d9488',
  amber: '#f59e0b',
  rose: '#e11d48',
};

export const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.neutral,
  CHART_COLORS.accent,
  CHART_COLORS.teal,
];

export function getChartColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length];
}
