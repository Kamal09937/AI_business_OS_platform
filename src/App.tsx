import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { CopilotPage } from '@/pages/CopilotPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { SalesPage } from '@/pages/SalesPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { ProfitEnginePage } from '@/pages/ProfitEnginePage';
import { PricingPage } from '@/pages/PricingPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  DollarSign, BarChart3, Megaphone, Settings, FileText, Zap,
  AlertTriangle, Bell, CheckSquare, MapPin, Plug, Package,
} from 'lucide-react';

function ProtectedRoutes() {
  const { user, loading, activeOrg } = useAuth();

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user) return <AuthPage />;
  if (!activeOrg) return <AuthPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/copilot" element={<CopilotPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/profit-engine" element={<ProfitEnginePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/finance" element={<ComingSoonPage title="Finance / AI CFO" description="Track revenue, expenses, cash flow, budgets, and break-even analysis with AI-powered expense anomaly detection and financial forecasting." features={["Cash flow tracking", "Budget vs actual variance", "Break-even analysis", "Expense anomaly detection", "Financial trend analysis"]} phase="Phase 3" icon={<DollarSign size={32} />} />} />
        <Route path="/inventory" element={<ComingSoonPage title="Inventory Intelligence" description="Track SKUs, stock levels, reorder points, and sales velocity with AI demand forecasting and stockout prediction." features={["Demand forecasting", "Stockout prediction", "Slow-moving detection", "Reorder recommendations", "Dead-stock alerts"]} phase="Phase 2" icon={<Package size={32} />} />} />
        <Route path="/marketing" element={<ComingSoonPage title="Marketing Intelligence" description="Track campaigns, ad spend, CAC, ROAS, and conversion rates with AI-powered ROI analysis and budget optimization." features={["Campaign ROI analysis", "CAC & ROAS tracking", "Budget optimization", "Segment analysis", "Anomaly detection"]} phase="Phase 2" icon={<Megaphone size={32} />} />} />
        <Route path="/operations" element={<ComingSoonPage title="Operations Management" description="Track processes, productivity, operational costs, and service levels with AI bottleneck detection and efficiency analysis." features={["Bottleneck detection", "Efficiency analysis", "Cost anomaly detection", "Resource utilization", "Process improvement"]} phase="Phase 3" icon={<Settings size={32} />} />} />
        <Route path="/procurement" element={<ComingSoonPage title="Procurement Intelligence" description="Track suppliers, purchase orders, delivery times, and payment terms with AI supplier risk assessment and savings detection." features={["Supplier performance", "Price anomaly detection", "Potential savings", "Supplier risk scoring", "Procurement optimization"]} phase="Phase 3" icon={<FileText size={32} />} />} />
        <Route path="/forecasting" element={<ComingSoonPage title="Forecasting Engine" description="Centralized forecasting for revenue, sales, demand, expenses, profit, and cash flow with scenario analysis and uncertainty ranges." features={["Revenue forecasting", "Demand forecasting", "Best/base/downside scenarios", "Key driver analysis", "Uncertainty ranges"]} phase="Phase 2" icon={<Zap size={32} />} />} />
        <Route path="/risk" element={<ComingSoonPage title="Risk Center" description="Detect revenue decline, margin erosion, cash-flow issues, customer churn, supplier dependency, and operational risks with transparent methodology." features={["Revenue decline detection", "Margin erosion alerts", "Churn risk scoring", "Supplier dependency analysis", "Risk prioritization"]} phase="Phase 3" icon={<AlertTriangle size={32} />} />} />
        <Route path="/alerts" element={<ComingSoonPage title="Alert Center" description="Configurable alerts for revenue, profit, margin, inventory, churn, expenses, and marketing performance with threshold-based notifications." features={["Threshold-based alerts", "Multi-channel notifications", "Configurable recipients", "Alert history", "Severity levels"]} phase="Phase 2" icon={<Bell size={32} />} />} />
        <Route path="/actions" element={<ComingSoonPage title="Action Center" description="Convert AI recommendations into assigned tasks, track implementation, and measure actual business impact." features={["Task assignment", "Approval workflows", "Implementation tracking", "Result measurement", "Impact verification"]} phase="Phase 2" icon={<CheckSquare size={32} />} />} />
        <Route path="/branches" element={<ComingSoonPage title="Multi-Branch Management" description="Manage multiple branches, compare performance, and track metrics across locations." features={["Branch comparison", "Location-level KPIs", "Cross-branch analytics", "Branch-level inventory"]} phase="Phase 4" icon={<MapPin size={32} />} />} />
        <Route path="/integrations" element={<ComingSoonPage title="Integrations" description="Connect CSV/Excel imports, accounting systems, CRM, ERP, e-commerce, payment platforms, and banking data." features={["CSV/Excel import", "Accounting sync", "CRM integration", "ERP connection", "API webhooks"]} phase="Phase 4" icon={<Plug size={32} />} />} />
        <Route path="/settings" element={<ComingSoonPage title="Settings" description="Manage organization, users, roles, security, billing, and system configuration." features={["Organization management", "User & role management", "Security settings", "Billing", "API keys"]} phase="Phase 4" icon={<Settings size={32} />} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return <ProtectedRoutes />;
}

export default App;
