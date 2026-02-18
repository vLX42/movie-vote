const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../../db/movienightapp.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      votes_per_voter INTEGER NOT NULL DEFAULT 5,
      max_invite_depth INTEGER,
      guest_invite_slots INTEGER NOT NULL DEFAULT 1,
      allow_jellyseerr_requests INTEGER NOT NULL DEFAULT 1,
      expires_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      winner_movie_id TEXT REFERENCES movies(id)
    );

    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      title TEXT NOT NULL,
      year INTEGER,
      runtime_minutes INTEGER,
      synopsis TEXT,
      poster_url TEXT,
      source TEXT NOT NULL,
      jellyfin_id TEXT,
      tmdb_id TEXT,
      jellyseerr_request_id TEXT,
      status TEXT NOT NULL DEFAULT 'in_library',
      nominated_by TEXT REFERENCES voters(id),
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voters (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      display_name TEXT,
      invited_by TEXT REFERENCES voters(id),
      invite_depth INTEGER NOT NULL DEFAULT 0,
      invite_code TEXT UNIQUE,
      invite_slots_remaining INTEGER NOT NULL DEFAULT 1,
      joined_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      created_by_voter_id TEXT REFERENCES voters(id),
      used_by_voter_id TEXT REFERENCES voters(id),
      status TEXT NOT NULL DEFAULT 'unused',
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      used_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      voter_id TEXT NOT NULL REFERENCES voters(id),
      movie_id TEXT NOT NULL REFERENCES movies(id),
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_invite_codes_session ON invite_codes(session_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON invite_codes(status);
    CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
    CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
    CREATE INDEX IF NOT EXISTS idx_votes_movie ON votes(movie_id);
    CREATE INDEX IF NOT EXISTS idx_movies_session ON movies(session_id);
    CREATE INDEX IF NOT EXISTS idx_voters_session ON voters(session_id);
  `);
}

module.exports = { getDb };
