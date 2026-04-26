const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount } = require('../utils/formatAmount');
const { renderLeaderboard } = require('../utils/cardRenderer');

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

/**
 * Resolves a Discord user ID to a display name via the interaction's guild.
 * Falls back to a truncated ID if the member cannot be fetched.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function resolveName(interaction, userId) {
  try {
    const member = await interaction.guild?.members.fetch(userId);
    return member?.displayName || `User#${userId.slice(-4)}`;
  } catch {
    return `User#${userId.slice(-4)}`;
  }
}

async function execute(interaction) {
  const type = interaction.options.getString('type') || 'balance';

  let rows;
  let title;
  let valueKey;

  switch (type) {
  case 'balance':
    rows = db
      .prepare('SELECT user_id, balance FROM wallets ORDER BY balance DESC LIMIT 10')
      .all();
    title = 'TOP 10 — RICHEST PLAYERS';
    valueKey = (row) => formatAmount(row.balance);
    break;

  case 'wagered':
    rows = db
      .prepare(
        'SELECT user_id, SUM(bet) as total_wagered FROM game_history GROUP BY user_id ORDER BY total_wagered DESC LIMIT 10'
      )
      .all();
    title = 'TOP 10 — MOST WAGERED';
    valueKey = (row) => `${row.total_wagered.toLocaleString()} wagered`;
    break;

  case 'profit':
    rows = db
      .prepare(
        'SELECT user_id, SUM(payout - bet) as net_profit FROM game_history GROUP BY user_id ORDER BY net_profit DESC LIMIT 10'
      )
      .all();
    title = 'TOP 10 — HIGHEST PROFIT';
    valueKey = (row) => {
      const sign = row.net_profit >= 0 ? '+' : '';
      return `${sign}${formatAmount(row.net_profit)}`;
    };
    break;

  case 'wins':
    rows = db
      .prepare(
        'SELECT user_id, COUNT(*) as win_count FROM game_history WHERE won = 1 GROUP BY user_id ORDER BY win_count DESC LIMIT 10'
      )
      .all();
    title = 'TOP 10 — MOST WINS';
    valueKey = (row) => `${row.win_count.toLocaleString()} wins`;
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

  // Resolve display names for each row.
  const lbRows = await Promise.all(
    rows.map(async (row, i) => ({
      rank: i + 1,
      name: await resolveName(interaction, row.user_id),
      value: valueKey(row),
    }))
  );

  // Render the leaderboard PNG.
  const pngBuffer = renderLeaderboard({ title, rows: lbRows });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'leaderboard.png' });

  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.trophy}  ${title}  ${EMOJIS.trophy}`)
    .setColor(COLORS.jackpot)
    .setImage('attachment://leaderboard.png')
    .setFooter({ text: 'Play more to climb the ranks!' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
