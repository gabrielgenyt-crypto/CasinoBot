const { EmbedBuilder } = require('discord.js');
const { log, ACTIONS } = require('../utils/auditLog');

/**
 * Notification service for big win announcements and user DMs.
 *
 * Big wins are announced in a configured channel (BIG_WIN_CHANNEL_ID env var).
 * Deposit/withdrawal confirmations are sent as DMs.
 */

// Threshold: wins above this multiplier or this coin amount trigger an announcement.
const BIG_WIN_MULTIPLIER = 10;
const BIG_WIN_AMOUNT = 5000;

/**
 * Checks if a game result qualifies as a "big win" and announces it.
 *
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {object} params - Win parameters.
 * @param {string} params.userId - The winner's Discord user ID.
 * @param {string} params.username - The winner's display name.
 * @param {string} params.game - The game name.
 * @param {number} params.bet - The wager amount.
 * @param {number} params.payout - The payout amount.
 * @param {number} [params.multiplier] - The win multiplier.
 */
const checkBigWin = async (client, { userId, username, game, bet, payout, multiplier }) => {
  const profit = payout - bet;
  const effectiveMultiplier = multiplier || (bet > 0 ? payout / bet : 0);

  const isBigWin =
    effectiveMultiplier >= BIG_WIN_MULTIPLIER || profit >= BIG_WIN_AMOUNT;

  if (!isBigWin) return;

  // Log the big win.
  log(userId, ACTIONS.BIG_WIN, {
    details: JSON.stringify({ game, bet, payout, multiplier: effectiveMultiplier }),
  });

  const channelId = process.env.BIG_WIN_CHANNEL_ID;
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('BIG WIN!')
      .setDescription(
        `**${username}** just won **${payout}** coins on **${game}**!\n` +
        `Bet: ${bet} | Multiplier: ${effectiveMultiplier.toFixed(2)}x | Profit: +${profit}`
      )
      .setColor(0xf1c40f)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.warn('[NOTIFY] Failed to send big win announcement:', error.message);
  }
};

/**
 * Sends a DM to a user. Silently fails if DMs are disabled.
 *
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string} userId - The target user's Discord ID.
 * @param {string|object} content - The message content or embed options.
 */
const sendDm = async (client, userId, content) => {
  try {
    const user = await client.users.fetch(userId);
    if (typeof content === 'string') {
      await user.send(content);
    } else {
      await user.send(content);
    }
  } catch (_error) {
    // User may have DMs disabled -- this is expected.
  }
};

/**
 * Sends a withdrawal status update DM.
 *
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string} userId - The user's Discord ID.
 * @param {object} params - Withdrawal details.
 * @param {string} params.status - The new status (approved, rejected, completed).
 * @param {number} params.amount - The withdrawal amount.
 * @param {string} params.chain - The blockchain.
 * @param {string} [params.txHash] - The transaction hash (if completed).
 */
const notifyWithdrawalUpdate = async (client, userId, { status, amount, chain, txHash }) => {
  let message;
  switch (status) {
  case 'approved':
    message = `Your withdrawal of **${amount}** coins on **${chain}** has been approved and is being processed.`;
    break;
  case 'rejected':
    message = `Your withdrawal of **${amount}** coins on **${chain}** has been rejected. The funds have been returned to your balance.`;
    break;
  case 'completed':
    message = `Your withdrawal of **${amount}** coins on **${chain}** is complete!\nTX: \`${txHash}\``;
    break;
  default:
    return;
  }

  await sendDm(client, userId, message);
};

module.exports = {
  checkBigWin,
  sendDm,
  notifyWithdrawalUpdate,
  BIG_WIN_MULTIPLIER,
  BIG_WIN_AMOUNT,
};
