import supabase from './db-client.js';
import crypto from 'crypto';

const DEFAULT_ADMIN_PASSWORD = 'DeLitmus@Admin2026';

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function defaults() {
  return {
    quiz_code_price: JSON.stringify({ amount: 1500, currency: 'NGN' }),
    levels: JSON.stringify({ items: ['100', '200', '300', 'WAEC', 'JAMB'] }),
    departments: JSON.stringify({ items: ['Science', 'Arts', 'Commercial', 'General Studies'] }),
    bank_account: JSON.stringify({ bank_name: '', account_number: '', account_name: 'De-Litmus Academy', auto_verify_enabled: true, paystack_public_key: '', flutterwave_public_key: '' }),
    ai_verification: JSON.stringify({ enabled: true, risk_threshold: 25, require_unique_ref: true }),
    site_info: JSON.stringify({ tagline: 'We Keep Moving', phone: '', email: 'info@delitmusacademy.com', address: 'Nigeria' }),
    site_images: JSON.stringify({ hero_bg: '/images/hero.jpg', cbt_spotlight: '/images/cbt.jpg', library_card: '/images/library.jpg', about_library: '/images/library.jpg' }),
    quiz_rules: JSON.stringify({ max_warnings: 20, noise_threshold: 'medium', require_camera: true, require_fullscreen: true }),
    admin_password_hash: sha256(DEFAULT_ADMIN_PASSWORD)
  };
}

async function ensureSeeded() {
  const d = defaults();
  const { data } = await supabase.from('site_settings').select('key');
  const have = new Set((data || []).map((r) => r.key));
  const missing = Object.entries(d).filter(([k]) => !have.has(k)).map(([key, value]) => ({ key, value }));
  if (missing.length) await supabase.from('site_settings').insert(missing);
}

async function getHash() {
  await ensureSeeded();
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return data?.value || '';
}

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  return key === (await getHash());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await ensureSeeded();
    if (req.method === 'GET') {
      const { key } = req.query;
      const admin = await isAdmin(req);
      if (key) {
        if (key === 'admin_password_hash' && !admin) return res.status(403).json({ error: 'Forbidden' });
        const { data, error } = await supabase.from('site_settings').select('*').eq('key', key).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      const { data, error } = await supabase.from('site_settings').select('*');
      if (error) throw error;
      const out = admin ? data : data.filter((r) => r.key !== 'admin_password_hash');
      return res.status(200).json(out);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const body = req.body || {};
      const items = body.items || (body.key ? { [body.key]: body.value } : null);
      if (!items) return res.status(400).json({ error: 'Provide key/value or items' });
      const results = [];
      for (const [k, v] of Object.entries(items)) {
        const value = typeof v === 'string' ? v : JSON.stringify(v);
        const { data: existing } = await supabase.from('site_settings').select('id').eq('key', k).maybeSingle();
        if (existing) {
          const { data, error } = await supabase.from('site_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', k).select().single();
          if (error) throw error;
          results.push(data);
        } else {
          const { data, error } = await supabase.from('site_settings').insert({ key: k, value }).select().single();
          if (error) throw error;
          results.push(data);
        }
      }
      return res.status(200).json(results);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('settings API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
