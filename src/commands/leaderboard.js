const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

const name = 'leaderboard';
const aliases = ['lb', 'top'];
const description = 'View top players. Usage: =leaderboard [balance|wagered|profit|wins]';

async function execute(message, args) {
  const type = (args[0] || 'balance').toLowerCase();

  let rows, title, formatRow;

  switch (type) {
  case 'balance':
  case 'bal':
    rows = db.prepare('SELECT user_id, balance FROM wallets ORDER BY balance DESC LIMIT 10').all();
    title = 'Top 10 — Richest Players';
    formatRow = (row, i) => `\`${i + 1}.\` <@${row.user_id}> — **${row.balance}** coins`;
    break;
  case 'wagered':
  case 'wager':
    rows = db.prepare('SELECT user_id, SUM(bet) as total_wagered FROM game_history GROUP BY user_id ORDER BY total_wagered DESC LIMIT 10').all();
    title = 'Top 10 — Most Wagered';
    formatRow = (row, i) => `\`${i + 1}.\` <@${row.user_id}> — **${row.total_wagered}** wagered`;
    break;
  case 'profit':
    rows = db.prepare('SELECT user_id, SUM(payout - bet) as net_profit FROM game_history GROUP BY user_id ORDER BY net_profit DESC LIMIT 10').all();
    title = 'Top 10 — Highest Profit';
    formatRow = (row, i) => {
      const sign = row.net_profit >= 0 ? '+' : '';
      return `\`${i + 1}.\` <@${row.user_id}> — **${sign}${row.net_profit}**`;
    };
    break;
  case 'wins':
  case 'win':
    rows = db.prepare('SELECT user_id, COUNT(*) as win_count FROM game_history WHERE won = 1 GROUP BY user_id ORDER BY win_count DESC LIMIT 10').all();
    title = 'Top 10 — Most Wins';
    formatRow = (row, i) => `\`${i + 1}.\` <@${row.user_id}> — **${row.win_count}** wins`;
    break;
  default:
    return message.reply('Types: `balance`, `wagered`, `profit`, `wins`');
  }

  if (!rows || rows.length === 0) {
    return message.reply('No data yet. Play some games first!');
  }

  const lines = rows.map((row, i) => formatRow(row, i));

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setColor(0xf1c40f)
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
