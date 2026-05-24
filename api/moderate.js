import { createHmac } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MODERATION_SECRET = process.env.MODERATION_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'TI-Camp';
const GITHUB_REPO = 'TI-Website';
const GITHUB_BRANCH = 'main';
const PROFILES_PATH = 'profiles.json';

function verifyToken(publicIds, token) {
  const payload = publicIds.slice().sort().join(',');
  const expected = createHmac('sha256', MODERATION_SECRET).update(payload).digest('hex');
  return expected === token;
}

function verifyEditToken(editData, token) {
  const payload = JSON.stringify({ personId: editData.personId, field: editData.field, value: editData.value });
  const expected = createHmac('sha256', MODERATION_SECRET).update(payload).digest('hex');
  return expected === token;
}

async function applyProfileEdit(editData) {
  // 1. Fetch current profiles.json from GitHub
  const getUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PROFILES_PATH}?ref=${GITHUB_BRANCH}`;
  const getResp = await fetch(getUrl, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!getResp.ok) {
    const err = await getResp.text();
    throw new Error('Failed to fetch profiles.json from GitHub: ' + err);
  }

  const fileData = await getResp.json();
  const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const profiles = JSON.parse(content);

  // 2. Apply the edit
  const { personId, field, value } = editData;
  if (!profiles[personId]) {
    // Create a new profile entry if it doesn't exist
    profiles[personId] = {
      name: personId.replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      maiden_name: null,
      nicknames: [],
      birth_year: null,
      birth_place: null,
      death_year: null,
      death_place: null,
      bio: null,
      generation: null,
      facts: []
    };
  }
  profiles[personId][field] = value;

  // 3. Commit updated profiles.json back to GitHub
  const updatedContent = Buffer.from(JSON.stringify(profiles, null, 2) + '\n').toString('base64');
  const displayName = personId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const putResp = await fetch(getUrl.split('?')[0], {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Update ${field} for ${displayName}`,
      content: updatedContent,
      sha: fileData.sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!putResp.ok) {
    const err = await putResp.text();
    throw new Error('Failed to commit profiles.json to GitHub: ' + err);
  }

  return true;
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
    // Determine action — either from query param or from base64 payload
    let action = req.query.action;

    if (!action && req.query.d) {
      try {
        const peek = JSON.parse(Buffer.from(req.query.d, 'base64url').toString('utf-8'));
        action = peek.action;
      } catch {
        // will be caught below
      }
    }

    if (!action) {
      return res.status(400).send(html('Invalid Link', 'This moderation link is missing required parameters.', '#c0392b'));
    }

    // ── PROFILE EDIT ACTIONS (check before photo actions) ──

    if (action === 'approve-edit' || action === 'reject-edit') {
      // Decode from single base64url param or legacy multi-param format
      let editData, editToken;

      if (req.query.d) {
        try {
          const decoded = JSON.parse(Buffer.from(req.query.d, 'base64url').toString('utf-8'));
          editData = { personId: decoded.personId, field: decoded.field, value: decoded.value };
          editToken = decoded.token;
        } catch {
          return res.status(400).send(html('Invalid Link', 'Could not decode edit data.', '#c0392b'));
        }
      } else if (req.query.edit && req.query.token) {
        try {
          editData = JSON.parse(decodeURIComponent(req.query.edit));
          editToken = req.query.token;
        } catch {
          return res.status(400).send(html('Invalid Link', 'Could not parse edit data.', '#c0392b'));
        }
      } else {
        return res.status(400).send(html('Invalid Link', 'This moderation link is missing required parameters.', '#c0392b'));
      }

      if (!verifyEditToken(editData, editToken)) {
        return res.status(403).send(html('Unauthorized', 'This moderation link is invalid or has been tampered with.', '#c0392b'));
      }

      const displayName = editData.personId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let displayValue;
      if (editData.field === 'facts' && Array.isArray(editData.value)) {
        displayValue = editData.value.length > 0
          ? editData.value.map(f => (f.year || '?') + ' — ' + f.label + (f.value ? ' (' + f.value + ')' : '')).join(', ')
          : '(no events)';
      } else if (Array.isArray(editData.value)) {
        displayValue = editData.value.join(', ') || '(empty)';
      } else {
        displayValue = String(editData.value ?? '(cleared)');
      }

      if (action === 'approve-edit') {
        try {
          // Special handling for profile photos
          if (editData.field === 'profile_photo') {
            const pendingId = editData.value; // e.g. ti-profile-photos/benjamin-boughton-pending-1716400000000
            const finalId = 'ti-profile-photos/' + editData.personId; // e.g. ti-profile-photos/benjamin-boughton

            // Rename pending photo to final ID (overwrites any existing photo)
            try {
              await cloudinary.uploader.rename(pendingId, finalId, { overwrite: true, invalidate: true });
            } catch (renameErr) {
              console.error('Cloudinary rename error:', renameErr);
              throw new Error('Failed to finalize photo in Cloudinary');
            }

            // Re-tag from pending to approved
            try {
              await cloudinary.uploader.replace_tag('ti-profile', [finalId]);
            } catch (tagErr) {
              console.error('Cloudinary tag error:', tagErr);
            }

            // Update the value to the final public ID before committing
            editData.value = finalId;
          }

          await applyProfileEdit(editData);
          res.setHeader('Content-Type', 'text/html');

          let msg;
          if (editData.field === 'profile_photo') {
            msg = `Profile photo for ${displayName} has been approved and is now visible.`;
          } else if (editData.field === 'facts') {
            const count = Array.isArray(editData.value) ? editData.value.length : 0;
            msg = `Timeline updated for ${displayName} (${count} event${count === 1 ? '' : 's'}). The site will redeploy in ~30 seconds.`;
          } else {
            msg = `Updated <strong>${editData.field}</strong> for ${displayName} to: ${displayValue}. The site will redeploy in ~30 seconds.`;
          }

          return res.status(200).send(html(
            editData.field === 'profile_photo' ? 'Photo Approved' : 'Edit Approved',
            msg,
            '#2e6b3e'
          ));
        } catch (err) {
          console.error('Profile edit commit error:', err);
          res.setHeader('Content-Type', 'text/html');
          return res.status(500).send(html('Error', 'Failed to apply edit: ' + err.message, '#c0392b'));
        }
      }

      if (action === 'reject-edit') {
        // For profile photos, delete the pending upload from Cloudinary
        if (editData.field === 'profile_photo' && editData.value) {
          try {
            await cloudinary.uploader.destroy(editData.value, { invalidate: true });
          } catch (delErr) {
            console.error('Cloudinary delete error:', delErr);
          }
        }

        res.setHeader('Content-Type', 'text/html');
        const msg = editData.field === 'profile_photo'
          ? `Profile photo for ${displayName} has been rejected and deleted.`
          : `Rejected change to <strong>${editData.field}</strong> for ${displayName}. No changes were made.`;

        return res.status(200).send(html(
          editData.field === 'profile_photo' ? 'Photo Rejected' : 'Edit Rejected',
          msg,
          '#c0392b'
        ));
      }
    }

    // ── PHOTO MODERATION ACTIONS ──

    const { ids, token } = req.query;

    if (!ids || !token) {
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
