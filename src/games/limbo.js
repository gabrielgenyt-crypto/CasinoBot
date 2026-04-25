const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

/**
 * Generates a crash-style multiplier from a provably fair result.
 * Uses the formula: multiplier = 0.99 / (1 - result), capped at 1000x.
 * This produces a distribution where higher multipliers are exponentially
 * less likely, with a ~1% house edge.
 *
 * @param {number} result - A float in [0, 1) from the provably fair system.
 * @returns {number} The generated multiplier (>= 1.00).
 */
function generateMultiplier(result) {
  // Avoid division by zero; cap at 1000x.
  const raw = 0.99 / (1 - result);
  return Math.min(parseFloat(Math.max(raw, 1.0).toFixed(2)), 1000);
}

/**
 * Plays a limbo game. The player picks a target multiplier; the game
 * generates a random multiplier. If the generated multiplier >= target,
 * the player wins target * bet.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {number} target - The target multiplier (>= 1.01, <= 1000).
 * @returns {{ target: number, multiplier: number, won: boolean, payout: number, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playLimbo = (userId, bet, target) => {
  if (target < 1.01 || target > 1000) {
    throw new Error('INVALID_TARGET');
  }

  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'limbo bet');

  const { result, nonce, serverSeedHash } = getNextResult(userId);
  const multiplier = generateMultiplier(result);
  const won = multiplier >= target;
  const payout = won ? Math.floor(bet * target) : 0;

  let newBalance;
  if (won) {
    newBalance = updateBalance(userId, payout, 'limbo win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'limbo', bet, payout, won, JSON.stringify({
    target, multiplier,
  }));

  const vipResult = addWagered(userId, bet);

  return {
    target,
    multiplier,
    won,
    payout,
    newBalance,
    nonce,
    serverSeedHash,
    vipLevelUp: vipResult.newLevel,
  };
};

module.exports = { playLimbo };
