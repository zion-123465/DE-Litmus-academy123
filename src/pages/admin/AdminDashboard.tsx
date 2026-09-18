import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, ClipboardList, Ticket, Receipt, BarChart3, Banknote, ArrowRight } from 'lucide-react';
import { apiFetch, formatDateTime, formatNGN, timeAgo } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { StatCard, StatusBadge } from '../../components/ui';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch<any>('/api/dashboard', { admin: true });
        setStats(d);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label="Loading command centre…" />;
  if (!stats) return <p className="text-red-600 font-semibold">Could not load dashboard. Check your admin session.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-2xl md:text-3xl text-navy-900">Command Centre</h1>
        <p className="text-sm text-gray-500">Full control over every part of De-Litmus Academy.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Students" value={stats.students} icon={<Users className="w-5 h-5" />} accent="navy" />
        <StatCard label="Revenue" value={formatNGN(stats.revenue)} icon={<Banknote className="w-5 h-5" />} accent="gold" />
        <StatCard label="Pending Payments" value={stats.paymentsPending} icon={<Receipt className="w-5 h-5" />} accent="red" />
        <StatCard label="Quiz Attempts" value={stats.attempts} icon={<BarChart3 className="w-5 h-5" />} accent="green" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Materials', value: stats.materials, icon: <BookOpen className="w-4 h-4" />, to: '/admin-portal-x7k9/materials' },
          { label: 'Quizzes', value: stats.quizzes, icon: <ClipboardList className="w-4 h-4" />, to: '/admin-portal-x7k9/quizzes' },
          { label: 'Questions', value: stats.questions, icon: <BarChart3 className="w-4 h-4" />, to: '/admin-portal-x7k9/questions' },
          { label: 'Codes', value: `${stats.codesActive} active / ${stats.codesUsed} used`, icon: <Ticket className="w-4 h-4" />, to: '/admin-portal-x7k9/codes' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="bg-white rounded-2xl border border-navy-100 p-4 hover:border-gold-400 transition group">
            <div className="flex items-center justify-between text-navy-700">
              {s.icon}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition text-gold-600" />
            </div>
            <div className="text-xl font-extrabold text-navy-900 mt-2">{s.value}</div>
            <div className="text-xs font-semibold text-gray-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900">Latest Payments</h3>
            <Link to="/admin-portal-x7k9/payments" className="text-xs font-bold text-gold-600">Manage →</Link>
          </div>
          <div className="space-y-2">
            {(stats.recentPayments || []).length === 0 && <p className="text-sm text-gray-400">No payments yet.</p>}
            {(stats.recentPayments || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-navy-50 rounded-xl px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-bold text-navy-900 truncate text-xs">{p.item_title}</div>
                  <div className="text-[11px] text-gray-400">{p.student_name} · {timeAgo(p.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-xs">{formatNGN(p.amount)}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900">Latest Attempts</h3>
            <Link to="/admin-portal-x7k9/scores" className="text-xs font-bold text-gold-600">View all →</Link>
          </div>
          <div className="space-y-2">
            {(stats.recentAttempts || []).length === 0 && <p className="text-sm text-gray-400">No attempts yet.</p>}
            {(stats.recentAttempts || []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between bg-navy-50 rounded-xl px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-bold text-navy-900 text-xs">Student #{a.student_id} → Quiz #{a.quiz_id}</div>
                  <div className="text-[11px] text-gray-400">{formatDateTime(a.started_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.status !== 'in_progress' && <span className="font-extrabold text-xs">{a.percentage ?? 0}%</span>}
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
