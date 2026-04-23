const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');
const {
  COLORS,
  DIVIDER,
  SPARKLE_LINE,
  sleep,
} = require('../utils/animations');

// Cooldown tracking: userId -> timestamp of last rob attempt.
const cooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown.

// Rob mechanics.
const SUCCESS_CHANCE = 0.4;       // 40% chance to succeed.
const MAX_STEAL_PERCENT = 0.15;   // Steal up to 15% of target's balance.
const FINE_PERCENT = 0.10;        // If caught, lose 10% of your own balance.
const MIN_TARGET_BALANCE = 100;   // Target must have at least 100 coins.

const data = new SlashCommandBuilder()
  .setName('rob')
  .setDescription('🔫 Attempt to rob another player! High risk, high reward.')
  .addUserOption((opt) =>
    opt.setName('target').setDescription('The player to rob').setRequired(true)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  const target = interaction.options.getUser('target');

  // Validation checks.
  if (target.id === userId) {
    return interaction.reply({ content: '❌ You can\'t rob yourself.', ephemeral: true });
  }
  if (target.bot) {
    return interaction.reply({ content: '❌ You can\'t rob a bot.', ephemeral: true });
  }

  ensureWallet(userId);
  ensureWallet(target.id);

  // Check cooldown.
  const lastRob = cooldowns.get(userId);
  if (lastRob) {
    const elapsed = Date.now() - lastRob;
    if (elapsed < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - elapsed;
      const minutes = Math.ceil(remaining / 60000);
      return interaction.reply({
        content: `⏰ You need to lay low for **${minutes} minutes** before robbing again.`,
        ephemeral: true,
      });
    }
  }

  const robberBalance = getBalance(userId);
  const targetBalance = getBalance(target.id);

  // Must have some coins to risk (fine if caught).
  if (robberBalance < 50) {
    return interaction.reply({
      content: '❌ You need at least **50** coins to attempt a robbery (risk of fines).',
      ephemeral: true,
    });
  }

  if (targetBalance < MIN_TARGET_BALANCE) {
    return interaction.reply({
      content: `❌ **${target.username}** doesn't have enough coins to rob (minimum: ${MIN_TARGET_BALANCE}).`,
      ephemeral: true,
    });
  }

  // Set cooldown immediately.
  cooldowns.set(userId, Date.now());

  // ── Frame 1: Sneaking up ──
  const frame1 = new EmbedBuilder()
    .setTitle('🔫  R O B B E R Y  🔫')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '  🌙 Under cover of darkness...\n' +
      '\n' +
      '     🕵️ ➡️ ➡️ ➡️ 💰\n' +
      '```\n' +
      `**${interaction.user.username}** is sneaking up on **${target.username}**...\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [frame1], fetchReply: true });

  // ── Frame 2: Attempting ──
  await sleep(800);
  const frame2 = new EmbedBuilder()
    .setTitle('🔫  R O B B E R Y  🔫')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '  🔓 Picking the lock...\n' +
      '\n' +
      '     🕵️ 🔧 🔒\n' +
      '```\n' +
      'Attempting to steal coins...\n\n' +
      DIVIDER
    )
    .setColor(COLORS.warning);

  await msg.edit({ embeds: [frame2] });

  // ── Frame 3: Outcome ──
  await sleep(1000);

  const roll = Math.random();
  const success = roll < SUCCESS_CHANCE;

  if (success) {
    // Successful robbery!
    const stealPercent = 0.05 + Math.random() * (MAX_STEAL_PERCENT - 0.05);
    const stolenAmount = Math.max(1, Math.floor(targetBalance * stealPercent));

    updateBalance(target.id, -stolenAmount, `robbed by ${userId}`);
    const newBalance = updateBalance(userId, stolenAmount, `robbed ${target.id}`);

    const finalEmbed = new EmbedBuilder()
      .setTitle('🔫💰  ROBBERY SUCCESSFUL  💰🔫')
      .setDescription(
        `${SPARKLE_LINE}\n` +
        `${DIVIDER}\n\n` +
        '```\n' +
        '  💰💰💰 SCORE! 💰💰💰\n' +
        '\n' +
        '     🕵️ 💨 💨 💨 💰\n' +
        '```\n' +
        `**${interaction.user.username}** robbed **${stolenAmount.toLocaleString()}** coins from **${target.username}**!\n\n` +
        `${DIVIDER}\n` +
        SPARKLE_LINE
      )
      .setColor(COLORS.win)
      .addFields(
        { name: '💰 Stolen', value: `\`+${stolenAmount.toLocaleString()}\``, inline: true },
        { name: '💰 Your Balance', value: `\`${newBalance.toLocaleString()}\``, inline: true },
        { name: '⏰ Cooldown', value: '`1 hour`', inline: true }
      )
      .setFooter({ text: `${target.username} lost ${stolenAmount.toLocaleString()} coins` })
      .setTimestamp();

    return msg.edit({ embeds: [finalEmbed] });
  }

  // Failed robbery -- pay a fine!
  const fineAmount = Math.max(1, Math.floor(robberBalance * FINE_PERCENT));
  const newBalance = updateBalance(userId, -fineAmount, `robbery fine (failed to rob ${target.id})`);

  const failEmbed = new EmbedBuilder()
    .setTitle('🚨  B U S T E D !  🚨')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '  🚨 ALARM! ALARM! 🚨\n' +
      '\n' +
      '     🕵️ 😱 👮 🚔\n' +
      '```\n' +
      `**${interaction.user.username}** got caught trying to rob **${target.username}**!\n` +
      `You paid a fine of **${fineAmount.toLocaleString()}** coins.\n\n` +
      DIVIDER
    )
    .setColor(COLORS.lose)
    .addFields(
      { name: '💸 Fine', value: `\`-${fineAmount.toLocaleString()}\``, inline: true },
      { name: '💰 Your Balance', value: `\`${newBalance.toLocaleString()}\``, inline: true },
      { name: '⏰ Cooldown', value: '`1 hour`', inline: true }
    )
    .setFooter({ text: 'Crime doesn\'t always pay...' })
    .setTimestamp();

  return msg.edit({ embeds: [failEmbed] });
}

module.exports = { data, execute };
