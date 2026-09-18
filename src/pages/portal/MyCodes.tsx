import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Copy, Check, PlayCircle, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatDateTime } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState, StatusBadge } from '../../components/ui';

export default function MyCodes() {
  const { student } = useAuth();
  const [codes, setCodes] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (student) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [c, q] = await Promise.all([
        apiFetch<any[]>(`/api/quiz-codes?student_id=${student!.id}&limit=100`),
        apiFetch<any[]>('/api/quizzes'),
      ]);
      setCodes(c);
      setQuizzes(Object.fromEntries(q.map((x: any) => [x.id, x.title])));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  if (loading) return <Spinner label="Loading your codes…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">My Quiz Codes</h1>
          <p className="text-sm text-gray-500">Each code grants one entry into a proctored quiz.</p>
        </div>
        <Link to="/portal/buy-code" className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Buy New Code
        </Link>
      </div>

      {codes.length === 0 ? (
        <EmptyState
          title="No quiz codes yet"
          message="Purchase a code to unlock any quiz. Approved payments deliver codes instantly."
          action={
            <Link to="/portal/buy-code" className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl inline-block">
              Buy a Quiz Code
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {codes.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center">
                <Ticket className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-extrabold text-lg text-navy-900 tracking-wide">{c.code}</span>
                  <button onClick={() => copy(c.code)} className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-700" title="Copy code">
                    {copied === c.code ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {c.quiz_id ? quizzes[c.quiz_id] || `Quiz #${c.quiz_id}` : 'Any quiz'} · Issued {formatDateTime(c.created_at)}
                  {c.used_at ? ` · Used ${formatDateTime(c.used_at)}` : ''}
                  {c.expires_at ? ` · Expires ${formatDateTime(c.expires_at)}` : ''}
                </div>
              </div>
              {c.status === 'active' && (
                <Link
                  to={c.quiz_id ? `/portal/take-quiz/${c.quiz_id}?code=${encodeURIComponent(c.code)}` : '/portal/start-quiz'}
                  className="flex items-center justify-center gap-2 text-sm font-bold text-navy-950 bg-gold-400 hover:bg-gold-300 px-5 py-2.5 rounded-xl transition shrink-0"
                >
                  <PlayCircle className="w-4 h-4" /> Use Code
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
