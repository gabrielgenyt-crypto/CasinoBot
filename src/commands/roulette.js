const { EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playRoulette, BET_TYPES } = require('../games/roulette');

const name = 'roulette';
const aliases = ['rl'];
const description = 'European roulette. Usage: =roulette <bet> <type|number>';

const validTypes = Object.keys(BET_TYPES);

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (args.length < 2) {
    return message.reply(
      'Usage: `=roulette <bet> <type>`\n' +
      'Types: `red`, `black`, `even`, `odd`, `low`, `high`, `dozen1-3`, `col1-3`, or a number `0-36`\n' +
      'Example: `=roulette 100 red`'
    );
  }

  const bet = parseInt(args[0], 10);
  const betTypeRaw = args[1].toLowerCase();

  if (isNaN(bet) || bet < 1) {
    return message.reply('Bet must be a positive number.');
  }

  const balance = getBalance(userId);
  if (bet > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  // Determine bet type: number (0-36) or named type.
  const numBet = parseInt(betTypeRaw, 10);
  let betType;
  if (!isNaN(numBet) && numBet >= 0 && numBet <= 36 && String(numBet) === betTypeRaw) {
    betType = betTypeRaw;
  } else if (validTypes.includes(betTypeRaw)) {
    betType = betTypeRaw;
  } else {
    return message.reply(`Invalid bet type. Use: ${validTypes.join(', ')}, or a number 0-36.`);
  }

  let result;
  try {
    result = playRoulette(userId, bet, betType);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    if (error.message === 'INVALID_BET_TYPE') {
      return message.reply('Invalid bet type.');
    }
    throw error;
  }

  const colorEmoji = { red: '🔴', black: '⚫', green: '🟢' };
  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const outcomeText = result.won
    ? `Won **${result.payout}** coins!`
    : `Lost **${bet}** coins.`;

  const embed = new EmbedBuilder()
    .setTitle(`Roulette - ${colorEmoji[result.color]} ${result.number}`)
    .setDescription(
      `**${message.author.username}** bet **${bet}** on **${result.betLabel}**\n` +
      `The ball landed on **${result.number}** (${result.color})\n\n` +
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
