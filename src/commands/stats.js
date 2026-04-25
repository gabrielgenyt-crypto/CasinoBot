const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { COLORS } = require('../utils/animations');
const { renderStats } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View your (or another user\'s) game statistics.')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('User to view stats for').setRequired(false)
  );

async function execute(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const userId = target.id;
  ensureWallet(userId);

  // Overall stats.
  const overall = db
    .prepare(
      'SELECT COUNT(*) as games, SUM(bet) as wagered, SUM(payout) as earned, SUM(won) as wins FROM game_history WHERE user_id = ?'
    )
    .get(userId);

  if (!overall || overall.games === 0) {
    return interaction.reply({
      content: `${target.username} hasn't played any games yet.`,
      ephemeral: true,
    });
  }

  const losses = overall.games - overall.wins;
  const netProfit = (overall.earned || 0) - (overall.wagered || 0);
  const winRate = ((overall.wins / overall.games) * 100).toFixed(1);

  // Per-game breakdown.
  const perGame = db
    .prepare(
      'SELECT game, COUNT(*) as games, SUM(bet) as wagered, SUM(payout) as earned, SUM(won) as wins FROM game_history WHERE user_id = ? GROUP BY game ORDER BY games DESC'
    )
    .all(userId);

  const perGameData = perGame.map((g) => ({
    game: g.game,
    games: g.games,
    wins: g.wins,
    profit: (g.earned || 0) - (g.wagered || 0),
  }));

  // Biggest win.
  const bigWin = db
    .prepare(
      'SELECT game, bet, payout FROM game_history WHERE user_id = ? AND won = 1 ORDER BY (payout - bet) DESC LIMIT 1'
    )
    .get(userId);

  const biggestWin = bigWin
    ? { game: bigWin.game, profit: bigWin.payout - bigWin.bet }
    : null;

  // Render the stats card PNG.
  const pngBuffer = renderStats({
    playerName: target.username,
    balance: getBalance(userId),
    gamesPlayed: overall.games,
    wins: overall.wins,
    losses,
    winRate,
    totalWagered: overall.wagered || 0,
    netProfit,
    perGame: perGameData,
    biggestWin,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'stats.png' });

  const embed = new EmbedBuilder()
    .setTitle(`Stats — ${target.username}`)
    .setColor(COLORS.info)
    .setImage('attachment://stats.png')
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
