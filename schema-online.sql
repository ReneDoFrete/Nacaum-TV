CREATE TABLE IF NOT EXISTS online_visitors (
  id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_online_visitors_last_seen ON online_visitors(last_seen);
