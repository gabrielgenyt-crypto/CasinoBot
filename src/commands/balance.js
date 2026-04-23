const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const db = require('../utils/database');
const { COLORS, DIVIDER, progressBar } = require('../utils/animations');
const { getVipRecord, getLevelForWagered, VIP_LEVELS } = require('../utils/vip');
const EMOJIS = require('../utils/emojis');

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('💰 Check your current coin balance and wallet overview.');

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const balance = getBalance(userId);

  // Fetch quick stats.
  const stats = db
    .prepare(
      'SELECT COUNT(*) as games, SUM(won) as wins FROM game_history WHERE user_id = ?'
    )
    .get(userId);

  const gamesPlayed = stats?.games || 0;
  const wins = stats?.wins || 0;
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';

  // VIP info.
  const vipRecord = getVipRecord(userId);
  const vipLevel = getLevelForWagered(vipRecord.total_wagered);
  const nextLevel = VIP_LEVELS[vipLevel.level + 1];

  // Balance tier visual.
  let tier;
  let tierEmoji;
  if (balance >= 100000) {
    tier = 'WHALE';
    tierEmoji = EMOJIS.whale;
  } else if (balance >= 50000) {
    tier = 'HIGH ROLLER';
    tierEmoji = EMOJIS.diamond;
  } else if (balance >= 10000) {
    tier = 'BALLER';
    tierEmoji = EMOJIS.fire;
  } else if (balance >= 1000) {
    tier = 'PLAYER';
    tierEmoji = EMOJIS.casino;
  } else {
    tier = 'ROOKIE';
    tierEmoji = '🌱';
  }

  let vipProgress = '';
  if (nextLevel) {
    vipProgress =
      `\n**Next:** ${nextLevel.name} (${progressBar(vipRecord.total_wagered, nextLevel.threshold, 12)})`;
  } else {
    vipProgress = '\n**MAX LEVEL** ⭐';
  }

  const embed = new EmbedBuilder()
    .setTitle(`${tierEmoji}  ${interaction.user.username}'s Wallet  ${tierEmoji}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      `  ${EMOJIS.coin} ${balance.toLocaleString()} COINS\n` +
      '```\n' +
      `**Rank:** ${tierEmoji} ${tier}\n` +
      `**VIP:** ${vipLevel.name} (Tier ${vipLevel.level})${vipProgress}\n\n` +
      DIVIDER
    )
    .setColor(
      balance >= 50000 ? COLORS.jackpot
        : balance >= 10000 ? COLORS.win
          : balance >= 1000 ? COLORS.neutral
            : COLORS.info
    )
    .addFields(
      { name: '🎮 Games', value: `\`${gamesPlayed}\``, inline: true },
      { name: `${EMOJIS.trophy} Wins`, value: `\`${wins}\``, inline: true },
      { name: '📊 Win Rate', value: `\`${winRate}%\``, inline: true }
    )
    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'Use /stats for full stats' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
