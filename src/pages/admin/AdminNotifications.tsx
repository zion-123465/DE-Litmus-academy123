import { useEffect, useState } from 'react';
import { Bell, Plus, Pencil, Trash2, Loader2, Megaphone, Eye, EyeOff } from 'lucide-react';
import { apiFetch, formatDateTime, timeAgo } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/ui';

const EMPTY = { title: '', message: '', audience: 'all', category: 'announcement', is_active: true };

const CATEGORIES = [
  { v: 'announcement', label: 'Announcement' },
  { v: 'exam', label: 'Exam / Quiz' },
  { v: 'payment', label: 'Payment' },
  { v: 'material', label: 'New Material' },
  { v: 'maintenance', label: 'Maintenance' },
];

export default function AdminNotifications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any[]>('/api/notifications?all=1&limit=100', { admin: true });
      setItems(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (n: any) => {
    setEditing(n);
    setForm({ title: n.title, message: n.message, audience: n.audience || 'all', category: n.category || 'announcement', is_active: n.is_active !== false });
    setError('');
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required.');
    if (!form.message.trim()) return setError('Message is required.');
    setBusy(true);
    try {
      if (editing) {
        await apiFetch('/api/notifications', { method: 'PUT', admin: true, body: JSON.stringify({ id: editing.id, ...form }) });
      } else {
        await apiFetch('/api/notifications', { method: 'POST', admin: true, body: JSON.stringify(form) });
      }
      setModalOpen(false);
      fetchAll();
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (n: any) => {
    try {
      await apiFetch('/api/notifications', { method: 'PUT', admin: true, body: JSON.stringify({ id: n.id, is_active: !n.is_active }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this notification for all students?')) return;
    try {
      await apiFetch('/api/notifications', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <Spinner label="Loading notifications…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Notifications</h1>
          <p className="text-sm text-gray-500">Broadcast announcements — they appear in every student account instantly.</p>
        </div>
        <button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Notification
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          message="Create your first broadcast for all students."
          action={<button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl">New Notification</button>}
        />
      ) : (
        <div className="grid gap-4">
          {items.map((n) => (
            <div key={n.id} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${n.is_active ? 'bg-navy-900 text-gold-300' : 'bg-gray-100 text-gray-400'}`}>
                  {n.is_active ? <Megaphone className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-900">{n.title}</span>
                    {n.is_active
                      ? <span className="badge bg-emerald-100 text-emerald-700">● Live</span>
                      : <span className="badge bg-gray-200 text-gray-600">○ Hidden</span>}
                    <span className="badge bg-gold-100 text-gold-700">{n.category || 'announcement'}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">{n.message}</p>
                  <div className="text-[11px] text-gray-400 mt-2">{formatDateTime(n.created_at)} · {timeAgo(n.created_at)}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleActive(n)} className="p-2.5 rounded-xl bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition" title={n.is_active ? 'Hide' : 'Show'}>
                    {n.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(n)} className="p-2.5 rounded-xl bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(n.id)} className="p-2.5 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Notification' : 'New Notification'}>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="label-text">Title *</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Weekend CBT Mock Exam" maxLength={120} />
          </div>
          <div>
            <label className="label-text">Message *</label>
            <textarea className="input-field" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write the announcement students will see…" maxLength={1000} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Category</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
                Visible to students now
              </label>
            </div>
          </div>
          <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Publishing…' : editing ? 'Save Changes' : 'Publish to All Students'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
