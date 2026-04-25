const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playSlots } = require('../games/slots');
const {
  COLORS,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderSlots, renderSlotsAnim } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('🎰 Spin the slot machine! Match symbols to win big.')
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
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
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

  // ── Animation frame: Rolling PNG ──
  const animBuffer = renderSlotsAnim({ playerName: interaction.user.username });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'rolling.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.slots}  S L O T   M A C H I N E  ${EMOJIS.slots}`)
    .setColor(COLORS.pending)
    .setImage('attachment://rolling.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  // ── Result after delay ──
  await sleep(2000);

  const isJackpot = result.multiplier >= 10;
  let color;

  if (isJackpot) {
    color = COLORS.jackpot;
  } else if (result.won) {
    color = COLORS.win;
  } else {
    color = COLORS.lose;
  }

  // Render the slot machine result image.
  const pngBuffer = renderSlots({
    reels: result.reels,
    won: result.won,
    multiplier: result.multiplier,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'slots.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(isJackpot ? `${EMOJIS.slots}${EMOJIS.coin} J A C K P O T ${EMOJIS.coin}${EMOJIS.slots}` : `${EMOJIS.slots}  S L O T S  ${EMOJIS.slots}`)
    .setDescription(
      result.won
        ? `**+${result.payout.toLocaleString()}** coins (${result.multiplier}x)`
        : 'Better luck next time!'
    )
    .setColor(color)
    .setImage('attachment://slots.png')
    .addFields(
      { name: `${EMOJIS.coin} Balance`, value: `\`${result.newBalance.toLocaleString()}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${result.nonce}\``, inline: true },
      { name: `${EMOJIS.shield} Seed`, value: `\`${result.serverSeedHash.substring(0, 12)}...\``, inline: true }
    )
    .setFooter({ text: `${EMOJIS.shield} Provably Fair | /fairness` })
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
