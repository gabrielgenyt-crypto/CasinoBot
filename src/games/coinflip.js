const { getNextResult } = require('../utils/provablyFair');
const { updateBalance, getBalance, recordGame } = require('../utils/wallet');
const { addWagered } = require('../utils/vip');

/**
 * Runs a coinflip game for the given user.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {'heads'|'tails'} choice - The user's pick.
 * @returns {{ won: boolean, side: string, payout: number, newBalance: number, nonce: number, serverSeedHash: string }}
 */
const playCoinflip = (userId, bet, choice) => {
  // Deduct the bet first (atomic -- throws on insufficient funds).
  updateBalance(userId, -bet, 'coinflip bet');

  const { result, nonce, serverSeedHash } = getNextResult(userId);
  const side = result < 0.5 ? 'heads' : 'tails';
  const won = side === choice;

  let payout = 0;
  let newBalance;

  if (won) {
    // 2x payout on win (bet is already deducted, so credit 2x).
    payout = bet * 2;
    newBalance = updateBalance(userId, payout, 'coinflip win');
  } else {
    // Bet was already deducted; nothing more to do.
    newBalance = getBalance(userId);
  }

  recordGame(userId, 'coinflip', bet, payout, won, JSON.stringify({
    side, choice,
  }));

  const vipResult = addWagered(userId, bet);

  return { won, side, payout, newBalance, nonce, serverSeedHash, vipLevelUp: vipResult.newLevel };
};

module.exports = { playCoinflip };
