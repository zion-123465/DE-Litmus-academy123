import { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Check, Ban, RotateCcw, Loader2, Search } from 'lucide-react';
import { apiFetch, formatDateTime } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { EmptyState, StatusBadge } from '../../components/ui';

export default function AdminCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ quiz_id: '', count: 5, expires_at: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    apiFetch<any[]>('/api/quizzes').then(setQuizzes).catch(() => {});
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any[]>('/api/quiz-codes?all=1&limit=300', { admin: true });
      setCodes(d);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const quizName = (id: number | null) => {
    if (!id) return 'Any quiz';
    return quizzes.find((q) => q.id === id)?.title || `Quiz #${id}`;
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiFetch('/api/quiz-codes', {
        method: 'POST', admin: true,
        body: JSON.stringify({ quiz_id: form.quiz_id ? Number(form.quiz_id) : null, count: Number(form.count) || 1, expires_at: form.expires_at || null }),
      });
      setModalOpen(false);
      fetchAll();
    } catch (e: any) {
      setError(e.message || 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: number, action: 'revoke' | 'activate') => {
    try {
      await apiFetch('/api/quiz-codes', { method: 'PUT', admin: true, body: JSON.stringify({ id, action }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this code?')) return;
    try {
      await apiFetch('/api/quiz-codes', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const filtered = codes.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <Spinner label="Loading codes…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Quiz Codes</h1>
          <p className="text-sm text-gray-500">Generate, assign, revoke and track every code.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
          <Plus className="w-4 h-4" /> Generate Codes
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Search code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="used">Used</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No codes found" message="Generate quiz codes to distribute to students." />
      ) : (
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-navy-950 text-white text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Quiz</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created / Used</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-navy-50 hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-extrabold text-navy-900 flex items-center gap-1.5">
                        {c.code}
                        <button onClick={() => copy(c.code)} className="text-gray-400 hover:text-gold-600">
                          {copied === c.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">{quizName(c.quiz_id)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.student_id ? `#${c.student_id}` : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {formatDateTime(c.created_at)}
                      {c.used_at && <div>Used: {formatDateTime(c.used_at)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {c.status === 'active' ? (
                          <button onClick={() => setStatus(c.id, 'revoke')} className="p-2 rounded-lg bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-600 transition" title="Revoke">
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => setStatus(c.id, 'activate')} className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 transition" title="Reactivate">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => remove(c.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition" title="Delete">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Generate Quiz Codes">
        <form onSubmit={generate} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="label-text">Lock to Quiz (optional)</label>
            <select className="input-field" value={form.quiz_id} onChange={(e) => setForm({ ...form, quiz_id: e.target.value })}>
              <option value="">Any quiz (flexible)</option>
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Quantity (max 100)</label>
              <input type="number" min="1" max="100" className="input-field" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label-text">Expiry (optional)</label>
              <input type="date" className="input-field" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Generate
          </button>
        </form>
      </Modal>
    </div>
  );
}
