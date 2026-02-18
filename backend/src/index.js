require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { voterMiddleware } = require('./middleware/voter');
const inviteRoutes = require('./routes/invite');
const sessionRoutes = require('./routes/session');
const voterRoutes = require('./routes/voter');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const imageRoutes = require('./routes/images');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

// Apply voter identification to all routes
app.use(voterMiddleware);

// Routes
app.use('/api/invite', inviteRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/voter', voterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/images', imageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Movie Night App backend running on port ${PORT}`);
});
