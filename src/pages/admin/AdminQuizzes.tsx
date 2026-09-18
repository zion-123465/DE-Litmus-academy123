import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, ListChecks, Power, PowerOff, X } from 'lucide-react';
import { apiFetch, formatCategory, parseSetting } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { EmptyState, StatusBadge } from '../../components/ui';
import CopyLinkButton from '../../components/CopyLinkButton';

const EMPTY = { title: '', description: '', level: '100', department: '', duration_minutes: 30, pass_mark: 50, price: 0, is_published: true, instructions: '' };

export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [departments, setDepartments] = useState<string[]>(['General']);
  const [newDeptInline, setNewDeptInline] = useState('');
  const [showNewDept, setShowNewDept] = useState(false);

  useEffect(() => {
    fetchAll();
    apiFetch<any[]>('/api/settings').then((rows) => {
      const lv = rows.find((r) => r.key === 'levels');
      const dp = rows.find((r) => r.key === 'departments');
      if (lv) { const p = parseSetting(lv); if (p?.items?.length) setLevels(p.items); }
      if (dp) { const p = parseSetting(dp); if (p?.items?.length) setDepartments(p.items); }
    }).catch(() => {});
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any[]>('/api/quizzes?with_counts=1');
      setQuizzes(d);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, department: departments[0] || 'General' });
    setError('');
    setNewDeptInline('');
    setShowNewDept(false);
    setModalOpen(true);
  };

  const openEdit = (q: any) => {
    setEditing(q);
    setForm({ title: q.title, description: q.description || '', level: q.level, department: q.department, duration_minutes: q.duration_minutes, pass_mark: q.pass_mark, price: q.price, is_published: q.is_published, instructions: q.instructions || '' });
    setError('');
    setNewDeptInline('');
    setShowNewDept(false);
    setModalOpen(true);
  };

  const addDepartmentInline = async () => {
    const name = newDeptInline.trim();
    if (!name) return;
    if (departments.includes(name)) {
      setForm((f: any) => ({ ...f, department: name }));
      setNewDeptInline('');
      setShowNewDept(false);
      return;
    }
    setBusy(true);
    try {
      const next = [...departments, name];
      await apiFetch('/api/settings', { method: 'PUT', admin: true, body: JSON.stringify({ key: 'departments', value: { items: next } }) });
      setDepartments(next);
      setForm((f: any) => ({ ...f, department: name }));
      setNewDeptInline('');
      setShowNewDept(false);
    } catch (e: any) {
      setError(e.message || 'Could not add department.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required.');
    setBusy(true);
    try {
      if (editing) {
        await apiFetch('/api/quizzes', { method: 'PUT', admin: true, body: JSON.stringify({ id: editing.id, ...form }) });
      } else {
        await apiFetch('/api/quizzes', { method: 'POST', admin: true, body: JSON.stringify(form) });
      }
      setModalOpen(false);
      fetchAll();
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this quiz and ALL its questions? This cannot be undone.')) return;
    try {
      await apiFetch('/api/quizzes', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const togglePublish = async (q: any) => {
    try {
      await apiFetch('/api/quizzes', { method: 'PUT', admin: true, body: JSON.stringify({ id: q.id, is_published: !q.is_published }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <Spinner label="Loading quizzes…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Quiz Manager</h1>
          <p className="text-sm text-gray-500">Create exams, set duration, pass mark, price and visibility.</p>
        </div>
        <button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState title="No quizzes yet" message="Create your first CBT exam." action={<button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl">New Quiz</button>} />
      ) : (
        <div className="grid gap-4">
          {quizzes.map((q) => (
            <div key={q.id} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge bg-navy-900 text-gold-300">{formatCategory(q.level)}</span>
                    <span className="badge bg-navy-50 text-navy-800 border border-navy-100">{q.department}</span>
                    {q.is_published ? <span className="badge bg-emerald-100 text-emerald-700">● Active</span> : <span className="badge bg-gray-200 text-gray-600">○ Deactivated</span>}
                    <span className="badge bg-gold-100 text-gold-700">{q.question_count ?? 0} questions</span>
                  </div>
                  <h3 className="font-bold text-navy-900 text-lg mt-2">{q.title}</h3>
                  {q.description && <p className="text-sm text-gray-500 line-clamp-1">{q.description}</p>}
                  <div className="mt-2">
                    <CopyLinkButton
                      id={q.id}
                      kind="quiz"
                      title={q.title}
                      subtitle={q.description || `${formatCategory(q.level)} · ${q.department} · ${q.question_count ?? 0} questions`}
                      priceLabel={Number(q.price) > 0 ? `₦${Number(q.price).toLocaleString()} / code` : 'Code price applies'}
                      compact
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-semibold">
                    {q.duration_minutes} mins · Pass {q.pass_mark}% · {Number(q.price) > 0 ? `₦${Number(q.price).toLocaleString()} (custom)` : 'Global code price'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link to={`/admin-portal-x7k9/questions?quiz=${q.id}`} className="flex items-center gap-1.5 text-xs font-bold bg-navy-900 text-gold-300 px-3.5 py-2.5 rounded-xl hover:bg-navy-800">
                    <ListChecks className="w-4 h-4" /> Questions
                  </Link>
                  <button onClick={() => togglePublish(q)} className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl transition ${q.is_published ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white'}`} title={q.is_published ? 'Deactivate quiz' : 'Activate quiz'}>
                    {q.is_published ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />} {q.is_published ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEdit(q)} className="p-2.5 rounded-xl bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(q.id)} className="p-2.5 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Quiz' : 'New Quiz'} wide>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="label-text">Quiz Title *</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. BIO 101 First Semester CBT" />
          </div>
          <div>
            <label className="label-text">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this exam about?" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Category (University Level / WAEC / JAMB)</label>
              <select className="input-field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {levels.map((l) => <option key={l} value={l}>{formatCategory(l)}</option>)}
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="label-text">Department</label>
              <select className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {!showNewDept ? (
                <button type="button" onClick={() => setShowNewDept(true)} className="mt-1.5 text-[11px] font-bold text-gold-600 hover:text-gold-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> New department
                </button>
              ) : (
                <div className="mt-1.5 flex gap-1.5">
                  <input className="input-field !py-1.5 !text-xs" placeholder="e.g. Computer Science" value={newDeptInline} onChange={(e) => setNewDeptInline(e.target.value)} />
                  <button type="button" onClick={addDepartmentInline} disabled={busy || !newDeptInline.trim()} className="bg-navy-900 text-gold-300 font-bold text-xs px-3 rounded-lg disabled:opacity-50">Add</button>
                  <button type="button" onClick={() => { setShowNewDept(false); setNewDeptInline(''); }} className="text-gray-400 hover:text-red-500 px-1"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <div>
              <label className="label-text">Duration (minutes)</label>
              <input type="number" min="1" max="600" className="input-field" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Pass Mark (%)</label>
              <input type="number" min="0" max="100" className="input-field" value={form.pass_mark} onChange={(e) => setForm({ ...form, pass_mark: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Custom Code Price ₦ (0 = use global price)</label>
              <input type="number" min="0" className="input-field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
                <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
                Active — students can enter with a code (uncheck to deactivate)
              </label>
            </div>
          </div>
          <div>
            <label className="label-text">Exam Instructions (shown before starting)</label>
            <textarea className="input-field" rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="e.g. Answer all questions. No calculators…" />
          </div>
          <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Quiz'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export function QuizStatusNote() {
  return <StatusBadge status="active" />;
}
