import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, GraduationCap, AlertCircle, Chrome } from 'lucide-react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, parseSetting } from '../lib/api';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '', department: '', matric_no: '' });
  const [departments, setDepartments] = useState<string[]>(['Science', 'Arts', 'Commercial', 'General Studies']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    apiFetch<any[]>('/api/settings')
      .then((rows) => {
        const dp = rows.find((r) => r.key === 'departments');
        if (dp) {
          const p = parseSetting(dp);
          if (p?.items?.length) setDepartments(p.items);
        }
      })
      .catch(() => {});
  }, []);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim()) return setError('Please enter your full name.');
    if (!form.email.trim()) return setError('Please enter your email address.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim() } },
      });
      if (error) throw error;
      const user = data.user || (await supabase.auth.getSession()).data.session?.user;
      if (user) {
        try {
          await apiFetch('/api/students', {
            method: 'POST',
            body: JSON.stringify({
              user_id: user.id,
              email: user.email,
              full_name: form.full_name.trim(),
              phone: form.phone.trim() || null,
              level: null,
              department: form.department || null,
              matric_no: form.matric_no.trim() || null,
            }),
          });
        } catch (e) {
          console.error('profile create failed', e);
        }
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 hero-pattern flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl bg-white rounded-3xl card-shadow overflow-hidden">
        <div className="bg-navy-900 px-8 py-6 flex items-center gap-4">
          <img src={LOGO_URL} alt="De-Litmus Academy" className="w-14 h-14 rounded-full object-cover ring-2 ring-gold-400" />
          <div>
            <h1 className="font-display font-bold text-xl text-gold-300">Student Registration</h1>
            <p className="text-white/60 text-sm">Join De-Litmus Academy — We Keep Moving</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-8 py-7 grid sm:grid-cols-2 gap-4">
          {error && (
            <div className="sm:col-span-2 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label-text">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-9" placeholder="e.g. Adaeze Okafor" value={form.full_name} onChange={set('full_name')} />
            </div>
          </div>
          <div>
            <label className="label-text">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" className="input-field pl-9" placeholder="you@example.com" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div>
            <label className="label-text">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-9" placeholder="0803 000 0000" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <label className="label-text">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" className="input-field pl-9" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} />
            </div>
          </div>
          <div>
            <label className="label-text">Confirm Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" className="input-field pl-9" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label-text">Department</label>
            <select className="input-field" value={form.department} onChange={set('department')}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label-text">Registration Number (optional)</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-9" placeholder="e.g. DLA/2026/001" value={form.matric_no} onChange={set('matric_no')} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60">
              {busy ? 'Creating your account…' : 'Join Free'}
            </button>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200"></div> OR <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => signInWithGoogle('De-Litmus Academy')}
              className="w-full flex items-center justify-center gap-2 border border-navy-100 hover:border-gold-400 font-bold py-3 rounded-xl text-sm text-navy-900 transition"
            >
              <Chrome className="w-4 h-4" /> Continue with Google
            </button>
          </div>
          <p className="sm:col-span-2 text-center text-sm text-gray-500">
            Already a student? <Link to="/login" className="font-bold text-navy-800 hover:text-gold-600">Login here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
