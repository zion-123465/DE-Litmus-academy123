import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

// Materials live in `materials_v2` (adds body_text for AI-arranged text
// materials). Reads fall back to legacy `materials` rows when needed.
const MTABLE = 'materials_v2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, level, department, search, free_only, limit } = req.query;
      if (id) {
        const { data, error } = await supabase.from(MTABLE).select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (data) return res.status(200).json(data);
        // legacy fallback
        const legacy = await supabase.from('materials').select('*').eq('id', id).maybeSingle();
        return res.status(200).json(legacy.data || null);
      }
      let q = supabase.from(MTABLE).select('*').order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 200, 500));
      if (level) q = q.eq('level', level);
      if (department) q = q.eq('department', department);
      if (free_only === '1') q = q.eq('is_free', true);
      if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%,department.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { title, description, level, department, file_url, file_type, cover_url, price, is_free, body_text } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title is required' });
      const isText = file_type === 'text';
      if (!isText && !file_url) return res.status(400).json({ error: 'Upload the material file (PDF or image), or use text form' });
      if (isText && !body_text) return res.status(400).json({ error: 'Paste the material text first' });
      const { data, error } = await supabase.from(MTABLE).insert({
        title, description: description || null, level: level || 'General', department: department || 'General',
        file_url: isText ? 'text://in-site' : file_url, file_type: file_type || 'pdf', cover_url: cover_url || null,
        price: Number(price) || 0, is_free: is_free !== false && !(Number(price) > 0),
        body_text: isText ? String(body_text).slice(0, 60000) : null
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, action, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (action === 'download') {
        const { data: cur } = await supabase.from(MTABLE).select('downloads').eq('id', id).maybeSingle();
        const { error } = await supabase.from(MTABLE).update({ downloads: (cur?.downloads || 0) + 1 }).eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      if (fields.price !== undefined) fields.price = Number(fields.price) || 0;
      if (fields.body_text !== undefined && fields.body_text) fields.body_text = String(fields.body_text).slice(0, 60000);
      if (fields.file_type === 'text' && !fields.body_text) fields.body_text = undefined;
      const { data, error } = await supabase.from(MTABLE).update(fields).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from(MTABLE).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('materials API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
