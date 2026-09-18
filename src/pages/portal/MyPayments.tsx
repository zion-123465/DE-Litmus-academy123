import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, ExternalLink, CheckCircle2, Clock, XCircle, Ticket, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatDateTime, formatNGN } from '../../lib/api';
import Spinner from '../../components/Spinner';
import { EmptyState, StatusBadge } from '../../components/ui';

export default function MyPayments() {
  const { student } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (student) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = await apiFetch<any[]>(`/api/payments?student_id=${student!.id}&limit=100`);
      setPayments(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner label="Loading your payments…" />;

  const iconFor = (status: string) => {
    if (status === 'approved') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    if (status === 'rejected') return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">My Payments</h1>
        <p className="text-sm text-gray-500">Every quiz-code and book purchase, with live approval status.</p>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="Buy a quiz code or a book and your receipt will appear here."
          action={
            <Link to="/portal/buy-code" className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl inline-block">
              Buy a Quiz Code
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {payments.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-navy-100 p-5 card-shadow">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-navy-50 flex items-center justify-center">
                  {p.item_type === 'book' ? <BookOpen className="w-5 h-5 text-navy-700" /> : <Ticket className="w-5 h-5 text-navy-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-900">{p.item_title}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDateTime(p.created_at)} · Ref: <span className="font-mono font-bold">{p.bank_ref || '—'}</span>
                    {p.verified_via && p.verified_via !== 'manual' && (
                      <span className="ml-1 text-emerald-600 font-semibold">
                        · {p.verified_via === 'ai_bank_match' || p.verified_via === 'auto_bank_match' ? 'AI-verified via bank' : 'Verified by admin'}
                      </span>
                    )}
                  </div>
                  {p.status === 'approved' && p.code_issued && (
                    <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-emerald-700 font-semibold">Your code:</span>
                      <span className="font-mono font-extrabold text-emerald-800">{p.code_issued}</span>
                    </div>
                  )}
                  {p.status === 'pending' && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Awaiting AI/admin approval — your code or book unlocks only after verification. Clean payments clear automatically.
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-extrabold text-navy-900">{formatNGN(p.amount)}</div>
                  {p.proof_url && (
                    <a href={p.proof_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-navy-700 hover:text-gold-600 flex items-center gap-1 mt-1">
                      Proof <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                {iconFor(p.status)}
                {p.status === 'approved' ? `Approved ${formatDateTime(p.decided_at)}` : p.status === 'rejected' ? `Declined ${formatDateTime(p.decided_at)}` : 'In review queue'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
