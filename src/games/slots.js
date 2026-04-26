const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');
const { contributeToJackpot, checkJackpotTrigger, awardJackpot } = require('../utils/jackpot');
const EMOJIS = require('../utils/emojis');

// ─── Symbol Definitions ─────────────────────────────────────────────────────
// Each symbol has a weight (rarity), a display emoji, and a visual id used by
// the PNG renderer to draw the correct graphic.

const SYMBOLS = [
  { id: 'diamond',  emoji: EMOJIS.diamond, name: 'diamond',  weight: 2 },
  { id: 'seven',    emoji: '7️⃣',           name: 'seven',    weight: 4 },
  { id: 'bell',     emoji: '🔔',           name: 'bell',     weight: 7 },
  { id: 'cherry',   emoji: '🍒',           name: 'cherry',   weight: 11 },
  { id: 'lemon',    emoji: '🍋',           name: 'lemon',    weight: 14 },
  { id: 'orange',   emoji: '🍊',           name: 'orange',   weight: 16 },
  { id: 'grape',    emoji: '🍇',           name: 'grape',    weight: 18 },
];

// Special symbols.
const WILD  = { id: 'wild',    emoji: '⭐',  name: 'wild',    weight: 3 };
const SCATTER = { id: 'scatter', emoji: '💫', name: 'scatter', weight: 4 };

// Full reel strip including specials.
const REEL_SYMBOLS = [...SYMBOLS, WILD, SCATTER];
const TOTAL_WEIGHT = REEL_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

// ─── Payout Table ───────────────────────────────────────────────────────────
// Multipliers for 3, 4, or 5 of a kind on a payline.
const PAYOUTS = {
  diamond: { 3: 15, 4: 50, 5: 200 },
  seven:   { 3: 8,  4: 25, 5: 100 },
  bell:    { 3: 5,  4: 15, 5: 50 },
  cherry:  { 3: 3,  4: 8,  5: 25 },
  lemon:   { 3: 2,  4: 5,  5: 15 },
  orange:  { 3: 1.5, 4: 3, 5: 10 },
  grape:   { 3: 1,  4: 2,  5: 8 },
  wild:    { 3: 20, 4: 75, 5: 500 },
};

// ─── Paylines ───────────────────────────────────────────────────────────────
// Each payline is an array of 5 row indices (one per reel), for a 5x3 grid.
// Row 0 = top, 1 = middle, 2 = bottom.
const PAYLINES = [
  [1, 1, 1, 1, 1], // Middle straight
  [0, 0, 0, 0, 0], // Top straight
  [2, 2, 2, 2, 2], // Bottom straight
  [0, 1, 2, 1, 0], // V shape
  [2, 1, 0, 1, 2], // Inverted V
  [0, 0, 1, 2, 2], // Diagonal down
  [2, 2, 1, 0, 0], // Diagonal up
  [1, 0, 0, 0, 1], // Shallow V top
  [1, 2, 2, 2, 1], // Shallow V bottom
  [0, 1, 1, 1, 0], // Flat bump top
  [2, 1, 1, 1, 2], // Flat bump bottom
  [1, 0, 1, 0, 1], // Zigzag up
  [1, 2, 1, 2, 1], // Zigzag down
  [0, 1, 0, 1, 0], // Wave top
  [2, 1, 2, 1, 2], // Wave bottom
  [0, 0, 1, 0, 0], // Dip top
  [2, 2, 1, 2, 2], // Bump bottom
  [1, 0, 2, 0, 1], // W shape
  [1, 2, 0, 2, 1], // M shape
  [0, 2, 0, 2, 0], // Deep zigzag
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Picks a symbol from the weighted reel using a float in [0, 1).
 * @param {number} roll - A float from the provably fair system.
 * @returns {object} The selected symbol.
 */
const pickSymbol = (roll) => {
  let cumulative = 0;
  const target = roll * TOTAL_WEIGHT;
  for (const symbol of REEL_SYMBOLS) {
    cumulative += symbol.weight;
    if (target < cumulative) return symbol;
  }
  return REEL_SYMBOLS[REEL_SYMBOLS.length - 1];
};

/**
 * Evaluates a single payline for matches, treating wilds as substitutes.
 * Returns the best match (longest run from left) and its payout info.
 *
 * @param {object[][]} grid - 5x3 grid of symbols (grid[reel][row]).
 * @param {number[]} payline - Array of 5 row indices.
 * @returns {{ symbol: string, count: number, multiplier: number }|null}
 */
function evaluatePayline(grid, payline) {
  const lineSymbols = payline.map((row, reel) => grid[reel][row]);

  // Find the first non-wild symbol to anchor the match.
  let anchor = null;
  for (const sym of lineSymbols) {
    if (sym.id !== 'wild' && sym.id !== 'scatter') {
      anchor = sym.id;
      break;
    }
  }

  // If all wilds, treat as wild match.
  if (anchor === null) {
    anchor = 'wild';
  }

  // Count consecutive matches from left (wilds count as matches).
  let count = 0;
  for (const sym of lineSymbols) {
    if (sym.id === anchor || sym.id === 'wild') {
      count++;
    } else {
      break;
    }
  }

  if (count < 3) return null;

  const payoutEntry = PAYOUTS[anchor];
  if (!payoutEntry) return null;

  const multiplier = payoutEntry[count] || 0;
  if (multiplier === 0) return null;

  return { symbol: anchor, count, multiplier };
}

/**
 * Counts scatter symbols across the entire grid.
 * @param {object[][]} grid - 5x3 grid.
 * @returns {number}
 */
function countScatters(grid) {
  let count = 0;
  for (const reel of grid) {
    for (const sym of reel) {
      if (sym.id === 'scatter') count++;
    }
  }
  return count;
}

// ─── Free Spins ─────────────────────────────────────────────────────────────

const FREE_SPIN_TABLE = {
  3: { spins: 8,  multiplier: 2 },
  4: { spins: 12, multiplier: 3 },
  5: { spins: 15, multiplier: 5 },
};

/**
 * Runs a batch of free spins internally and returns the total winnings.
 *
 * @param {string} userId
 * @param {number} bet - Original bet amount.
 * @param {number} spins - Number of free spins.
 * @param {number} freeMultiplier - Multiplier applied to all free spin wins.
 * @returns {{ totalWin: number, spinResults: object[] }}
 */
function runFreeSpins(userId, bet, spins, freeMultiplier) {
  const spinResults = [];
  let totalWin = 0;

  for (let s = 0; s < spins; s++) {
    // Spin the 5x3 grid.
    const grid = [];
    for (let reel = 0; reel < 5; reel++) {
      const col = [];
      for (let row = 0; row < 3; row++) {
        const { result } = getNextResult(userId);
        col.push(pickSymbol(result));
      }
      grid.push(col);
    }

    // Evaluate paylines.
    let spinWin = 0;
    const wins = [];
    for (let i = 0; i < PAYLINES.length; i++) {
      const hit = evaluatePayline(grid, PAYLINES[i]);
      if (hit) {
        const lineWin = Math.floor(bet * hit.multiplier * freeMultiplier);
        spinWin += lineWin;
        wins.push({ payline: i, ...hit, payout: lineWin });
      }
    }

    totalWin += spinWin;
    spinResults.push({
      grid: grid.map((reel) => reel.map((s) => s.id)),
      wins,
      spinWin,
    });
  }

  return { totalWin, spinResults };
}

// ─── Main Game ──────────────────────────────────────────────────────────────

/**
 * Spins the 5-reel slot machine. Uses provably fair results for each cell
 * of the 5x3 grid (15 results total).
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @returns {object} Full game result.
 */
const playSlots = (userId, bet) => {
  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'slots bet');

  // Spin the 5x3 grid (5 reels, 3 rows).
  const grid = [];
  let firstNonce = null;
  let firstHash = null;

  for (let reel = 0; reel < 5; reel++) {
    const col = [];
    for (let row = 0; row < 3; row++) {
      const { result, nonce, serverSeedHash } = getNextResult(userId);
      if (reel === 0 && row === 0) {
        firstNonce = nonce;
        firstHash = serverSeedHash;
      }
      col.push(pickSymbol(result));
    }
    grid.push(col);
  }

  // Evaluate all paylines.
  const paylineWins = [];
  let baseWin = 0;

  for (let i = 0; i < PAYLINES.length; i++) {
    const hit = evaluatePayline(grid, PAYLINES[i]);
    if (hit) {
      const lineWin = Math.floor(bet * hit.multiplier);
      baseWin += lineWin;
      paylineWins.push({ payline: i, ...hit, payout: lineWin });
    }
  }

  // Check for scatter bonus (free spins).
  const scatterCount = countScatters(grid);
  let freeSpinResult = null;

  if (scatterCount >= 3) {
    const fsConfig = FREE_SPIN_TABLE[Math.min(scatterCount, 5)];
    freeSpinResult = runFreeSpins(userId, bet, fsConfig.spins, fsConfig.multiplier);
    baseWin += freeSpinResult.totalWin;
  }

  // Contribute to the progressive jackpot pool.
  contributeToJackpot(bet);

  // Check for progressive jackpot trigger.
  let jackpotWin = null;
  if (checkJackpotTrigger(bet)) {
    jackpotWin = awardJackpot(userId, userId);
    baseWin += jackpotWin.amount;
  }

  const won = baseWin > 0;
  const payout = baseWin;
  let newBalance;

  if (won && payout > 0) {
    newBalance = updateBalance(userId, payout, jackpotWin ? 'slots jackpot' : 'slots win');
  } else {
    newBalance = getBalance(userId);
  }

  // Determine the best single payline win for display purposes.
  let bestWin = null;
  if (paylineWins.length > 0) {
    bestWin = paylineWins.reduce((a, b) => (a.payout > b.payout ? a : b));
  }

  // Check for jackpot-tier wins.
  const isJackpot = jackpotWin !== null || (bestWin && bestWin.count === 5 && bestWin.symbol === 'wild');
  const isBigWin = payout >= bet * 20;
  const isMegaWin = payout >= bet * 50;

  recordGame(userId, 'slots', bet, payout, won, JSON.stringify({
    grid: grid.map((reel) => reel.map((s) => s.id)),
    paylineWins: paylineWins.length,
    scatterCount,
    freeSpins: freeSpinResult ? freeSpinResult.spinResults.length : 0,
    jackpotWin: jackpotWin ? jackpotWin.amount : 0,
  }));

  const vipResult = addWagered(userId, bet);

  return {
    grid,
    paylineWins,
    bestWin,
    scatterCount,
    freeSpinResult,
    jackpotWin,
    won,
    payout,
    newBalance,
    isJackpot,
    isBigWin,
    isMegaWin,
    nonce: firstNonce,
    serverSeedHash: firstHash,
    vipLevelUp: vipResult.newLevel,
  };
};

module.exports = {
  playSlots,
  SYMBOLS,
  WILD,
  SCATTER,
  REEL_SYMBOLS,
  PAYOUTS,
  PAYLINES,
  FREE_SPIN_TABLE,
};
