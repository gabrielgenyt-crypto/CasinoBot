const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

// Wheel segments with labels, multipliers, colors, and weights.
// Higher weights = more likely to land on. House edge ~3%.
const SEGMENTS = [
  { label: '0.2x', multiplier: 0.2, color: '#424242', weight: 8 },
  { label: '1.5x', multiplier: 1.5, color: '#1565c0', weight: 12 },
  { label: '0.5x', multiplier: 0.5, color: '#6a1b9a', weight: 10 },
  { label: '2x',   multiplier: 2.0, color: '#2e7d32', weight: 8 },
  { label: '0.3x', multiplier: 0.3, color: '#424242', weight: 9 },
  { label: '1.2x', multiplier: 1.2, color: '#00838f', weight: 12 },
  { label: '3x',   multiplier: 3.0, color: '#e65100', weight: 5 },
  { label: '0.5x', multiplier: 0.5, color: '#6a1b9a', weight: 10 },
  { label: '1.5x', multiplier: 1.5, color: '#1565c0', weight: 10 },
  { label: '5x',   multiplier: 5.0, color: '#b71c1c', weight: 3 },
  { label: '0.2x', multiplier: 0.2, color: '#424242', weight: 8 },
  { label: '10x',  multiplier: 10.0, color: '#ffd700', weight: 1 },
  { label: '1.2x', multiplier: 1.2, color: '#00838f', weight: 10 },
  { label: '0.3x', multiplier: 0.3, color: '#424242', weight: 9 },
  { label: '2x',   multiplier: 2.0, color: '#2e7d32', weight: 6 },
  { label: '0.5x', multiplier: 0.5, color: '#6a1b9a', weight: 9 },
];

const TOTAL_WEIGHT = SEGMENTS.reduce((sum, s) => sum + s.weight, 0);

/**
 * Picks a segment index using a weighted random selection.
 * @param {number} roll - A float in [0, 1) from the provably fair system.
 * @returns {number} The winning segment index.
 */
const pickSegment = (roll) => {
  let cumulative = 0;
  const target = roll * TOTAL_WEIGHT;
  for (let i = 0; i < SEGMENTS.length; i++) {
    cumulative += SEGMENTS[i].weight;
    if (target < cumulative) return i;
  }
  return SEGMENTS.length - 1;
};

/**
 * Spins the wheel of fortune.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @returns {{ winningIndex: number, segment: object, multiplier: number, payout: number, won: boolean, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playWheel = (userId, bet) => {
  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'wheel bet');

  const { result, nonce, serverSeedHash } = getNextResult(userId);
  const winningIndex = pickSegment(result);
  const segment = SEGMENTS[winningIndex];
  const multiplier = segment.multiplier;
  const payout = Math.floor(bet * multiplier);
  const won = payout > bet;

  let newBalance;
  if (payout > 0) {
    newBalance = updateBalance(userId, payout, 'wheel win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'wheel', bet, payout, won, JSON.stringify({
    winningIndex, label: segment.label, multiplier,
  }));

  const vipResult = addWagered(userId, bet);

  return {
    winningIndex,
    segment,
    segments: SEGMENTS,
    multiplier,
    payout,
    won,
    newBalance,
    nonce,
    serverSeedHash,
    vipLevelUp: vipResult.newLevel,
  };
};

module.exports = { playWheel, SEGMENTS };
