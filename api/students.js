import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, user_id, all, search, level, department, limit } = req.query;
      if (id) {
        const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (user_id) {
        const { data, error } = await supabase.from('students').select('*').eq('user_id', user_id).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (all) {
        if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
        let q = supabase.from('students').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 200, 500));
        if (level) q = q.eq('level', level);
        if (department) q = q.eq('department', department);
        if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,matric_no.ilike.%${search}%`);
        const { data, error, count } = await q;
        if (error) throw error;
        return res.status(200).json({ students: data, count });
      }
      return res.status(400).json({ error: 'Provide id, user_id or all=1' });
    }
    if (req.method === 'POST') {
      const { user_id, email, full_name, phone, level, department, matric_no, avatar_url } = req.body || {};
      if (!user_id || !email || !full_name) return res.status(400).json({ error: 'user_id, email and full_name are required' });
      const { data: existing } = await supabase.from('students').select('*').eq('user_id', user_id).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from('students').update({ email, full_name, phone: phone || existing.phone, level: level || existing.level, department: department || existing.department, matric_no: matric_no || existing.matric_no, avatar_url: avatar_url || existing.avatar_url }).eq('id', existing.id).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      const { data, error } = await supabase.from('students').insert({ user_id, email, full_name, phone: phone || null, level: level || null, department: department || null, matric_no: matric_no || null, avatar_url: avatar_url || null }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      delete fields.user_id;
      const { data, error } = await supabase.from('students').update(fields).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('students API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
