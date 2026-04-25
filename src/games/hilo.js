const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

// Standard 52-card deck values. Ace = 1, Jack = 11, Queen = 12, King = 13.
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const DECK_SIZE = 52;

/**
 * Converts a deck index (0-51) to a card object.
 * @param {number} index
 * @returns {{ rank: string, suit: string, value: number }}
 */
function indexToCard(index) {
  const rankIdx = index % 13;
  const suitIdx = Math.floor(index / 13);
  return {
    rank: RANKS[rankIdx],
    suit: SUITS[suitIdx],
    value: rankIdx + 1, // 1 (Ace) through 13 (King).
  };
}

/**
 * Draws a card using a provably fair result.
 * @param {string} userId
 * @returns {{ card: { rank: string, suit: string, value: number }, nonce: number, serverSeedHash: string }}
 */
function drawCard(userId) {
  const { result, nonce, serverSeedHash } = getNextResult(userId);
  const index = Math.floor(result * DECK_SIZE);
  return { card: indexToCard(index), nonce, serverSeedHash };
}

/**
 * Calculates the multiplier for a correct guess based on the current card.
 * Higher multiplier when fewer cards satisfy the guess direction.
 * House edge ~3%.
 *
 * @param {number} currentValue - The current card value (1-13).
 * @param {'higher'|'lower'|'same'} guess - The player's guess.
 * @returns {number} The multiplier for this guess.
 */
function guessMultiplier(currentValue, guess) {
  let winCards;
  if (guess === 'higher') {
    winCards = 13 - currentValue; // Cards strictly higher.
  } else if (guess === 'lower') {
    winCards = currentValue - 1; // Cards strictly lower.
  } else {
    // 'same' -- 4 cards of same rank out of 52, but value-wise 1/13.
    winCards = 1;
  }

  if (winCards <= 0) return 0; // Impossible guess.

  const winChance = winCards / 13;
  // 0.97 factor for ~3% house edge.
  return parseFloat((0.97 / winChance).toFixed(2));
}

/**
 * Starts a new Hi-Lo game.
 *
 * @param {string} userId
 * @param {number} bet
 * @returns {object} The initial game state.
 */
function startHilo(userId, bet) {
  updateBalance(userId, -bet, 'hilo bet');

  const { card, nonce, serverSeedHash } = drawCard(userId);
  const vipResult = addWagered(userId, bet);

  return {
    userId,
    bet,
    cards: [card],
    currentCard: card,
    roundMultiplier: 1,
    status: 'playing', // 'playing' | 'lost' | 'cashed_out'
    payout: 0,
    newBalance: null,
    nonce,
    serverSeedHash,
    vipLevelUp: vipResult.newLevel,
  };
}

/**
 * Player makes a guess (higher, lower, or same).
 *
 * @param {object} state - The game state.
 * @param {'higher'|'lower'|'same'} guess - The player's guess.
 */
function guessHilo(state, guess) {
  if (state.status !== 'playing') throw new Error('GAME_OVER');
  if (!['higher', 'lower', 'same'].includes(guess)) throw new Error('INVALID_GUESS');

  const mult = guessMultiplier(state.currentCard.value, guess);
  if (mult === 0) throw new Error('IMPOSSIBLE_GUESS');

  // Draw the next card.
  const { card } = drawCard(state.userId);
  state.cards.push(card);

  // Check if the guess is correct.
  let correct = false;
  if (guess === 'higher') {
    correct = card.value > state.currentCard.value;
  } else if (guess === 'lower') {
    correct = card.value < state.currentCard.value;
  } else {
    correct = card.value === state.currentCard.value;
  }

  state.currentCard = card;

  if (correct) {
    state.roundMultiplier = parseFloat((state.roundMultiplier * mult).toFixed(2));
  } else {
    state.status = 'lost';
    state.payout = 0;
    state.newBalance = getBalance(state.userId);

    recordGame(state.userId, 'hilo', state.bet, 0, false, JSON.stringify({
      cards: state.cards.map((c) => `${c.rank}${c.suit}`),
      multiplier: state.roundMultiplier,
    }));
  }
}

/**
 * Player cashes out.
 *
 * @param {object} state - The game state.
 */
function cashOutHilo(state) {
  if (state.status !== 'playing') throw new Error('GAME_OVER');
  if (state.cards.length < 2) throw new Error('MUST_GUESS');

  state.status = 'cashed_out';
  state.payout = Math.floor(state.bet * state.roundMultiplier);
  state.newBalance = updateBalance(state.userId, state.payout, 'hilo win');

  recordGame(state.userId, 'hilo', state.bet, state.payout, true, JSON.stringify({
    cards: state.cards.map((c) => `${c.rank}${c.suit}`),
    multiplier: state.roundMultiplier,
  }));
}

module.exports = {
  startHilo,
  guessHilo,
  cashOutHilo,
  guessMultiplier,
  RANKS,
  SUITS,
};
