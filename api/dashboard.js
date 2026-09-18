import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
    const [
      { count: students },
      { count: materials },
      { count: quizzes },
      { count: questions },
      { count: codesActive },
      { count: codesUsed },
      { count: paymentsPending },
      { data: approved },
      { count: attempts },
      { data: recentPayments },
      { data: recentAttempts }
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('materials_v2').select('id', { count: 'exact', head: true }),
      supabase.from('quizzes').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('quiz_codes').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('quiz_codes').select('id', { count: 'exact', head: true }).eq('status', 'used'),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payments').select('amount').eq('status', 'approved'),
      supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).neq('status', 'in_progress'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(6),
      supabase.from('quiz_attempts').select('*').order('started_at', { ascending: false }).limit(6)
    ]);
    const revenue = (approved || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return res.status(200).json({
      students: students || 0, materials: materials || 0, quizzes: quizzes || 0, questions: questions || 0,
      codesActive: codesActive || 0, codesUsed: codesUsed || 0, paymentsPending: paymentsPending || 0,
      revenue, attempts: attempts || 0, recentPayments: recentPayments || [], recentAttempts: recentAttempts || []
    });
  } catch (err) {
    console.error('dashboard API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
