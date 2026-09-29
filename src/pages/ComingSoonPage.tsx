import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ComingSoonPageProps {
  title: string;
  description: string;
  features?: string[];
  phase?: string;
  icon?: ReactNode;
}

export function ComingSoonPage({ title, description, features, phase = 'Phase 2+', icon }: ComingSoonPageProps) {
  const navigate = useNavigate();
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mt-12">
        <Card>
          <div className="flex flex-col items-center text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mb-5">
              {icon || <Construction size={32} />}
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">{description}</p>

            <div className="mt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-200 dark:ring-amber-900 px-3 py-1 text-xs font-medium">
                Coming in {phase}
              </span>
            </div>

            {features && features.length > 0 && (
              <div className="mt-8 w-full text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Planned Features</p>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="secondary" className="mt-8" icon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
