const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top players by balance or total wagered.')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Leaderboard type')
      .setRequired(false)
      .addChoices(
        { name: 'Balance', value: 'balance' },
        { name: 'Total Wagered', value: 'wagered' },
        { name: 'Total Profit', value: 'profit' },
        { name: 'Most Wins', value: 'wins' }
      )
  );

async function execute(interaction) {
  const type = interaction.options.getString('type') || 'balance';

  let rows;
  let title;
  let formatRow;

  switch (type) {
  case 'balance':
    rows = db
      .prepare('SELECT user_id, balance FROM wallets ORDER BY balance DESC LIMIT 10')
      .all();
    title = 'Top 10 — Richest Players';
    formatRow = (row, i) => `\`${i + 1}.\` <@${row.user_id}> — **${row.balance}** coins`;
    break;

  case 'wagered':
    rows = db
      .prepare(
        'SELECT user_id, SUM(bet) as total_wagered FROM game_history GROUP BY user_id ORDER BY total_wagered DESC LIMIT 10'
      )
      .all();
    title = 'Top 10 — Most Wagered';
    formatRow = (row, i) => `\`${i + 1}.\` <@${row.user_id}> — **${row.total_wagered}** coins wagered`;
    break;

  case 'profit':
    rows = db
      .prepare(
        'SELECT user_id, SUM(payout - bet) as net_profit FROM game_history GROUP BY user_id ORDER BY net_profit DESC LIMIT 10'
      )
      .all();
    title = 'Top 10 — Highest Profit';
    formatRow = (row, i) => {
      const sign = row.net_profit >= 0 ? '+' : '';
      return `\`${i + 1}.\` <@${row.user_id}> — **${sign}${row.net_profit}** coins`;
    };
    break;

  case 'wins':
    rows = db
      .prepare(
        'SELECT user_id, COUNT(*) as win_count FROM game_history WHERE won = 1 GROUP BY user_id ORDER BY win_count DESC LIMIT 10'
      )
      .all();
    title = 'Top 10 — Most Wins';
    formatRow = (row, i) => `\`${i + 1}.\` <@${row.user_id}> — **${row.win_count}** wins`;
    break;

  default:
    return interaction.reply({ content: 'Invalid leaderboard type.', ephemeral: true });
  }

  if (!rows || rows.length === 0) {
    return interaction.reply({
      content: 'No data yet. Play some games first!',
      ephemeral: true,
    });
  }

  const lines = rows.map((row, i) => formatRow(row, i));

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setColor(0xf1c40f)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
