import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

function randomPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let s = '';
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });

    // GET /api/admin-recovery?student_id=1 -> reveal login email + user id
    if (req.method === 'GET') {
      const { student_id, email } = req.query;
      let student = null;
      if (student_id) {
        const { data } = await supabase.from('students').select('*').eq('id', student_id).maybeSingle();
        student = data;
      } else if (email) {
        const { data } = await supabase.from('students').select('*').ilike('email', String(email).trim()).maybeSingle();
        student = data;
      }
      if (!student) return res.status(404).json({ error: 'Student not found' });
      let authUser = null;
      if (student.user_id) {
        const { data } = await supabase.auth.admin.getUserById(student.user_id);
        authUser = data?.user || null;
      }
      return res.status(200).json({
        student_id: student.id,
        full_name: student.full_name,
        email: student.email,
        matric_no: student.matric_no,
        user_id: student.user_id,
        auth_email: authUser?.email || null,
        last_sign_in: authUser?.last_sign_in_at || null,
        email_confirmed: !!authUser?.email_confirmed_at,
        note: 'Passwords are one-way hashed and cannot be viewed. Use reset to issue a new temporary password.',
      });
    }

    // POST /api/admin-recovery { student_id, new_password? } -> reset auth password
    if (req.method === 'POST') {
      const { student_id, new_password } = req.body || {};
      if (!student_id) return res.status(400).json({ error: 'student_id is required' });
      const { data: student } = await supabase.from('students').select('*').eq('id', student_id).maybeSingle();
      if (!student) return res.status(404).json({ error: 'Student not found' });
      if (!student.user_id) return res.status(400).json({ error: 'This student has no linked login account' });
      const password = new_password && String(new_password).length >= 6 ? String(new_password) : randomPassword(10);
      const { error } = await supabase.auth.admin.updateUserById(student.user_id, { password });
      if (error) throw error;
      return res.status(200).json({
        ok: true,
        student_id: student.id,
        email: student.email,
        temp_password: password,
        message: 'Password reset. Share the temporary password with the student privately; ask them to change it after login.',
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin-recovery API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
