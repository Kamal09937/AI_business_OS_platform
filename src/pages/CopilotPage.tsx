import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { AIConversation, AIMessage, Product, Customer, Sale, Expense } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatPercent, formatNumber, getDateRange } from '@/lib/analytics';
import {
  Brain, Send, MessageSquare, Plus, Sparkles, TrendingUp, AlertTriangle,
  DollarSign, Users, Package, Bot, User as UserIcon,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>;
}

const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "What are my most profitable products?" },
  { icon: AlertTriangle, text: "Where am I losing money?" },
  { icon: DollarSign, text: "Why did profit change?" },
  { icon: Users, text: "Which customers may churn?" },
  { icon: Package, text: "Which products should I reorder?" },
  { icon: Sparkles, text: "Find potential profit opportunities" },
];

export function CopilotPage() {
  const { activeOrg, user } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConv, setActiveConv] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!activeOrg) return;
    setLoadingConv(true);
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('organization_id', activeOrg.id)
      .order('updated_at', { ascending: false });
    setConversations((data || []) as AIConversation[]);
    setLoadingConv(false);
  }, [activeOrg]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    const msgs = (data || []) as AIMessage[];
    setMessages(msgs.map(m => ({ role: m.role, content: m.content, data: m.metadata as Record<string, unknown> | undefined })));
  }, []);

  useEffect(() => {
    if (activeConv) loadMessages(activeConv.id);
    else setMessages([]);
  }, [activeConv, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // The "AI" — analyzes actual business data and generates explainable insights
  const analyzeBusinessData = async (question: string): Promise<string> => {
    if (!activeOrg) return "I don't have access to an organization's data.";

    const range = getDateRange('30d');
    const [prodRes, custRes, salesRes, expRes] = await Promise.all([
      supabase.from('products').select('*').eq('organization_id', activeOrg.id).eq('is_active', true),
      supabase.from('customers').select('*').eq('organization_id', activeOrg.id),
      supabase.from('sales').select('product_id, customer_id, total_revenue, gross_profit, quantity, sale_date').eq('organization_id', activeOrg.id).gte('sale_date', range.start.toISOString()),
      supabase.from('expenses').select('category, amount, expense_date').eq('organization_id', activeOrg.id).gte('expense_date', range.start.toISOString()),
    ]);

    const products = (prodRes.data || []) as Product[];
    const customers = (custRes.data || []) as Customer[];
    const sales = (salesRes.data || []) as { product_id: string; customer_id: string; total_revenue: number; gross_profit: number; quantity: number; sale_date: string }[];
    const expenses = (expRes.data || []) as { category: string; amount: number; expense_date: string }[];

    const q = question.toLowerCase();
    const currency = activeOrg.currency || 'USD';

    // Product profitability
    if (q.includes('profitable') || q.includes('most profitable') || q.includes('best product')) {
      if (sales.length === 0) return "I don't have any sales data for the last 30 days. Once you record sales, I can identify your most profitable products.";
      const perf = new Map<string, { revenue: number; profit: number; qty: number }>();
      for (const s of sales) {
        if (!s.product_id) continue;
        const ex = perf.get(s.product_id);
        if (ex) { ex.revenue += Number(s.total_revenue); ex.profit += Number(s.gross_profit); ex.qty += s.quantity; }
        else perf.set(s.product_id, { revenue: Number(s.total_revenue), profit: Number(s.gross_profit), qty: s.quantity });
      }
      const ranked = Array.from(perf.entries()).sort(([,a],[,b]) => b.profit - a.profit).slice(0, 5);
      if (ranked.length === 0) return "No product sales data available for the last 30 days.";
      const lines = ranked.map(([pid, d], i) => {
        const p = products.find(x => x.id === pid);
        return `${i+1}. **${p?.name || 'Unknown'}** — ${formatCurrency(d.profit, currency)} profit (${d.qty} units sold, ${formatPercent(d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0)} margin)`;
      });
      return `Based on the last 30 days of sales data, here are your most profitable products:\n\n${lines.join('\n')}\n\n**Key insight:** ${products.find(x => x.id === ranked[0][0])?.name || 'Your top product'} is your biggest profit driver. Consider ensuring adequate stock levels and exploring ways to boost its sales further.`;
    }

    // Where am I losing money
    if (q.includes('losing money') || q.includes('loss') || q.includes('leak')) {
      const issues: string[] = [];
      // Low margin products
      const lowMargin = products.filter(p => p.selling_price > 0 && ((p.selling_price - p.unit_cost) / p.selling_price) * 100 < 20);
      if (lowMargin.length > 0) issues.push(`**Low-margin products (${lowMargin.length}):** ${lowMargin.map(p => `${p.name} (${formatPercent(((p.selling_price - p.unit_cost) / p.selling_price) * 100)} margin)`).join(', ')}. These products earn less than 20% gross margin, limiting profitability.`);
      // Dead stock
      const soldIds = new Set(sales.filter(s => s.product_id).map(s => s.product_id!));
      const dead = products.filter(p => p.stock_quantity > 0 && !soldIds.has(p.id));
      if (dead.length > 0) {
        const deadValue = dead.reduce((s, p) => s + p.stock_quantity * p.unit_cost, 0);
        issues.push(`**Dead stock (${dead.length} products):** ${dead.map(p => p.name).join(', ')} — ${formatCurrency(deadValue, currency)} in capital is tied up in inventory with zero sales in the last 30 days.`);
      }
      // High expenses
      const expByCat = new Map<string, number>();
      for (const e of expenses) expByCat.set(e.category, (expByCat.get(e.category) || 0) + Number(e.amount));
      const totalExp = Array.from(expByCat.values()).reduce((a, b) => a + b, 0);
      const topExp = Array.from(expByCat.entries()).sort(([,a],[,b]) => b - a)[0];
      if (topExp && totalExp > 0) {
        const pct = (topExp[1] / totalExp) * 100;
        if (pct > 30) issues.push(`**Expense concentration:** ${topExp[0]} accounts for ${formatPercent(pct)} of total expenses (${formatCurrency(topExp[1], currency)}). This is the biggest target for cost reduction.`);
      }
      // Negative profit sales
      const negProfit = sales.filter(s => Number(s.gross_profit) < 0);
      if (negProfit.length > 0) issues.push(`**Negative-margin sales (${negProfit.length}):** Some sales were made below cost, resulting in direct losses.`);

      if (issues.length === 0) return "Good news — I analyzed your products, sales, and expenses from the last 30 days and found no significant profit leakage. Your margins are healthy and inventory is moving.";
      return `I identified ${issues.length} area(s) of potential profit leakage:\n\n${issues.join('\n\n')}\n\n**Recommended next step:** Visit the Profit Engine to create trackable actions for each issue, or use the Pricing Intelligence module to optimize underperforming products.`;
    }

    // Profit change
    if (q.includes('profit') && (q.includes('fall') || q.includes('change') || q.includes('decline') || q.includes('drop') || q.includes('decrease'))) {
      const totalProfit = sales.reduce((s, x) => s + Number(x.gross_profit), 0);
      const totalExp = expenses.reduce((s, x) => s + Number(x.amount), 0);
      const netProfit = totalProfit - totalExp;
      if (sales.length === 0 && expenses.length === 0) return "I don't have enough data for the last 30 days to analyze profit changes. Record sales and expenses to enable this analysis.";
      return `**Profit analysis for the last 30 days:**\n\n• Gross profit: ${formatCurrency(totalProfit, currency)}\n• Total expenses: ${formatCurrency(totalExp, currency)}\n• Net profit: ${formatCurrency(netProfit, currency)}\n\n${netProfit < 0 ? "Your business is currently operating at a net loss for this period. " : ""}${totalExp > totalProfit ? "Expenses are exceeding gross profit, which means you need to either increase margins, boost sales volume, or reduce costs. " : "Your gross profit covers expenses, but there may be room for optimization. "}The biggest expense category is ${expenses.length > 0 ? Array.from(expenses.entries()).sort(([,a],[,b]) => Number(b.amount) - Number(a.amount))[0][0] : 'not yet categorized'}.\n\n*This analysis uses actual recorded transactions. For a deeper comparison, ensure you have data across multiple periods.*`;
    }

    // Churn risk
    if (q.includes('churn') || q.includes('at risk') || q.includes('leaving')) {
      const churned = customers.filter(c => c.status === 'churned');
      const inactive = customers.filter(c => c.status === 'inactive');
      const atRisk = customers.filter(c => c.status === 'active' && c.total_orders > 0 && c.lifetime_value < 100);
      if (customers.length === 0) return "You don't have any customers in the system yet. Add customers and record sales to enable churn analysis.";
      const lines: string[] = [];
      if (churned.length > 0) lines.push(`**Already churned (${churned.length}):** ${churned.slice(0, 5).map(c => c.name).join(', ')}`);
      if (inactive.length > 0) lines.push(`**Inactive customers (${inactive.length}):** ${inactive.slice(0, 5).map(c => c.name).join(', ')}. These customers haven't been active recently and may need re-engagement.`);
      if (atRisk.length > 0) lines.push(`**Low-engagement customers (${atRisk.length}):** Active but with low lifetime value — may need attention to prevent churn.`);
      if (lines.length === 0) return "No churn risks detected. All your customers are active and engaged.";
      return `Here's my churn risk analysis:\n\n${lines.join('\n\n')}\n\n**Recommended action:** Reach out to inactive and low-engagement customers with targeted offers or check-ins to improve retention.`;
    }

    // Reorder
    if (q.includes('reorder') || q.includes('restock') || q.includes('replenish')) {
      const needReorder = products.filter(p => p.stock_quantity <= p.reorder_level);
      if (needReorder.length === 0) return "All products are above their reorder levels. No restocking needed at this time.";
      const lines = needReorder.map(p => `• **${p.name}** — ${p.stock_quantity} units (reorder level: ${p.reorder_level}). Suggested order: ${p.reorder_level * 2} units at ${formatCurrency(p.unit_cost, currency)}/unit = ${formatCurrency(p.reorder_level * 2 * p.unit_cost, currency)}`);
      return `**${needReorder.length} product(s) need reordering:**\n\n${lines.join('\n')}\n\nTotal estimated purchase cost: ${formatCurrency(needReorder.reduce((s, p) => s + p.reorder_level * 2 * p.unit_cost, 0), currency)}`;
    }

    // Profit opportunities
    if (q.includes('opportunity') || q.includes('opportunities') || q.includes('improve')) {
      const opps: string[] = [];
      const lowMargin = products.filter(p => p.selling_price > 0 && ((p.selling_price - p.unit_cost) / p.selling_price) * 100 < 30);
      if (lowMargin.length > 0) opps.push(`**Pricing opportunities (${lowMargin.length} products):** Products with margins below 30% could benefit from price optimization: ${lowMargin.slice(0, 3).map(p => p.name).join(', ')}${lowMargin.length > 3 ? '...' : ''}`);
      const dead = products.filter(p => p.stock_quantity > 0 && !new Set(sales.filter(s => s.product_id).map(s => s.product_id!)).has(p.id));
      if (dead.length > 0) opps.push(`**Inventory cleanup (${dead.length} products):** Dead stock tying up capital — consider discounting or bundling: ${dead.slice(0, 3).map(p => p.name).join(', ')}${dead.length > 3 ? '...' : ''}`);
      const topExp = Array.from(expenses.reduce((m, e) => { m.set(e.category, (m.get(e.category) || 0) + Number(e.amount)); return m; }, new Map<string, number>()).entries()).sort(([,a],[,b]) => b-a)[0];
      if (topExp) opps.push(`**Cost reduction:** Your largest expense is ${topExp[0]} at ${formatCurrency(topExp[1], currency)}. A 10% reduction would save ${formatCurrency(topExp[1] * 0.1, currency)}/month.`);
      if (opps.length === 0) return "No significant profit opportunities detected. Your business appears to be operating efficiently.";
      return `I found ${opps.length} profit opportunity area(s):\n\n${opps.join('\n\n')}\n\n**Next step:** Visit the Profit Engine to generate detailed, trackable recommendations for each opportunity.`;
    }

    // Revenue / sales summary
    if (q.includes('revenue') || q.includes('sales summary') || q.includes('how much')) {
      const totalRev = sales.reduce((s, x) => s + Number(x.total_revenue), 0);
      const totalProfit = sales.reduce((s, x) => s + Number(x.gross_profit), 0);
      const totalExp = expenses.reduce((s, x) => s + Number(x.amount), 0);
      return `**Business summary (last 30 days):**\n\n• Revenue: ${formatCurrency(totalRev, currency)}\n• Gross Profit: ${formatCurrency(totalProfit, currency)}\n• Expenses: ${formatCurrency(totalExp, currency)}\n• Net Profit: ${formatCurrency(totalProfit - totalExp, currency)}\n• Orders: ${sales.length}\n• Avg Order Value: ${formatCurrency(sales.length > 0 ? totalRev / sales.length : 0, currency)}\n• Active Customers: ${customers.filter(c => c.status === 'active').length}\n• Products: ${products.length}\n\n*All figures are from actual recorded transactions in your system.*`;
    }

    // Default response
    return `I can help you analyze your business data. I have access to:\n• ${products.length} products\n• ${customers.length} customers\n• ${sales.length} sales transactions (last 30 days)\n• ${expenses.length} expense records (last 30 days)\n\nTry asking me:\n• "What are my most profitable products?"\n• "Where am I losing money?"\n• "Which products should I reorder?"\n• "Find profit opportunities"\n\nI only use your actual business data — I never invent numbers.`;
  };

  const newConversation = async () => {
    if (!activeOrg || !user) return;
    const { data } = await supabase
      .from('ai_conversations')
      .insert({ organization_id: activeOrg.id, user_id: user.id, title: 'New Conversation' })
      .select()
      .single();
    if (data) {
      setActiveConv(data as AIConversation);
      setMessages([]);
      loadConversations();
    }
  };

  const sendMessage = async (text?: string) => {
    const message = text || input.trim();
    if (!message || !activeOrg || !user) return;
    if (!activeConv) {
      const { data: convData } = await supabase
        .from('ai_conversations')
        .insert({ organization_id: activeOrg.id, user_id: user.id, title: message.slice(0, 50) })
        .select()
        .single();
      if (convData) {
        setActiveConv(convData as AIConversation);
        loadConversations();
      }
    }

    const convId = activeConv?.id;
    if (!convId) return;

    setSending(true);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    await supabase.from('ai_messages').insert({ conversation_id: convId, role: 'user', content: message });

    const response = await analyzeBusinessData(message);

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    await supabase.from('ai_messages').insert({ conversation_id: convId, role: 'assistant', content: response });

    if (activeConv?.title === 'New Conversation') {
      await supabase.from('ai_conversations').update({ title: message.slice(0, 50) }).eq('id', convId);
      loadConversations();
    }
    setSending(false);
  };

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className="hidden lg:flex w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <Button icon={<Plus size={16} />} onClick={newConversation} variant="secondary" size="sm" className="w-full">New Conversation</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConv ? <LoadingSpinner size="sm" /> :
           conversations.length === 0 ? (
             <p className="text-xs text-slate-400 text-center py-8">No conversations yet</p>
           ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full text-left ${
                  activeConv?.id === conv.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <MessageSquare size={14} className="shrink-0" />
                <span className="truncate flex-1">{conv.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Brain size={18} /></div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">AI Business Copilot</h1>
            <p className="text-xs text-slate-400">Analyzes your actual business data — never invents numbers</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white mb-4"><Brain size={28} /></div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ask me about your business</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">I analyze your real data to provide explainable, data-backed insights</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => sendMessage(q.text)}
                    disabled={sending}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0"><q.icon size={16} /></div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                    msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-blue-600 text-white'
                  }`}>
                    {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`flex-1 rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0"><Bot size={16} /></div>
                  <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && sendMessage()}
              placeholder="Ask about your business performance..."
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none px-4 py-2.5 text-sm transition-all"
              disabled={sending}
            />
            <Button icon={<Send size={16} />} onClick={() => sendMessage()} loading={sending} disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
