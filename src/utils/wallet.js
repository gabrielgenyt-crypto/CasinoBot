const db = require('./database');

/**
 * Retrieves the current balance for a user. Returns 0 if the user has no wallet.
 * @param {string} userId - The Discord user ID.
 * @returns {number} The user's current balance.
 */
const getBalance = (userId) => {
  const row = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
  return row ? row.balance : 0;
};

/**
 * Atomically updates a user's balance within a transaction.
 * Throws if the resulting balance would be negative (insufficient funds).
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} amount - The amount to add (positive) or subtract (negative).
 * @param {string} [description] - Optional description for the transaction log.
 * @returns {number} The new balance after the update.
 */
const updateBalance = db.transaction((userId, amount, description) => {
  const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
  const currentBalance = wallet ? wallet.balance : 0;
  const newBalance = currentBalance + amount;

  if (newBalance < 0) {
    throw new Error('INSUFFICIENT_FUNDS');
  }

  db.prepare(
    'INSERT INTO wallets (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = ?'
  ).run(userId, newBalance, newBalance);

  db.prepare(
    'INSERT INTO transactions (user_id, amount, description) VALUES (?, ?, ?)'
  ).run(userId, amount, description || null);

  return newBalance;
});

/**
 * Ensures a wallet row exists for the given user. Creates one with a zero
 * balance if it does not already exist.
 * @param {string} userId - The Discord user ID.
 */
const ensureWallet = (userId) => {
  db.prepare(
    'INSERT OR IGNORE INTO wallets (user_id, balance) VALUES (?, 0)'
  ).run(userId);
};

/**
 * Records a completed game round in the history table.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} game - The game identifier (e.g. 'coinflip', 'dice').
 * @param {number} bet - The wager amount.
 * @param {number} payout - The amount returned to the user (0 on loss).
 * @param {boolean} won - Whether the user won.
 * @param {string} [details] - Optional JSON string with game-specific details.
 */
const recordGame = (userId, game, bet, payout, won, details) => {
  db.prepare(
    'INSERT INTO game_history (user_id, game, bet, payout, won, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, game, bet, payout, won ? 1 : 0, details || null);
};

module.exports = { getBalance, updateBalance, ensureWallet, recordGame };
