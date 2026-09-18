import { useEffect, useState } from 'react';
import { Search, Trash2, Receipt, BarChart3, KeyRound, Copy, Check, Loader2 } from 'lucide-react';
import { apiFetch, formatCategory, formatDateTime, parseSetting } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/ui';

export default function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [debounced, setDebounced] = useState('');
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverStudent, setRecoverStudent] = useState<any | null>(null);
  const [recoverInfo, setRecoverInfo] = useState<any | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetResult, setResetResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchAll();
    apiFetch<any[]>('/api/settings').then((rows) => {
      const lv = rows.find((r) => r.key === 'levels');
      if (lv) {
        const p = parseSetting(lv);
        if (p?.items?.length) setLevels(p.items);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, level]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      let url = '/api/students?all=1&limit=300';
      if (debounced.trim()) url += `&search=${encodeURIComponent(debounced.trim())}`;
      if (level) url += `&level=${encodeURIComponent(level)}`;
      const d = await apiFetch<any>(url, { admin: true });
      setStudents(d.students || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openRecovery = async (s: any) => {
    setRecoverStudent(s);
    setRecoverInfo(null);
    setRecoverMsg('');
    setResetResult(null);
    setNewPassword('');
    setCopied(false);
    setRecoverOpen(true);
    setRecoverBusy(true);
    try {
      const info = await apiFetch<any>(`/api/admin-recovery?student_id=${s.id}`, { admin: true });
      setRecoverInfo(info);
    } catch (e: any) {
      setRecoverMsg(e.message || 'Could not load login details.');
    } finally {
      setRecoverBusy(false);
    }
  };

  const doReset = async () => {
    if (!recoverStudent) return;
    if (newPassword && newPassword.length < 6) {
      setRecoverMsg('Custom password must be at least 6 characters (or leave blank for auto-generated).');
      return;
    }
    if (!confirm(`Reset login password for ${recoverStudent.full_name}?`)) return;
    setRecoverBusy(true);
    setRecoverMsg('');
    try {
      const r = await apiFetch<any>('/api/admin-recovery', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ student_id: recoverStudent.id, new_password: newPassword || undefined }),
      });
      setResetResult(r);
      setNewPassword('');
    } catch (e: any) {
      setRecoverMsg(e.message || 'Reset failed.');
    } finally {
      setRecoverBusy(false);
    }
  };

  const copyTemp = async () => {
    if (!resetResult?.temp_password) return;
    try {
      await navigator.clipboard.writeText(resetResult.temp_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this student record? Their codes, payments and attempts remain but will be orphaned.')) return;
    try {
      await apiFetch('/api/students', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">Students</h1>
        <p className="text-sm text-gray-500">Every registered student, searchable by name, email or matric number.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Search students…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All categories</option>
          {levels.map((l) => (
            <option key={l} value={l}>{formatCategory(l)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading students…" />
      ) : students.length === 0 ? (
        <EmptyState title="No students found" message="Try a different search or filter." />
      ) : (
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="bg-navy-950 text-white text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Category / Dept</th>
                  <th className="px-4 py-3">Matric No</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-navy-50 hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-navy-900 text-gold-300 font-extrabold text-sm flex items-center justify-center shrink-0">
                          {(s.full_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-navy-900 text-xs">{s.full_name}</div>
                          <div className="text-[11px] text-gray-400">ID: DLA-{String(s.id).padStart(5, '0')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div>{s.email}</div>
                      <div className="text-gray-400">{s.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="badge bg-navy-900 text-gold-300">{formatCategory(s.level)}</span>
                      <div className="text-gray-500 mt-1">{s.department || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{s.matric_no || '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <a href={`/admin-portal-x7k9/payments`} title="Payments" className="p-2 rounded-lg bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition">
                          <Receipt className="w-4 h-4" />
                        </a>
                        <a href={`/admin-portal-x7k9/scores`} title="Scores" className="p-2 rounded-lg bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition">
                          <BarChart3 className="w-4 h-4" />
                        </a>
                        <button onClick={() => openRecovery(s)} className="p-2 rounded-lg bg-gold-100 hover:bg-gold-400 hover:text-navy-950 text-gold-700 transition" title="Recover login / reset password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(s.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition" title="Delete">
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

      <Modal open={recoverOpen} onClose={() => setRecoverOpen(false)} title="Student Login Recovery">
        <div className="space-y-4">
          {recoverStudent && (
            <div className="bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-sm">
              <div className="font-bold text-navy-900">{recoverStudent.full_name}</div>
              <div className="text-xs text-gray-500">ID: DLA-{String(recoverStudent.id).padStart(5, '0')} · Matric: {recoverStudent.matric_no || '—'}</div>
            </div>
          )}
          {recoverBusy && !recoverInfo && !resetResult ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-navy-700" /></div>
          ) : (
            <>
              {recoverInfo && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between bg-white border border-navy-100 rounded-lg px-3 py-2">
                    <span className="text-gray-500">Login email</span>
                    <span className="font-mono font-bold text-navy-900">{recoverInfo.auth_email || recoverInfo.email}</span>
                  </div>
                  <div className="flex justify-between bg-white border border-navy-100 rounded-lg px-3 py-2">
                    <span className="text-gray-500">Last sign-in</span>
                    <span className="font-semibold text-navy-900">{recoverInfo.last_sign_in ? formatDateTime(recoverInfo.last_sign_in) : 'Never'}</span>
                  </div>
                  <div className="flex justify-between bg-white border border-navy-100 rounded-lg px-3 py-2">
                    <span className="text-gray-500">Email confirmed</span>
                    <span className="font-semibold text-navy-900">{recoverInfo.email_confirmed ? 'Yes' : 'No'}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{recoverInfo.note}</p>
                </div>
              )}
              {resetResult ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">New temporary password</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono font-extrabold text-lg text-emerald-800">{resetResult.temp_password}</span>
                    <button onClick={copyTemp} className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700" title="Copy">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-1">Share privately with the student. Ask them to log in and change it afterwards.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label-text">Custom password (optional — blank = auto-generate)</label>
                    <input
                      type="text"
                      className="input-field font-mono"
                      placeholder="Leave blank for a random secure password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <button onClick={doReset} disabled={recoverBusy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    {recoverBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {recoverBusy ? 'Resetting…' : 'Reset Password'}
                  </button>
                </>
              )}
            </>
          )}
          {recoverMsg && <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{recoverMsg}</div>}
        </div>
      </Modal>
    </div>
  );
}
