const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');

// House edge ~3%. The crash point formula ensures the house wins ~3% of rounds
// instantly (crash at 1.00x).
const HOUSE_EDGE = 0.03;

/**
 * Generates a provably fair crash point from the RNG result.
 * Uses the inverse CDF of an exponential-like distribution with a built-in
 * house edge: ~3% of the time the crash point is 1.00x (instant crash).
 *
 * @param {number} result - A float in [0, 1) from the provably fair system.
 * @returns {number} The crash multiplier, minimum 1.00.
 */
const getCrashPoint = (result) => {
  // If the result falls within the house edge band, instant crash.
  if (result < HOUSE_EDGE) return 1.0;

  // Otherwise, map to an exponential distribution.
  // Formula: 1 / (1 - result) floored to 2 decimals, capped at 1000x.
  const raw = (1 - HOUSE_EDGE) / (1 - result);
  return Math.min(Math.floor(raw * 100) / 100, 1000);
};

/**
 * Plays a crash game with a pre-set auto-cashout multiplier.
 * Since Discord interactions are not real-time, we simulate the full round
 * instantly: the crash point is determined, and if the user's cashout target
 * is at or below the crash point, they win.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {number} cashout - The auto-cashout multiplier (e.g. 2.0).
 * @returns {{ won: boolean, crashPoint: number, cashout: number, payout: number, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playCrash = (userId, bet, cashout) => {
  if (cashout < 1.01) throw new Error('INVALID_CASHOUT');

  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'crash bet');

  const { result, nonce, serverSeedHash } = getNextResult(userId);
  const crashPoint = getCrashPoint(result);

  const won = cashout <= crashPoint;
  let payout = 0;
  let newBalance;

  if (won) {
    payout = Math.floor(bet * cashout);
    newBalance = updateBalance(userId, payout, 'crash win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'crash', bet, payout, won, JSON.stringify({
    crashPoint, cashout,
  }));

  return { won, crashPoint, cashout, payout, newBalance, nonce, serverSeedHash };
};

module.exports = { playCrash, getCrashPoint };
