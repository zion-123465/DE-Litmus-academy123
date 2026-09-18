import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, ExternalLink, Loader2, Search, Zap, Sparkles, ShieldAlert } from 'lucide-react';
import { apiFetch, formatDateTime, formatNGN } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState, StatusBadge } from '../../components/ui';

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<number | null>(null);
  const [aiScans, setAiScans] = useState<Record<number, any>>({});
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any[]>('/api/payments?all=1&limit=300', { admin: true });
      setPayments(d);
      if (d.length) {
        try {
          const scans = await apiFetch<any[]>(`/api/ai-checks?payment_ids=${d.map((p: any) => p.id).join(',')}`, { admin: true });
          const map: Record<number, any> = {};
          for (const s of scans) {
            if (!map[s.payment_id]) map[s.payment_id] = s;
          }
          setAiScans(map);
        } catch {}
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const decide = async (id: number, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Approve this payment? A quiz code will be issued automatically for quiz purchases.' : 'Reject this payment?';
    if (!confirm(label)) return;
    setActing(id);
    try {
      await apiFetch('/api/payments', { method: 'PUT', admin: true, body: JSON.stringify({ id, action, decided_by: 'admin' }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActing(null);
    }
  };

  const filtered = payments.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${p.student_name} ${p.student_email} ${p.item_title} ${p.bank_ref || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const aiRecheck = async (id: number) => {
    setActing(id);
    setAiMsg(null);
    try {
      const r: any = await apiFetch('/api/payments', { method: 'PUT', admin: true, body: JSON.stringify({ id, action: 'ai-recheck' }) });
      setAiMsg(r.status === 'approved' ? `AI approved payment #${id} — code released.` : `AI re-check for #${id}: ${r.auto_check || 'still needs admin review'}`);
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActing(null);
    }
  };

  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  if (loading) return <Spinner label="Loading payments…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Payment Approvals</h1>
          <p className="text-sm text-gray-500">
            Review transfer proofs from quiz-code and book purchases.
            {pendingCount > 0 && <span className="ml-2 badge bg-red-600 text-white">{pendingCount} awaiting review</span>}
          </p>
        </div>
        <button onClick={fetchAll} className="border border-navy-100 bg-white hover:border-gold-400 font-bold text-sm px-4 py-2.5 rounded-xl text-navy-900">
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Search student, item, ref…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${statusFilter === s ? 'bg-navy-900 text-gold-300' : 'bg-white border border-navy-100 text-navy-800'}`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {aiMsg && (
        <div className="bg-navy-900 text-gold-300 text-sm font-semibold rounded-xl px-4 py-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" /> {aiMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No payments here" message={statusFilter === 'pending' ? 'All caught up — no payments awaiting review.' : 'No payments match this filter.'} />
      ) : (
        <div className="grid gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-900">{p.item_title}</span>
                    <StatusBadge status={p.status} />
                    <span className={`badge ${p.item_type === 'book' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{p.item_type === 'book' ? 'BOOK' : 'QUIZ CODE'}</span>
                    {(p.verified_via === 'ai_bank_match' || p.verified_via === 'auto_bank_match') && (
                      <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1"><Zap className="w-3 h-3" /> AI-VERIFIED</span>
                    )}
                    {aiScans[p.id] && (
                      <span className={`badge flex items-center gap-1 ${aiScans[p.id].risk >= 50 ? 'bg-red-100 text-red-700' : aiScans[p.id].risk >= 25 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                        <Sparkles className="w-3 h-3" /> AI risk {aiScans[p.id].risk ?? '?'}/100
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <div><strong>Student:</strong> {p.student_name} ({p.student_email}) · ID #{p.student_id}</div>
                    <div><strong>Transfer ref:</strong> <span className="font-mono font-bold">{p.bank_ref || '—'}</span></div>
                    <div><strong>Submitted:</strong> {formatDateTime(p.created_at)}</div>
                    {p.decided_at && <div><strong>Decided:</strong> {formatDateTime(p.decided_at)} by {p.decided_by || 'system'}</div>}
                    {p.code_issued && <div><strong>Code issued:</strong> <span className="font-mono font-extrabold text-emerald-700">{p.code_issued}</span></div>}
                  </div>
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-navy-800 bg-navy-50 hover:bg-gold-100 px-3 py-2 rounded-lg transition">
                      View payment proof <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {aiScans[p.id] && (
                    <div className="mt-2 text-[11px] bg-navy-50 border border-navy-100 rounded-lg px-3 py-2 text-gray-600">
                      <div className="font-bold text-navy-900 flex items-center gap-1">
                        {aiScans[p.id].risk >= 25 ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
                        AI scan — {aiScans[p.id].verdict === 'approve' ? 'clean' : 'needs review'}
                      </div>
                      {aiScans[p.id].flags && <div className="mt-1 text-amber-700 font-semibold">Flags: {aiScans[p.id].flags}</div>}
                      {Array.isArray(aiScans[p.id].checks) && aiScans[p.id].checks.length > 0 && (
                        <ul className="mt-1 space-y-0.5 list-disc list-inside">
                          {aiScans[p.id].checks.map((c: string, i: number) => <li key={i}>{c}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 md:text-right">
                  <div className="font-extrabold text-xl text-navy-900">{formatNGN(p.amount)}</div>
                  {p.status === 'pending' && (
                    <div className="flex md:justify-end flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => aiRecheck(p.id)}
                        disabled={acting === p.id}
                        className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-gold-300 font-bold text-xs px-4 py-2.5 rounded-xl disabled:opacity-60"
                        title="Run AI verification against the linked bank account"
                      >
                        {acting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Verify
                      </button>
                      <button
                        onClick={() => decide(p.id, 'approve')}
                        disabled={acting === p.id}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl disabled:opacity-60"
                      >
                        {acting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
                      </button>
                      <button
                        onClick={() => decide(p.id, 'reject')}
                        disabled={acting === p.id}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl disabled:opacity-60"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
