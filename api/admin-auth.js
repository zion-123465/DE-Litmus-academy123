import supabase from './db-client.js';
import crypto from 'crypto';

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const key = req.headers['x-admin-key'];
      if (!key || typeof key !== 'string' || key.length < 16) return res.status(200).json({ ok: false });
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
      const ok = !!data && data.value === key && crypto.timingSafeEqual(Buffer.from(data.value), Buffer.from(key));
      return res.status(200).json({ ok });
    }
    if (req.method === 'POST') {
      const { password } = req.body || {};
      if (!password || typeof password !== 'string') return res.status(400).json({ error: 'Password is required' });
      const hash = sha256(password);
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
      const ok = !!data && data.value.length === hash.length && crypto.timingSafeEqual(Buffer.from(data.value), Buffer.from(hash));
      if (!ok) {
        // Small delay to slow brute-force attempts
        await new Promise((r) => setTimeout(r, 600));
        return res.status(401).json({ error: 'Incorrect admin password' });
      }
      return res.status(200).json({ ok: true, token: data.value });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin-auth API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
