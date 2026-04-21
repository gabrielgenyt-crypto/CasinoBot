const { EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playDice } = require('../games/dice');

const name = 'dice';
const aliases = ['d'];
const description = 'Roll a dice (1-100). Usage: =dice <bet> <over|under> <target>';

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (args.length < 3) {
    return message.reply('Usage: `=dice <bet> <over|under> <target>`\nExample: `=dice 100 over 50`');
  }

  const bet = parseInt(args[0], 10);
  const direction = args[1].toLowerCase();
  const target = parseInt(args[2], 10);

  if (isNaN(bet) || bet < 1) {
    return message.reply('Bet must be a positive number.');
  }
  if (!['over', 'under'].includes(direction)) {
    return message.reply('Direction must be `over` or `under`.');
  }
  if (isNaN(target) || target < 1 || target > 99) {
    return message.reply('Target must be between 1 and 99.');
  }

  const balance = getBalance(userId);
  if (bet > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  const winChance = direction === 'over' ? (100 - target) / 100 : (target - 1) / 100;
  if (winChance <= 0 || winChance >= 1) {
    return message.reply('Invalid target for that direction.');
  }

  let result;
  try {
    result = playDice(userId, bet, direction, target);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    throw error;
  }

  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const winChancePercent = (winChance * 100).toFixed(1);
  const outcomeText = result.won
    ? `You won **${result.payout}** coins!`
    : `You lost **${bet}** coins.`;

  const embed = new EmbedBuilder()
    .setTitle(`Dice - Rolled ${result.roll}`)
    .setDescription(
      `**${message.author.username}** bet **${bet}** on **${direction} ${target}**\n` +
      `Roll: **${result.roll}** | ${outcomeText}`
    )
    .setColor(color)
    .addFields(
      { name: 'Multiplier', value: `${result.multiplier}x`, inline: true },
      { name: 'Win Chance', value: `${winChancePercent}%`, inline: true },
      { name: 'Balance', value: `${result.newBalance}`, inline: true }
    )
    .setFooter({ text: 'Provably Fair | =fairness to verify' });

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
