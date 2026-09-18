import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

// Parse tagged rich-content lines back into structured fields for clients.
function enrichMessage(r) {
  const out = { ...r, kind: 'text', attachment_url: null, attachment_name: null, reply_to: null };
  const raw = String(r.message || '');
  const lines = raw.split('\n');
  const kept = [];
  for (const ln of lines) {
    if (ln.startsWith('[img]')) {
      out.kind = 'image';
      out.attachment_url = ln.slice(5).trim();
    } else if (ln.startsWith('[file]')) {
      out.kind = 'file';
      const rest = ln.slice(6);
      const i = rest.lastIndexOf('|');
      out.attachment_url = (i >= 0 ? rest.slice(0, i) : rest).trim();
      out.attachment_name = (i >= 0 ? rest.slice(i + 1) : 'file').trim();
    } else if (ln.startsWith('[voice]')) {
      out.kind = 'voice';
      out.attachment_url = ln.slice(7).trim();
    } else if (ln.startsWith('[reply]')) {
      const rest = ln.slice(7).split('|');
      out.reply_to = { id: Number(rest[0]) || null, name: rest[1] || '', text: rest.slice(2).join('|') || '' };
    } else {
      kept.push(ln);
    }
  }
  out.message = kept.join('\n').trim();
  return out;
}

async function attachStudents(rows) {
  const enriched = (rows || []).map(enrichMessage);
  if (!enriched?.length) return enriched;
  const ids = [...new Set(enriched.filter((r) => r.student_id).map((r) => r.student_id))];
  if (!ids.length) return enriched.map((r) => ({ ...r, student: null }));
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, avatar_url, matric_no, level, department, phone, email')
    .in('id', ids);
  const map = Object.fromEntries((students || []).map((s) => [s.id, s]));
  return enriched.map((r) => ({ ...r, student: r.student_id ? map[r.student_id] || null : null }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ---- GROUP CHAT ----
    // GET /api/chat?scope=group&limit=100&after_id=123
    // POST /api/chat { scope:'group', student_id?, sender_name, sender_role, message }
    // DELETE /api/chat { id } (admin only)
    if (req.method === 'GET') {
      const { scope, limit, after_id, student_id, admin_unread } = req.query;

      if (scope === 'group') {
        let q = supabase.from('chat_messages').select('*').eq('scope', 'group').order('id', { ascending: true }).limit(Math.min(parseInt(limit) || 100, 200));
        if (after_id) q = q.gt('id', Number(after_id));
        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json(await attachStudents(data || []));
      }

      if (scope === 'private') {
        // student thread: their messages + admin replies
        if (!student_id) return res.status(400).json({ error: 'student_id is required' });
        let q = supabase.from('chat_messages').select('*').eq('scope', 'private').eq('student_id', student_id).order('id', { ascending: true }).limit(Math.min(parseInt(limit) || 200, 300));
        if (after_id) q = q.gt('id', Number(after_id));
        const { data, error } = await q;
        if (error) throw error;
        return res.status(200).json(await attachStudents(data || []));
      }

      if (admin_unread === '1') {
        if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
        // latest private message per student + unread counts
        const { data, error } = await supabase.from('chat_messages').select('*').eq('scope', 'private').order('id', { ascending: false }).limit(500);
        if (error) throw error;
        const threads = {};
        for (const m of data || []) {
          const sid = m.student_id;
          if (!sid) continue;
          if (!threads[sid]) threads[sid] = { student_id: sid, last: m, unread: 0, total: 0 };
          threads[sid].total += 1;
          if (m.sender_role === 'student' && !m.read_by_admin) threads[sid].unread += 1;
        }
        const list = await attachStudents(Object.values(threads).map((t) => ({ ...t.last, student_id: t.student_id, _unread: t.unread, _total: t.total })));
        return res.status(200).json(
          list.map((m) => ({ student_id: m.student_id, student: m.student, last: m, unread: m._unread, total: m._total }))
        );
      }

      return res.status(400).json({ error: 'Provide scope=group, scope=private&student_id, or admin_unread=1' });
    }

    if (req.method === 'POST') {
      const { scope, student_id, sender_name, sender_role, message, kind, attachment_url, attachment_name, reply_to } = req.body || {};
      if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required' });
      if (String(message).length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
      if (scope !== 'group' && scope !== 'private') return res.status(400).json({ error: 'scope must be group or private' });
      if (scope === 'private' && !student_id) return res.status(400).json({ error: 'student_id is required for private chat' });
      const role = sender_role === 'admin' ? 'admin' : 'student';
      if (role === 'admin' && !(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      if (role === 'student' && !student_id) return res.status(400).json({ error: 'student_id is required' });

      const k = ['text', 'image', 'file', 'voice'].includes(kind) ? kind : 'text';
      // Rich content is encoded as tagged lines appended to the message so no
      // schema change is needed: [img]url, [file]url|name, [voice]url, [reply]id|name|text
      let body = String(message).trim().slice(0, 2000);
      if (k === 'image' && attachment_url) body += `\n[img]${String(attachment_url).slice(0, 500)}`;
      if (k === 'file' && attachment_url) body += `\n[file]${String(attachment_url).slice(0, 500)}|${String(attachment_name || 'file').slice(0, 120)}`;
      if (k === 'voice' && attachment_url) body += `\n[voice]${String(attachment_url).slice(0, 500)}`;
      if (reply_to && typeof reply_to === 'object' && reply_to.id) {
        body += `\n[reply]${reply_to.id}|${String(reply_to.name || '').slice(0, 60)}|${String(reply_to.text || '').slice(0, 120)}`;
      }

      const { data, error } = await supabase.from('chat_messages').insert({
        scope,
        student_id: student_id ? Number(student_id) : null,
        sender_name: String(sender_name || (role === 'admin' ? 'Admin' : 'Student')).slice(0, 80),
        sender_role: role,
        message: body,
        read_by_admin: role === 'admin',
      }).select().single();
      if (error) throw error;
      const [one] = await attachStudents([data]);
      return res.status(201).json(one);
    }

    if (req.method === 'PUT') {
      // mark private thread read by admin
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { action, student_id } = req.body || {};
      if (action === 'mark_read' && student_id) {
        const { error } = await supabase.from('chat_messages').update({ read_by_admin: true }).eq('scope', 'private').eq('student_id', student_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('chat_messages').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('chat API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
