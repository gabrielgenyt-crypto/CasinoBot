const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { updateBalance, ensureWallet } = require('../utils/wallet');
const { COLORS, DIVIDER, SPARKLE_LINE } = require('../utils/animations');

const DAILY_AMOUNT = 500;
const COOLDOWN_HOURS = 24;

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription(`🎁 Claim your daily bonus of ${DAILY_AMOUNT} coins.`);

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const now = new Date();
  const claim = db
    .prepare('SELECT last_claim FROM daily_claims WHERE user_id = ?')
    .get(userId);

  if (claim) {
    const lastClaim = new Date(claim.last_claim);
    const hoursElapsed = (now - lastClaim) / (1000 * 60 * 60);

    if (hoursElapsed < COOLDOWN_HOURS) {
      const remaining = COOLDOWN_HOURS - hoursElapsed;
      const hours = Math.floor(remaining);
      const minutes = Math.floor((remaining - hours) * 60);

      const cooldownEmbed = new EmbedBuilder()
        .setTitle('⏰  DAILY BONUS  ⏰')
        .setDescription(
          `${DIVIDER}\n\n` +
          '```\n' +
          '  ⏰ Not yet...\n' +
          '```\n' +
          `Come back in **${hours}h ${minutes}m**\n\n` +
          DIVIDER
        )
        .setColor(COLORS.warning)
        .setTimestamp();

      return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
    }
  }

  // Record the claim timestamp.
  db.prepare(
    'INSERT INTO daily_claims (user_id, last_claim) VALUES (?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET last_claim = ?'
  ).run(userId, now.toISOString(), now.toISOString());

  const newBalance = updateBalance(userId, DAILY_AMOUNT, 'daily bonus');

  // Calculate streak (consecutive days).
  let streakText = '';
  if (claim) {
    const lastClaim = new Date(claim.last_claim);
    const hoursSinceLast = (now - lastClaim) / (1000 * 60 * 60);
    if (hoursSinceLast < 48) {
      streakText = '\n🔥 Keep your streak going! Come back tomorrow.';
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁  DAILY BONUS CLAIMED  🎁')
    .setDescription(
      `${SPARKLE_LINE}\n` +
      `${DIVIDER}\n\n` +
      '```\n' +
      `  🎁 +${DAILY_AMOUNT} COINS! 🎁\n` +
      '```\n' +
      `**${interaction.user.username}** claimed their daily bonus!${streakText}\n\n` +
      `${DIVIDER}\n` +
      SPARKLE_LINE
    )
    .setColor(COLORS.win)
    .addFields(
      { name: '🎁 Bonus', value: `\`+${DAILY_AMOUNT}\``, inline: true },
      { name: '💰 Balance', value: `\`${newBalance.toLocaleString()}\``, inline: true }
    )
    .setFooter({ text: 'Come back in 24 hours for your next bonus!' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
