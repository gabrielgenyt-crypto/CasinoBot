const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { getBalance, ensureWallet } = require('../utils/wallet');

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
  const profitSign = netProfit >= 0 ? '+' : '';

  // Per-game breakdown.
  const perGame = db
    .prepare(
      'SELECT game, COUNT(*) as games, SUM(bet) as wagered, SUM(payout) as earned, SUM(won) as wins FROM game_history WHERE user_id = ? GROUP BY game ORDER BY games DESC'
    )
    .all(userId);

  const gameLines = perGame.map((g) => {
    const gProfit = (g.earned || 0) - (g.wagered || 0);
    const gSign = gProfit >= 0 ? '+' : '';
    const gWinRate = ((g.wins / g.games) * 100).toFixed(0);
    return `**${g.game}** — ${g.games} games | ${g.wins}W/${g.games - g.wins}L (${gWinRate}%) | ${gSign}${gProfit}`;
  });

  // Biggest win.
  const bigWin = db
    .prepare(
      'SELECT game, bet, payout, created_at FROM game_history WHERE user_id = ? AND won = 1 ORDER BY (payout - bet) DESC LIMIT 1'
    )
    .get(userId);

  const embed = new EmbedBuilder()
    .setTitle(`Stats — ${target.username}`)
    .setColor(0x3498db)
    .addFields(
      { name: 'Balance', value: `${getBalance(userId)}`, inline: true },
      { name: 'Games Played', value: `${overall.games}`, inline: true },
      { name: 'Win Rate', value: `${winRate}%`, inline: true },
      { name: 'Wins / Losses', value: `${overall.wins}W / ${losses}L`, inline: true },
      { name: 'Total Wagered', value: `${overall.wagered || 0}`, inline: true },
      { name: 'Net Profit', value: `${profitSign}${netProfit}`, inline: true }
    );

  if (gameLines.length > 0) {
    embed.addFields({
      name: 'Per-Game Breakdown',
      value: gameLines.join('\n'),
      inline: false,
    });
  }

  if (bigWin) {
    const bigProfit = bigWin.payout - bigWin.bet;
    embed.addFields({
      name: 'Biggest Win',
      value: `**${bigWin.game}** — Bet ${bigWin.bet}, Won ${bigWin.payout} (+${bigProfit}) on ${bigWin.created_at}`,
      inline: false,
    });
  }

  embed.setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
