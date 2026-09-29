export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];
  return (
    <div className="flex items-center justify-center py-12">
      <span className={`${sizeClass} animate-spin rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-600`} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-600" />
    </div>
  );
}
