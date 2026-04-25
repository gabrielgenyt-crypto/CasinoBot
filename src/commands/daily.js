const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderReward } = require('../utils/cardRenderer');

const BASE_REWARD = 500;
const STREAK_BONUS = 100; // Extra coins per streak day.
const MAX_STREAK_BONUS = 7; // Cap streak multiplier at 7 days.

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily free coins! Streak bonuses for consecutive days.');

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Check existing claim.
  const record = db
    .prepare('SELECT streak, last_claimed FROM daily_rewards WHERE user_id = ? AND type = ?')
    .get(userId, 'daily');

  if (record) {
    const lastDate = record.last_claimed;

    // Already claimed today.
    if (lastDate === todayStr) {
      return interaction.reply({
        content: `${EMOJIS.coin} You already claimed your daily reward today! Come back tomorrow.`,
        ephemeral: true,
      });
    }

    // Check if streak continues (claimed yesterday).
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak;
    if (lastDate === yesterdayStr) {
      newStreak = record.streak + 1;
    } else {
      newStreak = 1; // Streak broken.
    }

    const streakMultiplier = Math.min(newStreak, MAX_STREAK_BONUS);
    const reward = BASE_REWARD + (streakMultiplier - 1) * STREAK_BONUS;

    db.prepare(
      'UPDATE daily_rewards SET streak = ?, last_claimed = ? WHERE user_id = ? AND type = ?'
    ).run(newStreak, todayStr, userId, 'daily');

    const newBalance = updateBalance(userId, reward, 'daily reward');

    const pngBuffer = renderReward({
      type: 'daily',
      amount: reward,
      streak: newStreak,
      newBalance,
      playerName: interaction.user.username,
    });
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'daily.png' });

    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.coin}  Daily Reward Claimed!`)
      .setColor(COLORS.win)
      .setImage('attachment://daily.png')
      .setFooter({ text: newStreak >= MAX_STREAK_BONUS ? 'Max streak bonus reached!' : `${MAX_STREAK_BONUS - newStreak} more days to max streak` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], files: [attachment] });
  }

  // First-time claim.
  db.prepare(
    'INSERT INTO daily_rewards (user_id, type, streak, last_claimed) VALUES (?, ?, 1, ?)'
  ).run(userId, 'daily', todayStr);

  const newBalance = updateBalance(userId, BASE_REWARD, 'daily reward');

  const pngBuffer = renderReward({
    type: 'daily',
    amount: BASE_REWARD,
    streak: 1,
    newBalance,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'daily.png' });

  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.coin}  Daily Reward Claimed!`)
    .setColor(COLORS.win)
    .setImage('attachment://daily.png')
    .setFooter({ text: 'Come back tomorrow to build your streak!' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
