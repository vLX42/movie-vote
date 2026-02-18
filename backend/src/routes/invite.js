const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { generateInviteCode } = require('../utils/inviteCodes');

// GET /api/invite/:code — validate, claim, set cookie, return session info
router.get('/:code', (req, res) => {
  const db = getDb();
  const { code } = req.params;

  const invite = db.prepare(`
    SELECT ic.*, s.id as session_id_direct, s.slug, s.name, s.status as session_status,
           s.votes_per_voter, s.guest_invite_slots, s.max_invite_depth, s.expires_at,
           s.allow_jellyseerr_requests
    FROM invite_codes ic
    JOIN sessions s ON ic.session_id = s.id
    WHERE ic.code = ?
  `).get(code);

  if (!invite) {
    return res.status(404).json({
      error: 'This invite link is not valid.',
      code: 'INVALID'
    });
  }

  if (invite.session_status !== 'open') {
    return res.status(410).json({
      error: 'Voting has closed for this session.',
      code: 'SESSION_CLOSED',
      sessionName: invite.name,
      slug: invite.slug
    });
  }

  if (invite.status === 'used') {
    return res.status(410).json({
      error: 'This spot was already claimed.',
      code: 'ALREADY_USED'
    });
  }

  if (invite.status === 'revoked') {
    return res.status(410).json({
      error: 'This invite link has been revoked.',
      code: 'REVOKED'
    });
  }

  // Check if visitor already has a valid voter cookie for this session
  const existingVoterId = req.cookies && req.cookies.movienightapp_voter;
  if (existingVoterId) {
    const existingVoter = db.prepare('SELECT * FROM voters WHERE id = ? AND session_id = ?')
      .get(existingVoterId, invite.session_id);
    if (existingVoter) {
      // Already joined — just return session info
      const inviteCode = existingVoter.invite_code;
      const inviteUrl = inviteCode
        ? `${req.protocol}://${req.get('host')}/join/${inviteCode}`
        : null;

      return res.json({
        success: true,
        alreadyJoined: true,
        session: {
          slug: invite.slug,
          name: invite.name,
          votesPerVoter: invite.votes_per_voter,
          allowJellyseerrRequests: !!invite.allow_jellyseerr_requests
        },
        voter: {
          id: existingVoter.id,
          displayName: existingVoter.display_name,
          inviteSlotsRemaining: existingVoter.invite_slots_remaining,
          inviteUrl
        }
      });
    }
  }

  // Determine invite depth
  let inviteDepth = 0;
  if (invite.created_by_voter_id) {
    const inviter = db.prepare('SELECT invite_depth FROM voters WHERE id = ?')
      .get(invite.created_by_voter_id);
    if (inviter) {
      inviteDepth = inviter.invite_depth + 1;
    }
  }

  // Check max invite depth
  if (invite.max_invite_depth !== null && inviteDepth > invite.max_invite_depth) {
    return res.status(403).json({
      error: 'This session has reached its maximum invite depth.',
      code: 'DEPTH_EXCEEDED'
    });
  }

  // Create voter
  const voterId = uuidv4();
  const guestCount = db.prepare('SELECT COUNT(*) as cnt FROM voters WHERE session_id = ?')
    .get(invite.session_id).cnt;

  // Generate a new invite code for this voter if they have slots
  let voterInviteCode = null;
  if (invite.guest_invite_slots > 0) {
    voterInviteCode = generateInviteCode();
  }

  const claimTransaction = db.transaction(() => {
    // Create voter record
    db.prepare(`
      INSERT INTO voters (id, session_id, display_name, invited_by, invite_depth, invite_code, invite_slots_remaining, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      voterId,
      invite.session_id,
      null,
      invite.created_by_voter_id || null,
      inviteDepth,
      voterInviteCode,
      invite.guest_invite_slots
    );

    // Mark invite as used
    db.prepare(`
      UPDATE invite_codes SET status = 'used', used_by_voter_id = ?, used_at = datetime('now')
      WHERE code = ?
    `).run(voterId, code);

    // Register the voter's own invite code if they have one
    if (voterInviteCode) {
      db.prepare(`
        INSERT INTO invite_codes (code, session_id, created_by_voter_id, status, created_at)
        VALUES (?, ?, ?, 'unused', datetime('now'))
      `).run(voterInviteCode, invite.session_id, voterId);
    }
  });

  claimTransaction();

  // Set cookie
  res.cookie('movienightapp_voter', voterId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  const inviteUrl = voterInviteCode
    ? `${req.protocol}://${req.get('host')}/join/${voterInviteCode}`
    : null;

  res.json({
    success: true,
    alreadyJoined: false,
    session: {
      slug: invite.slug,
      name: invite.name,
      votesPerVoter: invite.votes_per_voter,
      allowJellyseerrRequests: !!invite.allow_jellyseerr_requests
    },
    voter: {
      id: voterId,
      displayName: null,
      guestNumber: guestCount + 1,
      inviteSlotsRemaining: invite.guest_invite_slots,
      inviteUrl
    }
  });
});

module.exports = router;
