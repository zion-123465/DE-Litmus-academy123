import supabase from './db-client.js';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categoryLabel(level) {
  const v = String(level || '').trim();
  if (!v) return '';
  if (['WAEC', 'JAMB', 'NECO', 'NABTEB'].includes(v.toUpperCase())) return v.toUpperCase();
  if (/^\d+$/.test(v)) return `${v} Level`;
  return v;
}

function money(n) {
  const v = Number(n) || 0;
  return '₦' + v.toLocaleString('en-NG');
}

export default async function handler(req, res) {
  try {
    const { kind, id } = req.query;
    const ua = String(req.headers['user-agent'] || '');
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${proto}://${host}`;
    const isBot = /whatsapp|telegram|twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|viber|skype|applebot|googlebot|bingbot|crawler|spider|embed/i.test(ua);

    // Build the destination app URL (client route that renders the rich card)

    // Real browsers: redirect straight to the in-app share page.
    // NOTE: /s/* itself rewrites to THIS function, so redirecting back to
    // /s/* would loop forever. Instead redirect to /share/<kind>/<id>,
    // which the SPA rewrite serves as index.html (client route below).
    if (!isBot) {
      const dest = (kind === 'quiz' || kind === 'material') && id ? `${base}/share/${kind}/${id}` : base + '/';
      res.writeHead(302, { Location: dest });
      return res.end();
    }

    // Crawlers/bots: serve Open Graph HTML so pasted links unfurl with preview

    let title = 'De-Litmus Academy — We Keep Moving';
    let desc = 'Premium study materials, proctored CBT quizzes and secure payments for University, WAEC and JAMB students.';
    let image = `${base}/og-image.jpg`;
    let url = `${base}/s/${kind || 'quiz'}/${id || ''}`;
    if ((kind === 'quiz' || kind === 'material') && id) {
      const table = kind === 'quiz' ? 'quizzes' : 'materials_v2';
      const { data } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (data) {
        if (kind === 'quiz') {
          title = `${data.title} — De-Litmus Academy Quiz`;
          const parts = [categoryLabel(data.level), data.department].filter(Boolean);
          desc = `${parts.join(' · ')} — ${data.duration_minutes || 30} mins, pass ${data.pass_mark || 50}%. Buy a code and take this proctored CBT exam.`;
          image = LOGO_URL; // quiz links show the academy logo/picture
          url = `${base}/s/quiz/${data.id}`;
        } else {
          title = `${data.title} — De-Litmus Academy Material`;
          const parts = [categoryLabel(data.level), data.department].filter(Boolean);
          const price = data.is_free || Number(data.price) <= 0 ? 'FREE' : money(data.price);
          desc = `${parts.join(' · ')} — ${price}. ${data.description || 'Study material from the Academy Library.'}`.slice(0, 200);
          // material links carry the material's own cover/file picture
          image = data.cover_url || (data.file_type === 'image' ? data.file_url : LOGO_URL);
          url = `${base}/s/material/${data.id}`;
        }
      }
    }

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="De-Litmus Academy" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${esc(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(url)}" />
</head>
<body style="margin:0;background:#0c0633;color:#f7cd4d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<p>Opening De-Litmus Academy… <a style="color:#f7cd4d" href="${esc(url)}">Continue</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(html);
  } catch (err) {
    console.error('share API error:', err);
    return res.status(500).send('Share preview unavailable');
  }
}
