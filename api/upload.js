import supabase from './db-client.js';

const BUCKET = 'academy-files';

async function isAdmin(req) {
  const key = req.headers['x-admin-key'];
  if (!key) return false;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
  return !!data && data.value === key;
}

function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const { fileName, fileBase64, contentType, folder } = req.body || {};
      if (!fileName || !fileBase64) return res.status(400).json({ error: 'fileName and fileBase64 are required' });
      const buffer = Buffer.from(fileBase64, 'base64');
      if (buffer.length > 9 * 1024 * 1024) return res.status(400).json({ error: 'File too large. Maximum 9MB.' });
      const path = `${folder || 'uploads'}/${Date.now()}-${safeName(fileName)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: contentType || 'application/octet-stream', upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return res.status(200).json({ url: urlData.publicUrl, path });
    }
    if (req.method === 'DELETE') {
      if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required' });
      const { path } = req.body || {};
      if (!path) return res.status(400).json({ error: 'path is required' });
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('upload API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
