const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../utils/database');

const HELPLINE_INFO =
  'If you or someone you know has a gambling problem, please contact:\n' +
  '- **National Problem Gambling Helpline:** 1-800-522-4700\n' +
  '- **GamCare:** https://www.gamcare.org.uk\n' +
  '- **Gamblers Anonymous:** https://www.gamblersanonymous.org';

const data = new SlashCommandBuilder()
  .setName('exclude')
  .setDescription('Self-exclusion and responsible gambling tools.')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Exclude yourself from gambling for a period.')
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('Exclusion duration')
          .setRequired(true)
          .addChoices(
            { name: '7 days', value: '7d' },
            { name: '30 days', value: '30d' },
            { name: '90 days', value: '90d' },
            { name: 'Permanent', value: 'permanent' }
          )
      )
  )
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Check your current exclusion status.')
  )
  .addSubcommand((sub) =>
    sub.setName('help').setDescription('View responsible gambling resources.')
  );

// Pending confirmations for permanent exclusion.
const pendingPermanent = new Set();

async function execute(interaction) {
  const userId = interaction.user.id;
  const sub = interaction.options.getSubcommand();

  if (sub === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('Responsible Gambling')
      .setDescription(HELPLINE_INFO)
      .setColor(0x3498db)
      .addFields(
        { name: 'Self-Exclusion', value: 'Use `/exclude set` to temporarily or permanently block yourself from gambling.', inline: false },
        { name: 'Remember', value: 'Gambling should be entertainment, not a way to make money. Only gamble what you can afford to lose.', inline: false }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'status') {
    const exclusion = db.prepare('SELECT * FROM self_exclusions WHERE user_id = ?').get(userId);

    if (!exclusion) {
      return interaction.reply({ content: 'You are not currently self-excluded.', ephemeral: true });
    }

    if (exclusion.permanent) {
      return interaction.reply({
        content: 'You are **permanently** self-excluded. Contact an admin to reverse this.',
        ephemeral: true,
      });
    }

    const until = new Date(exclusion.excluded_until);
    if (until > new Date()) {
      return interaction.reply({
        content: `You are self-excluded until **${until.toISOString().split('T')[0]}**.`,
        ephemeral: true,
      });
    }

    // Expired.
    db.prepare('DELETE FROM self_exclusions WHERE user_id = ?').run(userId);
    return interaction.reply({ content: 'Your self-exclusion has expired. You can play again.', ephemeral: true });
  }

  if (sub === 'set') {
    const duration = interaction.options.getString('duration');

    if (duration === 'permanent') {
      // Require confirmation for permanent exclusion.
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

      return interaction.reply({
        content: '**WARNING:** Permanent self-exclusion **cannot be undone by you**. Only an admin can reverse it. Are you sure?',
        components: [row],
        ephemeral: true,
      });
    }

    // Calculate the exclusion end date.
    const days = parseInt(duration, 10);
    const until = new Date();
    until.setDate(until.getDate() + days);

    db.prepare(
      'INSERT INTO self_exclusions (user_id, excluded_until, permanent) VALUES (?, ?, 0) ' +
      'ON CONFLICT(user_id) DO UPDATE SET excluded_until = ?, permanent = 0'
    ).run(userId, until.toISOString(), until.toISOString());

    const embed = new EmbedBuilder()
      .setTitle('Self-Exclusion Active')
      .setDescription(`You are now excluded from gambling until **${until.toISOString().split('T')[0]}**.`)
      .setColor(0xe67e22)
      .addFields({ name: 'Need Help?', value: HELPLINE_INFO, inline: false });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
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
      .setDescription('You have been permanently excluded from gambling. Contact an admin to reverse this.')
      .setColor(0xe74c3c)
      .addFields({ name: 'Need Help?', value: HELPLINE_INFO, inline: false });

    return interaction.update({ embeds: [embed], components: [] });
  }
}

module.exports = { data, execute, handleButton };
