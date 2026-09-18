import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `DLA-${s.slice(0, 4)}-${s.slice(4)}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { student_id, code, status, quiz_id, all, limit } = req.query;
      if (code) {
        const { data, error } = await supabase.from('quiz_codes').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      let q = supabase.from('quiz_codes').select('*').order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 200, 500));
      if (student_id) q = q.eq('student_id', student_id);
      if (status) q = q.eq('status', status);
      if (quiz_id) q = q.eq('quiz_id', quiz_id);
      if (all && !(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      if (!all && !student_id && !(await isAdmin(req))) return res.status(400).json({ error: 'Provide student_id' });
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { quiz_id, student_id, count, expires_at } = req.body || {};
      const n = Math.min(Math.max(parseInt(count) || 1, 1), 100);
      const rows = [];
      for (let i = 0; i < n; i++) rows.push({ code: genCode(), quiz_id: quiz_id || null, student_id: student_id || null, status: 'active', expires_at: expires_at || null });
      const { data, error } = await supabase.from('quiz_codes').insert(rows).select();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, code, action, student_id, quiz_id, expires_at, status } = req.body || {};
      let row = null;
      if (id) {
        const { data } = await supabase.from('quiz_codes').select('*').eq('id', id).maybeSingle();
        row = data;
      } else if (code) {
        const { data } = await supabase.from('quiz_codes').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle();
        row = data;
      }
      if (!row) return res.status(404).json({ error: 'Code not found' });
      if (action === 'use') {
        if (row.status !== 'active') return res.status(400).json({ error: `This code is ${row.status}` });
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          await supabase.from('quiz_codes').update({ status: 'expired' }).eq('id', row.id);
          return res.status(400).json({ error: 'This code has expired' });
        }
        const updates = { status: 'used', used_at: new Date().toISOString() };
        if (student_id && !row.student_id) updates.student_id = student_id;
        if (student_id && row.student_id && row.student_id !== Number(student_id)) return res.status(403).json({ error: 'This code belongs to another student' });
        const { data, error } = await supabase.from('quiz_codes').update(updates).eq('id', row.id).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const updates = {};
      if (action === 'revoke') updates.status = 'revoked';
      if (action === 'activate') updates.status = 'active';
      if (status) updates.status = status;
      if (student_id !== undefined) updates.student_id = student_id || null;
      if (quiz_id !== undefined) updates.quiz_id = quiz_id || null;
      if (expires_at !== undefined) updates.expires_at = expires_at || null;
      const { data, error } = await supabase.from('quiz_codes').update(updates).eq('id', row.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('quiz_codes').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('quiz-codes API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
