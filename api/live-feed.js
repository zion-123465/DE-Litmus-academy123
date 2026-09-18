import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('[live-feed] Missing Supabase env vars');
}

const supabase = createClient(url, serviceKey);

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Student pushes a camera snapshot + monitoring status during the exam
    if (req.method === 'POST') {
      const { attempt_id, student_id, image, warnings, mic_level, face_visible, gaze_ok, answered, total } = req.body || {};
      if (!attempt_id || !student_id) return res.status(400).json({ error: 'attempt_id and student_id are required' });
      // Only accept feeds for attempts still in progress
      const { data: att } = await supabase.from('quiz_attempts').select('id, status').eq('id', attempt_id).maybeSingle();
      if (!att || att.status !== 'in_progress') return res.status(200).json({ ok: false, reason: 'attempt not live' });

      const row = {
        attempt_id: Number(attempt_id),
        student_id: Number(student_id),
        image: image || null,
        warnings: Number(warnings) || 0,
        mic_level: Math.max(0, Math.min(100, Number(mic_level) || 0)),
        face_visible: face_visible !== false,
        gaze_ok: gaze_ok !== false,
        answered: Number(answered) || 0,
        total: Number(total) || 0,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from('live_feeds').select('id').eq('attempt_id', row.attempt_id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('live_feeds').update(row).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('live_feeds').insert(row);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    // Admin polls the list of live feeds (recent heartbeats only)
    if (req.method === 'GET') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const since = new Date(Date.now() - 90000).toISOString();
      const { data, error } = await supabase
        .from('live_feeds')
        .select('*')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      if (!data?.length) return res.status(200).json([]);
      // attach student + quiz names
      const sIds = [...new Set(data.map((r) => r.student_id))];
      const aIds = [...new Set(data.map((r) => r.attempt_id))];
      const [{ data: students }, { data: attempts }] = await Promise.all([
        supabase.from('students').select('id, full_name, email, matric_no, level, department').in('id', sIds),
        supabase.from('quiz_attempts').select('id, quiz_id, status, warnings').in('id', aIds),
      ]);
      const liveAttemptIds = new Set((attempts || []).filter((a) => a.status === 'in_progress').map((a) => a.id));
      const qIds = [...new Set((attempts || []).map((a) => a.quiz_id))];
      const { data: quizzes } = qIds.length
        ? await supabase.from('quizzes').select('id, title').in('id', qIds)
        : { data: [] };
      const sMap = Object.fromEntries((students || []).map((s) => [s.id, s]));
      const aMap = Object.fromEntries((attempts || []).map((a) => [a.id, a]));
      const qMap = Object.fromEntries((quizzes || []).map((q) => [q.id, q]));
      const out = data
        .filter((r) => liveAttemptIds.has(r.attempt_id))
        .map((r) => ({
          ...r,
          student: sMap[r.student_id] || null,
          quiz: qMap[aMap[r.attempt_id]?.quiz_id] || null,
        }));
      return res.status(200).json(out);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('live-feed API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
