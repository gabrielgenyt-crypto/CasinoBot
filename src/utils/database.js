const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'database', 'casino.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance.
db.pragma('journal_mode = WAL');

// Create tables if they do not exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seeds (
    user_id TEXT PRIMARY KEY,
    server_seed TEXT NOT NULL,
    client_seed TEXT NOT NULL DEFAULT 'default',
    nonce INTEGER NOT NULL DEFAULT 0,
    server_seed_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    bet INTEGER NOT NULL,
    payout INTEGER NOT NULL DEFAULT 0,
    won INTEGER NOT NULL DEFAULT 0,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history (user_id);
  CREATE INDEX IF NOT EXISTS idx_game_history_game ON game_history (game);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions (user_id);

  CREATE TABLE IF NOT EXISTS vip (
    user_id TEXT PRIMARY KEY,
    level INTEGER NOT NULL DEFAULT 0,
    total_wagered INTEGER NOT NULL DEFAULT 0,
    cashback_claimed TEXT
  );

  CREATE TABLE IF NOT EXISTS referrals (
    user_id TEXT PRIMARY KEY,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT,
    referral_count INTEGER NOT NULL DEFAULT 0,
    referral_earnings INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    amount INTEGER NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promo_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, code)
  );

  CREATE TABLE IF NOT EXISTS bans (
    user_id TEXT PRIMARY KEY,
    reason TEXT,
    banned_by TEXT NOT NULL,
    banned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    user_id TEXT NOT NULL,
    command TEXT NOT NULL,
    used_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, command, used_at)
  );

  CREATE TABLE IF NOT EXISTS self_exclusions (
    user_id TEXT PRIMARY KEY,
    excluded_until TEXT,
    permanent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deposit_addresses (
    user_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, chain)
  );

  CREATE TABLE IF NOT EXISTS withdraw_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, chain, address)
  );

  CREATE TABLE IF NOT EXISTS withdraw_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    tx_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS first_deposit_bonus (
    user_id TEXT PRIMARY KEY,
    claimed INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals (referral_code);
  CREATE INDEX IF NOT EXISTS idx_withdraw_requests_status ON withdraw_requests (status);

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    game TEXT,
    entry_fee INTEGER NOT NULL DEFAULT 0,
    prize_pool INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'upcoming',
    max_players INTEGER NOT NULL DEFAULT 100,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tournament_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tournament_id, user_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
  );

  CREATE TABLE IF NOT EXISTS session_tracking (
    user_id TEXT PRIMARY KEY,
    session_start TEXT NOT NULL,
    total_wagered_session INTEGER NOT NULL DEFAULT 0,
    total_lost_session INTEGER NOT NULL DEFAULT 0,
    last_warning TEXT
  );
`);

module.exports = db;
