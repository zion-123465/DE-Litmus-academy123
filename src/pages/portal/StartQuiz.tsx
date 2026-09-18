import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Target, ArrowRight, Ticket, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatCategory, formatNGN, parseSetting } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState } from '../../components/ui';

export default function StartQuiz() {
  const { student } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [globalPrice, setGlobalPrice] = useState(1500);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [q, rows] = await Promise.all([
        apiFetch<any[]>('/api/quizzes?published_only=1&with_counts=1'),
        apiFetch<any[]>('/api/settings'),
      ]);
      setQuizzes(q);
      const gp = rows.find((r) => r.key === 'quiz_code_price');
      if (gp) {
        const p = parseSetting(gp);
        if (p?.amount) setGlobalPrice(p.amount);
      }
      if (student) {
        const [c, a] = await Promise.all([
          apiFetch<any[]>(`/api/quiz-codes?student_id=${student.id}&limit=100`),
          apiFetch<any[]>(`/api/quiz-attempts?student_id=${student.id}&limit=100`),
        ]);
        setCodes(c);
        setCompletedIds(new Set((a || []).filter((x: any) => x.status !== 'in_progress').map((x: any) => Number(x.quiz_id))));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeFor = (quizId: number) =>
    codes.find((c) => c.status === 'active' && (!c.quiz_id || Number(c.quiz_id) === Number(quizId)));

  if (loading) return <Spinner label="Loading available quizzes…" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">Take a Quiz</h1>
        <p className="text-sm text-gray-500">Pick an exam, enter your code, and step into the proctored hall. Each code works once — after you submit, only the admin can permit a retake.</p>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState title="No quizzes published" message="Check back soon for new exams." />
      ) : (
        <div className="grid gap-4">
          {quizzes.map((z) => {
            const code = activeFor(z.id);
            const price = Number(z.price) > 0 ? Number(z.price) : globalPrice;
            const locked = completedIds.has(Number(z.id));
            return (
              <div key={z.id} className="bg-white rounded-2xl border border-navy-100 p-5 md:p-6 card-shadow flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge bg-navy-900 text-gold-300">{formatCategory(z.level)}</span>
                    <span className="badge bg-navy-50 text-navy-800 border border-navy-100">{z.department}</span>
                    {locked ? (
                      <span className="badge bg-gray-200 text-gray-600"><Lock className="w-3 h-3" /> Submitted — admin permit needed</span>
                    ) : (
                      code && <span className="badge bg-emerald-100 text-emerald-700"><Ticket className="w-3 h-3" /> Code ready</span>
                    )}
                  </div>
                  <h3 className="font-bold text-navy-900 text-lg mt-2">{z.title}</h3>
                  {z.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{z.description}</p>}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 font-semibold">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {z.duration_minutes} mins</span>
                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Pass {z.pass_mark}%</span>
                    <span>{z.question_count ?? '?'} questions</span>
                    <span className="text-navy-900 font-extrabold">{formatNGN(price)} / code</span>
                  </div>
                </div>
                <div className="flex sm:flex-row md:flex-col gap-2 shrink-0">
                  {locked ? (
                    <Link
                      to="/portal/messages"
                      className="flex-1 md:flex-none text-center bg-navy-900 hover:bg-navy-800 text-gold-300 font-bold text-sm px-6 py-3 rounded-xl transition"
                    >
                      Ask Admin for Retake
                    </Link>
                  ) : code ? (
                    <Link
                      to={`/portal/take-quiz/${z.id}?code=${encodeURIComponent(code.code)}`}
                      className="flex-1 md:flex-none gold-btn font-bold text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2"
                    >
                      Enter Hall <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <>
                      <Link
                        to={`/portal/take-quiz/${z.id}`}
                        className="flex-1 md:flex-none text-center bg-navy-900 hover:bg-navy-800 text-gold-300 font-bold text-sm px-6 py-3 rounded-xl transition"
                      >
                        I Have a Code
                      </Link>
                      <Link
                        to="/portal/buy-code"
                        className="flex-1 md:flex-none text-center border border-navy-100 hover:border-gold-400 text-navy-900 font-bold text-sm px-6 py-3 rounded-xl transition"
                      >
                        Buy Code
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
