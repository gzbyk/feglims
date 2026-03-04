exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } 
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { to_email, to_name, subject, message, lab_name, app_url, reply_to } = body;

  if (!to_email || !subject || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; background:#f0f4f8; font-family: 'Segoe UI', sans-serif; }
  .wrapper { max-width:580px; margin:32px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:linear-gradient(135deg, #0a0f1e 0%, #0d1f3c 100%); padding:28px 36px; }
  .logo { font-family: monospace; font-size:22px; font-weight:700; color:#00e5b0; letter-spacing:3px; }
  .logo-sub { font-size:11px; color:#4a7fa0; margin-top:4px; letter-spacing:1px; }
  .body { padding:32px 36px; }
  .greeting { font-size:16px; font-weight:600; color:#1a2f4a; margin-bottom:16px; }
  .message { font-size:14px; color:#3d5a7a; line-height:1.7; white-space:pre-wrap; background:#f8fafc; border-left:3px solid #00e5b0; padding:16px 20px; border-radius:0 8px 8px 0; margin-bottom:24px; }
  .meta { font-size:12px; color:#7a9ab0; border-top:1px solid #e8f0f7; padding-top:16px; }
  .meta-row { display:flex; justify-content:space-between; margin-bottom:6px; }
  .btn { display:inline-block; margin-top:20px; padding:11px 24px; background:#00e5b0; color:#0a0f1e; border-radius:8px; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:.5px; }
  .footer { background:#f8fafc; padding:18px 36px; text-align:center; font-size:11px; color:#9ab0c0; border-top:1px solid #e8f0f7; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">FEGLIMS</div>
    <div class="logo-sub">Functional &amp; Evolutionary Genetics Laboratory</div>
  </div>
  <div class="body">
    <div class="greeting">Merhaba / Hello${to_name ? ` ${to_name}` : ''},</div>
    <div class="message">${message}</div>
    <div class="meta">
      ${lab_name ? `<div class="meta-row"><span>Laboratuvar / Laboratory:</span><span><b>${lab_name}</b></span></div>` : ''}
      <div class="meta-row"><span>Tarih / Date:</span><span>${new Date().toLocaleString('tr-TR')}</span></div>
    </div>
    ${app_url ? `<a href="${app_url}" class="btn">Sisteme Giriş / Open System →</a>` : ''}
  </div>
  <div class="footer">
    Bu e-posta FEGLIMS tarafından otomatik gönderilmiştir.<br>
    This email was automatically sent by FEGLIMS Laboratory Information Management System.
  </div>
</div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'FEGLIMS <onboarding@resend.dev>',
        to: [to_email],
        reply_to: reply_to || undefined,
        subject: `FEGLIMS — ${subject}`,
        html
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Resend error');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, id: data.id })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
