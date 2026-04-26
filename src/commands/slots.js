const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playSlots } = require('../games/slots');
const {
  COLORS,
  SPARKLE_LINE,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount, formatBalance } = require('../utils/formatAmount');
const { renderSlots, renderSlotsAnim } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('🎰 5-reel slot machine with wilds, scatters & free spins!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  // Play the game first so we have the result.
  let result;
  try {
    result = playSlots(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // ── Animation frame: Spinning PNG ──
  const animBuffer = renderSlotsAnim({ playerName: interaction.user.username });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'spinning.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.slots}  S L O T   M A C H I N E  ${EMOJIS.slots}`)
    .setColor(COLORS.pending)
    .setImage('attachment://spinning.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  // ── Result after delay ──
  await sleep(2200);

  // Determine embed color and title.
  let color;
  let title;

  if (result.isJackpot) {
    color = COLORS.jackpot;
    title = `${EMOJIS.slots}${EMOJIS.coin} J A C K P O T ${EMOJIS.coin}${EMOJIS.slots}`;
  } else if (result.isMegaWin) {
    color = 0xe040fb; // Purple for mega wins.
    title = `${EMOJIS.slots}${EMOJIS.fire} M E G A   W I N ${EMOJIS.fire}${EMOJIS.slots}`;
  } else if (result.isBigWin) {
    color = COLORS.win;
    title = `${EMOJIS.slots}${EMOJIS.winner} B I G   W I N ${EMOJIS.winner}${EMOJIS.slots}`;
  } else if (result.won) {
    color = COLORS.win;
    title = `${EMOJIS.slots}  S L O T S  ${EMOJIS.slots}`;
  } else {
    color = COLORS.lose;
    title = `${EMOJIS.slots}  S L O T S  ${EMOJIS.slots}`;
  }

  // Build description.
  let description = '';

  if (result.isJackpot || result.isMegaWin) {
    description += `${SPARKLE_LINE}\n`;
  }

  if (result.won) {
    description += `**+${formatAmount(result.payout)}**`;
    if (result.paylineWins.length > 0) {
      description += ` across **${result.paylineWins.length}** payline${result.paylineWins.length !== 1 ? 's' : ''}`;
    }
  } else {
    description += 'Better luck next time!';
  }

  // Progressive jackpot win.
  if (result.jackpotWin) {
    description += `\n\n${EMOJIS.fire} **PROGRESSIVE JACKPOT!** ${EMOJIS.fire}`;
    description += `\n${EMOJIS.coin} Jackpot prize: **+${formatAmount(result.jackpotWin.amount)}**`;
  }

  // Free spins info.
  if (result.freeSpinResult) {
    const fs = result.freeSpinResult;
    description += `\n\n💫 **${fs.spinResults.length} Free Spins** triggered!`;
    description += `\n${EMOJIS.coin} Free spin winnings: **+${formatAmount(fs.totalWin)}**`;
  }

  if (result.isJackpot || result.isMegaWin) {
    description += `\n${SPARKLE_LINE}`;
  }

  // Render the slot machine result image.
  const pngBuffer = renderSlots({
    grid: result.grid,
    paylineWins: result.paylineWins,
    bestWin: result.bestWin,
    payout: result.payout,
    won: result.won,
    isJackpot: result.isJackpot,
    isBigWin: result.isBigWin,
    isMegaWin: result.isMegaWin,
    scatterCount: result.scatterCount,
    freeSpinResult: result.freeSpinResult,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'slots.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setImage('attachment://slots.png')
    .addFields(
      { name: `${EMOJIS.coin} Balance`, value: `\`${formatBalance(result.newBalance)}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${result.nonce}\``, inline: true },
      { name: `${EMOJIS.shield} Seed`, value: `\`${result.serverSeedHash.substring(0, 12)}...\``, inline: true }
    )
    .setFooter({ text: `${EMOJIS.shield} Provably Fair | 5 reels \u2022 20 paylines | /fairness` })
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
