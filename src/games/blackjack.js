const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Draws a card from a virtual infinite deck using a provably fair result.
 * @param {number} result - A float in [0, 1) from the provably fair system.
 * @returns {{ rank: string, suit: string, display: string }}
 */
const drawCard = (result) => {
  const cardIndex = Math.floor(result * 52);
  const rank = RANKS[cardIndex % 13];
  const suit = SUITS[Math.floor(cardIndex / 13)];
  return { rank, suit, display: `${rank}${suit}` };
};

/**
 * Calculates the best hand value, treating Aces as 11 or 1.
 * @param {Array<{rank: string}>} hand - Array of card objects.
 * @returns {number} The best hand value (highest without busting, or lowest if busted).
 */
const handValue = (hand) => {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      total += 11;
      aces++;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank, 10);
    }
  }

  // Downgrade aces from 11 to 1 as needed.
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
};

/**
 * Formats a hand for display.
 * @param {Array<{display: string}>} hand - Array of card objects.
 * @returns {string}
 */
const formatHand = (hand) => hand.map((c) => c.display).join(' ');

/**
 * Creates a new blackjack game state. Deals 2 cards to the player and 2 to
 * the dealer (one face-down).
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @returns {object} The initial game state.
 */
const startBlackjack = (userId, bet) => {
  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'blackjack bet');

  // Deal 4 cards: player1, dealer1, player2, dealer2.
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const { result } = getNextResult(userId);
    cards.push(drawCard(result));
  }

  const playerHand = [cards[0], cards[2]];
  const dealerHand = [cards[1], cards[3]];

  const state = {
    userId,
    bet,
    playerHand,
    dealerHand,
    status: 'playing', // playing | stand | bust | blackjack | resolved
    doubled: false,
  };

  // Check for natural blackjack.
  if (handValue(playerHand) === 21) {
    state.status = 'blackjack';
    return resolveGame(state);
  }

  return state;
};

/**
 * Player hits: draws one more card.
 * @param {object} state - The current game state.
 * @returns {object} Updated game state.
 */
const hit = (state) => {
  const { result } = getNextResult(state.userId);
  state.playerHand.push(drawCard(result));

  if (handValue(state.playerHand) > 21) {
    state.status = 'bust';
    return resolveGame(state);
  }

  if (handValue(state.playerHand) === 21) {
    state.status = 'stand';
    return resolveGame(state);
  }

  return state;
};

/**
 * Player stands: dealer plays out their hand.
 * @param {object} state - The current game state.
 * @returns {object} Resolved game state.
 */
const stand = (state) => {
  state.status = 'stand';
  return resolveGame(state);
};

/**
 * Player doubles down: doubles the bet, draws exactly one card, then stands.
 * @param {object} state - The current game state.
 * @returns {object} Resolved game state.
 */
const double = (state) => {
  // Deduct the additional bet.
  updateBalance(state.userId, -state.bet, 'blackjack double');
  state.bet *= 2;
  state.doubled = true;

  const { result } = getNextResult(state.userId);
  state.playerHand.push(drawCard(result));

  if (handValue(state.playerHand) > 21) {
    state.status = 'bust';
  } else {
    state.status = 'stand';
  }

  return resolveGame(state);
};

/**
 * Resolves the game: dealer draws to 17+, determines winner, pays out.
 * @param {object} state - The current game state.
 * @returns {object} Final game state with outcome.
 */
const resolveGame = (state) => {
  const playerVal = handValue(state.playerHand);

  // If player busted, no need for dealer to play.
  if (state.status === 'bust') {
    state.outcome = 'lose';
    state.payout = 0;
    state.newBalance = getBalance(state.userId);
    recordGame(state.userId, 'blackjack', state.bet, 0, false, JSON.stringify({
      player: formatHand(state.playerHand),
      dealer: formatHand(state.dealerHand),
      playerValue: playerVal,
      dealerValue: handValue(state.dealerHand),
    }));
    state.vipLevelUp = addWagered(state.userId, state.bet).newLevel;
    return state;
  }

  // Dealer draws to 17.
  while (handValue(state.dealerHand) < 17) {
    const { result } = getNextResult(state.userId);
    state.dealerHand.push(drawCard(result));
  }

  const dealerVal = handValue(state.dealerHand);

  let payout = 0;
  if (state.status === 'blackjack' && playerVal === 21 && state.playerHand.length === 2) {
    // Natural blackjack pays 2.5x (3:2).
    if (dealerVal === 21 && state.dealerHand.length === 2) {
      // Push -- both have blackjack.
      payout = state.bet;
      state.outcome = 'push';
    } else {
      payout = Math.floor(state.bet * 2.5);
      state.outcome = 'blackjack';
    }
  } else if (dealerVal > 21) {
    // Dealer busts.
    payout = state.bet * 2;
    state.outcome = 'win';
  } else if (playerVal > dealerVal) {
    payout = state.bet * 2;
    state.outcome = 'win';
  } else if (playerVal === dealerVal) {
    payout = state.bet;
    state.outcome = 'push';
  } else {
    state.outcome = 'lose';
  }

  if (payout > 0) {
    state.newBalance = updateBalance(state.userId, payout, `blackjack ${state.outcome}`);
  } else {
    state.newBalance = getBalance(state.userId);
  }

  state.payout = payout;
  const won = state.outcome === 'win' || state.outcome === 'blackjack';

  recordGame(state.userId, 'blackjack', state.bet, payout, won, JSON.stringify({
    player: formatHand(state.playerHand),
    dealer: formatHand(state.dealerHand),
    playerValue: playerVal,
    dealerValue: dealerVal,
    outcome: state.outcome,
  }));

  state.vipLevelUp = addWagered(state.userId, state.bet).newLevel;

  return state;
};

module.exports = {
  startBlackjack,
  hit,
  stand,
  double,
  handValue,
  formatHand,
};
