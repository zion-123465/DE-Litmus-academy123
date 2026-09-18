import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatDateTime, formatDuration } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState, StatusBadge } from '../../components/ui';

export default function MyScores() {
  const { student } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (student) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const a = await apiFetch<any[]>(`/api/quiz-attempts?student_id=${student!.id}&limit=100`);
      setAttempts(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner label="Loading your scores…" />;

  const done = attempts.filter((a) => a.status !== 'in_progress');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">My Scores</h1>
        <p className="text-sm text-gray-500">Your complete quiz history with scores and proctoring records.</p>
      </div>

      {attempts.length === 0 ? (
        <EmptyState
          title="No quiz attempts yet"
          message="Take your first proctored quiz to start building your record."
          action={
            <Link to="/portal/start-quiz" className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl inline-block">
              Take a Quiz
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {attempts.map((a) => {
            const pct = Number(a.percentage) || 0;
            const pass = a.passed;
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div
                    className={`w-16 h-16 shrink-0 rounded-2xl flex flex-col items-center justify-center font-extrabold ${
                      a.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {a.status === 'in_progress' ? <Clock className="w-6 h-6" /> : (
                      <>
                        <span className="text-lg leading-none tick-tock">{pct}%</span>
                        {pass ? <CheckCircle2 className="w-4 h-4 mt-1" /> : <XCircle className="w-4 h-4 mt-1" />}
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-navy-900">{a.quiz?.title || `Quiz #${a.quiz_id}`}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Started {formatDateTime(a.started_at)}
                      {a.submitted_at ? ` · Submitted ${formatDateTime(a.submitted_at)}` : ''}
                      {a.score !== null && a.score !== undefined ? ` · ${a.score}/${a.total_marks} marks` : ''}
                      {a.time_spent_seconds ? ` · ${formatDuration(a.time_spent_seconds)}` : ''}
                    </div>
                    {(a.warnings || 0) > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {a.warnings} proctor warning{a.warnings === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                  {a.status === 'in_progress' ? (
                    <Link to={`/portal/take-quiz/${a.quiz_id}`} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl shrink-0 text-center">
                      Resume Quiz
                    </Link>
                  ) : (
                    pass && <Trophy className="w-6 h-6 text-gold-500 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div className="bg-navy-950 rounded-2xl p-6 text-white flex items-center gap-4">
          <Trophy className="w-10 h-10 text-gold-400 shrink-0" />
          <div>
            <div className="font-bold">Performance summary</div>
            <div className="text-sm text-white/65">
              {done.length} completed · {done.filter((a) => a.passed).length} passed · Average{' '}
              {Math.round(done.reduce((s, a) => s + (Number(a.percentage) || 0), 0) / done.length)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
