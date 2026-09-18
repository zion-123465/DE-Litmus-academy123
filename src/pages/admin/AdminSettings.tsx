import { useEffect, useState } from 'react';
import { Save, Plus, X, Loader2, CheckCircle2, AlertCircle, Landmark, Tag, Layers, Building2, KeyRound, Gavel, Sparkles, Image as ImageIcon, Upload } from 'lucide-react';
import { apiFetch, formatCategory, parseSetting, uploadFile } from '../../lib/api';
import { DEFAULT_SITE_IMAGES, SITE_IMAGE_SLOTS, type SiteImages } from '../../hooks/useSiteImages';
import Spinner from '../../components/Spinner';
import { createHash } from '../../lib/hash';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [codePrice, setCodePrice] = useState(1500);
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [departments, setDepartments] = useState<string[]>([]);
  const [newLevel, setNewLevel] = useState('');
  const [newDept, setNewDept] = useState('');
  const [bank, setBank] = useState({ bank_name: '', account_number: '', account_name: 'De-Litmus Academy', auto_verify_enabled: true, paystack_public_key: '', flutterwave_public_key: '' });
  const [aiVerify, setAiVerify] = useState({ enabled: true, risk_threshold: 25, require_unique_ref: true });
  const [siteInfo, setSiteInfo] = useState({ tagline: 'We Keep Moving', phone: '', email: 'info@delitmusacademy.com', address: 'Nigeria' });
  const [rules, setRules] = useState({ max_warnings: 20, noise_threshold: 'medium', require_camera: true, require_fullscreen: true });
  const [siteImages, setSiteImages] = useState<SiteImages>({ ...DEFAULT_SITE_IMAGES });
  const [imgUploading, setImgUploading] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<any[]>('/api/settings', { admin: true });
      const get = (k: string) => {
        const r = rows.find((x) => x.key === k);
        return r ? parseSetting(r) : null;
      };
      const cp = get('quiz_code_price');
      if (cp?.amount) setCodePrice(cp.amount);
      const lv = get('levels');
      if (lv?.items?.length) setLevels(lv.items);
      const dp = get('departments');
      if (dp?.items?.length) setDepartments(dp.items);
      const b = get('bank_account');
      if (b) setBank({ bank_name: b.bank_name || '', account_number: b.account_number || '', account_name: b.account_name || 'De-Litmus Academy', auto_verify_enabled: b.auto_verify_enabled !== false, paystack_public_key: b.paystack_public_key || '', flutterwave_public_key: b.flutterwave_public_key || '' });
      const av = get('ai_verification');
      if (av) setAiVerify({ enabled: av.enabled !== false, risk_threshold: Number(av.risk_threshold) || 25, require_unique_ref: av.require_unique_ref !== false });
      const si = get('site_info');
      if (si) setSiteInfo({ tagline: si.tagline || 'We Keep Moving', phone: si.phone || '', email: si.email || '', address: si.address || '' });
      const qr = get('quiz_rules');
      if (qr) setRules({ max_warnings: Number(qr.max_warnings) || 20, noise_threshold: qr.noise_threshold || 'medium', require_camera: qr.require_camera !== false, require_fullscreen: qr.require_fullscreen !== false });
      const si2 = get('site_images');
      if (si2 && typeof si2 === 'object') setSiteImages({ ...DEFAULT_SITE_IMAGES, ...si2 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT', admin: true,
        body: JSON.stringify({
          items: {
            quiz_code_price: { amount: Number(codePrice) || 0, currency: 'NGN' },
            levels: { items: levels },
            departments: { items: departments },
            bank_account: bank,
            ai_verification: aiVerify,
            site_info: siteInfo,
            site_images: siteImages,
            quiz_rules: rules,
          },
        }),
      });
      setMsg({ type: 'ok', text: 'All settings saved successfully.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleImageUpload = async (slot: keyof SiteImages, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please choose an image file (JPG or PNG).' });
      return;
    }
    if (file.size > 9 * 1024 * 1024) {
      setMsg({ type: 'err', text: 'Image too large. Maximum 9MB.' });
      return;
    }
    setMsg(null);
    setImgUploading(slot);
    try {
      const up = await uploadFile(file, 'site-images');
      setSiteImages((prev) => ({ ...prev, [slot]: up.url }));
      setMsg({ type: 'ok', text: 'Picture uploaded — press Save All to publish it on the website.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Upload failed.' });
    } finally {
      setImgUploading(null);
    }
  };

  const resetImage = (slot: keyof SiteImages) => {
    setSiteImages((prev) => ({ ...prev, [slot]: DEFAULT_SITE_IMAGES[slot] }));
  };

  const changePassword = async () => {
    setMsg(null);
    if (!newPassword || newPassword.length < 8) {
      setMsg({ type: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'err', text: 'Passwords do not match.' });
      return;
    }
    setBusy(true);
    try {
      const hash = await createHash(newPassword);
      await apiFetch('/api/settings', { method: 'PUT', admin: true, body: JSON.stringify({ key: 'admin_password_hash', value: hash }) });
      try {
        const { setAdminToken } = await import('../../lib/api');
        setAdminToken(hash);
      } catch {}
      setNewPassword('');
      setConfirmPassword('');
      setMsg({ type: 'ok', text: 'Admin password changed successfully. Use the new password next login.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Password change failed.' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading settings…" />;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Site Settings</h1>
          <p className="text-sm text-gray-500">Prices, levels, departments, bank account and exam rules.</p>
        </div>
        <button onClick={saveAll} disabled={busy} className="gold-btn font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save All
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      {/* Pricing */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-4"><Tag className="w-5 h-5 text-gold-600" /> Quiz Code Pricing</h3>
        <div className="max-w-xs">
          <label className="label-text">Global Quiz Code Price (₦)</label>
          <input type="number" min="0" className="input-field" value={codePrice} onChange={(e) => setCodePrice(Number(e.target.value))} />
          <p className="text-xs text-gray-400 mt-1">Applies to all quizzes unless a quiz has its own custom price. Book prices are set per material.</p>
        </div>
      </section>

      {/* Levels */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-1"><Layers className="w-5 h-5 text-gold-600" /> Student Categories</h3>
        <p className="text-xs text-gray-500 mb-4">University levels (100, 200, 300) plus exam tracks like WAEC and JAMB. These power search filters everywhere.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {levels.map((l) => (
            <span key={l} className="badge bg-navy-900 text-gold-300 !text-sm !px-3 !py-1.5">
              {formatCategory(l)}
              <button onClick={() => setLevels(levels.filter((x) => x !== l))} className="ml-1 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-xs">
          <input className="input-field" placeholder="e.g. 400 or NECO" value={newLevel} onChange={(e) => setNewLevel(e.target.value)} />
          <button
            onClick={() => { if (newLevel.trim() && !levels.includes(newLevel.trim())) setLevels([...levels, newLevel.trim()]); setNewLevel(''); }}
            className="bg-navy-900 text-gold-300 font-bold text-sm px-4 rounded-xl flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </section>

      {/* Departments */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-4"><Building2 className="w-5 h-5 text-gold-600" /> Departments</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {departments.map((d) => (
            <span key={d} className="badge bg-navy-50 text-navy-800 border border-navy-100 !text-sm !px-3 !py-1.5">
              {d}
              <button onClick={() => setDepartments(departments.filter((x) => x !== d))} className="ml-1 text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
          {departments.length === 0 && <span className="text-sm text-gray-400">No departments yet.</span>}
        </div>
        <div className="flex gap-2 max-w-sm">
          <input className="input-field" placeholder="e.g. Computer Science" value={newDept} onChange={(e) => setNewDept(e.target.value)} />
          <button
            onClick={() => { if (newDept.trim() && !departments.includes(newDept.trim())) setDepartments([...departments, newDept.trim()]); setNewDept(''); }}
            className="bg-navy-900 text-gold-300 font-bold text-sm px-4 rounded-xl flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </section>

      {/* Bank */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-1"><Landmark className="w-5 h-5 text-gold-600" /> Main Bank Account (Linked)</h3>
        <p className="text-xs text-gray-500 mb-4">This is the main account students pay into. The AI verifies every payment against it — nothing is released without AI or admin approval.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Bank Name</label>
            <input className="input-field" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} placeholder="e.g. GTBank" />
          </div>
          <div>
            <label className="label-text">Account Number</label>
            <input className="input-field font-mono" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} placeholder="0123456789" />
          </div>
          <div>
            <label className="label-text">Account Name</label>
            <input className="input-field" value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} placeholder="De-Litmus Academy" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
              <input type="checkbox" checked={bank.auto_verify_enabled} onChange={(e) => setBank({ ...bank, auto_verify_enabled: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
              Auto-verify matching transfers
            </label>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          When enabled, the AI checks every payment against this linked account: exact amount match, receipt
          attached, unique transfer reference, and a fraud-risk scan. Only clean payments are approved instantly —
          anything suspicious waits for your manual review. Quiz codes and book access are never released without approval.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="label-text">Paystack Public Key (optional, future card payments)</label>
            <input className="input-field font-mono text-xs" value={bank.paystack_public_key} onChange={(e) => setBank({ ...bank, paystack_public_key: e.target.value })} placeholder="pk_live_…" />
          </div>
          <div>
            <label className="label-text">Flutterwave Public Key (optional)</label>
            <input className="input-field font-mono text-xs" value={bank.flutterwave_public_key} onChange={(e) => setBank({ ...bank, flutterwave_public_key: e.target.value })} placeholder="FLWPUBK-…" />
          </div>
        </div>
      </section>

      {/* AI verification */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-gold-600" /> AI Payment Verification</h3>
        <p className="text-xs text-gray-500 mb-4">The AI gatekeeper approves only clean payments. You can re-run it on any pending payment, or approve/reject manually.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
            <input type="checkbox" checked={aiVerify.enabled} onChange={(e) => setAiVerify({ ...aiVerify, enabled: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
            Enable AI auto-approval
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
            <input type="checkbox" checked={aiVerify.require_unique_ref} onChange={(e) => setAiVerify({ ...aiVerify, require_unique_ref: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
            Reject reused transfer references
          </label>
          <div>
            <label className="label-text">AI risk threshold (0–100)</label>
            <input type="number" min="0" max="100" className="input-field" value={aiVerify.risk_threshold} onChange={(e) => setAiVerify({ ...aiVerify, risk_threshold: Number(e.target.value) })} />
            <p className="text-xs text-gray-400 mt-1">Payments scoring at or above this risk go to manual review. Lower = stricter.</p>
          </div>
        </div>
      </section>

      {/* Quiz rules */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-4"><Gavel className="w-5 h-5 text-gold-600" /> Proctoring Rules</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Max Warnings Before Auto-Submit</label>
            <input type="number" min="3" max="100" className="input-field" value={rules.max_warnings} onChange={(e) => setRules({ ...rules, max_warnings: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label-text">Noise Sensitivity</label>
            <select className="input-field" value={rules.noise_threshold} onChange={(e) => setRules({ ...rules, noise_threshold: e.target.value })}>
              <option value="low">Low (tolerant)</option>
              <option value="medium">Medium</option>
              <option value="high">High (strict)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
            <input type="checkbox" checked={rules.require_camera} onChange={(e) => setRules({ ...rules, require_camera: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
            Require camera to start
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900 cursor-pointer">
            <input type="checkbox" checked={rules.require_fullscreen} onChange={(e) => setRules({ ...rules, require_fullscreen: e.target.checked })} className="w-4 h-4 accent-yellow-600" />
            Require fullscreen mode
          </label>
        </div>
      </section>

      {/* Site info */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 mb-4">Academy Contact Info</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Tagline / Motto</label>
            <input className="input-field" value={siteInfo.tagline} onChange={(e) => setSiteInfo({ ...siteInfo, tagline: e.target.value })} />
          </div>
          <div>
            <label className="label-text">Support Email</label>
            <input className="input-field" value={siteInfo.email} onChange={(e) => setSiteInfo({ ...siteInfo, email: e.target.value })} />
          </div>
          <div>
            <label className="label-text">Phone</label>
            <input className="input-field" value={siteInfo.phone} onChange={(e) => setSiteInfo({ ...siteInfo, phone: e.target.value })} />
          </div>
          <div>
            <label className="label-text">Address</label>
            <input className="input-field" value={siteInfo.address} onChange={(e) => setSiteInfo({ ...siteInfo, address: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Website pictures */}
      <section className="bg-white rounded-2xl border border-navy-100 p-6">
        <h3 className="font-bold text-navy-900 flex items-center gap-2 mb-1"><ImageIcon className="w-5 h-5 text-gold-600" /> Website Pictures</h3>
        <p className="text-xs text-gray-500 mb-4">Re-edit any photo on the website. Upload a replacement, preview it, then press Save All to publish.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {SITE_IMAGE_SLOTS.map((slot) => (
            <div key={slot.key} className="border border-navy-100 rounded-xl p-3">
              <img src={siteImages[slot.key]} alt={slot.label} className="w-full h-32 object-cover rounded-lg bg-navy-50" />
              <div className="font-bold text-sm text-navy-900 mt-2">{slot.label}</div>
              <div className="text-[11px] text-gray-400 mb-2">{slot.hint}</div>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 bg-navy-900 hover:bg-navy-800 text-gold-300 font-bold text-xs px-3 py-2 rounded-lg cursor-pointer transition">
                  {imgUploading === slot.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {imgUploading === slot.key ? 'Uploading…' : 'Replace'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={imgUploading !== null}
                    onChange={(e) => handleImageUpload(slot.key, e.target.files?.[0])}
                  />
                </label>
                {siteImages[slot.key] !== DEFAULT_SITE_IMAGES[slot.key] && (
                  <button
                    type="button"
                    onClick={() => resetImage(slot.key)}
                    className="text-xs font-bold text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg border border-navy-100"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Password */}
      <section className="bg-navy-950 rounded-2xl p-6 text-white">
        <h3 className="font-bold text-gold-300 flex items-center gap-2 mb-4"><KeyRound className="w-5 h-5" /> Change Admin Password</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text !text-white/70">New Password (min 8 chars)</label>
            <input type="password" className="input-field !bg-white/10 !border-white/20 !text-white placeholder:text-white/30" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="label-text !text-white/70">Confirm New Password</label>
            <input type="password" className="input-field !bg-white/10 !border-white/20 !text-white placeholder:text-white/30" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <button onClick={changePassword} disabled={busy} className="mt-4 bg-gold-400 hover:bg-gold-300 text-navy-950 font-bold text-sm px-6 py-2.5 rounded-xl disabled:opacity-60">
          Update Password
        </button>
      </section>

      <button onClick={saveAll} disabled={busy} className="w-full gold-btn font-bold py-3.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save All Settings
      </button>
    </div>
  );
}
