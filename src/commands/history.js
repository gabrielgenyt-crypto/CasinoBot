const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('View your recent game history.')
  .addIntegerOption((opt) =>
    opt
      .setName('limit')
      .setDescription('Number of games to show (default 10, max 25)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  const limit = interaction.options.getInteger('limit') || 10;

  const rows = db
    .prepare(
      'SELECT game, bet, payout, won, created_at FROM game_history WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    )
    .all(userId, limit);

  if (rows.length === 0) {
    return interaction.reply({
      content: 'No game history found. Play a game first!',
      ephemeral: true,
    });
  }

  const lines = rows.map((row, i) => {
    const outcome = row.won ? '✅' : '❌';
    const profit = row.payout - row.bet;
    const sign = profit >= 0 ? '+' : '';
    return `\`${i + 1}.\` ${outcome} **${row.game}** — Bet: ${row.bet} | ${sign}${profit} | ${row.created_at}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Game History — ${interaction.user.username}`)
    .setDescription(lines.join('\n'))
    .setColor(0x9b59b6)
    .setFooter({ text: `Showing last ${rows.length} game(s)` });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
