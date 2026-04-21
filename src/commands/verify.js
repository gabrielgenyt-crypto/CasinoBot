const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { generateResult, hashServerSeed } = require('../utils/provablyFair');

const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verify a provably fair game result.')
  .addStringOption((opt) =>
    opt.setName('server_seed').setDescription('The revealed server seed').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('client_seed').setDescription('Your client seed at the time').setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt.setName('nonce').setDescription('The nonce of the game round').setRequired(true).setMinValue(0)
  );

async function execute(interaction) {
  const serverSeed = interaction.options.getString('server_seed');
  const clientSeed = interaction.options.getString('client_seed');
  const nonce = interaction.options.getInteger('nonce');

  // Reproduce the result.
  const result = generateResult(serverSeed, clientSeed, nonce);
  const seedHash = hashServerSeed(serverSeed);

  // Show how this result maps to common games.
  const coinflipSide = result < 0.5 ? 'Heads' : 'Tails';
  const diceRoll = Math.floor(result * 100) + 1;
  const rouletteNumber = Math.floor(result * 37);

  // Crash point calculation (same formula as crash game).
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
      { name: 'Server Seed', value: `\`${serverSeed.substring(0, 32)}...\``, inline: false },
      { name: 'Server Seed Hash', value: `\`${seedHash}\``, inline: false },
      { name: 'Client Seed', value: `\`${clientSeed}\``, inline: true },
      { name: 'Nonce', value: `${nonce}`, inline: true },
      { name: 'Raw Result', value: `${result.toFixed(10)}`, inline: true },
      { name: 'Coinflip', value: coinflipSide, inline: true },
      { name: 'Dice Roll', value: `${diceRoll}`, inline: true },
      { name: 'Roulette', value: `${rouletteNumber}`, inline: true },
      { name: 'Crash Point', value: `${crashPoint}x`, inline: true }
    )
    .setFooter({
      text: 'Compare the Server Seed Hash with the hash shown before the game to confirm fairness.',
    });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
