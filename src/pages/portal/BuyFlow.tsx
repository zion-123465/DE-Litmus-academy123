import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Landmark, Upload, CheckCircle2, AlertCircle, Copy, ShieldCheck, Loader2, BadgeCheck, Ticket, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatCategory, formatNGN, parseSetting, uploadFile } from '../../lib/api';
import Spinner from '../../components/Spinner';

interface BankInfo {
  bank_name: string;
  account_number: string;
  account_name: string;
  auto_verify_enabled: boolean;
}

export default function BuyFlow({ mode }: { mode: 'quiz_code' | 'book' }) {
  const { student } = useAuth();
  const navigate = useNavigate();
  const { id: bookId } = useParams();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [book, setBook] = useState<any | null>(null);
  const [quizId, setQuizId] = useState('');
  const [bank, setBank] = useState<BankInfo>({ bank_name: '', account_number: '', account_name: 'De-Litmus Academy', auto_verify_enabled: true });
  const [globalPrice, setGlobalPrice] = useState(1500);
  const [amount, setAmount] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [ownedQuizIds, setOwnedQuizIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bookId, student?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<any[]>('/api/settings');
      const b = rows.find((r) => r.key === 'bank_account');
      if (b) {
        const p = parseSetting(b);
        if (p) setBank({ bank_name: p.bank_name || '', account_number: p.account_number || '', account_name: p.account_name || 'De-Litmus Academy', auto_verify_enabled: p.auto_verify_enabled !== false });
      }
      const gp = rows.find((r) => r.key === 'quiz_code_price');
      if (gp) {
        const p = parseSetting(gp);
        if (p?.amount) setGlobalPrice(p.amount);
      }
      if (mode === 'quiz_code') {
        const q = await apiFetch<any[]>('/api/quizzes?published_only=1');
        setQuizzes(q);
        if (q.length === 1) setQuizId(String(q[0].id));
        if (student) {
          // one code per student per quiz: hide quizzes already bought/submitted
          try {
            const [pays, attempts] = await Promise.all([
              apiFetch<any[]>(`/api/payments?student_id=${student.id}&item_type=quiz_code&limit=200`),
              apiFetch<any[]>(`/api/quiz-attempts?student_id=${student.id}&limit=200`),
            ]);
            const owned = new Set<number>();
            for (const p of pays || []) {
              if (p.status === 'pending' || p.status === 'approved') owned.add(Number(p.item_id));
            }
            for (const a of attempts || []) {
              if (a.status !== 'in_progress') owned.add(Number(a.quiz_id));
            }
            setOwnedQuizIds(owned);
            const firstFree = q.find((x: any) => !owned.has(Number(x.id)));
            if (firstFree && q.length > 1) setQuizId('');
          } catch {}
        }
      } else {
        const m = await apiFetch<any>(`/api/materials?id=${bookId}`);
        setBook(m);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const expectedPrice = mode === 'quiz_code'
    ? (() => {
        const q = quizzes.find((x) => String(x.id) === quizId);
        return q ? (Number(q.price) > 0 ? Number(q.price) : globalPrice) : globalPrice;
      })()
    : Number(book?.price) || 0;

  const copyAcct = async () => {
    try {
      await navigator.clipboard.writeText(bank.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!student) return setError('Please login first.');
    if (mode === 'quiz_code' && !quizId) return setError('Please select a quiz.');
    if (mode === 'quiz_code' && ownedQuizIds.has(Number(quizId))) {
      return setError('You already bought a code for this quiz subject. Each student can only buy one code per quiz — contact the admin if you need a retake.');
    }
    if (!amount || Number(amount) <= 0) return setError('Please enter the amount you transferred.');
    if (!bankRef.trim()) return setError('Please enter your transfer reference / sender name.');
    if (!proofFile) return setError('Please upload your payment receipt — it is required for approval.');
    setBusy(true);
    try {
      const up = await uploadFile(proofFile, 'payment-proofs');
      const proofUrl = up.url;
      const data = await apiFetch<any>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          student_id: student.id,
          item_type: mode,
          item_id: mode === 'quiz_code' ? Number(quizId) : Number(bookId),
          amount: Number(amount),
          bank_ref: bankRef.trim(),
          proof_url: proofUrl,
        }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Payment submission failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading payment details…" />;

  if (result) {
    const approved = result.status === 'approved';
    return (
      <div className="max-w-xl mx-auto">
        <div className={`rounded-3xl p-8 text-center card-shadow ${approved ? 'bg-emerald-600' : 'bg-navy-950'} text-white`}>
          {approved ? <BadgeCheck className="w-16 h-16 mx-auto text-white" /> : <CheckCircle2 className="w-16 h-16 mx-auto text-gold-400" />}
          <h2 className="font-display font-extrabold text-2xl mt-4">
            {approved ? 'Payment Verified!' : 'Payment Submitted!'}
          </h2>
          <p className="text-white/75 text-sm mt-2 max-w-sm mx-auto">
            {approved
              ? result.verified_via === 'ai_bank_match' || result.verified_via === 'auto_bank_match'
                ? 'The AI verified your transfer against the academy account and approved it.'
                : 'Your payment has been approved.'
              : 'Your payment is pending. The AI + admin must approve it before your code or book is released.'}
          </p>
          {result.code_issued && (
            <div className="mt-5 bg-white/15 border border-white/30 rounded-2xl px-6 py-4">
              <div className="text-xs font-bold uppercase tracking-widest text-white/70">Your quiz code — AI approved</div>
              <div className="font-mono font-extrabold text-3xl tracking-wider mt-1">{result.code_issued}</div>
            </div>
          )}
          {!approved && (
            <div className="mt-5 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-left">
              <div className="text-xs font-bold uppercase tracking-widest text-gold-300 mb-2">AI verification checks</div>
              <ul className="text-xs text-white/80 space-y-1 list-disc list-inside">
                <li>Receipt uploaded and attached to your payment</li>
                <li>Amount matches the exact price on the linked academy account</li>
                <li>Transfer reference is valid and never reused</li>
                <li>Fraud-risk scan passes the academy's threshold</li>
              </ul>
              <p className="text-[11px] text-white/60 mt-2">Your code / book unlocks only after AI or admin approval. You can track status under My Payments.</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {mode === 'quiz_code' ? (
              <button onClick={() => navigate('/portal/codes')} className="bg-white text-navy-950 font-bold text-sm px-6 py-3 rounded-xl">
                Go to My Codes
              </button>
            ) : (
              <button onClick={() => navigate('/materials')} className="bg-white text-navy-950 font-bold text-sm px-6 py-3 rounded-xl">
                {approved ? 'Download Your Book' : 'Back to Library'}
              </button>
            )}
            <button onClick={() => navigate('/portal/payments')} className="border border-white/40 font-bold text-sm px-6 py-3 rounded-xl">
              View Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900 flex items-center gap-2">
          {mode === 'quiz_code' ? <Ticket className="w-6 h-6 text-gold-600" /> : <BookOpen className="w-6 h-6 text-gold-600" />}
          {mode === 'quiz_code' ? 'Buy a Quiz Code' : 'Buy Study Material'}
        </h1>
        <p className="text-sm text-gray-500">
          {mode === 'quiz_code'
            ? 'One code per student per quiz subject. Transfer to the academy account, then submit your proof below.'
            : 'Transfer to the academy account, then submit your proof below.'}
        </p>
      </div>

      {mode === 'book' && book && (
        <div className="bg-white rounded-2xl border border-navy-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-navy-900 text-gold-300 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-navy-900">{book.title}</div>
            <div className="text-xs text-gray-500">{formatCategory(book.level)} · {book.department}</div>
          </div>
          <div className="font-extrabold text-navy-900">{formatNGN(book.price)}</div>
        </div>
      )}

      <div className="bg-navy-950 hero-pattern rounded-2xl p-6 text-white card-shadow">
        <div className="flex items-center gap-2 text-gold-300 font-bold text-sm mb-4">
          <Landmark className="w-5 h-5" /> PAY TO ACADEMY ACCOUNT
        </div>
        {bank.account_number ? (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-bold">Bank</div>
              <div className="font-bold mt-1">{bank.bank_name || '—'}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-bold">Account Number</div>
              <div className="font-mono font-extrabold text-lg mt-1 flex items-center gap-2">
                {bank.account_number}
                <button onClick={copyAcct} className="text-gold-300 hover:text-gold-200" title="Copy">
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-bold">Account Name</div>
              <div className="font-bold mt-1">{bank.account_name}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/60 bg-white/5 border border-white/10 rounded-xl p-4">
            Bank details are being updated by the admin. Please check back shortly or contact support.
          </div>
        )}
        <div className="mt-4 flex items-start gap-2 text-xs text-white/60">
          <ShieldCheck className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
          {bank.auto_verify_enabled
            ? 'AI verification is ON — clean transfers (exact amount, valid unique ref, receipt attached) are approved instantly; anything else goes to the admin.'
            : 'The admin will manually verify your transfer after you submit proof. Nothing is released until approved.'}
        </div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {mode === 'quiz_code' && (
          <div>
            <label className="label-text">Select Quiz * (one code per student per subject)</label>
            <select className="input-field" value={quizId} onChange={(e) => setQuizId(e.target.value)}>
              <option value="">— Choose a quiz —</option>
              {quizzes.map((q) => {
                const owned = ownedQuizIds.has(Number(q.id));
                return (
                  <option key={q.id} value={q.id} disabled={owned}>
                    {q.title} ({formatCategory(q.level)}) — {formatNGN(Number(q.price) > 0 ? Number(q.price) : globalPrice)}{owned ? ' · ALREADY BOUGHT' : ''}
                  </option>
                );
              })}
            </select>
            {quizId && ownedQuizIds.has(Number(quizId)) && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
                You already have a code (or submitted attempt) for this quiz. Only the admin can permit a retake.
              </p>
            )}
          </div>
        )}
        <div className="bg-gold-50 border border-gold-400/40 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-navy-900">Amount to pay</span>
          <span className="font-extrabold text-xl text-navy-950">{formatNGN(expectedPrice)}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Amount Transferred (₦) *</label>
            <input type="number" min="1" className="input-field" placeholder={String(expectedPrice)} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Transfer Ref / Sender Name *</label>
            <input className="input-field" placeholder="e.g. 000123456789 / Adaeze O." value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label-text">Payment Receipt * (required for approval)</label>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-navy-100 hover:border-gold-400 rounded-xl px-4 py-5 cursor-pointer transition text-sm text-gray-500">
            <Upload className="w-5 h-5 text-navy-700" />
            {proofFile ? <span className="font-bold text-navy-900">{proofFile.name}</span> : 'Tap to upload receipt (JPG, PNG or PDF, max 9MB)'}
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? 'Verifying payment…' : `I Have Paid ${formatNGN(expectedPrice)} — Submit`}
        </button>
      </form>
    </div>
  );
}
