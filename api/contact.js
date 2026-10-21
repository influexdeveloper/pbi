const TO = ['admin@pixelbuilderinc.com', 'dev@pixelbuilderinc.com'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'method' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const token = b['cf-turnstile-response'];
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const key = process.env.RESEND_API_KEY;
  if (!secret || !key) return res.status(500).json({ success: false, error: 'missing env' });
  if (!token || !b.name || !b.email || !b.message) return res.status(400).json({ success: false, error: 'invalid' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip })
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!v.success) return res.status(403).json({ success: false, error: 'captcha' });
  const from = process.env.RESEND_FROM || 'Pixel Builder Website <noreply@pixelbuilderinc.com>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      from, to: TO, reply_to: b.email,
      subject: 'New inquiry from the Pixel Builder website',
      html: '<p><b>Name:</b> ' + esc(b.name) + '</p><p><b>Email:</b> ' + esc(b.email) + '</p><p><b>Project details:</b></p><p>' + esc(b.message).replace(/\n/g, '<br>') + '</p>'
    })
  }).catch(() => null);
  if (!r || !r.ok) {
    const t = r ? await r.text().catch(() => '') : 'network';
    console.error('resend failed', r && r.status, t);
    return res.status(502).json({ success: false });
  }
  return res.status(200).json({ success: true });
};
