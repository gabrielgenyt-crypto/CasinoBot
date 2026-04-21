const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');

// European roulette: numbers 0-36. House edge 2.7% (single zero).
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

/**
 * Valid bet types and their payout multipliers (including the original bet).
 * For example, "red" pays 2x (1:1), "number" pays 36x (35:1).
 */
const BET_TYPES = {
  red: { check: (n) => RED_NUMBERS.has(n), payout: 2, label: 'Red' },
  black: { check: (n) => BLACK_NUMBERS.has(n), payout: 2, label: 'Black' },
  even: { check: (n) => n > 0 && n % 2 === 0, payout: 2, label: 'Even' },
  odd: { check: (n) => n > 0 && n % 2 === 1, payout: 2, label: 'Odd' },
  low: { check: (n) => n >= 1 && n <= 18, payout: 2, label: '1-18' },
  high: { check: (n) => n >= 19 && n <= 36, payout: 2, label: '19-36' },
  dozen1: { check: (n) => n >= 1 && n <= 12, payout: 3, label: '1st Dozen' },
  dozen2: { check: (n) => n >= 13 && n <= 24, payout: 3, label: '2nd Dozen' },
  dozen3: { check: (n) => n >= 25 && n <= 36, payout: 3, label: '3rd Dozen' },
  col1: { check: (n) => n > 0 && n % 3 === 1, payout: 3, label: 'Column 1' },
  col2: { check: (n) => n > 0 && n % 3 === 2, payout: 3, label: 'Column 2' },
  col3: { check: (n) => n > 0 && n % 3 === 0, payout: 3, label: 'Column 3' },
};

/**
 * Gets the color of a roulette number.
 * @param {number} num - The roulette number (0-36).
 * @returns {string} 'red', 'black', or 'green'.
 */
const getColor = (num) => {
  if (num === 0) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
};

/**
 * Plays a roulette round.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {string} betType - The type of bet (e.g. 'red', 'even', or a number '0'-'36').
 * @returns {{ won: boolean, number: number, color: string, betLabel: string, payout: number, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playRoulette = (userId, bet, betType) => {
  // Determine if this is a straight-up number bet or a named bet.
  let checkFn;
  let payoutMultiplier;
  let betLabel;

  const numBet = parseInt(betType, 10);
  if (!isNaN(numBet) && numBet >= 0 && numBet <= 36 && String(numBet) === betType) {
    // Straight-up number bet: 36x payout.
    checkFn = (n) => n === numBet;
    payoutMultiplier = 36;
    betLabel = `Number ${numBet}`;
  } else if (BET_TYPES[betType]) {
    checkFn = BET_TYPES[betType].check;
    payoutMultiplier = BET_TYPES[betType].payout;
    betLabel = BET_TYPES[betType].label;
  } else {
    throw new Error('INVALID_BET_TYPE');
  }

  // Deduct the bet atomically.
  updateBalance(userId, -bet, 'roulette bet');

  const { result, nonce, serverSeedHash } = getNextResult(userId);

  // Map the 0-1 float to a number 0-36.
  const number = Math.floor(result * 37);
  const color = getColor(number);
  const won = checkFn(number);

  let payout = 0;
  let newBalance;

  if (won) {
    payout = bet * payoutMultiplier;
    newBalance = updateBalance(userId, payout, 'roulette win');
  } else {
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'roulette', bet, payout, won, JSON.stringify({
    number, color, betType, betLabel,
  }));

  return { won, number, color, betLabel, payout, newBalance, nonce, serverSeedHash };
};

module.exports = { playRoulette, BET_TYPES, getColor };
