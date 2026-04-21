const { EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playSlots } = require('../games/slots');

const name = 'slots';
const aliases = ['slot', 's'];
const description = 'Spin the slot machine! Usage: =slots <bet>';

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (args.length < 1) {
    return message.reply('Usage: `=slots <bet>`\nExample: `=slots 100`');
  }

  const bet = parseInt(args[0], 10);
  if (isNaN(bet) || bet < 1) {
    return message.reply('Bet must be a positive number.');
  }

  const balance = getBalance(userId);
  if (bet > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  let result;
  try {
    result = playSlots(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    throw error;
  }

  const reelDisplay = result.reels.map((r) => r.emoji).join(' | ');
  const color = result.won ? 0x2ecc71 : 0xe74c3c;

  let outcomeText;
  if (result.multiplier >= 10) {
    outcomeText = `JACKPOT! **${result.multiplier}x** — won **${result.payout}** coins!`;
  } else if (result.won) {
    outcomeText = `**${result.multiplier}x** — won **${result.payout}** coins!`;
  } else {
    outcomeText = `No match. Lost **${bet}** coins.`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Slots')
    .setDescription(
      `**[ ${reelDisplay} ]**\n\n` +
      `${message.author.username} bet **${bet}** coins\n` +
      outcomeText
    )
    .setColor(color)
    .addFields(
      { name: 'Balance', value: `${result.newBalance}`, inline: true },
      { name: 'Nonce', value: `${result.nonce}`, inline: true }
    )
    .setFooter({ text: 'Provably Fair | =fairness to verify' });

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
