const db = require('./database');

// ─── Jackpot Pool Configuration ─────────────────────────────────────────────
// A progressive jackpot that accumulates a small percentage of every bet
// placed across all games. Any slots spin has a chance to trigger the jackpot.

// Percentage of each bet that goes into the jackpot pool.
const CONTRIBUTION_RATE = 0.01; // 1%

// Base jackpot amount (pool never drops below this after a win).
const BASE_JACKPOT = 10000;

// Chance to trigger the jackpot on a qualifying spin (per spin).
// Actual chance scales with bet size relative to the pool.
const BASE_TRIGGER_CHANCE = 0.0001; // 0.01% base

// ─── Database Setup ─────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS jackpot_pool (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    amount INTEGER NOT NULL DEFAULT ${BASE_JACKPOT},
    last_winner_id TEXT,
    last_winner_name TEXT,
    last_win_amount INTEGER,
    last_won_at TEXT,
    total_wins INTEGER NOT NULL DEFAULT 0
  );

  INSERT OR IGNORE INTO jackpot_pool (id, amount) VALUES (1, ${BASE_JACKPOT});

  CREATE TABLE IF NOT EXISTS jackpot_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    amount INTEGER NOT NULL,
    won_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Prepared Statements ────────────────────────────────────────────────────

const getPoolStmt = db.prepare('SELECT * FROM jackpot_pool WHERE id = 1');
const addToPoolStmt = db.prepare('UPDATE jackpot_pool SET amount = amount + ? WHERE id = 1');
const resetPoolStmt = db.prepare(`
  UPDATE jackpot_pool
  SET amount = ?,
      last_winner_id = ?,
      last_winner_name = ?,
      last_win_amount = ?,
      last_won_at = datetime('now'),
      total_wins = total_wins + 1
  WHERE id = 1
`);
const recordWinStmt = db.prepare(`
  INSERT INTO jackpot_history (user_id, username, amount)
  VALUES (?, ?, ?)
`);
const getHistoryStmt = db.prepare(`
  SELECT * FROM jackpot_history ORDER BY won_at DESC LIMIT ?
`);

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the current jackpot pool info.
 * @returns {{ amount: number, lastWinnerId: string|null, lastWinnerName: string|null, lastWinAmount: number|null, lastWonAt: string|null, totalWins: number }}
 */
function getJackpotPool() {
  const row = getPoolStmt.get();
  return {
    amount: row.amount,
    lastWinnerId: row.last_winner_id,
    lastWinnerName: row.last_winner_name,
    lastWinAmount: row.last_win_amount,
    lastWonAt: row.last_won_at,
    totalWins: row.total_wins,
  };
}

/**
 * Contributes a portion of a bet to the jackpot pool.
 * Should be called on every game bet.
 *
 * @param {number} bet - The bet amount.
 * @returns {number} The amount contributed.
 */
function contributeToJackpot(bet) {
  const contribution = Math.max(Math.floor(bet * CONTRIBUTION_RATE), 1);
  addToPoolStmt.run(contribution);
  return contribution;
}

/**
 * Checks if a jackpot is triggered on this spin.
 * The chance scales with bet size relative to the pool.
 *
 * @param {number} bet - The bet amount.
 * @returns {boolean} Whether the jackpot was triggered.
 */
function checkJackpotTrigger(bet) {
  const pool = getPoolStmt.get();
  if (pool.amount <= BASE_JACKPOT) return false;

  // Scale chance: higher bets relative to pool = higher chance.
  const betRatio = Math.min(bet / pool.amount, 0.01);
  const chance = BASE_TRIGGER_CHANCE + betRatio * 0.01;

  return Math.random() < chance;
}

/**
 * Awards the jackpot to a player. Resets the pool to the base amount.
 *
 * @param {string} userId - The winner's Discord user ID.
 * @param {string} username - The winner's display name.
 * @returns {{ amount: number }} The jackpot amount won.
 */
function awardJackpot(userId, username) {
  const pool = getPoolStmt.get();
  const winAmount = pool.amount;

  resetPoolStmt.run(BASE_JACKPOT, userId, username, winAmount);
  recordWinStmt.run(userId, username, winAmount);

  return { amount: winAmount };
}

/**
 * Returns recent jackpot win history.
 * @param {number} [limit=5] - Number of records to return.
 * @returns {Array<{ userId: string, username: string, amount: number, wonAt: string }>}
 */
function getJackpotHistory(limit = 5) {
  const rows = getHistoryStmt.all(limit);
  return rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    amount: r.amount,
    wonAt: r.won_at,
  }));
}

module.exports = {
  getJackpotPool,
  contributeToJackpot,
  checkJackpotTrigger,
  awardJackpot,
  getJackpotHistory,
  CONTRIBUTION_RATE,
  BASE_JACKPOT,
};
