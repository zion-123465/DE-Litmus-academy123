import supabase from './db-client.js';

// Student-to-student private chats gated by chat requests.
// A student must send a request; the other must accept before either
// can message. Admins bypass requests entirely.
// Tables: chat_requests(id, from_id, to_id, status, created_at)
//         dm_messages(id, scope='dm', student_id=sender, peer_id, ...)

// reuse enrich/attach from same module shape
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
  const ids = [...new Set(enriched.flatMap((r) => [r.student_id, r.peer_id]).filter(Boolean))];
  if (!ids.length) return enriched.map((r) => ({ ...r, student: null, peer: null }));
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, avatar_url, matric_no, level, department, phone, email')
    .in('id', ids);
  const map = Object.fromEntries((students || []).map((s) => [s.id, s]));
  return enriched.map((r) => ({
    ...r,
    student: r.student_id ? map[r.student_id] || null : null,
    peer: r.peer_id ? map[r.peer_id] || null : null,
  }));
}

async function pairAccepted(a, b) {
  const { data } = await supabase
    .from('chat_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`)
    .limit(1);
  return !!(data && data.length);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ---- REQUESTS ----
    // GET /api/dm?action=requests&student_id=X -> incoming pending + my sent
    // POST /api/dm { action:'request', from_id, to_id }
    // PUT /api/dm { action:'accept'|'decline', id, student_id }
    // ---- MESSAGES ----
    // GET /api/dm?action=thread&me=X&peer=Y (requires accepted request)
    // GET /api/dm?action=threads&student_id=X (my accepted conversations)
    // POST /api/dm { action:'send', scope:'dm', from_id, to_id, message, kind?, attachment_url?, attachment_name?, reply_to? }
    if (req.method === 'GET') {
      const { action, student_id, me, peer, limit } = req.query;

      if (action === 'requests' && student_id) {
        const sid = Number(student_id);
        const { data, error } = await supabase
          .from('chat_requests')
          .select('*')
          .or(`to_id.eq.${sid},from_id.eq.${sid}`)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        const ids = [...new Set((data || []).flatMap((r) => [r.from_id, r.to_id]))];
        const { data: students } = ids.length
          ? await supabase.from('students').select('id, full_name, avatar_url, level, department').in('id', ids)
          : { data: [] };
        const map = Object.fromEntries((students || []).map((s) => [s.id, s]));
        return res.status(200).json(
          (data || []).map((r) => ({ ...r, from: map[r.from_id] || null, to: map[r.to_id] || null }))
        );
      }

      if (action === 'thread' && me && peer) {
        const a = Number(me);
        const b = Number(peer);
        if (!(await pairAccepted(a, b))) return res.status(403).json({ error: 'No accepted chat request between you two yet.' });
        const { data, error } = await supabase
          .from('dm_messages')
          .select('*')
          .or(`and(student_id.eq.${a},peer_id.eq.${b}),and(student_id.eq.${b},peer_id.eq.${a})`)
          .order('id', { ascending: true })
          .limit(Math.min(parseInt(limit) || 200, 300));
        if (error) throw error;
        return res.status(200).json(await attachStudents(data || []));
      }

      if (action === 'threads' && student_id) {
        const sid = Number(student_id);
        const { data, error } = await supabase
          .from('dm_messages')
          .select('*')
          .or(`student_id.eq.${sid},peer_id.eq.${sid}`)
          .order('id', { ascending: false })
          .limit(500);
        if (error) throw error;
        const map = {};
        for (const m of data || []) {
          const other = Number(m.student_id) === sid ? Number(m.peer_id) : Number(m.student_id);
          if (!other) continue;
          if (!map[other]) map[other] = { peer_id: other, last: m, unread: 0 };
          if (Number(m.student_id) !== sid && !m.read_by_peer) map[other].unread += 1;
        }
        const list = Object.values(map);
        const ids = list.map((t) => t.peer_id);
        const { data: students } = ids.length
          ? await supabase.from('students').select('id, full_name, avatar_url, level, department').in('id', ids)
          : { data: [] };
        const sMap = Object.fromEntries((students || []).map((s) => [s.id, s]));
        return res.status(200).json(list.map((t) => ({ ...t, peer: sMap[t.peer_id] || null })));
      }

      return res.status(400).json({ error: 'Provide action=requests|thread|threads' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action === 'request') {
        const from_id = Number(body.from_id);
        const to_id = Number(body.to_id);
        if (!from_id || !to_id) return res.status(400).json({ error: 'from_id and to_id are required' });
        if (from_id === to_id) return res.status(400).json({ error: 'You cannot message yourself' });
        const { data: existing } = await supabase
          .from('chat_requests')
          .select('*')
          .or(`and(from_id.eq.${from_id},to_id.eq.${to_id}),and(from_id.eq.${to_id},to_id.eq.${from_id})`)
          .limit(5);
        const open = (existing || []).find((r) => r.status === 'pending' || r.status === 'accepted');
        if (open) {
          return res.status(200).json({ ...open, already: true });
        }
        // revive a declined one by resetting to pending
        const declined = (existing || []).find((r) => r.status === 'declined' && r.from_id === from_id && r.to_id === to_id);
        if (declined) {
          const { data, error } = await supabase.from('chat_requests').update({ status: 'pending' }).eq('id', declined.id).select().single();
          if (error) throw error;
          return res.status(200).json(data);
        }
        const { data, error } = await supabase.from('chat_requests').insert({ from_id, to_id, status: 'pending' }).select().single();
        if (error) throw error;
        return res.status(201).json(data);
      }

      if (body.action === 'send') {
        const { from_id, to_id, message, kind, attachment_url, attachment_name, reply_to } = body;
        const a = Number(from_id);
        const b = Number(to_id);
        if (!a || !b) return res.status(400).json({ error: 'from_id and to_id are required' });
        if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required' });
        if (!(await pairAccepted(a, b))) return res.status(403).json({ error: 'Chat request not accepted yet.' });
        const k = ['text', 'image', 'file', 'voice'].includes(kind) ? kind : 'text';
        let textBody = String(message).trim().slice(0, 2000);
        if (k === 'image' && attachment_url) textBody += `\n[img]${String(attachment_url).slice(0, 500)}`;
        if (k === 'file' && attachment_url) textBody += `\n[file]${String(attachment_url).slice(0, 500)}|${String(attachment_name || 'file').slice(0, 120)}`;
        if (k === 'voice' && attachment_url) textBody += `\n[voice]${String(attachment_url).slice(0, 500)}`;
        if (reply_to && typeof reply_to === 'object' && reply_to.id) {
          textBody += `\n[reply]${reply_to.id}|${String(reply_to.name || '').slice(0, 60)}|${String(reply_to.text || '').slice(0, 120)}`;
        }
        const { data, error } = await supabase.from('dm_messages').insert({
          student_id: a,
          peer_id: b,
          sender_name: '',
          message: textBody,
          read_by_peer: false,
        }).select().single();
        if (error) throw error;
        const [one] = await attachStudents([{ ...data, sender_role: 'student' }]);
        return res.status(201).json(one);
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'PUT') {
      const { action, id, student_id } = req.body || {};
      if ((action === 'accept' || action === 'decline') && id && student_id) {
        const { data: req2 } = await supabase.from('chat_requests').select('*').eq('id', id).maybeSingle();
        if (!req2) return res.status(404).json({ error: 'Request not found' });
        if (Number(req2.to_id) !== Number(student_id)) return res.status(403).json({ error: 'Only the recipient can respond' });
        const { data, error } = await supabase.from('chat_requests').update({ status: action === 'accept' ? 'accepted' : 'declined' }).eq('id', id).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (action === 'mark_read' && student_id) {
        // mark messages sent TO me as read
        const { error } = await supabase.from('dm_messages').update({ read_by_peer: true }).eq('peer_id', Number(student_id));
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'DELETE') {
      // cancel/withdraw own pending request
      const { id, student_id } = req.body || {};
      if (!id || !student_id) return res.status(400).json({ error: 'id and student_id are required' });
      const { data: req2 } = await supabase.from('chat_requests').select('*').eq('id', id).maybeSingle();
      if (!req2) return res.status(404).json({ error: 'Request not found' });
      if (Number(req2.from_id) !== Number(student_id)) return res.status(403).json({ error: 'Only the sender can withdraw' });
      const { error } = await supabase.from('chat_requests').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('dm API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
