function adminMiddleware(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden. Invalid or missing admin secret.' });
  }
  next();
}

module.exports = { adminMiddleware };
