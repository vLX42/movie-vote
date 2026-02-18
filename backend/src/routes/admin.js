const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { adminMiddleware } = require('../middleware/admin');
const { generateInviteCode } = require('../utils/inviteCodes');

router.use(adminMiddleware);

// POST /api/admin/sessions — create a new session
router.post('/sessions', (req, res) => {
  const db = getDb();
  const {
    name,
    slug,
    votesPerVoter = 5,
    rootInviteCodes = 1,
    guestInviteSlots = 1,
    maxInviteDepth = null,
    allowJellyseerrRequests = true,
    expiresAt = null
  } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'name and slug are required.' });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'slug must be lowercase alphanumeric with hyphens only.' });
  }

  const existing = db.prepare('SELECT id FROM sessions WHERE slug = ?').get(slug);
  if (existing) {
    return res.status(409).json({ error: 'A session with this slug already exists.' });
  }

  const sessionId = uuidv4();
  const createSession = db.transaction(() => {
    db.prepare(`
      INSERT INTO sessions (id, slug, name, status, votes_per_voter, max_invite_depth, guest_invite_slots, allow_jellyseerr_requests, expires_at, created_at)
      VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sessionId, slug, name,
      votesPerVoter,
      maxInviteDepth,
      guestInviteSlots,
      allowJellyseerrRequests ? 1 : 0,
      expiresAt || null
    );

    const codes = [];
    for (let i = 0; i < rootInviteCodes; i++) {
      const code = generateInviteCode();
      db.prepare(`
        INSERT INTO invite_codes (code, session_id, created_by_voter_id, status, created_at)
        VALUES (?, ?, NULL, 'unused', datetime('now'))
      `).run(code, sessionId);
      codes.push(code);
    }
    return codes;
  });

  const codes = createSession();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({
    session,
    rootInviteLinks: codes.map(c => ({ code: c, url: `${baseUrl}/join/${c}` }))
  });
});

// GET /api/admin/sessions — list all sessions
router.get('/sessions', (req, res) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM voters WHERE session_id = s.id) as voter_count,
      (SELECT COUNT(*) FROM movies WHERE session_id = s.id) as movie_count,
      (SELECT COUNT(*) FROM votes WHERE session_id = s.id) as total_votes
    FROM sessions s
    ORDER BY s.created_at DESC
  `).all();
  res.json({ sessions });
});

// GET /api/admin/sessions/:id — session detail
router.get('/sessions/:id', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const movies = db.prepare(`
    SELECT m.*, COUNT(v.id) as vote_count
    FROM movies m
    LEFT JOIN votes v ON v.movie_id = m.id
    WHERE m.session_id = ?
    GROUP BY m.id
    ORDER BY vote_count DESC
  `).all(session.id);

  const voters = db.prepare(`
    SELECT v.*,
      (SELECT COUNT(*) FROM votes WHERE voter_id = v.id) as vote_count
    FROM voters v
    WHERE v.session_id = ?
    ORDER BY v.joined_at ASC
  `).all(session.id);

  const codes = db.prepare(`
    SELECT * FROM invite_codes WHERE session_id = ? ORDER BY created_at ASC
  `).all(session.id);

  res.json({ session, movies, voters, codes });
});

// PATCH /api/admin/sessions/:id — update session settings
router.patch('/sessions/:id', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const updates = {};
  const allowed = ['name', 'status', 'votes_per_voter', 'max_invite_depth',
    'guest_invite_slots', 'allow_jellyseerr_requests', 'expires_at'];

  const body = req.body;
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.votesPerVoter !== undefined) updates.votes_per_voter = body.votesPerVoter;
  if (body.maxInviteDepth !== undefined) updates.max_invite_depth = body.maxInviteDepth;
  if (body.guestInviteSlots !== undefined) updates.guest_invite_slots = body.guestInviteSlots;
  if (body.allowJellyseerrRequests !== undefined) updates.allow_jellyseerr_requests = body.allowJellyseerrRequests ? 1 : 0;
  if (body.expiresAt !== undefined) updates.expires_at = body.expiresAt;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE sessions SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), session.id);

  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id);
  res.json({ session: updated });
});

// POST /api/admin/sessions/:id/close — close voting, optionally set winner
router.post('/sessions/:id/close', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const { winnerMovieId } = req.body;

  // Auto-determine winner if not specified
  let winner = winnerMovieId;
  if (!winner) {
    const topMovie = db.prepare(`
      SELECT movie_id, COUNT(*) as cnt FROM votes
      WHERE session_id = ?
      GROUP BY movie_id
      ORDER BY cnt DESC
      LIMIT 1
    `).get(session.id);
    winner = topMovie ? topMovie.movie_id : null;
  }

  db.prepare(`
    UPDATE sessions SET status = 'closed', winner_movie_id = ? WHERE id = ?
  `).run(winner || null, session.id);

  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id);
  const winnerMovie = winner ? db.prepare('SELECT * FROM movies WHERE id = ?').get(winner) : null;

  res.json({ session: updated, winnerMovie });
});

// GET /api/admin/sessions/:id/tree — full invite tree
router.get('/sessions/:id/tree', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const voters = db.prepare(`
    SELECT v.*,
      (SELECT COUNT(*) FROM votes WHERE voter_id = v.id) as vote_count
    FROM voters v
    WHERE v.session_id = ?
  `).all(session.id);

  const codes = db.prepare(
    'SELECT * FROM invite_codes WHERE session_id = ?'
  ).all(session.id);

  // Build tree
  function buildTree(parentId) {
    return voters
      .filter(v => v.invited_by === parentId)
      .map((voter, idx) => {
        const voterCodes = codes.filter(c => c.created_by_voter_id === voter.id);
        return {
          id: voter.id,
          displayName: voter.display_name || `Guest #${voter.id.slice(0, 6)}`,
          inviteDepth: voter.invite_depth,
          voteCount: voter.vote_count,
          inviteSlotsRemaining: voter.invite_slots_remaining,
          joinedAt: voter.joined_at,
          codes: voterCodes.map(c => ({ code: c.code, status: c.status })),
          children: buildTree(voter.id)
        };
      });
  }

  // Root nodes (invited_by = null)
  const rootVoters = voters
    .filter(v => !v.invited_by)
    .map(voter => {
      const voterCodes = codes.filter(c => c.created_by_voter_id === voter.id);
      return {
        id: voter.id,
        displayName: voter.display_name || `Guest #${voter.id.slice(0, 6)}`,
        inviteDepth: voter.invite_depth,
        voteCount: voter.vote_count,
        inviteSlotsRemaining: voter.invite_slots_remaining,
        joinedAt: voter.joined_at,
        codes: voterCodes.map(c => ({ code: c.code, status: c.status })),
        children: buildTree(voter.id)
      };
    });

  // Root invite codes (admin-generated, no voter)
  const rootCodes = codes.filter(c => !c.created_by_voter_id);

  res.json({
    session: { id: session.id, name: session.name, slug: session.slug },
    rootCodes: rootCodes.map(c => ({ code: c.code, status: c.status, usedByVoterId: c.used_by_voter_id })),
    tree: rootVoters
  });
});

// PATCH /api/admin/voters/:id/invites — adjust invite slots
router.patch('/voters/:id/invites', (req, res) => {
  const db = getDb();
  const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
  if (!voter) return res.status(404).json({ error: 'Voter not found.' });

  const { inviteSlotsRemaining } = req.body;
  if (inviteSlotsRemaining === undefined) {
    return res.status(400).json({ error: 'inviteSlotsRemaining is required.' });
  }

  const slots = Math.max(0, parseInt(inviteSlotsRemaining));

  // If increasing slots and voter has no invite code, generate one
  let inviteCode = voter.invite_code;
  if (slots > 0 && !inviteCode) {
    inviteCode = generateInviteCode();
    db.prepare(`
      INSERT INTO invite_codes (code, session_id, created_by_voter_id, status, created_at)
      VALUES (?, ?, ?, 'unused', datetime('now'))
    `).run(inviteCode, voter.session_id, voter.id);
  }

  db.prepare('UPDATE voters SET invite_slots_remaining = ?, invite_code = ? WHERE id = ?')
    .run(slots, inviteCode, voter.id);

  res.json({ success: true, inviteSlotsRemaining: slots, inviteCode });
});

// POST /api/admin/invite-codes/:code/revoke — revoke a code
router.post('/invite-codes/:code/revoke', (req, res) => {
  const db = getDb();
  const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(req.params.code);
  if (!invite) return res.status(404).json({ error: 'Invite code not found.' });

  if (invite.status === 'used') {
    return res.status(409).json({ error: 'This code has already been used.' });
  }

  db.prepare('UPDATE invite_codes SET status = ? WHERE code = ?').run('revoked', req.params.code);
  res.json({ success: true });
});

// DELETE /api/admin/voters/:id — remove a voter
router.delete('/voters/:id', (req, res) => {
  const db = getDb();
  const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
  if (!voter) return res.status(404).json({ error: 'Voter not found.' });

  // Votes remain per spec
  db.prepare('DELETE FROM voters WHERE id = ?').run(voter.id);
  res.json({ success: true });
});

// POST /api/admin/sessions/:id/invite-codes — generate additional root codes
router.post('/sessions/:id/invite-codes', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const count = Math.max(1, Math.min(20, parseInt(req.body.count) || 1));
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateInviteCode();
    db.prepare(`
      INSERT INTO invite_codes (code, session_id, created_by_voter_id, status, created_at)
      VALUES (?, ?, NULL, 'unused', datetime('now'))
    `).run(code, session.id);
    codes.push(code);
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({
    codes: codes.map(c => ({ code: c, url: `${baseUrl}/join/${c}` }))
  });
});

module.exports = router;
