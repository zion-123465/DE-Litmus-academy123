import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

function stripAnswers(rows) {
  return rows.map(({ correct_option, ...rest }) => rest);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { quiz_id, id } = req.query;
      const admin = await isAdmin(req);
      if (id) {
        const { data, error } = await supabase.from('questions').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(200).json(null);
        return res.status(200).json(admin ? data : stripAnswers([data])[0]);
      }
      if (!quiz_id) return res.status(400).json({ error: 'quiz_id is required' });
      const { data, error } = await supabase.from('questions').select('*').eq('quiz_id', quiz_id).order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(admin ? data : stripAnswers(data));
    }
    if (req.method === 'POST') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const body = req.body || {};
      if (Array.isArray(body.questions)) {
        const rows = body.questions.filter((x) => x && x.question_text && x.quiz_id).map((x) => ({
          quiz_id: x.quiz_id, question_text: x.question_text, option_a: x.option_a || '', option_b: x.option_b || '',
          option_c: x.option_c || '', option_d: x.option_d || '', correct_option: (x.correct_option || 'A').toUpperCase(), marks: Number(x.marks) || 1
        }));
        if (!rows.length) return res.status(400).json({ error: 'No valid questions provided' });
        const { data, error } = await supabase.from('questions').insert(rows).select();
        if (error) throw error;
        return res.status(201).json(data);
      }
      const { quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks } = body;
      if (!quiz_id || !question_text) return res.status(400).json({ error: 'quiz_id and question_text are required' });
      const { data, error } = await supabase.from('questions').insert({
        quiz_id, question_text, option_a: option_a || '', option_b: option_b || '', option_c: option_c || '', option_d: option_d || '',
        correct_option: (correct_option || 'A').toUpperCase(), marks: Number(marks) || 1
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id, ...fields } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (fields.correct_option) fields.correct_option = String(fields.correct_option).toUpperCase();
      if (fields.marks !== undefined) fields.marks = Number(fields.marks) || 1;
      const { data, error } = await supabase.from('questions').update(fields).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id, quiz_id } = req.body || {};
      if (quiz_id) {
        const { error } = await supabase.from('questions').delete().eq('quiz_id', quiz_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      if (!id) return res.status(400).json({ error: 'id or quiz_id is required' });
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('questions API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
