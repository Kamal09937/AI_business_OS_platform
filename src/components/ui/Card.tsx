import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, subtitle, action, children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
}
