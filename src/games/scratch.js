const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

// ─── Scratch Card Configuration ─────────────────────────────────────────────
// A 3x3 grid of hidden tiles. Each tile hides a prize symbol. Match 3 of the
// same symbol to win that prize tier. The card can contain multiple matches.

const GRID_SIZE = 3;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE; // 9 tiles

// Prize symbols ordered by rarity (rarest first).
// Each has a multiplier and a weight controlling how often it appears.
const PRIZE_SYMBOLS = [
  { id: 'jackpot',  label: 'JACKPOT',  emoji: '💎', multiplier: 100, weight: 1 },
  { id: 'gold',     label: 'GOLD',     emoji: '🥇', multiplier: 25,  weight: 3 },
  { id: 'silver',   label: 'SILVER',   emoji: '🥈', multiplier: 10,  weight: 6 },
  { id: 'bronze',   label: 'BRONZE',   emoji: '🥉', multiplier: 5,   weight: 10 },
  { id: 'star',     label: 'STAR',     emoji: '⭐', multiplier: 3,   weight: 14 },
  { id: 'coin',     label: 'COIN',     emoji: '🪙', multiplier: 2,   weight: 18 },
  { id: 'cherry',   label: 'CHERRY',   emoji: '🍒', multiplier: 1,   weight: 22 },
  { id: 'blank',    label: 'BLANK',    emoji: '❌', multiplier: 0,   weight: 26 },
];

const TOTAL_WEIGHT = PRIZE_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

/**
 * Picks a prize symbol using a weighted random selection.
 * @param {number} roll - A float in [0, 1) from the provably fair system.
 * @returns {object} The selected prize symbol.
 */
function pickPrize(roll) {
  let cumulative = 0;
  const target = roll * TOTAL_WEIGHT;
  for (const symbol of PRIZE_SYMBOLS) {
    cumulative += symbol.weight;
    if (target < cumulative) return symbol;
  }
  return PRIZE_SYMBOLS[PRIZE_SYMBOLS.length - 1];
}

/**
 * Generates a scratch card. Each of the 9 tiles gets a random prize symbol.
 * Uses 9 sequential provably fair results.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount (card price).
 * @returns {object} The initial game state.
 */
function buyScratchCard(userId, bet) {
  updateBalance(userId, -bet, 'scratch buy');

  // Generate the 9 tiles.
  const tiles = [];
  let firstNonce = null;
  let firstHash = null;

  for (let i = 0; i < TOTAL_TILES; i++) {
    const { result, nonce, serverSeedHash } = getNextResult(userId);
    if (i === 0) {
      firstNonce = nonce;
      firstHash = serverSeedHash;
    }
    tiles.push(pickPrize(result));
  }

  const vipResult = addWagered(userId, bet);

  return {
    userId,
    bet,
    tiles,               // Array of 9 prize symbol objects.
    revealed: [],        // Indices of revealed tiles.
    status: 'scratching', // 'scratching' | 'complete'
    payout: 0,
    matches: [],
    newBalance: null,
    nonce: firstNonce,
    serverSeedHash: firstHash,
    vipLevelUp: vipResult.newLevel,
  };
}

/**
 * Reveals a single tile on the scratch card.
 *
 * @param {object} state - The game state.
 * @param {number} index - The tile index to reveal (0-8).
 */
function revealTile(state, index) {
  if (state.status !== 'scratching') throw new Error('GAME_OVER');
  if (index < 0 || index >= TOTAL_TILES) throw new Error('INVALID_TILE');
  if (state.revealed.includes(index)) throw new Error('ALREADY_REVEALED');

  state.revealed.push(index);

  // Auto-complete when all tiles are revealed.
  if (state.revealed.length === TOTAL_TILES) {
    completeScratchCard(state);
  }
}

/**
 * Reveals all remaining tiles and calculates the payout.
 *
 * @param {object} state - The game state.
 */
function revealAll(state) {
  if (state.status !== 'scratching') throw new Error('GAME_OVER');

  for (let i = 0; i < TOTAL_TILES; i++) {
    if (!state.revealed.includes(i)) {
      state.revealed.push(i);
    }
  }

  completeScratchCard(state);
}

/**
 * Completes the scratch card: counts matches and calculates payout.
 * A "match" is 3 or more of the same non-blank symbol.
 *
 * @param {object} state - The game state.
 */
function completeScratchCard(state) {
  state.status = 'complete';

  // Count occurrences of each symbol.
  const counts = {};
  for (const tile of state.tiles) {
    if (tile.id === 'blank') continue;
    counts[tile.id] = (counts[tile.id] || 0) + 1;
  }

  // Find all symbols with 3+ matches.
  const matches = [];
  let totalMultiplier = 0;

  for (const [symbolId, count] of Object.entries(counts)) {
    if (count >= 3) {
      const symbol = PRIZE_SYMBOLS.find((s) => s.id === symbolId);
      if (symbol) {
        // Bonus: 4 matches = 2x the multiplier, 5+ = 3x.
        let bonus = 1;
        if (count === 4) bonus = 2;
        else if (count >= 5) bonus = 3;

        const matchMultiplier = symbol.multiplier * bonus;
        totalMultiplier += matchMultiplier;
        matches.push({
          symbol: symbol.id,
          label: symbol.label,
          emoji: symbol.emoji,
          count,
          multiplier: matchMultiplier,
        });
      }
    }
  }

  state.matches = matches;
  const won = totalMultiplier > 0;
  state.payout = won ? Math.floor(state.bet * totalMultiplier) : 0;

  if (won && state.payout > 0) {
    state.newBalance = updateBalance(state.userId, state.payout, 'scratch win');
  } else {
    state.newBalance = getBalance(state.userId);
  }

  recordGame(state.userId, 'scratch', state.bet, state.payout, won, JSON.stringify({
    tiles: state.tiles.map((t) => t.id),
    matches,
    totalMultiplier,
  }));
}

module.exports = {
  buyScratchCard,
  revealTile,
  revealAll,
  completeScratchCard,
  PRIZE_SYMBOLS,
  GRID_SIZE,
  TOTAL_TILES,
};
