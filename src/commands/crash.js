const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCrash } = require('../games/crash');
const {
  COLORS,
  DIVIDER,
  SPARKLE_LINE,
  crashGraph,
  winBanner,
  lossBanner,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderCrash } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('crash')
  .setDescription('🚀 Ride the multiplier! Cash out before it crashes.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addNumberOption((opt) =>
    opt
      .setName('cashout')
      .setDescription('Auto-cashout multiplier (e.g. 2.0)')
      .setRequired(true)
      .setMinValue(1.01)
      .setMaxValue(1000)
  );

/**
 * Builds a climbing multiplier bar for animation frames.
 * @param {number} current - Current multiplier.
 * @param {number} target - Target cashout.
 * @returns {string}
 */
function rocketTrail(current, target) {
  const maxBars = 15;
  const ratio = Math.min(current / Math.max(target, 2), 1);
  const filled = Math.round(ratio * maxBars);
  const empty = maxBars - filled;
  const bar = '▓'.repeat(filled) + '░'.repeat(empty);
  return `\`${current.toFixed(2)}x\` ${bar} ${EMOJIS.rocket}`;
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const cashout = interaction.options.getNumber('cashout');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  // Play the game first so we know the outcome.
  let result;
  try {
    result = playCrash(userId, bet, cashout);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // ── Build animation steps up to the crash/cashout point ──
  // We simulate the multiplier climbing in steps.
  const finalMultiplier = result.crashPoint;
  const steps = [];
  let m = 1.0;
  const increment = Math.max((finalMultiplier - 1) / 4, 0.1);

  while (m < finalMultiplier - increment * 0.5) {
    m += increment;
    if (m < finalMultiplier) steps.push(parseFloat(m.toFixed(2)));
  }
  // Cap at 4 animation frames to keep it snappy.
  const animSteps = steps.slice(0, 4);

  // ── Frame 1: Launch ──
  const launchEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.rocket}  C R A S H  ${EMOJIS.rocket}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      `  ${EMOJIS.rocket} LAUNCHING...\n` +
      '  ▓░░░░░░░░░░░░░░\n' +
      '  1.00x\n' +
      '```\n' +
      `**${interaction.user.username}** bet **${bet.toLocaleString()}** coins\n` +
      `Target: **${cashout}x**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [launchEmbed], fetchReply: true });

  // ── Climbing frames ──
  for (const step of animSteps) {
    await sleep(600);
    const climbColor = step >= cashout ? COLORS.win : COLORS.neutral;
    const climbEmbed = new EmbedBuilder()
      .setTitle(`${EMOJIS.rocket}  C R A S H  ${EMOJIS.rocket}`)
      .setDescription(
        `${DIVIDER}\n\n` +
        `${rocketTrail(step, cashout)}\n\n` +
        '📈 Multiplier climbing...\n' +
        `Target: **${cashout}x**\n\n` +
        DIVIDER
      )
      .setColor(climbColor);
    await msg.edit({ embeds: [climbEmbed] });
  }

  // ── Final frame: Result ──
  await sleep(800);

  const won = result.won;
  const color = won ? COLORS.win : COLORS.lose;
  const outcomeText = won
    ? winBanner(result.payout, result.cashout >= 5)
    : lossBanner(bet);

  const statusLine = won
    ? `✅ Cashed out at **${result.cashout}x**!`
    : `💥 **CRASHED** at **${result.crashPoint}x**!`;

  const graph = crashGraph(result.crashPoint);

  // Render the crash graph image.
  const pngBuffer = renderCrash({
    crashPoint: result.crashPoint,
    cashout: result.cashout,
    won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'crash.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(won ? `${EMOJIS.rocket}${EMOJIS.coin}  CASHED OUT  ${EMOJIS.coin}${EMOJIS.rocket}` : '💥  C R A S H E D  💥')
    .setDescription(
      (won && result.cashout >= 5 ? `${SPARKLE_LINE}\n` : '') +
      `${DIVIDER}\n\n` +
      `${graph}\n\n` +
      `${statusLine}\n` +
      `Target: **${result.cashout}x** | Crashed at: **${result.crashPoint}x**\n\n` +
      `${outcomeText}\n\n` +
      DIVIDER +
      (won && result.cashout >= 5 ? `\n${SPARKLE_LINE}` : '')
    )
    .setColor(color)
    .setImage('attachment://crash.png')
    .addFields(
      { name: `${EMOJIS.coin} Balance`, value: `\`${result.newBalance.toLocaleString()}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${result.nonce}\``, inline: true },
      { name: `${EMOJIS.shield} Seed`, value: `\`${result.serverSeedHash.substring(0, 12)}...\``, inline: true }
    )
    .setFooter({ text: `${EMOJIS.shield} Provably Fair | /fairness to verify` })
    .setTimestamp();

  if (result.vipLevelUp) {
    finalEmbed.addFields({
      name: '⭐ VIP Level Up!',
      value: `You reached **${result.vipLevelUp.name}**!`,
      inline: false,
    });
  }

  return msg.edit({ embeds: [finalEmbed], files: [attachment] });
}

module.exports = { data, execute };
