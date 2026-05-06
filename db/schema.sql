CREATE TABLE IF NOT EXISTS tvs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL UNIQUE,
  room_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pair_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  pair_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  guest_label TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  valid_until TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  disconnected_at TEXT
);

CREATE TABLE IF NOT EXISTS tv_commands (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  device_id TEXT,
  room_id TEXT,
  source TEXT NOT NULL DEFAULT 'dashboard',
  note TEXT,
  created_at TEXT NOT NULL,
  available_at TEXT NOT NULL,
  delivered_at TEXT,
  acknowledged_at TEXT
);
