const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

const TILES_PER_FLOOR = 3;
const TOTAL_FLOORS = 8;

// Difficulty determines how many traps per floor.
const DIFFICULTIES = {
  easy:   { traps: 1, label: 'Easy (1 trap)' },
  medium: { traps: 2, label: 'Medium (2 traps)' },
};

/**
 * Calculates the multiplier for reaching a given floor.
 * Based on the probability of surviving that many floors.
 *
 * @param {number} floor - The floor reached (1-based).
 * @param {number} traps - Number of traps per floor.
 * @returns {number} The cumulative multiplier.
 */
function getMultiplier(floor, traps) {
  if (floor <= 0) return 1;
  const safeChance = (TILES_PER_FLOOR - traps) / TILES_PER_FLOOR;
  // 0.97 factor for ~3% house edge.
  const raw = 0.97 / Math.pow(safeChance, floor);
  return parseFloat(raw.toFixed(2));
}

/**
 * Starts a new tower game.
 *
 * @param {string} userId
 * @param {number} bet
 * @param {string} difficulty - 'easy' or 'medium'.
 * @returns {object} The initial game state.
 */
function startTower(userId, bet, difficulty = 'easy') {
  const diff = DIFFICULTIES[difficulty];
  if (!diff) throw new Error('INVALID_DIFFICULTY');

  updateBalance(userId, -bet, 'tower bet');

  // Pre-generate all trap positions using provably fair results.
  const trapPositions = [];
  let firstNonce = null;
  let firstHash = null;

  for (let floor = 0; floor < TOTAL_FLOORS; floor++) {
    const trapsOnFloor = [];
    const available = [0, 1, 2];

    for (let t = 0; t < diff.traps; t++) {
      const { result, nonce, serverSeedHash } = getNextResult(userId);
      if (floor === 0 && t === 0) {
        firstNonce = nonce;
        firstHash = serverSeedHash;
      }
      const idx = Math.floor(result * available.length);
      trapsOnFloor.push(available[idx]);
      available.splice(idx, 1);
    }

    trapPositions.push(trapsOnFloor);
  }

  const vipResult = addWagered(userId, bet);

  return {
    userId,
    bet,
    difficulty,
    traps: diff.traps,
    trapPositions,
    currentFloor: 0,
    status: 'playing', // 'playing' | 'exploded' | 'cashed_out'
    multiplier: 1,
    payout: 0,
    newBalance: null,
    nonce: firstNonce,
    serverSeedHash: firstHash,
    vipLevelUp: vipResult.newLevel,
  };
}

/**
 * Player picks a tile on the current floor.
 *
 * @param {object} state - The game state.
 * @param {number} tile - The tile index (0, 1, or 2).
 */
function climbFloor(state, tile) {
  if (state.status !== 'playing') throw new Error('GAME_OVER');
  if (tile < 0 || tile >= TILES_PER_FLOOR) throw new Error('INVALID_TILE');
  if (state.currentFloor >= TOTAL_FLOORS) throw new Error('MAX_FLOOR');

  const traps = state.trapPositions[state.currentFloor];

  if (traps.includes(tile)) {
    // Hit a trap.
    state.status = 'exploded';
    state.multiplier = 0;
    state.payout = 0;
    state.newBalance = getBalance(state.userId);

    recordGame(state.userId, 'tower', state.bet, 0, false, JSON.stringify({
      difficulty: state.difficulty,
      floor: state.currentFloor,
      trapPositions: state.trapPositions,
    }));
  } else {
    // Safe -- advance.
    state.currentFloor++;
    state.multiplier = getMultiplier(state.currentFloor, state.traps);

    // Auto cash-out at max floor.
    if (state.currentFloor >= TOTAL_FLOORS) {
      cashOutTower(state);
    }
  }
}

/**
 * Player cashes out at the current floor.
 *
 * @param {object} state - The game state.
 */
function cashOutTower(state) {
  if (state.status !== 'playing') throw new Error('GAME_OVER');
  if (state.currentFloor <= 0) throw new Error('MUST_CLIMB');

  state.status = 'cashed_out';
  state.payout = Math.floor(state.bet * state.multiplier);
  state.newBalance = updateBalance(state.userId, state.payout, 'tower win');

  recordGame(state.userId, 'tower', state.bet, state.payout, true, JSON.stringify({
    difficulty: state.difficulty,
    floor: state.currentFloor,
    multiplier: state.multiplier,
    trapPositions: state.trapPositions,
  }));
}

module.exports = {
  startTower,
  climbFloor,
  cashOutTower,
  getMultiplier,
  TILES_PER_FLOOR,
  TOTAL_FLOORS,
  DIFFICULTIES,
};
