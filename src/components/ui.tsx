import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Tabs({ tabs }: { tabs: { label: string; icon?: ReactNode; content: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-2 mb-6">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition ${
              active === i ? 'bg-navy-900 text-gold-300 shadow-lg' : 'bg-white text-navy-800 border border-navy-100 hover:border-gold-400'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs[active]?.content}</div>
    </div>
  );
}

export function StatCard({ label, value, icon, accent = 'navy' }: { label: string; value: string | number; icon: ReactNode; accent?: 'navy' | 'gold' | 'green' | 'red' }) {
  const styles: Record<string, string> = {
    navy: 'bg-navy-900 text-white',
    gold: 'bg-gradient-to-br from-gold-600 to-gold-400 text-navy-950',
    green: 'bg-emerald-600 text-white',
    red: 'bg-red-600 text-white',
  };
  return (
    <div className={`${styles[accent]} rounded-2xl p-5 card-shadow`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</div>
        <div className="opacity-80">{icon}</div>
      </div>
      <div className="text-3xl font-extrabold mt-2">{value}</div>
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 bg-white rounded-2xl border border-dashed border-navy-100">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-navy-50 flex items-center justify-center text-navy-700">
        <ChevronDown className="w-6 h-6 rotate-180" />
      </div>
      <h4 className="font-bold text-navy-900">{title}</h4>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    approved: 'bg-emerald-100 text-emerald-700',
    submitted: 'bg-emerald-100 text-emerald-700',
    used: 'bg-slate-200 text-slate-700',
    pending: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    revoked: 'bg-red-100 text-red-700',
    expired: 'bg-orange-100 text-orange-700',
    auto_submitted: 'bg-purple-100 text-purple-700',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return <span className={`badge ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}
