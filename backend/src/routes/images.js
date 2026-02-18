const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// GET /api/images/jellyfin/:itemId — proxy Jellyfin poster
router.get('/jellyfin/:itemId', async (req, res) => {
  const jellyfinUrl = process.env.JELLYFIN_URL;
  const jellyfinKey = process.env.JELLYFIN_API_KEY;

  if (!jellyfinUrl || !jellyfinKey) {
    return res.status(503).send('Jellyfin not configured');
  }

  try {
    const url = `${jellyfinUrl}/Items/${req.params.itemId}/Images/Primary?api_key=${jellyfinKey}&maxWidth=400&quality=90`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).send('Image not found');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.body.pipe(res);
  } catch (err) {
    console.error('Jellyfin image proxy error:', err.message);
    res.status(502).send('Failed to fetch image');
  }
});

// GET /api/images/tmdb/* — proxy TMDB poster via Jellyseerr
router.get('/tmdb/*', async (req, res) => {
  // path after /tmdb/ is the TMDB image path (e.g. /abc123.jpg)
  const imagePath = '/' + req.params[0];
  const tmdbImageBase = 'https://image.tmdb.org/t/p/w400';

  try {
    const url = `${tmdbImageBase}${imagePath}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).send('Image not found');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.body.pipe(res);
  } catch (err) {
    console.error('TMDB image proxy error:', err.message);
    res.status(502).send('Failed to fetch image');
  }
});

module.exports = router;
