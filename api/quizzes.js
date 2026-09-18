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
      const { id, level, department, search, published_only, with_counts } = req.query;
      if (id) {
        const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(200).json(null);
        if (with_counts === '1') {
          const { count: qCount } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', id);
          const { count: aCount } = await supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', id);
          return res.status(200).json({ ...data, question_count: qCount || 0, attempt_count: aCount || 0 });
        }
        return res.status(200).json(data);
      }
      let q = supabase.from('quizzes').select('*').order('created_at', { ascending: false });
      if (published_only === '1') q = q.eq('is_published', true);
      if (level) q = q.eq('level', level);
      if (department) q = q.eq('department', department);
      if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      if (with_counts === '1' && data.length) {
        const ids = data.map((x) => x.id);
        const { data: qs } = await supabase.from('questions').select('quiz_id').in('quiz_id', ids);
        const counts = {};
        (qs || []).forEach((r) => { counts[r.quiz_id] = (counts[r.quiz_id] || 0) + 1; });
        return res.status(200).json(data.map((x) => ({ ...x, question_count: counts[x.id] || 0 })));
      }
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { title, description, level, department, duration_minutes, pass_mark, price, is_published, instructions } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title is required' });
      const { data, error } = await supabase.from('quizzes').insert({
        title, description: description || null, level: level || 'General', department: department || 'General',
        duration_minutes: Number(duration_minutes) || 30, pass_mark: Number(pass_mark) || 50,
        price: Number(price) || 0, is_published: is_published !== false, instructions: instructions || null
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (fields.duration_minutes !== undefined) fields.duration_minutes = Number(fields.duration_minutes) || 30;
      if (fields.pass_mark !== undefined) fields.pass_mark = Number(fields.pass_mark) || 50;
      if (fields.price !== undefined) fields.price = Number(fields.price) || 0;
      const { data, error } = await supabase.from('quizzes').update(fields).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await supabase.from('questions').delete().eq('quiz_id', id);
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('quizzes API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
