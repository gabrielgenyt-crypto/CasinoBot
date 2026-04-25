const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

const POOL_SIZE = 40;
const DRAW_COUNT = 10;
const MAX_PICKS = 10;

// Payout multipliers indexed by [picks][hits].
// Designed for ~96% RTP. Index 0 is unused (0 picks not allowed).
const PAYOUTS = {
  1:  [0, 3.6],
  2:  [0, 1.5, 9],
  3:  [0, 0, 2.5, 26],
  4:  [0, 0, 1.5, 6, 60],
  5:  [0, 0, 0, 3, 12, 150],
  6:  [0, 0, 0, 1.5, 5, 30, 300],
  7:  [0, 0, 0, 1, 3, 12, 72, 500],
  8:  [0, 0, 0, 0, 2, 8, 30, 200, 1000],
  9:  [0, 0, 0, 0, 1.5, 4, 15, 80, 400, 2000],
  10: [0, 0, 0, 0, 1, 3, 10, 40, 200, 800, 5000],
};

/**
 * Draws `count` unique numbers from 1..poolSize using sequential provably
 * fair results (Fisher-Yates style selection).
 *
 * @param {string} userId
 * @param {number} poolSize
 * @param {number} count
 * @returns {{ drawn: number[], nonce: number, serverSeedHash: string }}
 */
function drawNumbers(userId, poolSize, count) {
  const pool = [];
  for (let i = 1; i <= poolSize; i++) pool.push(i);

  const drawn = [];
  let firstNonce = null;
  let firstHash = null;

  for (let i = 0; i < count; i++) {
    const { result, nonce, serverSeedHash } = getNextResult(userId);
    if (i === 0) {
      firstNonce = nonce;
      firstHash = serverSeedHash;
    }
    const remaining = pool.length;
    const idx = Math.floor(result * remaining);
    drawn.push(pool[idx]);
    // Remove picked number (swap with last for O(1)).
    pool[idx] = pool[remaining - 1];
    pool.pop();
  }

  return { drawn, nonce: firstNonce, serverSeedHash: firstHash };
}

/**
 * Plays a keno game.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {number[]} picks - The player's chosen numbers (1-40).
 * @returns {{ picks: number[], drawn: number[], hits: number[], hitCount: number, multiplier: number, payout: number, won: boolean, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playKeno = (userId, bet, picks) => {
  if (picks.length < 1 || picks.length > MAX_PICKS) {
    throw new Error('INVALID_PICKS');
  }

  // Validate picks are unique and in range.
  const pickSet = new Set(picks);
  if (pickSet.size !== picks.length) throw new Error('DUPLICATE_PICKS');
  for (const p of picks) {
    if (p < 1 || p > POOL_SIZE) throw new Error('INVALID_PICK_RANGE');
  }

  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'keno bet');

  // Draw numbers.
  const { drawn, nonce, serverSeedHash } = drawNumbers(userId, POOL_SIZE, DRAW_COUNT);

  // Calculate hits.
  const drawnSet = new Set(drawn);
  const hits = picks.filter((p) => drawnSet.has(p));
  const hitCount = hits.length;

  // Look up payout.
  const payoutTable = PAYOUTS[picks.length];
  const multiplier = payoutTable[hitCount] || 0;
  const payout = Math.floor(bet * multiplier);
  const won = payout > 0;

  let newBalance;
  if (won) {
    newBalance = updateBalance(userId, payout, 'keno win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'keno', bet, payout, won, JSON.stringify({
    picks, drawn, hits, hitCount, multiplier,
  }));

  const vipResult = addWagered(userId, bet);

  return {
    picks,
    drawn,
    hits,
    hitCount,
    multiplier,
    payout,
    won,
    newBalance,
    nonce,
    serverSeedHash,
    vipLevelUp: vipResult.newLevel,
  };
};

module.exports = { playKeno, POOL_SIZE, DRAW_COUNT, MAX_PICKS, PAYOUTS };
