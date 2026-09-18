import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Receipt, BarChart3, PlayCircle, ArrowRight, Trophy, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatCategory, formatDateTime } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { StatusBadge } from '../../components/ui';

export default function PortalDashboard() {
  const { student } = useAuth();
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (student) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, p, a] = await Promise.all([
        apiFetch<any[]>(`/api/quiz-codes?student_id=${student!.id}&limit=50`),
        apiFetch<any[]>(`/api/payments?student_id=${student!.id}&limit=50`),
        apiFetch<any[]>(`/api/quiz-attempts?student_id=${student!.id}&limit=50`),
      ]);
      setCodes(c);
      setPayments(p);
      setAttempts(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner label="Loading your portal…" />;

  const activeCodes = codes.filter((c) => c.status === 'active');
  const completed = attempts.filter((a) => a.status !== 'in_progress');
  const avg = completed.length ? Math.round(completed.reduce((s, a) => s + (Number(a.percentage) || 0), 0) / completed.length) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-navy-950 hero-pattern rounded-2xl p-6 md:p-8 text-white card-shadow">
        <div className="text-xs font-bold tracking-[0.25em] text-gold-400 uppercase">Student Portal</div>
        <h1 className="font-display font-extrabold text-2xl md:text-3xl mt-2">
          Welcome back, <span className="gold-text">{student?.full_name?.split(' ')[0] || 'Scholar'}</span>
        </h1>
        <p className="text-white/60 text-sm mt-2">
          {student?.level ? formatCategory(student.level) : 'Category not set'} {student?.department ? `· ${student.department}` : ''} · {student?.email}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/portal/start-quiz" className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> Take a Quiz
          </Link>
          <Link to="/portal/ai-tutor" className="text-sm font-bold px-5 py-2.5 rounded-xl border border-gold-400/50 text-gold-300 hover:bg-gold-400/10 transition flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Ask AI Tutor
          </Link>
          <Link to="/portal/buy-code" className="text-sm font-bold px-5 py-2.5 rounded-xl border border-gold-400/50 text-gold-300 hover:bg-gold-400/10 transition">
            Buy Quiz Code
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Codes', value: activeCodes.length, icon: <Ticket className="w-5 h-5" />, link: '/portal/codes' },
          { label: 'Payments', value: payments.length, icon: <Receipt className="w-5 h-5" />, link: '/portal/payments' },
          { label: 'Quizzes Taken', value: completed.length, icon: <BarChart3 className="w-5 h-5" />, link: '/portal/scores' },
          { label: 'Average Score', value: completed.length ? `${avg}%` : '—', icon: <Trophy className="w-5 h-5" />, link: '/portal/scores' },
        ].map((s) => (
          <Link key={s.label} to={s.link} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow hover:border-gold-400 transition">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center mb-3">{s.icon}</div>
            <div className="text-2xl font-extrabold text-navy-900">{s.value}</div>
            <div className="text-xs font-semibold text-gray-500 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900">Recent Quiz Codes</h3>
            <Link to="/portal/codes" className="text-xs font-bold text-gold-600 flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {codes.length === 0 ? (
            <p className="text-sm text-gray-500">No codes yet. <Link to="/portal/buy-code" className="font-bold text-navy-800">Buy your first code</Link>.</p>
          ) : (
            <div className="space-y-2">
              {codes.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-navy-50 rounded-xl px-4 py-2.5">
                  <span className="font-mono font-bold text-sm text-navy-900">{c.code}</span>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-navy-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900">Recent Results</h3>
            <Link to="/portal/scores" className="text-xs font-bold text-gold-600 flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {completed.length === 0 ? (
            <p className="text-sm text-gray-500">No completed quizzes yet. Your scores will appear here.</p>
          ) : (
            <div className="space-y-2">
              {completed.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-navy-50 rounded-xl px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-navy-900 truncate">{a.quiz?.title || `Quiz #${a.quiz_id}`}</div>
                    <div className="text-xs text-gray-400">{formatDateTime(a.submitted_at)}</div>
                  </div>
                  <span className={`font-extrabold ${(a.percentage ?? 0) >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{a.percentage ?? 0}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
