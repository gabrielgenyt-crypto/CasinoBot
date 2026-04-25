const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playSlots } = require('../games/slots');
const {
  COLORS,
  DIVIDER,
  slotMachine,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderSlots } = require('../utils/cardRenderer');

// Random spinning symbols for animation frames.
const SPIN_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '7️⃣', EMOJIS.diamond, '⭐', EMOJIS.slots];

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('🎰 Spin the slot machine! Match symbols to win big.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

/**
 * Picks a random element from an array.
 */
function randomSymbol() {
  return SPIN_SYMBOLS[Math.floor(Math.random() * SPIN_SYMBOLS.length)];
}

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

  const reels = result.reels.map((r) => r.emoji);

  // ── Frame 1: Machine starting ──
  const frame1 = new EmbedBuilder()
    .setTitle(`${EMOJIS.slots}  S L O T   M A C H I N E  ${EMOJIS.slots}`)
    .setDescription(
      `${DIVIDER}\n` +
      slotMachine(['❓', '❓', '❓'], true) +
      `\n${interaction.user.username} pulls the lever...\n` +
      `Bet: **${bet.toLocaleString()}** coins\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [frame1], fetchReply: true });

  // ── Frame 2: First reel stops ──
  await sleep(700);
  const frame2 = new EmbedBuilder()
    .setTitle(`${EMOJIS.slots}  S L O T   M A C H I N E  ${EMOJIS.slots}`)
    .setDescription(
      `${DIVIDER}\n` +
      slotMachine([reels[0], randomSymbol(), randomSymbol()]) +
      '\n🔄 Spinning...\n' +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame2] });

  // ── Frame 3: Second reel stops ──
  await sleep(700);
  const frame3 = new EmbedBuilder()
    .setTitle(`${EMOJIS.slots}  S L O T   M A C H I N E  ${EMOJIS.slots}`)
    .setDescription(
      `${DIVIDER}\n` +
      slotMachine([reels[0], reels[1], randomSymbol()]) +
      '\n🔄 Almost there...\n' +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame3] });

  // ── Frame 4: All reels stopped -- result ──
  await sleep(900);

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
