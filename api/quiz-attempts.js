import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

async function attachStudents(attempts) {
  if (!attempts?.length) return attempts;
  const sIds = [...new Set(attempts.map((a) => a.student_id))];
  const qIds = [...new Set(attempts.map((a) => a.quiz_id))];
  const [{ data: students }, { data: quizzes }] = await Promise.all([
    supabase.from('students').select('id, full_name, email, level, department, matric_no').in('id', sIds),
    supabase.from('quizzes').select('id, title, level, department').in('id', qIds)
  ]);
  const sMap = Object.fromEntries((students || []).map((s) => [s.id, s]));
  const qMap = Object.fromEntries((quizzes || []).map((q) => [q.id, q]));
  return attempts.map((a) => ({ ...a, student: sMap[a.student_id] || null, quiz: qMap[a.quiz_id] || null }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, student_id, quiz_id, status, all, limit } = req.query;
      const admin = await isAdmin(req);
      if (id) {
        const { data, error } = await supabase.from('quiz_attempts').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(200).json(null);
        const [merged] = await attachStudents([data]);
        return res.status(200).json(merged);
      }
      let q = supabase.from('quiz_attempts').select('*').order('started_at', { ascending: false }).limit(Math.min(parseInt(limit) || 200, 500));
      if (student_id) q = q.eq('student_id', student_id);
      if (quiz_id) q = q.eq('quiz_id', quiz_id);
      if (status) q = q.eq('status', status);
      if (all && !admin) return res.status(403).json({ error: 'Admin access required' });
      if (!all && !student_id && !quiz_id && !admin) return res.status(400).json({ error: 'Provide student_id, quiz_id or all=1' });
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(await attachStudents(data));
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action === 'start') {
        const { student_id, quiz_id, code } = body;
        if (!student_id || !quiz_id || !code) return res.status(400).json({ error: 'student_id, quiz_id and code are required' });
        const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quiz_id).maybeSingle();
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
        if (quiz.is_published === false) return res.status(403).json({ error: 'This quiz has been deactivated by the admin.' });
        const { data: codeRow } = await supabase.from('quiz_codes').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle();
        if (!codeRow) return res.status(404).json({ error: 'Invalid quiz code' });
        if (codeRow.status !== 'active') return res.status(400).json({ error: `This code has been used and deactivated. Each quiz code works only once — please buy a new code.` });
        if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
          await supabase.from('quiz_codes').update({ status: 'expired' }).eq('id', codeRow.id);
          return res.status(400).json({ error: 'This code has expired' });
        }
        if (codeRow.quiz_id && Number(codeRow.quiz_id) !== Number(quiz_id)) return res.status(400).json({ error: 'This code is for a different quiz' });
        if (codeRow.student_id && Number(codeRow.student_id) !== Number(student_id)) return res.status(403).json({ error: 'This code belongs to another student' });
        const { data: existing } = await supabase.from('quiz_attempts').select('*').eq('student_id', student_id).eq('quiz_id', quiz_id).eq('status', 'in_progress').maybeSingle();
        if (existing) return res.status(200).json({ attempt: existing, resumed: true });
        // One attempt per student per quiz: after submission they cannot write
        // again unless the admin grants a retake permit.
        const { data: prior } = await supabase.from('quiz_attempts')
          .select('id')
          .eq('student_id', student_id)
          .eq('quiz_id', quiz_id)
          .neq('status', 'in_progress')
          .limit(1);
        if (prior && prior.length) {
          const { data: permit } = await supabase.from('retake_permits')
            .select('*')
            .eq('student_id', student_id)
            .eq('quiz_id', quiz_id)
            .eq('consumed', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!permit) {
            return res.status(403).json({ error: 'You have already submitted this quiz. Only the admin can permit a retake — please contact the admin.' });
          }
          await supabase.from('retake_permits').update({ consumed: true }).eq('id', permit.id);
        }
        await supabase.from('quiz_codes').update({ status: 'used', used_at: new Date().toISOString(), student_id }).eq('id', codeRow.id);
        const { data: questions } = await supabase.from('questions').select('id').eq('quiz_id', quiz_id);
        const { data: attempt, error } = await supabase.from('quiz_attempts').insert({
          student_id, quiz_id, code_id: codeRow.id, answers: {}, status: 'in_progress', warnings: 0, warning_log: []
        }).select().single();
        if (error) throw error;
        return res.status(201).json({ attempt, resumed: false, total_questions: (questions || []).length });
      }
      if (body.action === 'submit') {
        const { attempt_id, answers, warning_log, time_spent_seconds, auto } = body;
        if (!attempt_id) return res.status(400).json({ error: 'attempt_id is required' });
        const { data: attempt } = await supabase.from('quiz_attempts').select('*').eq('id', attempt_id).maybeSingle();
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.status !== 'in_progress') {
          const [merged] = await attachStudents([attempt]);
          return res.status(200).json(merged);
        }
        const [{ data: questions }, { data: quiz }] = await Promise.all([
          supabase.from('questions').select('*').eq('quiz_id', attempt.quiz_id),
          supabase.from('quizzes').select('*').eq('id', attempt.quiz_id).maybeSingle()
        ]);
        const ans = answers || {};
        let score = 0;
        let total = 0;
        (questions || []).forEach((q) => {
          const m = Number(q.marks) || 1;
          total += m;
          if (String(ans[q.id] || '').toUpperCase() === String(q.correct_option).toUpperCase()) score += m;
        });
        const pct = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;
        const warnings = Array.isArray(warning_log) ? warning_log.length : (attempt.warnings || 0);
        const { data, error } = await supabase.from('quiz_attempts').update({
          answers: ans, score, total_marks: total, percentage: pct,
          passed: pct >= (Number(quiz?.pass_mark) || 50),
          warnings, warning_log: warning_log || [],
          status: auto ? 'auto_submitted' : 'submitted',
          submitted_at: new Date().toISOString(),
          time_spent_seconds: Number(time_spent_seconds) || 0
        }).eq('id', attempt_id).select().single();
        if (error) throw error;
        const [merged] = await attachStudents([data]);
        return res.status(200).json(merged);
      }
      if (body.action === 'heartbeat') {
        const { attempt_id, warnings, warning_log, answers } = body;
        if (!attempt_id) return res.status(400).json({ error: 'attempt_id required' });
        const updates = { warnings: Number(warnings) || 0, warning_log: warning_log || [] };
        if (answers && typeof answers === 'object') updates.answers = answers;
        await supabase.from('quiz_attempts').update(updates).eq('id', attempt_id);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('quiz_attempts').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('quiz-attempts API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
