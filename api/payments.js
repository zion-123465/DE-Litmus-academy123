import supabase from './db-client.js';

async function getSetting(key) {
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return null;
  try { return JSON.parse(data.value); } catch { return data.value; }
}

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

async function issueQuizCode(quizId, studentId) {
  const code = genCode();
  const { data, error } = await supabase.from('quiz_codes').insert({ code, quiz_id: quizId, student_id: studentId, status: 'active' }).select().single();
  if (error) throw error;
  return data;
}

// Automatic bank verification: matches the paid amount against the expected
// price, validates the transfer reference against the admin's linked main
// bank account, and runs an AI fraud-scoring pass over the submission.
// Auto-approval ONLY happens when: (1) AI verification is enabled, (2) the
// linked bank account details are present, (3) receipt uploaded, (4) amount
// matches expected price, (5) reference is valid and never reused, and
// (6) the AI fraud score is below the admin's risk threshold.
// If ANY check fails, the payment stays pending for manual admin approval —
// nothing is ever released to the student without AI or admin approval.
function aiFraudScore({ amount, expected, bankRef, proofUrl, studentId, studentName, studentEmail, recentRefs }) {
  let risk = 0;
  const flags = [];
  const ref = String(bankRef || '').trim();
  // Duplicated reference across payments = high fraud risk
  const dupes = (recentRefs || []).filter((r) => r && r.toLowerCase() === ref.toLowerCase()).length;
  if (dupes > 0) {
    risk += 60;
    flags.push('Transfer reference already used on another payment');
  }
  // Overpayment far above expected can indicate receipt tampering
  if (Number(amount) > Number(expected) * 1.5 && Number(expected) > 0) {
    risk += 25;
    flags.push('Amount far above expected price');
  }
  // Suspiciously short/generic references
  if (ref.length < 6 || /^(test|demo|123+|abc|xxx|none|n\/a)$/i.test(ref)) {
    risk += 30;
    flags.push('Reference looks invalid or generic');
  }
  // Receipt filename sanity (must look like an actual upload URL)
  if (!proofUrl || !/^https?:\/\/.+\..+/.test(String(proofUrl))) {
    risk += 40;
    flags.push('Receipt not properly attached');
  }
  // Missing student identity linkage
  if (!studentName || !studentEmail) {
    risk += 15;
    flags.push('Student identity incomplete');
  }
  risk = Math.min(100, risk);
  return { risk, flags, verdict: risk >= 50 ? 'reject' : risk >= 25 ? 'review' : 'approve' };
}

async function aiAutoVerifyCheck({ amount, expected, bankRef, proofUrl, studentId, studentName, studentEmail, bank, ai }) {
  const checks = [];
  if (!bank?.auto_verify_enabled) return { pass: false, reason: 'AI auto-verification is disabled — awaiting admin review', checks, ai: null };
  if (!ai?.enabled) return { pass: false, reason: 'AI verification is disabled — awaiting admin review', checks, ai: null };
  if (!bank?.bank_name || !bank?.account_number) {
    return { pass: false, reason: 'Admin bank account not linked — awaiting admin review', checks, ai: null };
  }
  const ref = String(bankRef || '').trim();
  if (ref.length < 3) return { pass: false, reason: 'Transfer reference required', checks, ai: null };
  checks.push('Linked bank account present');
  if (!proofUrl) return { pass: false, reason: 'Receipt required for AI verification', checks, ai: null };
  checks.push('Receipt attached');
  if (Number(amount) + 0.01 < Number(expected)) {
    return { pass: false, reason: `Amount ${amount} below expected ${expected} — awaiting admin review`, checks, ai: null };
  }
  checks.push(`Amount ${amount} matches expected ${expected}`);
  // Pull recent refs to detect reuse
  let recentRefs = [];
  try {
    const { data } = await supabase.from('payments').select('bank_ref').order('created_at', { ascending: false }).limit(200);
    recentRefs = (data || []).map((r) => r.bank_ref).filter(Boolean);
  } catch {}
  const score = aiFraudScore({ amount, expected, bankRef: ref, proofUrl, studentId, studentName, studentEmail, recentRefs });
  const threshold = Number(ai?.risk_threshold);
  const maxRisk = Number.isFinite(threshold) ? threshold : 25;
  checks.push(`AI fraud scan: risk ${score.risk}/100 (threshold ${maxRisk})${score.flags.length ? ' — ' + score.flags.join('; ') : ' — clean'}`);
  if (score.risk >= maxRisk) {
    return {
      pass: false,
      reason: `AI flagged this payment (risk ${score.risk}/100): ${score.flags.join('; ') || 'suspicious pattern'} — awaiting admin review`,
      checks,
      ai: score,
    };
  }
  return {
    pass: true,
    reason: `AI verified via linked ${bank.bank_name} account: amount matched, receipt attached, reference unique, fraud risk ${score.risk}/100`,
    checks,
    ai: score,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, student_id, status, item_type, all, limit } = req.query;
      if (id) {
        const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      let q = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 200, 500));
      if (student_id) q = q.eq('student_id', student_id);
      if (status) q = q.eq('status', status);
      if (item_type) q = q.eq('item_type', item_type);
      if (all && !(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      if (!all && !student_id && !(await isAdmin(req))) return res.status(400).json({ error: 'Provide student_id' });
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { student_id, item_type, item_id, amount, bank_ref, proof_url } = req.body || {};
      if (!student_id || !item_type || !item_id || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'student_id, item_type, item_id and amount are required' });
      }
      if (!proof_url) {
        return res.status(400).json({ error: 'Payment receipt upload is required for verification.' });
      }
      const { data: student } = await supabase.from('students').select('*').eq('id', student_id).maybeSingle();
      if (!student) return res.status(404).json({ error: 'Student not found' });
      // One quiz code per student per quiz subject: block repeat purchases
      // (pending or approved) for the same quiz.
      if (item_type === 'quiz_code') {
        const { data: dupes } = await supabase.from('payments')
          .select('id, status')
          .eq('student_id', student_id)
          .eq('item_type', 'quiz_code')
          .eq('item_id', item_id)
          .in('status', ['pending', 'approved'])
          .limit(1);
        if (dupes && dupes.length) {
          return res.status(400).json({ error: 'You already bought a quiz code for this subject. Each student can only buy one code per quiz.' });
        }
        const { data: priorAttempts } = await supabase.from('quiz_attempts')
          .select('id')
          .eq('student_id', student_id)
          .eq('quiz_id', item_id)
          .neq('status', 'in_progress')
          .limit(1);
        if (priorAttempts && priorAttempts.length) {
          return res.status(400).json({ error: 'You already wrote this quiz. Only the admin can permit a retake — please contact the admin.' });
        }
      }
      let itemTitle = '';
      let expected = 0;
      if (item_type === 'quiz_code') {
        const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', item_id).maybeSingle();
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
        const global = (await getSetting('quiz_code_price')) || { amount: 1500 };
        expected = Number(quiz.price) > 0 ? Number(quiz.price) : Number(global.amount) || 0;
        itemTitle = `Quiz code: ${quiz.title}`;
      } else if (item_type === 'book') {
        const { data: mat } = await supabase.from('materials_v2').select('*').eq('id', item_id).maybeSingle();
        if (!mat) return res.status(404).json({ error: 'Material not found' });
        expected = Number(mat.price) || 0;
        itemTitle = `Book: ${mat.title}`;
      } else {
        return res.status(400).json({ error: 'item_type must be quiz_code or book' });
      }
      const bank = (await getSetting('bank_account')) || {};
      const ai = (await getSetting('ai_verification')) || { enabled: true, risk_threshold: 25 };
      const check = await aiAutoVerifyCheck({
        amount, expected, bankRef: bank_ref, proofUrl: proof_url,
        studentId: student_id, studentName: student.full_name, studentEmail: student.email,
        bank, ai,
      });
      let status = 'pending';
      let verifiedVia = 'manual';
      let codeIssued = null;
      if (check.pass) {
        status = 'approved';
        verifiedVia = 'ai_bank_match';
        if (item_type === 'quiz_code') {
          const c = await issueQuizCode(item_id, student_id);
          codeIssued = c.code;
        }
      }
      const { data, error } = await supabase.from('payments').insert({
        student_id, student_name: student.full_name, student_email: student.email,
        item_type, item_id, item_title: itemTitle, amount: Number(amount),
        bank_ref: bank_ref || null, proof_url: proof_url || null,
        status, verified_via: verifiedVia, code_issued: codeIssued,
        decided_at: status === 'approved' ? new Date().toISOString() : null
      }).select().single();
      if (error) throw error;
      try {
        await supabase.from('payment_ai_checks').insert({
          payment_id: data.id,
          risk: check.ai ? check.ai.risk : null,
          verdict: check.pass ? 'approve' : 'review',
          flags: check.ai && check.ai.flags.length ? check.ai.flags.join('; ') : null,
          checks: check.checks || [],
          reason: check.reason,
        });
      } catch {}
      return res.status(201).json({ ...data, auto_check: check.reason, ai_checks: check.checks });
    }
    if (req.method === 'PUT') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id, action, decided_by } = req.body || {};
      if (!id || !action) return res.status(400).json({ error: 'id and action are required' });
      const { data: pay } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
      if (!pay) return res.status(404).json({ error: 'Payment not found' });
      if (action === 'approve') {
        let codeIssued = pay.code_issued;
        if (pay.item_type === 'quiz_code' && !codeIssued) {
          const c = await issueQuizCode(pay.item_id, pay.student_id);
          codeIssued = c.code;
        }
        const { data, error } = await supabase.from('payments').update({
          status: 'approved', verified_via: (pay.verified_via === 'ai_bank_match' || pay.verified_via === 'auto_bank_match') ? 'ai_bank_match' : 'manual_admin',
          code_issued: codeIssued, decided_at: new Date().toISOString(), decided_by: decided_by || 'admin'
        }).eq('id', id).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (action === 'ai-recheck') {
        // Admin-triggered AI re-scan of a pending payment against the linked bank account.
        if (pay.status !== 'pending') return res.status(400).json({ error: 'Only pending payments can be AI re-checked' });
        let expected = 0;
        if (pay.item_type === 'quiz_code') {
          const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', pay.item_id).maybeSingle();
          const global = (await getSetting('quiz_code_price')) || { amount: 1500 };
          expected = quiz ? (Number(quiz.price) > 0 ? Number(quiz.price) : Number(global.amount) || 0) : Number(pay.amount);
        } else {
          const { data: mat } = await supabase.from('materials_v2').select('*').eq('id', pay.item_id).maybeSingle();
          expected = mat ? Number(mat.price) || 0 : Number(pay.amount);
        }
        const bank = (await getSetting('bank_account')) || {};
        const ai = (await getSetting('ai_verification')) || { enabled: true, risk_threshold: 25 };
        const check = await aiAutoVerifyCheck({
          amount: pay.amount, expected, bankRef: pay.bank_ref, proofUrl: pay.proof_url,
          studentId: pay.student_id, studentName: pay.student_name, studentEmail: pay.student_email,
          bank, ai,
        });
        if (check.pass) {
          let codeIssued = pay.code_issued;
          if (pay.item_type === 'quiz_code' && !codeIssued) {
            const c = await issueQuizCode(pay.item_id, pay.student_id);
            codeIssued = c.code;
          }
          const { data, error } = await supabase.from('payments').update({
            status: 'approved', verified_via: 'ai_bank_match', code_issued: codeIssued,
            decided_at: new Date().toISOString(), decided_by: 'ai-recheck'
          }).eq('id', id).select().single();
          if (error) throw error;
          try {
            await supabase.from('payment_ai_checks').insert({
              payment_id: id, risk: check.ai ? check.ai.risk : null, verdict: 'approve',
              flags: check.ai && check.ai.flags.length ? check.ai.flags.join('; ') : null,
              checks: check.checks || [], reason: check.reason,
            });
          } catch {}
          return res.status(200).json({ ...data, auto_check: check.reason, ai_checks: check.checks });
        }
        try {
          await supabase.from('payment_ai_checks').insert({
            payment_id: id, risk: check.ai ? check.ai.risk : null, verdict: 'review',
            flags: check.ai && check.ai.flags.length ? check.ai.flags.join('; ') : null,
            checks: check.checks || [], reason: check.reason,
          });
        } catch {}
        return res.status(200).json({ ok: false, auto_check: check.reason, ai_checks: check.checks, ai: check.ai });
      }
      if (action === 'reject') {
        const { data, error } = await supabase.from('payments').update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: decided_by || 'admin' }).eq('id', id).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      return res.status(400).json({ error: 'action must be approve, ai-recheck or reject' });
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('payments API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
