const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../utils/database');

const name = 'exclude';
const aliases = ['selfexclude'];
const description = 'Self-exclusion tools. Usage: =exclude <set|status|help> [duration]';

const HELPLINE_INFO =
  'If you or someone you know has a gambling problem:\n' +
  '- **National Problem Gambling Helpline:** 1-800-522-4700\n' +
  '- **GamCare:** https://www.gamcare.org.uk\n' +
  '- **Gamblers Anonymous:** https://www.gamblersanonymous.org';

const pendingPermanent = new Set();

async function execute(message, args) {
  const userId = message.author.id;
  const sub = (args[0] || 'help').toLowerCase();

  if (sub === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('Responsible Gambling')
      .setDescription(HELPLINE_INFO)
      .setColor(0x3498db)
      .addFields(
        { name: 'Self-Exclusion', value: 'Use `=exclude set <7d|30d|90d|permanent>` to block yourself from gambling.', inline: false },
        { name: 'Remember', value: 'Only gamble what you can afford to lose.', inline: false }
      );
    return message.reply({ embeds: [embed] });
  }

  if (sub === 'status') {
    const exclusion = db.prepare('SELECT * FROM self_exclusions WHERE user_id = ?').get(userId);
    if (!exclusion) {
      return message.reply('You are not currently self-excluded.');
    }
    if (exclusion.permanent) {
      return message.reply('You are **permanently** self-excluded. Contact an admin to reverse this.');
    }
    const until = new Date(exclusion.excluded_until);
    if (until > new Date()) {
      return message.reply(`You are self-excluded until **${until.toISOString().split('T')[0]}**.`);
    }
    db.prepare('DELETE FROM self_exclusions WHERE user_id = ?').run(userId);
    return message.reply('Your self-exclusion has expired. You can play again.');
  }

  if (sub === 'set') {
    const duration = (args[1] || '').toLowerCase();
    if (!['7d', '30d', '90d', 'permanent'].includes(duration)) {
      return message.reply('Usage: `=exclude set <7d|30d|90d|permanent>`');
    }

    if (duration === 'permanent') {
      pendingPermanent.add(userId);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`exclude:confirm:${userId}`)
          .setLabel('Yes, permanently exclude me')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`exclude:cancel:${userId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
      return message.reply({
        content: '**WARNING:** Permanent self-exclusion **cannot be undone by you**. Only an admin can reverse it. Are you sure?',
        components: [row],
      });
    }

    const days = parseInt(duration, 10);
    const until = new Date();
    until.setDate(until.getDate() + days);

    db.prepare(
      'INSERT INTO self_exclusions (user_id, excluded_until, permanent) VALUES (?, ?, 0) ' +
      'ON CONFLICT(user_id) DO UPDATE SET excluded_until = ?, permanent = 0'
    ).run(userId, until.toISOString(), until.toISOString());

    const embed = new EmbedBuilder()
      .setTitle('Self-Exclusion Active')
      .setDescription(`You are now excluded until **${until.toISOString().split('T')[0]}**.`)
      .setColor(0xe67e22)
      .addFields({ name: 'Need Help?', value: HELPLINE_INFO, inline: false });

    return message.reply({ embeds: [embed] });
  }

  return message.reply('Usage: `=exclude <set|status|help> [duration]`');
}

async function handleButton(interaction) {
  const [, action, ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'This is not your action.', ephemeral: true });
  }

  if (action === 'cancel') {
    pendingPermanent.delete(ownerId);
    return interaction.update({ content: 'Self-exclusion cancelled.', components: [] });
  }

  if (action === 'confirm') {
    if (!pendingPermanent.has(ownerId)) {
      return interaction.update({ content: 'This confirmation has expired.', components: [] });
    }
    pendingPermanent.delete(ownerId);

    db.prepare(
      'INSERT INTO self_exclusions (user_id, permanent) VALUES (?, 1) ' +
      'ON CONFLICT(user_id) DO UPDATE SET permanent = 1, excluded_until = NULL'
    ).run(ownerId);

    const embed = new EmbedBuilder()
      .setTitle('Permanent Self-Exclusion Active')
      .setDescription('You have been permanently excluded. Contact an admin to reverse this.')
      .setColor(0xe74c3c)
      .addFields({ name: 'Need Help?', value: HELPLINE_INFO, inline: false });

    return interaction.update({ embeds: [embed], components: [] });
  }
}

module.exports = { name, aliases, description, execute, handleButton };
