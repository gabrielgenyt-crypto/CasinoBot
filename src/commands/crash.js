const { EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCrash } = require('../games/crash');

const name = 'crash';
const aliases = [];
const description = 'Ride the multiplier! Usage: =crash <bet> <cashout>';

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (args.length < 2) {
    return message.reply('Usage: `=crash <bet> <cashout>`\nExample: `=crash 100 2.5`');
  }

  const bet = parseInt(args[0], 10);
  const cashout = parseFloat(args[1]);

  if (isNaN(bet) || bet < 1) {
    return message.reply('Bet must be a positive number.');
  }
  if (isNaN(cashout) || cashout < 1.01 || cashout > 1000) {
    return message.reply('Cashout must be between 1.01 and 1000.');
  }

  const balance = getBalance(userId);
  if (bet > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  let result;
  try {
    result = playCrash(userId, bet, cashout);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    throw error;
  }

  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const crashEmoji = result.crashPoint <= 1.2 ? '💥' : '📈';
  const outcomeText = result.won
    ? `Cashed out at **${result.cashout}x** — won **${result.payout}** coins!`
    : `Crashed at **${result.crashPoint}x** before your **${result.cashout}x** target.`;

  const embed = new EmbedBuilder()
    .setTitle(`${crashEmoji} Crash - ${result.crashPoint}x`)
    .setDescription(
      `**${message.author.username}** bet **${bet}** coins\n` +
      `Target: **${result.cashout}x** | Crashed at: **${result.crashPoint}x**\n\n` +
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
