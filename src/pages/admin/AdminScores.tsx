import { useEffect, useState } from 'react';
import { Search, AlertTriangle, CheckCircle2, XCircle, Trash2, Eye, RotateCcw, Loader2 } from 'lucide-react';
import { apiFetch, formatCategory, formatDateTime, formatDuration } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { EmptyState, StatusBadge } from '../../components/ui';

export default function AdminScores() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizFilter, setQuizFilter] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [permits, setPermits] = useState<any[]>([]);
  const [permitting, setPermitting] = useState<number | null>(null);

  useEffect(() => {
    fetchAll();
    fetchPermits();
    apiFetch<any[]>('/api/quizzes').then(setQuizzes).catch(() => {});
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any[]>('/api/quiz-attempts?all=1&limit=300', { admin: true });
      setAttempts(d);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchPermits = async () => {
    try {
      const d = await apiFetch<any[]>('/api/retake-permits?all=1&limit=100', { admin: true });
      setPermits(d);
    } catch {
      setPermits([]);
    }
  };

  const grantRetake = async (a: any) => {
    const name = a.student?.full_name || `Student #${a.student_id}`;
    const quiz = a.quiz?.title || `Quiz #${a.quiz_id}`;
    if (!confirm(`Permit ${name} to write "${quiz}" again? (One extra attempt)`)) return;
    setPermitting(a.id);
    try {
      await apiFetch('/api/retake-permits', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ student_id: a.student_id, quiz_id: a.quiz_id, note: `Retake after attempt #${a.id}` }),
      });
      fetchPermits();
      alert(`Retake permitted for ${name}.`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPermitting(null);
    }
  };

  const revokePermit = async (id: number) => {
    if (!confirm('Revoke this retake permit?')) return;
    try {
      await apiFetch('/api/retake-permits', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchPermits();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const hasOpenPermit = (student_id: number, quiz_id: number) =>
    permits.some((p) => Number(p.student_id) === Number(student_id) && Number(p.quiz_id) === Number(quiz_id) && !p.consumed);

  const remove = async (id: number) => {
    if (!confirm('Delete this attempt record?')) return;
    try {
      await apiFetch('/api/quiz-attempts', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = attempts.filter((a) => {
    if (quizFilter && String(a.quiz_id) !== quizFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${a.student?.full_name || ''} ${a.student?.email || ''} ${a.quiz?.title || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <Spinner label="Loading scores…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Scores & Attempts</h1>
          <p className="text-sm text-gray-500">Every student result with full proctoring history. Submitted students are locked out until you permit a retake.</p>
        </div>
        <button onClick={fetchAll} className="border border-navy-100 bg-white hover:border-gold-400 font-bold text-sm px-4 py-2.5 rounded-xl text-navy-900">
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Search student or quiz…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto max-w-xs" value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
          <option value="">All quizzes</option>
          {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
      </div>

      {permits.filter((p) => !p.consumed).length > 0 && (
        <div className="bg-white rounded-2xl border border-gold-400/50 p-5">
          <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-3">
            <RotateCcw className="w-4 h-4 text-gold-600" /> Open Retake Permits ({permits.filter((p) => !p.consumed).length})
          </h3>
          <div className="space-y-2">
            {permits.filter((p) => !p.consumed).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-gold-50 border border-gold-400/40 rounded-xl px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-bold text-navy-900">{p.student?.full_name || `Student #${p.student_id}`}</span>
                  <span className="text-gray-500"> → {p.quiz?.title || `Quiz #${p.quiz_id}`}</span>
                  {p.note && <div className="text-[11px] text-gray-400 truncate">{p.note}</div>}
                </div>
                <button onClick={() => revokePermit(p.id)} className="text-xs font-bold text-red-500 hover:text-red-600 shrink-0">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No attempts yet" message="Student quiz results will appear here after completion." />
      ) : (
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="bg-navy-950 text-white text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Quiz</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Warnings</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t border-navy-50 hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-navy-900 text-xs">{a.student?.full_name || `#${a.student_id}`}</div>
                      <div className="text-[11px] text-gray-400">{a.student?.email || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate">{a.quiz?.title || `#${a.quiz_id}`}</td>
                    <td className="px-4 py-3">
                      {a.status === 'in_progress' ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : (
                        <span className={`font-extrabold ${a.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                          {a.percentage ?? 0}% <span className="font-medium text-gray-400 text-[11px]">({a.score}/{a.total_marks})</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'in_progress' ? <span className="text-gray-400 text-xs">—</span> : a.passed ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs"><CheckCircle2 className="w-4 h-4" /> PASS</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><XCircle className="w-4 h-4" /> FAIL</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(a.warnings || 0) > 0 ? (
                        <span className="badge bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3" /> {a.warnings}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {a.time_spent_seconds ? formatDuration(a.time_spent_seconds) : '—'}
                      <div className="text-[10px] text-gray-400">{formatDateTime(a.submitted_at || a.started_at)}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} />
                      {a.status !== 'in_progress' && hasOpenPermit(a.student_id, a.quiz_id) && (
                        <div className="mt-1"><span className="badge bg-emerald-100 text-emerald-700">Retake permitted</span></div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {a.status !== 'in_progress' && !hasOpenPermit(a.student_id, a.quiz_id) && (
                          <button
                            onClick={() => grantRetake(a)}
                            disabled={permitting === a.id}
                            className="p-2 rounded-lg bg-gold-100 hover:bg-gold-400 hover:text-navy-950 text-gold-700 transition disabled:opacity-50"
                            title="Permit retake (one extra attempt)"
                          >
                            {permitting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => setDetail(a)} className="p-2 rounded-lg bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition" title="View detail">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(a.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Attempt Detail" wide>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-navy-50 rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Student</div>
                <div className="font-bold text-navy-900">{detail.student?.full_name || `#${detail.student_id}`}</div>
                <div className="text-xs text-gray-500">{detail.student?.email} · {formatCategory(detail.student?.level)} · {detail.student?.department || ''}</div>
              </div>
              <div className="bg-navy-50 rounded-xl p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Quiz</div>
                <div className="font-bold text-navy-900">{detail.quiz?.title || `#${detail.quiz_id}`}</div>
                <div className="text-xs text-gray-500">Started {formatDateTime(detail.started_at)}{detail.submitted_at ? ` · Submitted ${formatDateTime(detail.submitted_at)}` : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-navy-950 text-white rounded-xl p-4">
              <div className={`text-3xl font-extrabold ${detail.passed ? 'text-emerald-400' : 'text-red-400'}`}>{detail.percentage ?? 0}%</div>
              <div className="text-xs text-white/60">
                {detail.score ?? 0}/{detail.total_marks ?? 0} marks · {detail.time_spent_seconds ? formatDuration(detail.time_spent_seconds) : '—'} · {detail.warnings || 0} warnings
              </div>
              <div className="ml-auto"><StatusBadge status={detail.status} /></div>
            </div>
            <div>
              <div className="label-text">Warning Log ({(detail.warning_log || []).length})</div>
              {(detail.warning_log || []).length === 0 ? (
                <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-semibold">Clean session — no warnings.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto scroll-thin space-y-1.5">
                  {(detail.warning_log || []).map((w: any) => (
                    <div key={w.n} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                      <span className="font-extrabold text-amber-700">#{w.n}</span>
                      <span className="badge bg-white text-gray-600 border border-gray-200">{w.category}</span>
                      <span className="flex-1 text-gray-700">{w.message}</span>
                      <span className="text-gray-400 font-mono">{formatDuration(w.elapsed || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {detail.answers && Object.keys(detail.answers).length > 0 && (
              <div>
                <div className="label-text">Answers ({Object.keys(detail.answers).length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(detail.answers).map(([qid, opt]) => (
                    <span key={qid} className="badge bg-navy-50 text-navy-800 border border-navy-100">Q{qid}: {String(opt)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
