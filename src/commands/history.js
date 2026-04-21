const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

const name = 'history';
const aliases = ['hist'];
const description = 'View recent game history. Usage: =history [limit]';

async function execute(message, args) {
  const userId = message.author.id;
  const limit = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 25);

  const rows = db.prepare(
    'SELECT game, bet, payout, won, created_at FROM game_history WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).all(userId, limit);

  if (rows.length === 0) {
    return message.reply('No game history found. Play a game first!');
  }

  const lines = rows.map((row, i) => {
    const outcome = row.won ? '✅' : '❌';
    const profit = row.payout - row.bet;
    const sign = profit >= 0 ? '+' : '';
    return `\`${i + 1}.\` ${outcome} **${row.game}** — Bet: ${row.bet} | ${sign}${profit}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Game History — ${message.author.username}`)
    .setDescription(lines.join('\n'))
    .setColor(0x9b59b6)
    .setFooter({ text: `Showing last ${rows.length} game(s)` });

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
