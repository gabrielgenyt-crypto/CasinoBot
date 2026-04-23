const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playRoulette, BET_TYPES } = require('../games/roulette');
const {
  COLORS,
  DIVIDER,
  SPARKLE_LINE,
  rouletteWheel,
  winBanner,
  lossBanner,
  sleep,
} = require('../utils/animations');

// Build choices from BET_TYPES plus a few number examples.
const betChoices = [
  ...Object.entries(BET_TYPES).map(([key, val]) => ({
    name: val.label,
    value: key,
  })),
];

const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('🎡 European roulette. Bet on colors, numbers, dozens, and more.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Bet type (red, black, even, odd, low, high, dozen1-3, col1-3, or a number 0-36)')
      .setRequired(true)
      .addChoices(...betChoices.slice(0, 25))
  )
  .addIntegerOption((opt) =>
    opt
      .setName('number')
      .setDescription('Straight-up number bet (0-36). Overrides type if provided.')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(36)
  );

/**
 * Builds the roulette table ASCII art showing the result.
 * @param {number} num - The winning number.
 * @param {string} col - The winning color.
 * @returns {string}
 */
function rouletteResult(num, col) {
  const colorEmoji = { red: '🔴', black: '⚫', green: '🟢' };
  const emoji = colorEmoji[col] || '⚪';
  return [
    '```',
    '  ╔═══════════════╗',
    `  ║   ${emoji}  ${String(num).padStart(2, ' ')}  ${emoji}   ║`,
    '  ╚═══════════════╝',
    '```',
  ].join('\n');
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const numberBet = interaction.options.getInteger('number');
  const typeBet = interaction.options.getString('type');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  // If a number is provided, use it as a straight-up bet.
  const betType = numberBet !== null ? String(numberBet) : typeBet;

  let result;
  try {
    result = playRoulette(userId, bet, betType);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    if (error.message === 'INVALID_BET_TYPE') {
      return interaction.reply({ content: '❌ Invalid bet type.', ephemeral: true });
    }
    throw error;
  }

  // ── Frame 1: Wheel starting to spin ──
  const frame1 = new EmbedBuilder()
    .setTitle('🎡  R O U L E T T E  🎡')
    .setDescription(
      `${DIVIDER}\n\n` +
      `${rouletteWheel(0)}\n\n` +
      '🔄 The wheel is spinning...\n' +
      `**${interaction.user.username}** bet **${bet.toLocaleString()}** on **${result.betLabel}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [frame1], fetchReply: true });

  // ── Frame 2: Wheel spinning faster ──
  await sleep(600);
  const frame2 = new EmbedBuilder()
    .setTitle('🎡  R O U L E T T E  🎡')
    .setDescription(
      `${DIVIDER}\n\n` +
      `${rouletteWheel(1)}\n\n` +
      '🔄 Spinning faster...\n' +
      `Bet: **${result.betLabel}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame2] });

  // ── Frame 3: Ball bouncing ──
  await sleep(600);
  const frame3 = new EmbedBuilder()
    .setTitle('🎡  R O U L E T T E  🎡')
    .setDescription(
      `${DIVIDER}\n\n` +
      `${rouletteWheel(2)}\n\n` +
      '⚪ Ball is bouncing...\n' +
      `Bet: **${result.betLabel}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame3] });

  // ── Frame 4: Slowing down ──
  await sleep(700);
  const frame4 = new EmbedBuilder()
    .setTitle('🎡  R O U L E T T E  🎡')
    .setDescription(
      `${DIVIDER}\n\n` +
      `${rouletteWheel(3)}\n\n` +
      '⚪ Slowing down...\n' +
      `Bet: **${result.betLabel}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame4] });

  // ── Frame 5: Final result ──
  await sleep(900);

  const colorEmoji = { red: '🔴', black: '⚫', green: '🟢' };
  const color = result.won ? COLORS.win : COLORS.lose;
  const isBigWin = result.won && result.payout >= bet * 5;
  const outcomeText = result.won
    ? winBanner(result.payout, isBigWin)
    : lossBanner(bet);

  const finalEmbed = new EmbedBuilder()
    .setTitle(
      isBigWin
        ? `🎡💰  ${colorEmoji[result.color]} ${result.number}  💰🎡`
        : `🎡  ${colorEmoji[result.color]} ${result.number}  🎡`
    )
    .setDescription(
      (isBigWin ? `${SPARKLE_LINE}\n` : '') +
      `${DIVIDER}\n\n` +
      `${rouletteResult(result.number, result.color)}\n` +
      `The ball landed on **${result.number}** (${result.color})\n` +
      `You bet on **${result.betLabel}**\n\n` +
      `${outcomeText}\n\n` +
      DIVIDER +
      (isBigWin ? `\n${SPARKLE_LINE}` : '')
    )
    .setColor(color)
    .addFields(
      { name: '💰 Balance', value: `\`${result.newBalance.toLocaleString()}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${result.nonce}\``, inline: true },
      { name: '🔐 Seed', value: `\`${result.serverSeedHash.substring(0, 12)}...\``, inline: true }
    )
    .setFooter({ text: '🔒 Provably Fair | /fairness to verify' })
    .setTimestamp();

  if (result.vipLevelUp) {
    finalEmbed.addFields({
      name: '⭐ VIP Level Up!',
      value: `You reached **${result.vipLevelUp.name}**!`,
      inline: false,
    });
  }

  return msg.edit({ embeds: [finalEmbed] });
}

module.exports = { data, execute };
