import supabase from './db-client.js';

// AI-assisted answer detection for quiz questions.
// If OPENAI_API_KEY is configured (Secrets tab), the question is checked by
// an AI model. Otherwise a built-in smart heuristic scores each option.

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

const STOP = new Set(('the,a,an,of,to,in,is,are,was,were,be,been,for,on,with,that,this,these,those,it,its,as,at,by,from,or,and,which,what,when,where,who,whom,how,why,do,does,did,not,no,an,into,than,then,so,such,following,___').split(','));

function keywords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function heuristic(question, options) {
  const qKeys = keywords(question);
  let best = 'A';
  let bestScore = -1;
  const detail = {};
  const letters = ['A', 'B', 'C', 'D'];
  options.forEach((opt, i) => {
    const oKeys = keywords(opt);
    let score = 0;
    for (const k of oKeys) if (qKeys.includes(k)) score += 2;
    // penalise joke/empty options, reward specific (longer, numeric) answers
    if (!opt || !opt.trim()) score -= 10;
    if (/\d/.test(opt)) score += 1;
    if (opt && opt.trim().length > 60) score -= 1;
    detail[letters[i]] = score;
    if (score > bestScore) {
      bestScore = score;
      best = letters[i];
    }
  });
  const scores = Object.values(detail).sort((a, b) => b - a);
  const margin = (scores[0] ?? 0) - (scores[1] ?? 0);
  const confidence = Math.min(0.92, 0.45 + margin * 0.12);
  return {
    answer: best,
    confidence: Math.round(confidence * 100) / 100,
    explanation: `Heuristic match: option ${best} shares the most key terms with the question (${bestScore} pts vs next-best ${scores[1] ?? 0}). Please confirm before finalizing.`,
    method: 'smart-detect',
  };
}

// --- Pasted-text bulk parsing + per-question-number answer arrangement ---
// Accepts raw pasted exam text such as:
//   1. What is 2+2?  A) 3  B) 4  C) 5  D) 6  Answer: B
//   2) Capital of Nigeria? (a) Lagos (b) Abuja (c) Kano (d) Ibadan — Ans: b
// and returns numbered questions with options + detected answers.

function stripNumPrefix(line) {
  return String(line || '').replace(/^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\)\:\-\|]\s*/i, '').trim();
}

function extractAnswerKeyMap(text) {
  // Support a trailing/standalone answer key section, e.g.:
  //   ANSWERS: 1-B 2. C 3) A 4:A 5 = D
  //   Answer Key
  //   1. B  2. B  3. A ...
  const map = {};
  const keyIdx = String(text || '').search(/(?:answer\s*key|answers?)\s*[:\-]?\s*\n/im);
  const zone = keyIdx >= 0 ? String(text).slice(keyIdx) : String(text || '');
  const re = /(\d{1,3})\s*[\.\)\:\-\=]\s*\(?([A-Da-d])\)?/g;
  let m;
  while ((m = re.exec(zone)) !== null) {
    map[Number(m[1])] = m[2].toUpperCase();
  }
  return map;
}

function extractMarkedAnswer(block) {
  const pats = [
    /(?:correct\s*answer|answer|ans)\s*(?:is|:)?\s*\(?([A-Da-d])\)?(?![a-z])/i,
    /(?:correct|answer|key)\s*[\(<\[]?\s*([A-Da-d])\s*[\)>\]]?/i,
    /✓\s*\(?([A-Da-d])\)?/,
    /\(([A-Da-d])\)\s*(?:✓|✔|correct|answer)/i,
  ];
  for (const p of pats) {
    const m = block.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function cleanOpt(s) {
  return String(s || '')
    .replace(/^(?:correct\s*answer|answer|ans)\s*(?:is|:)?\s*\(?[A-Da-d]\)?.*$/gim, '')
    .replace(/[✓✔]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOptions(block) {
  // Strip a trailing "Answer: X" tail before option splitting so the key
  // never leaks into option D text.
  const noKeyTail = String(block || '').replace(/\s*(?:correct\s*answer|answer|ans)\s*(?:is|:)?\s*\(?[A-Da-d]\)?\s*\.?\s*$/i, '');
  const src = noKeyTail || block;
  // Try lettered options: A) ... B) ... C) ... D) ... (also A. A: (A) a))
  const lettered = src.match(/\(?[A-Da-d][\)\.\:\-][\s:.\-]+/g);
  if (lettered && lettered.length >= 2) {
    const parts = src.split(/\(?([A-Da-d])[\)\.\:\-][\s:.\-]+/);
    // parts: [stem, L1, text1, L2, text2, ...]
    const stem = stripNumPrefix(parts[0]);
    const opts = { A: '', B: '', C: '', D: '' };
    for (let i = 1; i + 1 < parts.length; i += 2) {
      const L = String(parts[i]).toUpperCase();
      if (opts[L] !== undefined && !opts[L]) opts[L] = cleanOpt(parts[i + 1]);
    }
    if (stem && opts.A && opts.B) return { stem, opts };
  }
  // Try numbered options: 1) 2) 3) 4) or i ii iii iv? keep simple: 1-4
  const numbered = src.match(/(?:^|\s)([1-4])\s*[\)\.\:]\s+/g);
  if (numbered && numbered.length >= 2) {
    const parts = src.split(/(?:^|\s)([1-4])\s*[\)\.\:]\s+/);
    const stem = stripNumPrefix(parts[0]);
    const letters = ['A', 'B', 'C', 'D'];
    const opts = { A: '', B: '', C: '', D: '' };
    let k = 0;
    for (let i = 1; i < parts.length && k < 4; i += 2, k++) {
      opts[letters[k]] = cleanOpt(parts[i + 1] || '');
    }
    if (stem && opts.A && opts.B) return { stem, opts };
  }
  // Try pipe-separated line: Question | A | B | C | D | ANSWER | marks
  if (src.includes('|')) {
    const cells = src.split('|').map((c) => c.trim());
    if (cells.length >= 3) {
      return {
        stem: stripNumPrefix(cells[0]),
        opts: { A: cells[1] || '', B: cells[2] || '', C: cells[3] || '', D: cells[4] || '' },
        pipeAnswer: (cells[5] || '').toUpperCase().charAt(0),
      };
    }
  }
  return null;
}

function splitIntoBlocks(text) {
  // Remove a trailing answer-key section from question splitting — it is
  // handled separately by extractAnswerKeyMap so keys never become questions.
  const keyAt = String(text || '').search(/^\s*(?:answer\s*key|answers?)\s*[:\-]?\s*$/im);
  const body = keyAt >= 0 ? String(text).slice(0, keyAt) : String(text || '');
  const lines = body.split('\n');
  const blocks = [];
  let cur = [];
  const startsQ = (l) => /^\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\)\:\-\|]\s+\S/i.test(l) && !/^\s*[A-Da-d1-4]\s*[\)\.\:]\s*/.test(l);
  for (const line of lines) {
    if (!line.trim()) {
      if (cur.length) {
        // blank line may separate questions; check next non-empty starts a question later
        cur.push('');
      }
      continue;
    }
    if (startsQ(line) && cur.join(' ').trim()) {
      blocks.push(cur.join('\n'));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.join(' ').trim()) blocks.push(cur.join('\n'));
  // If no numbered questions found, treat each non-empty line as one block (pipe format)
  if (blocks.length <= 1 && !/^\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\)\:\-\|]/im.test(text)) {
    const pipeLines = lines.map((l) => l.trim()).filter((l) => l.includes('|'));
    if (pipeLines.length) return pipeLines;
  }
  return blocks;
}

function parsePastedText(text) {
  const blocks = splitIntoBlocks(text);
  const keyMap = extractAnswerKeyMap(text); // number -> letter from "Answer Key" section
  const out = [];
  const unparsed = [];
  blocks.forEach((block, idx) => {
    const parsed = parseOptions(block.replace(/\n+/g, ' '));
    if (!parsed || !parsed.stem) {
      const preview = block.replace(/\s+/g, ' ').trim().slice(0, 90);
      if (preview) unparsed.push({ number: idx + 1, preview });
      return;
    }
    const { stem, opts } = parsed;
    let marked = extractMarkedAnswer(block);
    let markedSrc = marked ? 'inline key' : null;
    if (!marked && parsed.pipeAnswer && ['A', 'B', 'C', 'D'].includes(parsed.pipeAnswer)) {
      marked = parsed.pipeAnswer;
      markedSrc = 'pipe column';
    }
    if (!marked && keyMap[idx + 1]) {
      marked = keyMap[idx + 1];
      markedSrc = 'answer key section';
    }
    // Also try matching by the question's printed number (e.g. "12." when
    // some earlier blocks failed to parse).
    if (!marked) {
      const printed = (block.match(/^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\)\:\-\|]/i) || [])[1];
      if (printed && keyMap[Number(printed)]) {
        marked = keyMap[Number(printed)];
        markedSrc = 'answer key section';
      }
    }
    const h = heuristic(stem, [opts.A, opts.B, opts.C, opts.D]);
    out.push({
      number: idx + 1,
      question_text: stem,
      option_a: opts.A,
      option_b: opts.B,
      option_c: opts.C || '',
      option_d: opts.D || '',
      detected_answer: marked || h.answer,
      detection_method: marked ? 'marked-key' : h.method,
      confidence: marked ? 1 : h.confidence,
      explanation: marked
        ? `Answer key (${markedSrc}) says option ${marked}.`
        : h.explanation,
      marks: 1,
    });
  });
  return { questions: out, unparsed };
}

async function openaiArrange(text) {
  const prompt =
    `You are an exam formatting assistant. Parse the pasted exam text into numbered multiple-choice questions. ` +
    `Reply with ONLY valid JSON: {"questions":[{"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","detected_answer":"A|B|C|D","confidence":0-1,"explanation":"one short sentence"}]}. ` +
    `Detect the correct answer for each number: use any embedded answer key (Answer:/Ans:/✓), otherwise solve the question. ` +
    `Keep original wording. Skip anything that is not a question. Also honour a trailing "Answer Key" section (e.g. "1-B 2.C 3) A") when present.\n\nPASTED TEXT:\n${String(text).slice(0, 12000)}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error('AI service unavailable');
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed.questions) ? parsed.questions : [];
  return list
    .filter((q) => q && q.question_text && q.option_a && q.option_b)
    .map((q, i) => {
      const ans = String(q.detected_answer || 'A').toUpperCase().charAt(0);
      return {
        number: i + 1,
        question_text: String(q.question_text),
        option_a: String(q.option_a || ''),
        option_b: String(q.option_b || ''),
        option_c: String(q.option_c || ''),
        option_d: String(q.option_d || ''),
        detected_answer: ['A', 'B', 'C', 'D'].includes(ans) ? ans : 'A',
        detection_method: 'openai',
        confidence: Math.min(1, Math.max(0, Number(q.confidence) || 0.7)),
        explanation: String(q.explanation || 'AI model arranged and answered this question.'),
        marks: 1,
      };
    });
}

async function openaiDetect(question, options) {
  const letters = ['A', 'B', 'C', 'D'];
  const prompt =
    `You are an exam answer key assistant. Given the multiple-choice question and options, reply with ONLY valid JSON: {"answer":"A|B|C|D","confidence":0-1,"explanation":"one short sentence"} accounting for the correct choice.\n\nQuestion: ${question}\n` +
    options.map((o, i) => `${letters[i]}. ${o || '(blank)'}`).join('\n');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error('AI service unavailable');
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned no result');
  const parsed = JSON.parse(match[0]);
  const answer = String(parsed.answer || 'A').toUpperCase().charAt(0);
  if (!['A', 'B', 'C', 'D'].includes(answer)) throw new Error('AI returned invalid option');
  return {
    answer,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
    explanation: String(parsed.explanation || 'AI model selected the most likely correct option.'),
    method: 'openai',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
    const body = req.body || {};
    // NEW: paste-and-arrange mode — admin pastes raw exam text, AI numbers
    // each question and arranges the detected answer per number.
    if (body.mode === 'arrange' || body.pasted_text) {
      const text = body.pasted_text || '';
      if (!text || String(text).trim().length < 10) {
        return res.status(400).json({ error: 'Paste the exam text first (at least one full question).' });
      }
      if (process.env.OPENAI_API_KEY) {
        try {
          const arranged = await openaiArrange(text);
          if (arranged.length) return res.status(200).json({ questions: arranged, method: 'openai' });
        } catch (e) {
          console.warn('openai arrange failed, falling back to parser:', e.message);
        }
      }
      const arranged = parsePastedText(text);
      if (!arranged.questions.length) {
        return res.status(400).json({ error: 'Could not find numbered questions. Paste text like "1. Question? A) ... B) ... C) ... D) ..." with options.' });
      }
      return res.status(200).json({ questions: arranged.questions, unparsed: arranged.unparsed, method: arranged.questions[0]?.detection_method === 'marked-key' ? 'marked-key' : 'smart-detect' });
    }
    const { question_text, option_a, option_b, option_c, option_d } = body;
    if (!question_text || !option_a || !option_b) {
      return res.status(400).json({ error: 'question_text and at least options A and B are required' });
    }
    const options = [option_a, option_b, option_c || '', option_d || ''];
    if (process.env.OPENAI_API_KEY) {
      try {
        return res.status(200).json(await openaiDetect(question_text, options));
      } catch (e) {
        console.warn('openai detect failed, falling back to heuristic:', e.message);
      }
    }
    return res.status(200).json(heuristic(question_text, options));
  } catch (err) {
    console.error('ai-detect API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
