const { getDb } = require('../db/schema');

// Attaches voter info to req.voter if cookie is present and valid
function voterMiddleware(req, res, next) {
  const voterId = req.cookies && req.cookies.movienightapp_voter;
  if (!voterId) {
    req.voter = null;
    return next();
  }

  const db = getDb();
  const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(voterId);
  req.voter = voter || null;
  next();
}

// Requires a valid voter cookie, otherwise 401
function requireVoter(req, res, next) {
  if (!req.voter) {
    return res.status(401).json({
      error: 'No voter identity found. Use your invite link to join the session.'
    });
  }
  next();
}

// Requires the voter to belong to the current session (slug-based)
function requireSessionVoter(req, res, next) {
  if (!req.voter) {
    return res.status(401).json({
      error: 'No voter identity found. Use your invite link to join the session.'
    });
  }

  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE slug = ?').get(req.params.slug);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  if (req.voter.session_id !== session.id) {
    return res.status(403).json({
      error: 'Your identity is not associated with this session.'
    });
  }

  req.session = session;
  next();
}

module.exports = { voterMiddleware, requireVoter, requireSessionVoter };
