const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureWallet } = require('../utils/wallet');
const { getJackpotPool, getJackpotHistory } = require('../utils/jackpot');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');

const data = new SlashCommandBuilder()
  .setName('jackpot')
  .setDescription('💰 View the progressive jackpot pool and recent winners.');

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const pool = getJackpotPool();
  const history = getJackpotHistory(5);

  // Build the embed.
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.coin}${EMOJIS.fire}  PROGRESSIVE JACKPOT  ${EMOJIS.fire}${EMOJIS.coin}`)
    .setColor(COLORS.jackpot)
    .setTimestamp();

  // Current pool.
  let description = `### ${EMOJIS.coin} Current Pool\n`;
  description += `# **${pool.amount.toLocaleString()}** coins\n\n`;
  description += '> 1% of every bet feeds the jackpot pool.\n';
  description += '> Any **slots** spin can trigger the jackpot!\n';
  description += '> Higher bets = higher chance to win.\n';

  // Last winner.
  if (pool.lastWinnerName) {
    description += `\n### ${EMOJIS.trophy} Last Winner\n`;
    description += `**${pool.lastWinnerName}** won **${pool.lastWinAmount.toLocaleString()}** coins`;
    if (pool.lastWonAt) {
      description += ` on ${pool.lastWonAt}`;
    }
    description += '\n';
  }

  embed.setDescription(description);

  // Stats fields.
  embed.addFields(
    { name: `${EMOJIS.crown} Total Jackpots Won`, value: `\`${pool.totalWins}\``, inline: true },
    { name: `${EMOJIS.slots} Eligible Game`, value: '`Slots`', inline: true },
    { name: `${EMOJIS.lightning} Contribution`, value: '`1% per bet`', inline: true }
  );

  // Recent winners history.
  if (history.length > 0) {
    const historyLines = history.map(
      (h, i) => `**${i + 1}.** ${h.username} -- **${h.amount.toLocaleString()}** coins`
    );
    embed.addFields({
      name: `${EMOJIS.trophy} Recent Winners`,
      value: historyLines.join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Play /slots for a chance to win the jackpot!' });

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
