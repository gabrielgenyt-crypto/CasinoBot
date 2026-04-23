const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS, DIVIDER } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('🏆 View the top players by balance or total wagered.')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Leaderboard type')
      .setRequired(false)
      .addChoices(
        { name: `${EMOJIS.coin} Balance`, value: 'balance' },
        { name: `${EMOJIS.casino} Total Wagered`, value: 'wagered' },
        { name: '📈 Total Profit', value: 'profit' },
        { name: `${EMOJIS.trophy} Most Wins`, value: 'wins' }
      )
  );

// Medal emojis for top 3.
const MEDALS = ['🥇', '🥈', '🥉'];

async function execute(interaction) {
  const type = interaction.options.getString('type') || 'balance';

  let rows;
  let title;
  let titleEmoji;
  let formatRow;

  switch (type) {
  case 'balance':
    rows = db
      .prepare('SELECT user_id, balance FROM wallets ORDER BY balance DESC LIMIT 10')
      .all();
    title = 'Richest Players';
    titleEmoji = EMOJIS.coin;
    formatRow = (row, i) => {
      const medal = i < 3 ? MEDALS[i] : `\`${i + 1}.\``;
      const bar = '█'.repeat(Math.min(Math.ceil(row.balance / 1000), 15));
      return `${medal} <@${row.user_id}>\n   \`${row.balance.toLocaleString()}\` coins ${bar}`;
    };
    break;

  case 'wagered':
    rows = db
      .prepare(
        'SELECT user_id, SUM(bet) as total_wagered FROM game_history GROUP BY user_id ORDER BY total_wagered DESC LIMIT 10'
      )
      .all();
    title = 'Most Wagered';
    titleEmoji = EMOJIS.casino;
    formatRow = (row, i) => {
      const medal = i < 3 ? MEDALS[i] : `\`${i + 1}.\``;
      return `${medal} <@${row.user_id}> — **${row.total_wagered.toLocaleString()}** wagered`;
    };
    break;

  case 'profit':
    rows = db
      .prepare(
        'SELECT user_id, SUM(payout - bet) as net_profit FROM game_history GROUP BY user_id ORDER BY net_profit DESC LIMIT 10'
      )
      .all();
    title = 'Highest Profit';
    titleEmoji = '📈';
    formatRow = (row, i) => {
      const medal = i < 3 ? MEDALS[i] : `\`${i + 1}.\``;
      const sign = row.net_profit >= 0 ? '+' : '';
      const emoji = row.net_profit >= 0 ? '📈' : '📉';
      return `${medal} <@${row.user_id}> — ${emoji} **${sign}${row.net_profit.toLocaleString()}** coins`;
    };
    break;

  case 'wins':
    rows = db
      .prepare(
        'SELECT user_id, COUNT(*) as win_count FROM game_history WHERE won = 1 GROUP BY user_id ORDER BY win_count DESC LIMIT 10'
      )
      .all();
    title = 'Most Wins';
    titleEmoji = EMOJIS.trophy;
    formatRow = (row, i) => {
      const medal = i < 3 ? MEDALS[i] : `\`${i + 1}.\``;
      return `${medal} <@${row.user_id}> — **${row.win_count.toLocaleString()}** wins`;
    };
    break;

  default:
    return interaction.reply({ content: '❌ Invalid leaderboard type.', ephemeral: true });
  }

  if (!rows || rows.length === 0) {
    return interaction.reply({
      content: '❌ No data yet. Play some games first!',
      ephemeral: true,
    });
  }

  const lines = rows.map((row, i) => formatRow(row, i));

  const embed = new EmbedBuilder()
    .setTitle(`${titleEmoji}  TOP 10 — ${title.toUpperCase()}  ${titleEmoji}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      lines.join('\n\n') +
      `\n\n${DIVIDER}`
    )
    .setColor(COLORS.jackpot)
    .setFooter({ text: 'Play more to climb the ranks!' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
