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

  CREATE TABLE IF NOT EXISTS daily_claims (
    user_id TEXT PRIMARY KEY,
    last_claim TEXT NOT NULL
  );
`);

module.exports = db;
