const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const db = require('../utils/database');
const { COLORS } = require('../utils/animations');
const { getVipRecord, getLevelForWagered } = require('../utils/vip');
const EMOJIS = require('../utils/emojis');
const { renderBalance } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your current balance and wallet overview.');

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

  // Balance tier.
  let tier;
  if (balance >= 100000) {
    tier = 'WHALE';
  } else if (balance >= 50000) {
    tier = 'HIGH ROLLER';
  } else if (balance >= 10000) {
    tier = 'BALLER';
  } else if (balance >= 1000) {
    tier = 'PLAYER';
  } else {
    tier = 'ROOKIE';
  }

  // Render the wallet card PNG.
  const pngBuffer = renderBalance({
    playerName: interaction.user.username,
    balance,
    tier,
    gamesPlayed,
    wins,
    winRate,
    vipName: vipLevel.name,
    vipLevel: vipLevel.level,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'balance.png' });

  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.coin}  ${interaction.user.username}'s Wallet`)
    .setColor(
      balance >= 50000 ? COLORS.jackpot
        : balance >= 10000 ? COLORS.win
          : balance >= 1000 ? COLORS.neutral
            : COLORS.info
    )
    .setImage('attachment://balance.png')
    .setFooter({ text: 'Use /stats for full stats | /daily for free rewards' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
