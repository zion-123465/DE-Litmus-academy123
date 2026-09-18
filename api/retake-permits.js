import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

// Retake permits: after a student submits a quiz they are locked out until
// the admin grants a permit. One permit = one extra attempt (auto-consumed).
// GET /api/retake-permits?all=1 (admin) | ?student_id=&quiz_id=
// POST /api/retake-permits { student_id, quiz_id, note? } (admin)
// DELETE /api/retake-permits { id } (admin)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { all, student_id, quiz_id, limit } = req.query;
      if (all === '1') {
        if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
        const { data, error } = await supabase.from('retake_permits').select('*').order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 100, 200));
        if (error) throw error;
        // attach names
        const sIds = [...new Set((data || []).map((r) => r.student_id))];
        const qIds = [...new Set((data || []).map((r) => r.quiz_id))];
        const [{ data: students }, { data: quizzes }] = await Promise.all([
          sIds.length ? supabase.from('students').select('id, full_name, email').in('id', sIds) : { data: [] },
          qIds.length ? supabase.from('quizzes').select('id, title').in('id', qIds) : { data: [] },
        ]);
        const sMap = Object.fromEntries((students || []).map((s) => [s.id, s]));
        const qMap = Object.fromEntries((quizzes || []).map((q) => [q.id, q]));
        return res.status(200).json((data || []).map((r) => ({ ...r, student: sMap[r.student_id] || null, quiz: qMap[r.quiz_id] || null })));
      }
      if (!student_id || !quiz_id) return res.status(400).json({ error: 'Provide student_id and quiz_id' });
      const { data, error } = await supabase.from('retake_permits')
        .select('id')
        .eq('student_id', student_id)
        .eq('quiz_id', quiz_id)
        .eq('consumed', false)
        .limit(1);
      if (error) throw error;
      return res.status(200).json({ permitted: !!(data && data.length) });
    }

    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });

    if (req.method === 'POST') {
      const { student_id, quiz_id, note, granted_by } = req.body || {};
      if (!student_id || !quiz_id) return res.status(400).json({ error: 'student_id and quiz_id are required' });
      const { data, error } = await supabase.from('retake_permits').insert({
        student_id: Number(student_id),
        quiz_id: Number(quiz_id),
        granted_by: granted_by || 'admin',
        note: note ? String(note).slice(0, 300) : null,
        consumed: false,
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('retake_permits').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('retake-permits API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
