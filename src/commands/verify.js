const { EmbedBuilder } = require('discord.js');
const { generateResult, hashServerSeed } = require('../utils/provablyFair');

const name = 'verify';
const aliases = ['pf'];
const description = 'Verify a provably fair result. Usage: =verify <server_seed> <client_seed> <nonce>';

async function execute(message, args) {
  if (args.length < 3) {
    return message.reply('Usage: `=verify <server_seed> <client_seed> <nonce>`');
  }

  const serverSeed = args[0];
  const clientSeed = args[1];
  const nonce = parseInt(args[2], 10);

  if (isNaN(nonce) || nonce < 0) {
    return message.reply('Nonce must be a non-negative number.');
  }

  const result = generateResult(serverSeed, clientSeed, nonce);
  const seedHash = hashServerSeed(serverSeed);

  const coinflipSide = result < 0.5 ? 'Heads' : 'Tails';
  const diceRoll = Math.floor(result * 100) + 1;
  const rouletteNumber = Math.floor(result * 37);

  const HOUSE_EDGE = 0.03;
  let crashPoint;
  if (result < HOUSE_EDGE) {
    crashPoint = 1.0;
  } else {
    const raw = (1 - HOUSE_EDGE) / (1 - result);
    crashPoint = Math.min(Math.floor(raw * 100) / 100, 1000);
  }

  const embed = new EmbedBuilder()
    .setTitle('Provably Fair Verification')
    .setColor(0x9b59b6)
    .addFields(
      { name: 'Server Seed Hash', value: `\`${seedHash}\``, inline: false },
      { name: 'Client Seed', value: `\`${clientSeed}\``, inline: true },
      { name: 'Nonce', value: `${nonce}`, inline: true },
      { name: 'Raw Result', value: `${result.toFixed(10)}`, inline: true },
      { name: 'Coinflip', value: coinflipSide, inline: true },
      { name: 'Dice Roll', value: `${diceRoll}`, inline: true },
      { name: 'Roulette', value: `${rouletteNumber}`, inline: true },
      { name: 'Crash Point', value: `${crashPoint}x`, inline: true }
    )
    .setFooter({ text: 'Compare the hash with the one shown before the game.' });

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
