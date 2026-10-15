const TO = 'contact@pixelbuilderinc.com';
const CC = 'dev@pixelbuilderinc.com';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'method' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const token = b['cf-turnstile-response'];
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return res.status(500).json({ success: false, error: 'missing TURNSTILE_SECRET_KEY' });
  if (!token || !b.name || !b.email || !b.message) return res.status(400).json({ success: false, error: 'invalid' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip })
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!v.success) return res.status(403).json({ success: false, error: 'captcha' });
  const origin = 'https://' + (req.headers.host || 'pixelbuilderinc.com');
  const r = await fetch('https://formsubmit.co/ajax/' + TO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': origin, 'Referer': origin + '/' },
    body: JSON.stringify({ name: b.name, email: b.email, message: b.message, _subject: 'New inquiry from the Pixel Builder website', _cc: CC, _template: 'table', _captcha: 'false', _replyto: b.email })
  }).then(r => r.json()).catch(() => ({ success: false }));
  const ok = r.success === true || r.success === 'true';
  return res.status(ok ? 200 : 502).json({ success: ok });
};
