import supabase from './db-client.js';

// Litmus AI — student learning assistant + website guide.
// Uses OpenAI when OPENAI_API_KEY is configured; otherwise answers from a
// built-in academy knowledge base + study-topic explanations.

const SITE_GUIDE = `
You are Litmus AI, the friendly study companion inside the De-Litmus Academy website.
ACADEMY FACTS (use when asked about the website):
- De-Litmus Academy ("We Keep Moving") serves University (100/200/300 level), WAEC and JAMB students.
- Student portal pages: Dashboard, My Quiz Codes, Buy Quiz Code, Take a Quiz (CBT Quiz), My Payments, My Scores, Chat with Admin, AI Tutor, Profile.
- To take a quiz: buy a quiz code (Pay by bank transfer, upload receipt), wait for AI/admin approval, then go to CBT Quiz, enter the code, enable camera + mic, and start. Camera watches eyes/face; noise triggers audible warnings; 20 warnings auto-submits the quiz.
- Materials: PDFs/images in the Library. Paid books unlock after payment approval. Reading happens INSIDE the website reader — no downloads.
- Payments: transfer to the academy's linked bank account shown on the buy page, enter amount + transfer reference, upload receipt. AI verifies clean payments instantly; others wait for admin review.
- Group chat: /group-chat page, open room moderated by admin, has a copyable group link.
- Private admin chat: portal "Chat with Admin" page; admin replies from admin Chats panel.
- Notifications: admin broadcasts appear as a bell icon in the navbar for logged-in students.
- Contact: phone 08106852839, address Beside Noble Hostel before Chemistry Lab Presco Campus, WhatsApp group link in footer/chat widget.
- Registration number is optional at signup. Students register with name, email, password; login with email + password or Google.
STYLE: warm, concise, step-by-step when explaining website flows. Use short paragraphs and simple lists. Never reveal admin secrets (no admin URL, no admin password, no bank details beyond telling students to check the buy page).
For study questions (any subject/topic), explain clearly with examples, then offer a quick practice question.
Keep answers under ~220 words unless the student asks for detail.
`.trim();

function localAnswer(question, studentName) {
  const q = String(question || '').toLowerCase();
  const name = studentName ? ` ${String(studentName).split(' ')[0]}` : '';

  const has = (...words) => words.some((w) => q.includes(w));

  if (has('quiz code', 'buy code', 'buy a code', 'purchase code', 'get code')) {
    return `Great question${name}! Here's how to get a quiz code:\n\n1. Open the portal and tap "Buy Quiz Code".\n2. Pick your quiz — you'll see the academy's bank account.\n3. Transfer the exact amount, then enter the amount + transfer reference.\n4. Upload your payment receipt (photo/PDF) and submit.\n5. The AI verifies clean payments instantly; others wait for admin approval.\n6. Your code appears under "My Quiz Codes" — copy it into the CBT Quiz hall.\n\nNeed help with a stuck payment? Check "My Payments" or message the admin in "Chat with Admin".`;
  }
  if (has('warning', '20', 'auto-submit', 'noise', 'camera', 'cheat', 'proctor')) {
    return `Here's how exam monitoring works${name}:\n\n- Your camera and microphone stay ON during the quiz.\n- Looking away, leaving the frame, switching tabs, or loud noise raises an audible spoken warning.\n- Each offence counts: warning 1, 2, 3… up to 20.\n- At 20 warnings the quiz SUBMITS AUTOMATICALLY — no extra chances.\n\nTips: sit in good light, face the screen, keep the room silent, and stay in fullscreen. Good luck!`;
  }
  if (has('score', 'result', 'mark', 'grade', 'pass')) {
    return `Your scores appear instantly after each quiz${name}!\n\n- Open "My Scores" in the portal for full history, percentages and pass/fail.\n- The admin also reviews every attempt, including warnings.\n- Most quizzes pass at 50% — check the quiz card for its pass mark.\n\nWant study tips for your next attempt? Tell me the subject!`;
  }
  if (has('material', 'book', 'pdf', 'download', 'read', 'library')) {
    return `About materials${name}:\n\n- Browse the Library by keyword, level (100/200/300/WAEC/JAMB) and department.\n- FREE items open instantly; paid books need payment + AI/admin approval first.\n- Reading happens INSIDE the website reader — downloads are disabled to protect authors.\n- Every book/quiz card has Copy Link + Preview for sharing.\n\nTell me a subject and I'll suggest what to study first!`;
  }
  if (has('payment', 'pay', 'bank', 'transfer', 'receipt', 'approve', 'verify')) {
    return `Payments made simple${name}:\n\n1. Go to Buy Quiz Code (or Buy on any paid book).\n2. Transfer to the linked academy account shown there.\n3. Enter the exact amount + your transfer reference.\n4. Upload the receipt and submit.\n5. AI approves clean payments instantly; anything flagged waits for the admin.\n\nTrack everything under "My Payments" with live status.`;
  }
  if (has('register', 'sign up', 'signup', 'account', 'login', 'password', 'email', 'matric', 'registration number')) {
    return `Accounts 101${name}:\n\n- Join free with name, email and password (registration number is optional).\n- Login with email + password, or Continue with Google.\n- Forgot your password? Message the admin via "Chat with Admin" or WhatsApp (08106852839) — the admin can reset it for you.\n- Add a profile photo anytime under Profile.`;
  }
  if (has('group chat', 'group', 'chat with admin', 'private chat', 'message admin', 'notification', 'bell')) {
    return `Chatting & updates${name}:\n\n- Group Chat page: open room for all students (copy the group link to invite friends). Admin moderates it.\n- "Chat with Admin" in your portal: private 1-on-1 support, admin replies from their dashboard.\n- The bell icon in the navbar shows admin announcements — check it often!\n- There's also a floating chat button linking to WhatsApp (08106852839) and the academy's address: Beside Noble Hostel, before Chemistry Lab, Presco Campus.`;
  }
  if (has('waec')) {
    return `WAEC prep with me${name}! Pick a subject (e.g. English, Maths, Biology, Chemistry, Physics, Economics) and tell me the topic — I'll explain it simply, give examples, then quiz you. For the academy: WAEC materials and CBT quizzes are in the Library/Quiz Centre filtered by the WAEC category. What should we study first?`;
  }
  if (has('jamb', 'utme')) {
    return `JAMB/UTME prep mode${name}! Tell me your subject + topic (e.g. "JAMB Physics: motion") and I'll explain, show shortcuts, and drill you with practice questions. The academy also has JAMB-category quizzes and solved materials. Which subject first?`;
  }
  if (has('photo', 'picture', 'avatar', 'profile picture')) {
    return `To add your photo${name}: open Profile in the portal, tap the camera icon on the avatar, choose a JPG/PNG (max 5MB) — it uploads instantly and shows in the navbar, chats and group room.`;
  }
  if (has('hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening')) {
    return `Hello${name}! Great to see you. I can:\n\n- Explain how anything on this website works (codes, payments, quizzes, scores)\n- Teach any study topic step-by-step\n- Quiz you for WAEC, JAMB or university exams\n\nWhat shall we do first?`;
  }
  if (has('thank')) {
    return `You're welcome${name}! Keep moving — that's the academy spirit. Ask me anything else, anytime.`;
  }
  if (has('who are you', 'your name', 'litmus')) {
    return `I'm Litmus AI${name} — your study companion inside De-Litmus Academy. I answer website questions and teach any subject. The human admin is reachable via "Chat with Admin", phone 08106852839, or the WhatsApp group. What can I help with?`;
  }

  // Generic study fallback: structured learning response
  const topic = String(question).trim().slice(0, 140);
  return `Let's learn: "${topic}"${name}!\n\n1. KEY IDEA — Tell me which subject this belongs to (Maths, English, Physics, Chemistry, Biology, Economics…) and I'll break it into simple steps.\n2. EXAMPLE — I'll walk through a worked example.\n3. PRACTICE — I'll quiz you with 2–3 quick questions.\n\nFor academy help, ask things like "how do I buy a quiz code?" or "how do warnings work?". Which subject is "${topic}" for?`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, student_name, history } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'Question is required' });
    const q = String(question).trim().slice(0, 1000);

    // Light touch of DB context: live counts for smarter answers
    let counts = '';
    try {
      const [{ count: mats }, { count: quizzes }] = await Promise.all([
        supabase.from('materials_v2').select('id', { count: 'exact', head: true }),
        supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('is_published', true),
      ]);
      counts = `\nLIVE STATS: ${mats || 0} materials, ${quizzes || 0} published quizzes.`;
    } catch {}

    if (process.env.OPENAI_API_KEY) {
      try {
        const msgs = [
          { role: 'system', content: SITE_GUIDE + counts },
          ...(Array.isArray(history) ? history.slice(-8) : []),
          { role: 'user', content: q },
        ];
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: msgs, temperature: 0.6, max_tokens: 600 }),
        });
        if (!r.ok) throw new Error('AI service unavailable');
        const data = await r.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return res.status(200).json({ answer: text, method: 'openai' });
        throw new Error('Empty AI reply');
      } catch (e) {
        console.warn('ai-tutor openai failed, using local brain:', e.message);
      }
    }

    return res.status(200).json({ answer: localAnswer(q, student_name), method: 'local' });
  } catch (err) {
    console.error('ai-tutor API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
