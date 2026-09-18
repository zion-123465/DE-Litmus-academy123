import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Chrome } from 'lucide-react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Please enter your email and password.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 hero-pattern flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl card-shadow overflow-hidden">
        <div className="bg-navy-900 px-8 py-6 flex items-center gap-4">
          <img src={LOGO_URL} alt="De-Litmus Academy" className="w-14 h-14 rounded-full object-cover ring-2 ring-gold-400" />
          <div>
            <h1 className="font-display font-bold text-xl text-gold-300">Student Login</h1>
            <p className="text-white/60 text-sm">Welcome back — keep moving</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div>
            <label className="label-text">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" className="input-field pl-9" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-text">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" className="input-field pl-9" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60">
            {busy ? 'Signing you in…' : 'Login to Portal'}
          </button>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200"></div> OR <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          <button
            type="button"
            onClick={() => signInWithGoogle('De-Litmus Academy')}
            className="w-full flex items-center justify-center gap-2 border border-navy-100 hover:border-gold-400 font-bold py-3 rounded-xl text-sm text-navy-900 transition"
          >
            <Chrome className="w-4 h-4" /> Continue with Google
          </button>
          <p className="text-center text-sm text-gray-500">
            New here? <Link to="/register" className="font-bold text-navy-800 hover:text-gold-600">Create an account</Link>
          </p>
          <p className="text-center text-xs text-gray-400">
            Forgot password or email?{' '}
            <a
              href="https://wa.me/2348106852839?text=Hello!%20I%20forgot%20my%20login%20details%20and%20need%20help%20recovering%20my%20account."
              target="_blank"
              rel="noreferrer"
              className="font-bold text-emerald-600 hover:text-emerald-500"
            >
              Chat with the admin on WhatsApp
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
