import { createHmac } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MODERATION_SECRET = process.env.MODERATION_SECRET;
const MODERATOR_EMAIL = process.env.MODERATOR_EMAIL || 'boughtonbd@gmail.com';
const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

function generateToken(publicIds) {
  const payload = publicIds.slice().sort().join(',');
  return createHmac('sha256', MODERATION_SECRET).update(payload).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { publicIds } = req.body;
    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({ error: 'publicIds array required' });
    }

    const token = generateToken(publicIds);
    const idsParam = encodeURIComponent(JSON.stringify(publicIds));

    const approveUrl = `${SITE_URL}/api/moderate?action=approve&ids=${idsParam}&token=${token}`;
    const rejectUrl = `${SITE_URL}/api/moderate?action=reject&ids=${idsParam}&token=${token}`;

    // Build per-photo HTML with individual approve/reject links
    const photoRows = publicIds.map(id => {
      const thumbUrl = cloudinary.url(id, {
        transformation: [
          { width: 500, height: 400, crop: 'fill' },
          { quality: 'auto' },
          { fetch_format: 'jpg' }
        ]
      });
      const singleIds = encodeURIComponent(JSON.stringify([id]));
      const singleToken = generateToken([id]);
      const approveOne = `${SITE_URL}/api/moderate?action=approve&ids=${singleIds}&token=${singleToken}`;
      const rejectOne = `${SITE_URL}/api/moderate?action=reject&ids=${singleIds}&token=${singleToken}`;
      const displayName = id.split('/').pop().replace(/_/g, ' ');

      return `
        <div style="margin-bottom:20px;border:1px solid #e0ddd5;border-radius:8px;overflow:hidden;background:white;">
          <img src="${thumbUrl}" alt="" style="width:100%;max-width:500px;display:block;" />
          <div style="padding:10px 14px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;">${displayName}</p>
            <a href="${approveOne}" style="display:inline-block;background:#2e6b3e;color:white;padding:8px 16px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:13px;margin-right:8px;">
              Approve
            </a>
            <a href="${rejectOne}" style="display:inline-block;background:#c0392b;color:white;padding:8px 16px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:13px;">
              Reject
            </a>
          </div>
        </div>`;
    }).join('');

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
        <h2 style="color:#1e4d2b;">New Photos Pending Review</h2>
        <p>${publicIds.length} photo${publicIds.length === 1 ? '' : 's'} uploaded to Treasure Island Camp:</p>
        <div style="margin:20px 0;">
          <a href="${approveUrl}" style="display:inline-block;background:#2e6b3e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:12px;">
            Approve All
          </a>
          <a href="${rejectUrl}" style="display:inline-block;background:#c0392b;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Reject All
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e0ddd5;margin:20px 0;" />
        ${photoRows}
        <p style="font-size:13px;color:#888;">Photos remain hidden until approved.</p>
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
        subject: `${publicIds.length} new photo${publicIds.length === 1 ? '' : 's'} pending review`,
        html: emailHtml,
        tracking: { click: false },
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('Resend error:', errText);
      // Don't fail the upload — photos are saved, email just didn't send
      return res.status(200).json({ sent: false, error: 'Email failed but photos saved' });
    }

    res.status(200).json({ sent: true });
  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}
