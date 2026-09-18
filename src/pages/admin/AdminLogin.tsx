import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function AdminLogin() {
  const { isAdmin, loading, login } = useAdmin();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) navigate('/admin-portal-x7k9');
  }, [loading, isAdmin, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) return setError('Enter the admin password.');
    setBusy(true);
    try {
      await login(password);
      navigate('/admin-portal-x7k9');
    } catch (err: any) {
      setError(err.message || 'Access denied.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 hero-pattern flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={LOGO_URL} alt="De-Litmus Academy" className="w-20 h-20 rounded-full object-cover mx-auto ring-2 ring-gold-400 mb-4" />
          <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/40 rounded-full px-4 py-1.5 text-xs font-bold text-red-300">
            <ShieldCheck className="w-3.5 h-3.5" /> RESTRICTED — AUTHORISED PERSONNEL ONLY
          </div>
          <h1 className="font-display font-extrabold text-2xl text-white mt-3">Admin Control Area</h1>
          <p className="text-white/50 text-sm mt-1">This section is hidden from the public site.</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-7 card-shadow space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div>
            <label className="label-text">Admin Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                className="input-field pl-9"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Verifying…' : 'Unlock Admin Area'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Hint: default password is <span className="font-mono font-bold">DeLitmus@Admin2026</span> — change it in Settings after first login.
          </p>
        </form>
      </div>
    </div>
  );
}
