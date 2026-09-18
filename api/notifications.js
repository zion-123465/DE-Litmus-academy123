import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

// Broadcast notifications: admin creates, every student account sees them.
// GET /api/notifications?limit=20 (public, active only)
// GET /api/notifications?all=1 (admin, everything)
// POST /api/notifications { title, message, audience, category } (admin)
// PUT /api/notifications { id, ...fields } (admin)
// DELETE /api/notifications { id } (admin)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { all, limit } = req.query;
      if (all === '1') {
        if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
        const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 100, 200));
        if (error) throw error;
        return res.status(200).json(data || []);
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(Math.min(parseInt(limit) || 20, 50));
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });

    if (req.method === 'POST') {
      const { title, message, audience, category } = req.body || {};
      if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });
      if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required' });
      const { data, error } = await supabase.from('notifications').insert({
        title: String(title).trim().slice(0, 120),
        message: String(message).trim().slice(0, 1000),
        audience: audience || 'all',
        category: category || 'announcement',
        is_active: true,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      delete fields.created_at;
      const { data, error } = await supabase.from('notifications').update(fields).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('notifications API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
