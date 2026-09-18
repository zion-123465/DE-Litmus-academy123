import { useEffect, useRef, useState } from 'react';
import { Save, CheckCircle2, AlertCircle, User as UserIcon, Camera, Loader2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, formatCategory, parseSetting, uploadFile } from '../../lib/api';
import Spinner from '../../components/Spinner';

export default function Profile() {
  const { student, refreshStudent } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '', level: '', department: '', matric_no: '' });
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [departments, setDepartments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (student) {
      setForm({
        full_name: student.full_name || '',
        phone: student.phone || '',
        level: student.level || '',
        department: student.department || '',
        matric_no: student.matric_no || '',
      });
    }
  }, [student?.id]);

  useEffect(() => {
    apiFetch<any[]>('/api/settings')
      .then((rows) => {
        const lv = rows.find((r) => r.key === 'levels');
        const dp = rows.find((r) => r.key === 'departments');
        if (lv) {
          const p = parseSetting(lv);
          if (p?.items?.length) setLevels(p.items);
        }
        if (dp) {
          const p = parseSetting(dp);
          if (p?.items?.length) setDepartments(p.items);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!student) return <Spinner label="Loading profile…" />;

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const currentAvatar = avatarPreview || student.avatar_url || null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please choose an image file (JPG or PNG).' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Photo is too large. Maximum 5MB.' });
      return;
    }
    setMsg(null);
    setAvatarUploading(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setAvatarPreview(localUrl);
      const up = await uploadFile(file, 'avatars');
      await apiFetch('/api/students', { method: 'PUT', body: JSON.stringify({ id: student.id, avatar_url: up.url }) });
      await refreshStudent();
      setAvatarPreview(null);
      setMsg({ type: 'ok', text: 'Profile picture updated successfully.' });
    } catch (err: any) {
      setAvatarPreview(null);
      setMsg({ type: 'err', text: err.message || 'Could not upload photo.' });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setMsg(null);
    setAvatarUploading(true);
    try {
      await apiFetch('/api/students', { method: 'PUT', body: JSON.stringify({ id: student.id, avatar_url: null }) });
      await refreshStudent();
      setAvatarPreview(null);
      setMsg({ type: 'ok', text: 'Profile picture removed.' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || 'Could not remove photo.' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.full_name.trim()) {
      setMsg({ type: 'err', text: 'Full name is required.' });
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/students', { method: 'PUT', body: JSON.stringify({ id: student.id, ...form }) });
      await refreshStudent();
      setMsg({ type: 'ok', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || 'Could not save profile.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-navy-900">My Profile</h1>
        <p className="text-sm text-gray-500">Keep your student record accurate — it appears on receipts and results.</p>
      </div>

      <div className="bg-white rounded-2xl border border-navy-100 p-6 card-shadow">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative shrink-0">
            {currentAvatar ? (
              <img src={currentAvatar} alt="Profile" className="w-16 h-16 rounded-full object-cover ring-2 ring-gold-400" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-navy-900 text-gold-300 font-extrabold text-2xl flex items-center justify-center">
                {(student.full_name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              title="Upload profile picture"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gold-btn flex items-center justify-center disabled:opacity-60"
            >
              {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-navy-900">{student.full_name}</div>
            <div className="text-sm text-gray-500">{student.email}</div>
            <div className="text-xs text-gray-400 mt-0.5">Student ID: DLA-{String(student.id).padStart(5, '0')}</div>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs font-bold text-navy-800 hover:text-gold-600 disabled:opacity-50"
              >
                {avatarUploading ? 'Uploading…' : currentAvatar ? 'Change photo' : 'Add photo'}
              </button>
              {currentAvatar && !avatarUploading && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {msg && (
          <div
            className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 mb-4 ${
              msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
          </div>
        )}

        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label-text">Full Name *</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-9" value={form.full_name} onChange={set('full_name')} />
            </div>
          </div>
          <div>
            <label className="label-text">Phone</label>
            <input className="input-field" value={form.phone} onChange={set('phone')} placeholder="0803 000 0000" />
          </div>
          <div>
            <label className="label-text">Matric Number</label>
            <input className="input-field" value={form.matric_no} onChange={set('matric_no')} placeholder="DLA/2026/001" />
          </div>
          <div>
            <label className="label-text">Category (University Level / WAEC / JAMB)</label>
            <select className="input-field" value={form.level} onChange={set('level')}>
              <option value="">Select category</option>
              {levels.map((l) => (
                <option key={l} value={l}>{formatCategory(l)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">Department</label>
            <select className="input-field" value={form.department} onChange={set('department')}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="gold-btn font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-60">
              <Save className="w-4 h-4" /> {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-navy-950 rounded-2xl p-5 text-white text-sm">
        <div className="font-bold text-gold-300 mb-1">Data protection</div>
        <p className="text-white/60 text-xs leading-relaxed">
          Your records are stored securely and only visible to you and authorised academy administrators.
          Payment proofs and quiz results are never shared publicly.
        </p>
      </div>
    </div>
  );
}
