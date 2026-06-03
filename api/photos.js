import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  // Set CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_ORIGIN || 'https://ti-camp.org');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const result = await cloudinary.api.resources_by_tag('ti-slideshow', {
      max_results: 100,
      resource_type: 'image',
      context: true,  // Include context metadata (captions)
    });

    const photos = result.resources.map(r => ({
      url: cloudinary.url(r.public_id, {
        transformation: [
          { width: 1000, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      }),
      publicId: r.public_id,
      caption: r.context?.custom?.caption || ''
    }));

    // Cache for 60 seconds on Vercel's edge
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json({ photos });
  } catch (error) {
    console.error('Cloudinary error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
}
