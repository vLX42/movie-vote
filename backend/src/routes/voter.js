const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const { requireVoter } = require('../middleware/voter');

// GET /api/voter/me
router.get('/me', requireVoter, (req, res) => {
  const db = getDb();
  const voter = req.voter;

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(voter.session_id);
  const totalVotes = db.prepare(
    'SELECT COUNT(*) as cnt FROM votes WHERE session_id = ? AND voter_id = ?'
  ).get(voter.session_id, voter.id).cnt;

  const inviteUrl = voter.invite_code
    ? `${req.protocol}://${req.get('host')}/join/${voter.invite_code}`
    : null;

  res.json({
    voter: {
      id: voter.id,
      displayName: voter.display_name,
      sessionId: voter.session_id,
      sessionSlug: session ? session.slug : null,
      inviteDepth: voter.invite_depth,
      inviteSlotsRemaining: voter.invite_slots_remaining,
      inviteCode: voter.invite_code,
      inviteUrl,
      votesUsed: totalVotes,
      votesRemaining: session ? session.votes_per_voter - totalVotes : 0,
      joinedAt: voter.joined_at
    }
  });
});

// GET /api/voter/me/invite
router.get('/me/invite', requireVoter, (req, res) => {
  const voter = req.voter;
  const inviteUrl = voter.invite_code
    ? `${req.protocol}://${req.get('host')}/join/${voter.invite_code}`
    : null;

  res.json({
    inviteCode: voter.invite_code,
    inviteUrl,
    slotsRemaining: voter.invite_slots_remaining
  });
});

// PATCH /api/voter/me — update display name
router.patch('/me', requireVoter, (req, res) => {
  const db = getDb();
  const voter = req.voter;
  const { displayName } = req.body;

  if (displayName !== undefined) {
    const name = displayName ? String(displayName).slice(0, 50) : null;
    db.prepare('UPDATE voters SET display_name = ? WHERE id = ?').run(name, voter.id);
  }

  const updated = db.prepare('SELECT * FROM voters WHERE id = ?').get(voter.id);
  res.json({ success: true, displayName: updated.display_name });
});

module.exports = router;
