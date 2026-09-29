import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'neutral' | 'purple';
}

const accentMap = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-900' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-900' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-900' },
  red: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200 dark:ring-rose-900' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-200 dark:ring-teal-900' },
  neutral: { bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-200 dark:ring-slate-700' },
  purple: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200 dark:ring-violet-900' },
};

export function KpiCard({ label, value, icon, change, changeLabel, subtitle, accent = 'neutral' }: KpiCardProps) {
  const colors = accentMap[accent];
  const hasChange = change !== undefined && change !== null && !isNaN(change);
  const isPositive = hasChange && change > 0;
  const isNegative = hasChange && change < 0;
  const isFlat = hasChange && change === 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
            {icon}
          </div>
        )}
      </div>
      {hasChange && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${
            isPositive ? 'text-emerald-600 dark:text-emerald-400' :
            isNegative ? 'text-rose-600 dark:text-rose-400' :
            'text-slate-500 dark:text-slate-400'
          }`}>
            {isPositive && <TrendingUp size={13} />}
            {isNegative && <TrendingDown size={13} />}
            {isFlat && <Minus size={13} />}
            {isPositive ? '+' : ''}{change!.toFixed(1)}%
          </span>
          {changeLabel && <span className="text-xs text-slate-400 dark:text-slate-500">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
