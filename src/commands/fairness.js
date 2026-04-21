const { EmbedBuilder } = require('discord.js');
const { rotateSeed, setClientSeed } = require('../utils/provablyFair');
const db = require('../utils/database');

const name = 'fairness';
const aliases = ['seed', 'seeds'];
const description = 'Manage provably fair seeds. Usage: =fairness <info|rotate|seed> [value]';

async function execute(message, args) {
  const userId = message.author.id;
  const sub = (args[0] || 'info').toLowerCase();

  if (sub === 'info') {
    const seed = db.prepare(
      'SELECT server_seed_hash, client_seed, nonce FROM seeds WHERE user_id = ?'
    ).get(userId);

    if (!seed) {
      return message.reply('No seed record found. Play a game first to generate one.');
    }

    const embed = new EmbedBuilder()
      .setTitle('Provably Fair - Your Seeds')
      .setColor(0x9b59b6)
      .addFields(
        { name: 'Server Seed Hash', value: `\`${seed.server_seed_hash}\``, inline: false },
        { name: 'Client Seed', value: `\`${seed.client_seed}\``, inline: true },
        { name: 'Nonce', value: `${seed.nonce}`, inline: true }
      )
      .setFooter({ text: 'Use =fairness rotate to reveal your server seed.' });

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'rotate') {
    const { oldServerSeed, newServerSeedHash } = rotateSeed(userId);

    const embed = new EmbedBuilder()
      .setTitle('Seed Rotated')
      .setColor(0xe67e22)
      .setDescription('Your server seed has been rotated. You can now verify past results.')
      .addFields(
        { name: 'Old Server Seed (revealed)', value: oldServerSeed ? `\`${oldServerSeed}\`` : 'None (first rotation)', inline: false },
        { name: 'New Server Seed Hash', value: `\`${newServerSeedHash}\``, inline: false }
      );

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'seed' || sub === 'set') {
    const value = args[1];
    if (!value) {
      return message.reply('Usage: `=fairness seed <your-seed>`');
    }
    setClientSeed(userId, value);
    return message.reply(`Client seed updated to \`${value}\`.`);
  }

  return message.reply('Usage: `=fairness <info|rotate|seed> [value]`');
}

module.exports = { name, aliases, description, execute };
