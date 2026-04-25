const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/animations');
const { renderHistory } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('View your recent game history.')
  .addIntegerOption((opt) =>
    opt
      .setName('limit')
      .setDescription('Number of games to show (default 10, max 15)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(15)
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

  // Build data for the PNG renderer.
  const games = rows.map((row) => ({
    game: row.game,
    bet: row.bet,
    profit: row.payout - row.bet,
    won: !!row.won,
    date: row.created_at ? row.created_at.split(' ')[0] : '',
  }));

  const pngBuffer = renderHistory({
    playerName: interaction.user.username,
    games,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'history.png' });

  const embed = new EmbedBuilder()
    .setTitle(`Game History — ${interaction.user.username}`)
    .setColor(COLORS.vip)
    .setImage('attachment://history.png')
    .setFooter({ text: `Showing last ${rows.length} game(s)` });

  return interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
}

module.exports = { data, execute };
