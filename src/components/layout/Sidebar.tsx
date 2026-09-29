import { NavLink } from 'react-router-dom';
import { Brain, LayoutDashboard, MessageSquare, DollarSign, Users, ShoppingCart, Receipt, Tag, Package, Megaphone, Settings, TrendingUp, FileText, Bell, AlertTriangle, CheckSquare, BarChart3, Zap, MapPin, Plug, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: 'phase1' | 'soon';
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, badge: 'phase1' },
      { to: '/copilot', label: 'AI Copilot', icon: MessageSquare, badge: 'phase1' },
    ],
  },
  {
    title: 'Business Modules',
    items: [
      { to: '/sales', label: 'Sales', icon: ShoppingCart, badge: 'phase1' },
      { to: '/customers', label: 'Customers', icon: Users, badge: 'phase1' },
      { to: '/products', label: 'Products', icon: Package, badge: 'phase1' },
      { to: '/expenses', label: 'Expenses', icon: Receipt, badge: 'phase1' },
      { to: '/finance', label: 'Finance', icon: DollarSign, badge: 'soon' },
      { to: '/pricing', label: 'Pricing Intelligence', icon: Tag, badge: 'phase1' },
      { to: '/inventory', label: 'Inventory', icon: BarChart3, badge: 'soon' },
      { to: '/marketing', label: 'Marketing', icon: Megaphone, badge: 'soon' },
      { to: '/operations', label: 'Operations', icon: Settings, badge: 'soon' },
      { to: '/procurement', label: 'Procurement', icon: FileText, badge: 'soon' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { to: '/profit-engine', label: 'Profit Engine', icon: TrendingUp, badge: 'phase1' },
      { to: '/forecasting', label: 'Forecasting', icon: Zap, badge: 'soon' },
      { to: '/risk', label: 'Risk Center', icon: AlertTriangle, badge: 'soon' },
      { to: '/alerts', label: 'Alert Center', icon: Bell, badge: 'soon' },
      { to: '/actions', label: 'Action Center', icon: CheckSquare, badge: 'soon' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/branches', label: 'Branches', icon: MapPin, badge: 'soon' },
      { to: '/integrations', label: 'Integrations', icon: Plug, badge: 'soon' },
      { to: '/settings', label: 'Settings', icon: Settings, badge: 'soon' },
    ],
  },
];

export function Sidebar() {
  const { activeOrg } = useAuth();

  return (
    <aside className="hidden md:flex w-60 lg:w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
          <Brain size={20} />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">AI Business OS</span>
          <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{activeOrg?.name || 'No Organization'}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge === 'phase1' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  {item.badge === 'soon' && <span className="text-[10px] text-slate-400 dark:text-slate-600 font-normal">soon</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
            <TrendingUp size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phase 1 Active</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Foundation modules live</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
