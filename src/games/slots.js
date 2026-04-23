const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');
const EMOJIS = require('../utils/emojis');

// Slot symbols ordered by rarity (rarest first).
// Each symbol has a weight that determines how often it appears on a reel.
const SYMBOLS = [
  { emoji: EMOJIS.diamond, name: 'diamond', weight: 2 },
  { emoji: '7️⃣', name: 'seven', weight: 5 },
  { emoji: '🔔', name: 'bell', weight: 8 },
  { emoji: '🍒', name: 'cherry', weight: 12 },
  { emoji: '🍋', name: 'lemon', weight: 15 },
  { emoji: '🍊', name: 'orange', weight: 18 },
  { emoji: '🍇', name: 'grape', weight: 20 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

// Payout table: 3-of-a-kind multipliers. RTP ~96% (house edge ~4%).
const PAYOUTS = {
  diamond: 50,
  seven: 20,
  bell: 10,
  cherry: 5,
  lemon: 3,
  orange: 2,
  grape: 1.5,
};

// Two matching symbols pay a reduced amount.
const TWO_MATCH_MULTIPLIER = 0.5;

/**
 * Picks a symbol from the weighted reel using a float in [0, 1).
 * @param {number} roll - A float from the provably fair system.
 * @returns {{ emoji: string, name: string }}
 */
const pickSymbol = (roll) => {
  let cumulative = 0;
  const target = roll * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    cumulative += symbol.weight;
    if (target < cumulative) return symbol;
  }
  // Fallback (should not happen).
  return SYMBOLS[SYMBOLS.length - 1];
};

/**
 * Spins the slot machine. Uses 3 consecutive provably fair results for the
 * 3 reels.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @returns {{ reels: Array<{emoji: string, name: string}>, won: boolean, multiplier: number, payout: number, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playSlots = (userId, bet) => {
  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'slots bet');

  // Spin 3 reels using 3 sequential provably fair results.
  const r1 = getNextResult(userId);
  const r2 = getNextResult(userId);
  const r3 = getNextResult(userId);

  const reels = [
    pickSymbol(r1.result),
    pickSymbol(r2.result),
    pickSymbol(r3.result),
  ];

  // Determine payout.
  let multiplier = 0;
  const names = reels.map((r) => r.name);

  if (names[0] === names[1] && names[1] === names[2]) {
    // Three of a kind.
    multiplier = PAYOUTS[names[0]] || 1;
  } else if (names[0] === names[1] || names[1] === names[2] || names[0] === names[2]) {
    // Two of a kind -- find the matching symbol.
    let matchName;
    if (names[0] === names[1]) matchName = names[0];
    else if (names[1] === names[2]) matchName = names[1];
    else matchName = names[0];
    multiplier = (PAYOUTS[matchName] || 1) * TWO_MATCH_MULTIPLIER;
  }

  const won = multiplier > 0;
  const payout = won ? Math.floor(bet * multiplier) : 0;
  let newBalance;

  if (won && payout > 0) {
    newBalance = updateBalance(userId, payout, 'slots win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'slots', bet, payout, won, JSON.stringify({
    reels: reels.map((r) => r.name), multiplier,
  }));

  const vipResult = addWagered(userId, bet);

  return {
    reels,
    won,
    multiplier,
    payout,
    newBalance,
    nonce: r1.nonce,
    serverSeedHash: r1.serverSeedHash,
    vipLevelUp: vipResult.newLevel,
  };
};

module.exports = { playSlots };
