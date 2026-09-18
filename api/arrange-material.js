import supabase from './db-client.js';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

// Local formatter: turns pasted raw text into clean, well-arranged study
// material (title-case headings, numbered points, trimmed lines).
function arrangeLocal(text, title) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ') });
      para = [];
    }
  };

  for (const line of lines) {
    // Heading-ish: short, ends with colon, ALL CAPS, or numbered section
    if (
      /^(chapter|section|part|unit|topic|module|lesson)\s+\d+/i.test(line) ||
      (line.length <= 70 && /:$/.test(line)) ||
      (line.length <= 60 && line === line.toUpperCase() && /[A-Z]{3,}/.test(line))
    ) {
      flush();
      blocks.push({ type: 'h', text: line.replace(/:$/, '') });
    } else if (/^(\d+[.)\-:]\s+|[-*•]\s+)/.test(line)) {
      flush();
      blocks.push({ type: 'li', text: line.replace(/^(\d+[.)\-:]\s+|[-*•]\s+)/, '') });
    } else if (line.length <= 80 && /^[A-Z0-9][^.!?]*$/.test(line) && blocks.length && blocks[blocks.length - 1].type !== 'h') {
      // Short standalone line after content — treat as subheading
      flush();
      blocks.push({ type: 'h2', text: line });
    } else {
      para.push(line);
    }
  }
  flush();

  return {
    title: String(title || 'Study Material').trim(),
    blocks: blocks.length ? blocks : [{ type: 'p', text: String(text).trim() }],
  };
}

async function arrangeOpenAI(text, title) {
  const prompt =
    `You are a study-material editor for De-Litmus Academy. Arrange the pasted raw text into a clean, well-structured study note. ` +
    `Reply with ONLY valid JSON: {"title":"...","blocks":[{"type":"h|h2|p|li|quote","text":"..."}]}. ` +
    `Rules: fix obvious typos, split long walls of text into short paragraphs, turn lists into "li" items, detect headings as "h"/"h2", keep all facts, never invent new facts, keep it exam-focused.\n\n` +
    `TITLE: ${title}\n\nRAW TEXT:\n${String(text).slice(0, 12000)}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error('AI service unavailable');
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : [])
    .filter((b) => b && b.text)
    .map((b) => ({
      type: ['h', 'h2', 'p', 'li', 'quote'].includes(b.type) ? b.type : 'p',
      text: String(b.text).slice(0, 2000),
    }));
  if (!blocks.length) throw new Error('AI returned no content');
  return { title: String(parsed.title || title || 'Study Material'), blocks };
}

// POST /api/arrange-material { pasted_text, title } (admin)
// Returns { title, blocks[] } — AI-arranged study content.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
    const { pasted_text, title } = req.body || {};
    if (!pasted_text || String(pasted_text).trim().length < 20) {
      return res.status(400).json({ error: 'Paste the material text first (at least a few sentences).' });
    }
    if (process.env.OPENAI_API_KEY) {
      try {
        const arranged = await arrangeOpenAI(pasted_text, title);
        return res.status(200).json({ ...arranged, method: 'openai' });
      } catch (e) {
        console.warn('arrange-material openai failed, using local formatter:', e.message);
      }
    }
    return res.status(200).json({ ...arrangeLocal(pasted_text, title), method: 'smart-format' });
  } catch (err) {
    console.error('arrange-material API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
