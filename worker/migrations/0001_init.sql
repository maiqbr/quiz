CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  quiz_id TEXT NOT NULL,
  question_ids TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  question_started_at INTEGER NOT NULL,
  finished_at INTEGER,
  elapsed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS runs_user ON runs(user_id,started_at DESC);
CREATE INDEX IF NOT EXISTS runs_rank ON runs(quiz_id,hits DESC,elapsed_ms ASC);
CREATE TABLE IF NOT EXISTS run_answers (
  run_id TEXT NOT NULL REFERENCES runs(id),
  position INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  chosen TEXT,
  correct INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  PRIMARY KEY(run_id,position)
);
