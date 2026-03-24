import { createHmac } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MODERATION_SECRET = process.env.MODERATION_SECRET;

function verifyToken(publicIds, token) {
  const payload = publicIds.slice().sort().join(',');
  const expected = createHmac('sha256', MODERATION_SECRET).update(payload).digest('hex');
  return expected === token;
}

function html(title, message, color) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f0e6; }
  .card { background: white; border-radius: 12px; padding: 2.5rem; text-align: center; max-width: 420px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
  h1 { color: ${color}; margin: 0 0 0.5rem; }
  p { color: #555; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const { action, ids, token } = req.query;

    if (!action || !ids || !token) {
      return res.status(400).send(html('Invalid Link', 'This moderation link is missing required parameters.', '#c0392b'));
    }

    let publicIds;
    try {
      publicIds = JSON.parse(decodeURIComponent(ids));
    } catch {
      return res.status(400).send(html('Invalid Link', 'Could not parse photo IDs.', '#c0392b'));
    }

    if (!verifyToken(publicIds, token)) {
      return res.status(403).send(html('Unauthorized', 'This moderation link is invalid or has been tampered with.', '#c0392b'));
    }

    if (action === 'approve') {
      let approved = 0;
      let skipped = 0;
      for (const id of publicIds) {
        try {
          await cloudinary.uploader.replace_tag('ti-slideshow', [id]);
          approved++;
        } catch {
          skipped++; // already deleted or doesn't exist
        }
      }
      const msg = skipped > 0
        ? `${approved} photo${approved === 1 ? '' : 's'} approved and now visible on the site. ${skipped} already removed.`
        : `${approved} photo${approved === 1 ? '' : 's'} approved and now visible on the site.`;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html('Photos Approved', msg, '#2e6b3e'));
    }

    if (action === 'reject') {
      let deleted = 0;
      let skipped = 0;
      for (const id of publicIds) {
        try {
          const result = await cloudinary.uploader.destroy(id, { invalidate: true });
          if (result.result === 'ok') deleted++;
          else skipped++;
        } catch {
          skipped++;
        }
      }
      const msg = skipped > 0
        ? `${deleted} photo${deleted === 1 ? '' : 's'} deleted. ${skipped} already removed.`
        : `${deleted} photo${deleted === 1 ? '' : 's'} deleted.`;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html('Photos Rejected', msg, '#c0392b'));
    }

    return res.status(400).send(html('Invalid Action', 'Action must be "approve" or "reject".', '#c0392b'));
  } catch (error) {
    console.error('Moderate error:', error);
    res.status(500).send(html('Error', 'Something went wrong processing your request. Please try again.', '#c0392b'));
  }
}
