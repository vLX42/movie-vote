const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { requireSessionVoter } = require('../middleware/voter');

// GET /api/session/:slug — session info + movies with vote counts + voter's votes
router.get('/:slug', requireSessionVoter, (req, res) => {
  const db = getDb();
  const session = req.session;
  const voter = req.voter;

  const movies = db.prepare(`
    SELECT m.*,
      COUNT(v.id) as vote_count,
      (SELECT COUNT(*) FROM votes WHERE movie_id = m.id AND voter_id = ?) as my_votes
    FROM movies m
    LEFT JOIN votes v ON v.movie_id = m.id
    WHERE m.session_id = ?
    GROUP BY m.id
    ORDER BY vote_count DESC, m.created_at ASC
  `).all(voter.id, session.id);

  const myTotalVotes = db.prepare(
    'SELECT COUNT(*) as cnt FROM votes WHERE session_id = ? AND voter_id = ?'
  ).get(session.id, voter.id).cnt;

  const inviteUrl = voter.invite_code
    ? `${req.protocol}://${req.get('host')}/join/${voter.invite_code}`
    : null;

  res.json({
    session: {
      id: session.id,
      slug: session.slug,
      name: session.name,
      status: session.status,
      votesPerVoter: session.votes_per_voter,
      allowJellyseerrRequests: !!session.allow_jellyseerr_requests,
      expiresAt: session.expires_at,
      winnerMovieId: session.winner_movie_id
    },
    voter: {
      id: voter.id,
      displayName: voter.display_name,
      votesUsed: myTotalVotes,
      votesRemaining: session.votes_per_voter - myTotalVotes,
      inviteSlotsRemaining: voter.invite_slots_remaining,
      inviteUrl
    },
    movies: movies.map(normalizeMovie)
  });
});

// GET /api/session/:slug/movies — paginated movie list
router.get('/:slug/movies', requireSessionVoter, (req, res) => {
  const db = getDb();
  const session = req.session;
  const voter = req.voter;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as cnt FROM movies WHERE session_id = ?')
    .get(session.id).cnt;

  const movies = db.prepare(`
    SELECT m.*,
      COUNT(v.id) as vote_count,
      (SELECT COUNT(*) FROM votes WHERE movie_id = m.id AND voter_id = ?) as my_votes
    FROM movies m
    LEFT JOIN votes v ON v.movie_id = m.id
    WHERE m.session_id = ?
    GROUP BY m.id
    ORDER BY vote_count DESC, m.created_at ASC
    LIMIT ? OFFSET ?
  `).all(voter.id, session.id, limit, offset);

  res.json({
    movies: movies.map(normalizeMovie),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// POST /api/session/:slug/movies — nominate a movie
router.post('/:slug/movies', requireSessionVoter, (req, res) => {
  const db = getDb();
  const session = req.session;
  const voter = req.voter;

  if (session.status !== 'open') {
    return res.status(403).json({ error: 'This session is no longer open.' });
  }

  const { title, year, runtimeMinutes, synopsis, posterUrl, source, jellyfinId, tmdbId, status } = req.body;

  if (!title || !source) {
    return res.status(400).json({ error: 'title and source are required.' });
  }

  // Prevent duplicate nominations in the same session
  const existing = db.prepare(`
    SELECT id FROM movies
    WHERE session_id = ? AND (
      (jellyfin_id IS NOT NULL AND jellyfin_id = ?) OR
      (tmdb_id IS NOT NULL AND tmdb_id = ?) OR
      (title = ? AND source = ?)
    )
  `).get(session.id, jellyfinId || null, tmdbId || null, title, source);

  if (existing) {
    return res.status(409).json({ error: 'This movie is already nominated in this session.', movieId: existing.id });
  }

  const movieId = uuidv4();
  db.prepare(`
    INSERT INTO movies (id, session_id, title, year, runtime_minutes, synopsis, poster_url, source, jellyfin_id, tmdb_id, status, nominated_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    movieId, session.id, title, year || null, runtimeMinutes || null,
    synopsis || null, posterUrl || null, source,
    jellyfinId || null, tmdbId || null,
    status || 'in_library', voter.id
  );

  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
  res.status(201).json(normalizeMovie({ ...movie, vote_count: 0, my_votes: 0 }));
});

// POST /api/session/:slug/request — Jellyseerr request + nominate
router.post('/:slug/request', requireSessionVoter, async (req, res) => {
  const db = getDb();
  const session = req.session;
  const voter = req.voter;

  if (session.status !== 'open') {
    return res.status(403).json({ error: 'This session is no longer open.' });
  }

  if (!session.allow_jellyseerr_requests) {
    return res.status(403).json({ error: 'Movie requests are disabled for this session.' });
  }

  const { title, year, runtimeMinutes, synopsis, posterUrl, tmdbId } = req.body;

  if (!tmdbId) {
    return res.status(400).json({ error: 'tmdbId is required to submit a request.' });
  }

  // Check if already nominated
  const existing = db.prepare(
    'SELECT id FROM movies WHERE session_id = ? AND tmdb_id = ?'
  ).get(session.id, String(tmdbId));

  if (existing) {
    return res.status(409).json({ error: 'This movie is already nominated.', movieId: existing.id });
  }

  // Submit Jellyseerr request
  let jellyseerrRequestId = null;
  const jellyseerrUrl = process.env.JELLYSEERR_URL;
  const jellyseerrKey = process.env.JELLYSEERR_API_KEY;

  if (jellyseerrUrl && jellyseerrKey) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${jellyseerrUrl}/api/v1/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': jellyseerrKey
        },
        body: JSON.stringify({ mediaType: 'movie', mediaId: tmdbId })
      });
      if (response.ok) {
        const data = await response.json();
        jellyseerrRequestId = String(data.id || '');
      }
    } catch (err) {
      console.error('Jellyseerr request failed:', err.message);
      // Non-fatal — still nominate the movie
    }
  }

  const movieId = uuidv4();
  db.prepare(`
    INSERT INTO movies (id, session_id, title, year, runtime_minutes, synopsis, poster_url, source, tmdb_id, jellyseerr_request_id, status, nominated_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'jellyseerr', ?, ?, 'requested', ?, datetime('now'))
  `).run(
    movieId, session.id, title, year || null, runtimeMinutes || null,
    synopsis || null, posterUrl || null,
    String(tmdbId), jellyseerrRequestId, voter.id
  );

  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
  res.status(201).json(normalizeMovie({ ...movie, vote_count: 0, my_votes: 0 }));
});

// POST /api/session/:slug/vote — cast one vote on a movie
router.post('/:slug/vote', requireSessionVoter, (req, res) => {
  const db = getDb();
  const session = req.session;
  const voter = req.voter;

  if (session.status !== 'open') {
    return res.status(403).json({ error: 'This session is no longer open.' });
  }

  const { movieId } = req.body;
  if (!movieId) {
    return res.status(400).json({ error: 'movieId is required.' });
  }

  const movie = db.prepare('SELECT * FROM movies WHERE id = ? AND session_id = ?').get(movieId, session.id);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found in this session.' });
  }

  const totalVotes = db.prepare(
    'SELECT COUNT(*) as cnt FROM votes WHERE session_id = ? AND voter_id = ?'
  ).get(session.id, voter.id).cnt;

  if (totalVotes >= session.votes_per_voter) {
    return res.status(403).json({
      error: `You have used all ${session.votes_per_voter} of your votes.`
    });
  }

  const voteId = uuidv4();
  db.prepare(`
    INSERT INTO votes (id, session_id, voter_id, movie_id, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(voteId, session.id, voter.id, movieId);

  const newTotal = totalVotes + 1;
  const movieVotes = db.prepare('SELECT COUNT(*) as cnt FROM votes WHERE movie_id = ? AND session_id = ?')
    .get(movieId, session.id).cnt;
  const myMovieVotes = db.prepare('SELECT COUNT(*) as cnt FROM votes WHERE movie_id = ? AND voter_id = ?')
    .get(movieId, voter.id).cnt;

  res.json({
    success: true,
    votesUsed: newTotal,
    votesRemaining: session.votes_per_voter - newTotal,
    movie: { id: movieId, voteCount: movieVotes, myVotes: myMovieVotes }
  });
});

// DELETE /api/session/:slug/vote — retract one vote from a movie
router.delete('/:slug/vote', requireSessionVoter, (req, res) => {
  const db = getDb();
  const session = req.session;
  const voter = req.voter;

  if (session.status !== 'open') {
    return res.status(403).json({ error: 'This session is no longer open.' });
  }

  const { movieId } = req.body;
  if (!movieId) {
    return res.status(400).json({ error: 'movieId is required.' });
  }

  // Find most recent vote for this movie by this voter
  const vote = db.prepare(`
    SELECT id FROM votes WHERE movie_id = ? AND voter_id = ? AND session_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(movieId, voter.id, session.id);

  if (!vote) {
    return res.status(404).json({ error: 'No vote found to retract.' });
  }

  db.prepare('DELETE FROM votes WHERE id = ?').run(vote.id);

  const totalVotes = db.prepare(
    'SELECT COUNT(*) as cnt FROM votes WHERE session_id = ? AND voter_id = ?'
  ).get(session.id, voter.id).cnt;
  const movieVotes = db.prepare('SELECT COUNT(*) as cnt FROM votes WHERE movie_id = ? AND session_id = ?')
    .get(movieId, session.id).cnt;
  const myMovieVotes = db.prepare('SELECT COUNT(*) as cnt FROM votes WHERE movie_id = ? AND voter_id = ?')
    .get(movieId, voter.id).cnt;

  res.json({
    success: true,
    votesUsed: totalVotes,
    votesRemaining: session.votes_per_voter - totalVotes,
    movie: { id: movieId, voteCount: movieVotes, myVotes: myMovieVotes }
  });
});

// GET /api/voter/me — current voter info
router.get('/voter/me', (req, res) => {
  // This needs to be handled at app level since it's not under /:slug
  // Redirect to specific endpoint
  res.status(404).json({ error: 'Use /api/voter/me' });
});

function normalizeMovie(m) {
  return {
    id: m.id,
    sessionId: m.session_id,
    title: m.title,
    year: m.year,
    runtimeMinutes: m.runtime_minutes,
    synopsis: m.synopsis,
    posterUrl: m.poster_url,
    source: m.source,
    jellyfinId: m.jellyfin_id,
    tmdbId: m.tmdb_id,
    jellyseerrRequestId: m.jellyseerr_request_id,
    status: m.status,
    nominatedBy: m.nominated_by,
    createdAt: m.created_at,
    voteCount: m.vote_count || 0,
    myVotes: m.my_votes || 0
  };
}

module.exports = router;
