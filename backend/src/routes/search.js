const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { requireVoter } = require('../middleware/voter');

// GET /api/search/jellyfin?q=
router.get('/jellyfin', requireVoter, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters.' });
  }

  const jellyfinUrl = process.env.JELLYFIN_URL;
  const jellyfinKey = process.env.JELLYFIN_API_KEY;

  if (!jellyfinUrl || !jellyfinKey) {
    return res.status(503).json({ error: 'Jellyfin is not configured.' });
  }

  try {
    const url = new URL(`${jellyfinUrl}/Items`);
    url.searchParams.set('searchTerm', q);
    url.searchParams.set('IncludeItemTypes', 'Movie');
    url.searchParams.set('Recursive', 'true');
    url.searchParams.set('Fields', 'Overview,RunTimeTicks,ProductionYear,PrimaryImageAspectRatio,ProviderIds');
    url.searchParams.set('Limit', '20');
    url.searchParams.set('api_key', jellyfinKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Jellyfin returned ${response.status}`);
    }

    const data = await response.json();
    const items = (data.Items || []).map(item => ({
      id: `jellyfin:${item.Id}`,
      title: item.Name,
      year: item.ProductionYear || null,
      runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
      synopsis: item.Overview || null,
      posterUrl: `/api/images/jellyfin/${item.Id}`,
      source: 'jellyfin',
      jellyfinId: item.Id,
      tmdbId: item.ProviderIds && item.ProviderIds.Tmdb ? item.ProviderIds.Tmdb : null,
      status: 'in_library'
    }));

    res.json({ results: items, query: q });
  } catch (err) {
    console.error('Jellyfin search error:', err.message);
    res.status(502).json({ error: 'Failed to reach Jellyfin.' });
  }
});

// GET /api/search/tmdb?q=
router.get('/tmdb', requireVoter, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters.' });
  }

  const jellyseerrUrl = process.env.JELLYSEERR_URL;
  const jellyseerrKey = process.env.JELLYSEERR_API_KEY;

  if (!jellyseerrUrl || !jellyseerrKey) {
    return res.status(503).json({ error: 'Jellyseerr is not configured.' });
  }

  try {
    const url = new URL(`${jellyseerrUrl}/api/v1/search`);
    url.searchParams.set('query', q);
    url.searchParams.set('page', '1');
    url.searchParams.set('language', 'en');

    const response = await fetch(url.toString(), {
      headers: { 'X-Api-Key': jellyseerrKey }
    });

    if (!response.ok) {
      throw new Error(`Jellyseerr returned ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || [])
      .filter(r => r.mediaType === 'movie')
      .map(item => {
        const media = item.mediaInfo;
        let status = 'nominated_only';
        if (media) {
          if (media.status === 5) status = 'in_library'; // Available
          else if ([2, 3, 4].includes(media.status)) status = 'requested';
        }

        const posterPath = item.posterPath;
        const posterUrl = posterPath
          ? `/api/images/tmdb${posterPath}`
          : null;

        return {
          id: `tmdb:${item.id}`,
          title: item.title || item.originalTitle,
          year: item.releaseDate ? parseInt(item.releaseDate.slice(0, 4)) : null,
          runtimeMinutes: null,
          synopsis: item.overview || null,
          posterUrl,
          source: 'jellyseerr',
          jellyfinId: null,
          tmdbId: String(item.id),
          status
        };
      });

    res.json({ results, query: q });
  } catch (err) {
    console.error('TMDB/Jellyseerr search error:', err.message);
    res.status(502).json({ error: 'Failed to reach Jellyseerr.' });
  }
});

module.exports = router;
