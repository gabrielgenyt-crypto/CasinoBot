const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderReward } = require('../utils/cardRenderer');

const BASE_REWARD = 5000;
const STREAK_BONUS = 1000; // Extra coins per consecutive week.
const MAX_STREAK_BONUS = 4; // Cap streak multiplier at 4 weeks.
const COOLDOWN_DAYS = 7;

const data = new SlashCommandBuilder()
  .setName('weekly')
  .setDescription('Open your weekly chest! Bigger rewards with streak bonuses.');

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Check existing claim.
  const record = db
    .prepare('SELECT streak, last_claimed FROM daily_rewards WHERE user_id = ? AND type = ?')
    .get(userId, 'weekly');

  if (record) {
    const lastDate = new Date(record.last_claimed);
    const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    // Not enough time has passed.
    if (daysSince < COOLDOWN_DAYS) {
      const nextClaim = new Date(lastDate);
      nextClaim.setDate(nextClaim.getDate() + COOLDOWN_DAYS);
      const daysLeft = COOLDOWN_DAYS - daysSince;
      return interaction.reply({
        content: `${EMOJIS.coin} Your weekly chest isn't ready yet! Come back in **${daysLeft}** day(s).`,
        ephemeral: true,
      });
    }

    // Check if streak continues (claimed within 8-14 days = last week's window).
    let newStreak;
    if (daysSince <= COOLDOWN_DAYS + 2) {
      newStreak = record.streak + 1;
    } else {
      newStreak = 1; // Streak broken.
    }

    const streakMultiplier = Math.min(newStreak, MAX_STREAK_BONUS);
    const reward = BASE_REWARD + (streakMultiplier - 1) * STREAK_BONUS;

    db.prepare(
      'UPDATE daily_rewards SET streak = ?, last_claimed = ? WHERE user_id = ? AND type = ?'
    ).run(newStreak, todayStr, userId, 'weekly');

    const newBalance = updateBalance(userId, reward, 'weekly chest');

    const pngBuffer = renderReward({
      type: 'weekly',
      amount: reward,
      streak: newStreak,
      newBalance,
      playerName: interaction.user.username,
    });
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'weekly.png' });

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.diamond}  Weekly Chest Opened!`)
      .setColor(COLORS.vip)
      .setImage('attachment://weekly.png')
      .setFooter({ text: newStreak >= MAX_STREAK_BONUS ? 'Max streak bonus reached!' : `${MAX_STREAK_BONUS - newStreak} more weeks to max streak` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], files: [attachment] });
  }

  // First-time claim.
  db.prepare(
    'INSERT INTO daily_rewards (user_id, type, streak, last_claimed) VALUES (?, ?, 1, ?)'
  ).run(userId, 'weekly', todayStr);

  const newBalance = updateBalance(userId, BASE_REWARD, 'weekly chest');

  const pngBuffer = renderReward({
    type: 'weekly',
    amount: BASE_REWARD,
    streak: 1,
    newBalance,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'weekly.png' });

  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.diamond}  Weekly Chest Opened!`)
    .setColor(COLORS.vip)
    .setImage('attachment://weekly.png')
    .setFooter({ text: 'Come back next week for streak bonuses!' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
