import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500">
        <AlertCircle size={28} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">Something went wrong</h3>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Try again
        </button>
      )}
    </div>
  );
}
