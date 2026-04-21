const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { rotateSeed, setClientSeed } = require('../utils/provablyFair');
const db = require('../utils/database');

const data = new SlashCommandBuilder()
  .setName('fairness')
  .setDescription('View or manage your provably fair seeds.')
  .addSubcommand((sub) =>
    sub.setName('info').setDescription('View your current seed hash and nonce.')
  )
  .addSubcommand((sub) =>
    sub
      .setName('rotate')
      .setDescription('Rotate your server seed and reveal the old one for verification.')
  )
  .addSubcommand((sub) =>
    sub
      .setName('seed')
      .setDescription('Set a custom client seed.')
      .addStringOption((opt) =>
        opt.setName('value').setDescription('Your new client seed').setRequired(true)
      )
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  const sub = interaction.options.getSubcommand();

  if (sub === 'info') {
    const seed = db
      .prepare('SELECT server_seed_hash, client_seed, nonce FROM seeds WHERE user_id = ?')
      .get(userId);

    if (!seed) {
      return interaction.reply({
        content: 'No seed record found. Play a game first to generate one.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('Provably Fair - Your Seeds')
      .setColor(0x9b59b6)
      .addFields(
        { name: 'Server Seed Hash', value: `\`${seed.server_seed_hash}\``, inline: false },
        { name: 'Client Seed', value: `\`${seed.client_seed}\``, inline: true },
        { name: 'Nonce', value: `${seed.nonce}`, inline: true }
      )
      .setFooter({ text: 'Rotate your seed to reveal the server seed for verification.' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'rotate') {
    const { oldServerSeed, newServerSeedHash } = rotateSeed(userId);

    const embed = new EmbedBuilder()
      .setTitle('Seed Rotated')
      .setColor(0xe67e22)
      .setDescription('Your server seed has been rotated. You can now verify past results.')
      .addFields(
        {
          name: 'Old Server Seed (revealed)',
          value: oldServerSeed ? `\`${oldServerSeed}\`` : 'None (first rotation)',
          inline: false,
        },
        { name: 'New Server Seed Hash', value: `\`${newServerSeedHash}\``, inline: false }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'seed') {
    const value = interaction.options.getString('value');
    setClientSeed(userId, value);

    return interaction.reply({
      content: `Client seed updated to \`${value}\`.`,
      ephemeral: true,
    });
  }
}

module.exports = { data, execute };
