import { createHmac } from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MODERATION_SECRET = process.env.MODERATION_SECRET;
const MODERATOR_EMAIL = process.env.MODERATOR_EMAIL || 'boughtonbd@gmail.com';
const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

function generateEditToken(personId, field, value) {
  const payload = JSON.stringify({ personId, field, value });
  return createHmac('sha256', MODERATION_SECRET).update(payload).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { personId, field, value } = req.body;

    if (!personId || !field || value === undefined) {
      return res.status(400).json({ error: 'personId, field, and value are required' });
    }

    // Whitelist of editable fields
    const allowedFields = ['nicknames', 'bio', 'birth_year', 'birth_place', 'death_year', 'death_place', 'maiden_name'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Field not editable: ' + field });
    }

    const token = generateEditToken(personId, field, value);

    // Encode entire payload as base64url to avoid Resend click tracking breaking multi-param URLs
    const approvePayload = Buffer.from(JSON.stringify({ action: 'approve-edit', personId, field, value, token })).toString('base64url');
    const rejectPayload = Buffer.from(JSON.stringify({ action: 'reject-edit', personId, field, value, token })).toString('base64url');

    const approveUrl = `${SITE_URL}/api/moderate?d=${approvePayload}`;
    const rejectUrl = `${SITE_URL}/api/moderate?d=${rejectPayload}`;

    // Format the value for display in email
    let displayValue;
    if (Array.isArray(value)) {
      displayValue = value.length > 0 ? value.join(', ') : '<em>(empty)</em>';
    } else if (value === null || value === '') {
      displayValue = '<em>(cleared)</em>';
    } else {
      displayValue = String(value);
    }

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
        <h2 style="color:#1e4d2b;">Profile Edit Pending Review</h2>
        <p>Someone wants to update a profile on Treasure Island Camp:</p>

        <div style="background:#f5f0e6;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;"><strong>Person:</strong> ${personId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
          <p style="margin:0 0 8px;"><strong>Field:</strong> ${field}</p>
          <p style="margin:0;"><strong>New value:</strong> ${displayValue}</p>
        </div>

        <div style="margin:20px 0;">
          <a href="${approveUrl}" style="display:inline-block;background:#2e6b3e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:12px;">
            Approve
          </a>
          <a href="${rejectUrl}" style="display:inline-block;background:#c0392b;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Reject
          </a>
        </div>

        <p style="font-size:13px;color:#888;">Changes won't appear on the site until approved.</p>
      </div>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Treasure Island Camp <onboarding@resend.dev>',
        to: [MODERATOR_EMAIL],
        subject: `Profile edit pending: ${field} for ${personId.replace(/-/g, ' ')}`,
        html: emailHtml,
        tracking: { click: false },
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('Resend error:', errText);
      return res.status(200).json({ sent: false, error: 'Email failed' });
    }

    res.status(200).json({ sent: true });
  } catch (error) {
    console.error('Profile edit notify error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}
