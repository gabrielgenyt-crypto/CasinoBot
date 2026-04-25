const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

// Grid is 5x5 = 25 tiles.
const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

/**
 * Calculates the payout multiplier for revealing `revealed` safe tiles
 * out of a grid with `mineCount` mines. Uses the combinatorial formula:
 *   multiplier = C(total, revealed) / C(total - mines, revealed) * (1 - houseEdge)
 *
 * @param {number} revealed - Number of safe tiles revealed so far.
 * @param {number} mineCount - Number of mines on the board.
 * @returns {number} The current multiplier (>= 1.0).
 */
const getMultiplier = (revealed, mineCount) => {
  if (revealed === 0) return 1;
  const safeTiles = TOTAL_TILES - mineCount;
  let multiplier = 1;
  for (let i = 0; i < revealed; i++) {
    multiplier *= (TOTAL_TILES - i) / (safeTiles - i);
  }
  // Apply 2% house edge.
  return Math.floor(multiplier * 0.98 * 100) / 100;
};

/**
 * Starts a new mines game. Places mines randomly using provably fair results.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {number} mineCount - Number of mines (1-24).
 * @returns {object} The initial game state.
 */
const startMines = (userId, bet, mineCount) => {
  if (mineCount < 1 || mineCount > TOTAL_TILES - 1) {
    throw new Error('INVALID_MINE_COUNT');
  }

  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'mines bet');

  // Place mines using Fisher-Yates shuffle with provably fair results.
  const indices = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  for (let i = TOTAL_TILES - 1; i > 0; i--) {
    const { result } = getNextResult(userId);
    const j = Math.floor(result * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const minePositions = new Set(indices.slice(0, mineCount));

  const state = {
    userId,
    bet,
    mineCount,
    minePositions: [...minePositions],
    revealed: [],       // Indices of revealed safe tiles.
    status: 'playing',  // playing | exploded | cashed_out
    multiplier: 1,
    payout: 0,
  };

  addWagered(userId, bet);

  return state;
};

/**
 * Reveals a tile on the mines grid.
 *
 * @param {object} state - The current game state.
 * @param {number} index - The tile index to reveal (0-24).
 * @returns {object} Updated game state.
 */
const revealTile = (state, index) => {
  if (state.status !== 'playing') throw new Error('GAME_OVER');
  if (index < 0 || index >= TOTAL_TILES) throw new Error('INVALID_TILE');
  if (state.revealed.includes(index)) throw new Error('ALREADY_REVEALED');

  const mineSet = new Set(state.minePositions);

  if (mineSet.has(index)) {
    // Hit a mine -- game over.
    state.status = 'exploded';
    state.revealed.push(index);
    state.multiplier = 0;
    state.payout = 0;
    state.newBalance = getBalance(state.userId);

    recordGame(state.userId, 'mines', state.bet, 0, false, JSON.stringify({
      mineCount: state.mineCount,
      revealed: state.revealed.length,
      exploded: true,
    }));

    return state;
  }

  // Safe tile.
  state.revealed.push(index);
  state.multiplier = getMultiplier(state.revealed.length, state.mineCount);

  // Check if all safe tiles are revealed (auto-cashout).
  const safeTiles = TOTAL_TILES - state.mineCount;
  if (state.revealed.length >= safeTiles) {
    return cashOut(state);
  }

  return state;
};

/**
 * Cashes out the current mines game.
 *
 * @param {object} state - The current game state.
 * @returns {object} Final game state with payout.
 */
const cashOut = (state) => {
  if (state.status !== 'playing') throw new Error('GAME_OVER');
  if (state.revealed.length === 0) throw new Error('REVEAL_FIRST');

  state.status = 'cashed_out';
  state.payout = Math.floor(state.bet * state.multiplier);
  state.newBalance = updateBalance(state.userId, state.payout, 'mines cashout');

  recordGame(state.userId, 'mines', state.bet, state.payout, true, JSON.stringify({
    mineCount: state.mineCount,
    revealed: state.revealed.length,
    multiplier: state.multiplier,
  }));

  return state;
};

module.exports = { startMines, revealTile, cashOut, getMultiplier, GRID_SIZE, TOTAL_TILES };
