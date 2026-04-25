const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

// 8 rows of pegs. The ball bounces left or right at each row,
// landing in one of 9 slots (0-8). Slots at the edges pay more.
const ROWS = 8;
const SLOT_COUNT = ROWS + 1; // 9 slots

// Multiplier table (symmetric). Index 0 = leftmost, 4 = center, 8 = rightmost.
// House edge ~3%. Edge slots are rare (1/256 chance) so they pay big.
const SLOT_MULTIPLIERS = [5.6, 2.1, 1.4, 1.1, 0.5, 1.1, 1.4, 2.1, 5.6];

/**
 * Plays a plinko game. The ball drops through 8 rows of pegs, bouncing
 * left (0) or right (1) at each peg, determined by provably fair results.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @returns {{ path: number[], slot: number, multiplier: number, payout: number, won: boolean, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playPlinko = (userId, bet) => {
  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'plinko bet');

  const path = [];
  let position = 0; // Tracks cumulative rightward bounces.
  let firstNonce = null;
  let firstHash = null;

  for (let row = 0; row < ROWS; row++) {
    const { result, nonce, serverSeedHash } = getNextResult(userId);
    if (row === 0) {
      firstNonce = nonce;
      firstHash = serverSeedHash;
    }

    const direction = result < 0.5 ? 0 : 1; // 0 = left, 1 = right
    path.push(direction);
    position += direction;
  }

  // position is now 0..ROWS, mapping directly to slot index.
  const slot = position;
  const multiplier = SLOT_MULTIPLIERS[slot];
  const payout = Math.floor(bet * multiplier);
  const won = payout > bet;

  let newBalance;
  if (payout > 0) {
    newBalance = updateBalance(userId, payout, 'plinko win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'plinko', bet, payout, won, JSON.stringify({
    path, slot, multiplier,
  }));

  const vipResult = addWagered(userId, bet);

  return {
    path,
    slot,
    multiplier,
    payout,
    won,
    newBalance,
    nonce: firstNonce,
    serverSeedHash: firstHash,
    vipLevelUp: vipResult.newLevel,
  };
};

module.exports = { playPlinko, ROWS, SLOT_COUNT, SLOT_MULTIPLIERS };
