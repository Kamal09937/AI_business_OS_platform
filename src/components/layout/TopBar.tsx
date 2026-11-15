import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor, LogOut, ChevronDown, User as UserIcon, Building2, Palette } from 'lucide-react';
import type { Theme } from '@/contexts/ThemeContext';

const THEME_OPTIONS: { key: Theme; label: string; icon: typeof Sun }[] = [
  { key: 'black', label: 'Pure Black', icon: Monitor },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'light', label: 'Light', icon: Sun },
];

export function TopBar() {
  const { profile, organizations, activeOrg, setActiveOrg, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgMenuOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (profile?.full_name || 'User')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const activeThemeOption = THEME_OPTIONS.find((t) => t.key === theme);

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 shrink-0">
      {/* Brand on mobile (search box removed: it was decorative/non-functional) */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="text-sm font-bold text-slate-900 dark:text-white">AI Business OS</span>
        <span className="text-xs text-slate-400">{activeOrg?.name}</span>
        <UserIcon size={0} />
      </div>

      <div className="hidden md:block" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme switcher */}
        <div ref={themeRef} className="relative">
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            className="flex items-center gap-1.5 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Theme"
            aria-label="Select theme"
          >
            <Palette size={18} />
            <ChevronDown size={12} />
          </button>
          {themeMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1.5 z-50"
              role="menu"
            >
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Theme</p>
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  role="menuitemradio"
                  aria-checked={theme === opt.key}
                  onClick={() => { setTheme(opt.key); setThemeMenuOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    theme === opt.key
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <opt.icon size={15} />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {theme === opt.key && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Org switcher */}
        {organizations.length > 0 && (
          <div ref={orgRef} className="relative">
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors max-w-[180px]"
            >
              <Building2 size={16} className="shrink-0 text-slate-400" />
              <span className="truncate">{activeOrg?.name || 'Select Org'}</span>
              <ChevronDown size={14} className="shrink-0 text-slate-400" />
            </button>
            {orgMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1.5 z-50">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Organizations</p>
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => { setActiveOrg(org); setOrgMenuOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      org.id === activeOrg?.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Building2 size={14} className="shrink-0" />
                    <span className="truncate flex-1 text-left">{org.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User menu */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-semibold">
              {initials}
            </div>
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1.5 z-50">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{profile?.full_name || 'User'}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
