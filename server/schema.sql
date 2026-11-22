-- Driftwood Isle database (Cloudflare D1)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  display_name TEXT,
  expires INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
-- One island + player save per account. Stored as JSON; version guards against overwriting newer data.
CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
-- friend_id may visit owner_id's island. role: visitor | resident. standing=0 means one visit (visits_left).
CREATE TABLE IF NOT EXISTS links (
  owner_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  role TEXT NOT NULL,
  standing INTEGER NOT NULL,
  visits_left INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL,
  PRIMARY KEY (owner_id, friend_id)
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  role TEXT NOT NULL,
  standing INTEGER NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  used_by TEXT
);
CREATE TABLE IF NOT EXISTS visit_passes (
  token TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  item TEXT NOT NULL,
  direct INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS mail_to ON mail(to_id, claimed);
CREATE INDEX IF NOT EXISTS links_friend ON links(friend_id);
