import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

// Admin-only: latest AI verification scan per payment.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
    const { payment_id, payment_ids } = req.query;
    let q = supabase.from('payment_ai_checks').select('*').order('created_at', { ascending: false }).limit(500);
    if (payment_id) q = q.eq('payment_id', payment_id);
    if (payment_ids) {
      const ids = String(payment_ids).split(',').map((x) => Number(x)).filter(Boolean);
      if (ids.length) q = q.in('payment_id', ids);
    }
    const { data, error } = await q;
    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('ai-checks API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
