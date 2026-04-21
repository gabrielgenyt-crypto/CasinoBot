const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

// House edge: 1%. Payout multiplier is calculated as (100 - houseEdge) / winChance.
const HOUSE_EDGE = 0.01;

/**
 * Calculates the payout multiplier for a given win probability.
 * @param {number} winChance - Win probability as a fraction (e.g. 0.5 for 50%).
 * @returns {number} The multiplier rounded to 4 decimal places.
 */
const getMultiplier = (winChance) =>
  Math.round(((1 - HOUSE_EDGE) / winChance) * 10000) / 10000;

/**
 * Runs a dice game. The user picks "over" or "under" a target number (1-100).
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {'over'|'under'} direction - Whether the roll must be over or under the target.
 * @param {number} target - The target number (1-99).
 * @returns {{ won: boolean, roll: number, multiplier: number, payout: number, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playDice = (userId, bet, direction, target) => {
  // Calculate win chance based on direction and target.
  // "over" target means roll must be > target, so winChance = (100 - target) / 100.
  // "under" target means roll must be < target, so winChance = (target - 1) / 100.
  const winChance =
    direction === 'over' ? (100 - target) / 100 : (target - 1) / 100;

  if (winChance <= 0 || winChance >= 1) {
    throw new Error('INVALID_TARGET');
  }

  const multiplier = getMultiplier(winChance);

  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'dice bet');

  const { result, nonce, serverSeedHash } = getNextResult(userId);

  // Convert the 0-1 float to a 1-100 roll.
  const roll = Math.floor(result * 100) + 1;

  const won =
    direction === 'over' ? roll > target : roll < target;

  let payout = 0;
  let newBalance;

  if (won) {
    payout = Math.floor(bet * multiplier);
    newBalance = updateBalance(userId, payout, 'dice win');
  } else {
    const { getBalance } = require('../utils/wallet');
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'dice', bet, payout, won, JSON.stringify({
    roll, target, direction, multiplier,
  }));

  const vipResult = addWagered(userId, bet);

  return { won, roll, multiplier, payout, newBalance, nonce, serverSeedHash, vipLevelUp: vipResult.newLevel };
};

module.exports = { playDice, getMultiplier };
