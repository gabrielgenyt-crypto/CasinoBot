const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const {
  startBlackjack,
  hit,
  stand,
  double,
  handValue,
} = require('../games/blackjack');
const {
  COLORS,
  DIVIDER,
  SPARKLE_LINE,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderBlackjackTable } = require('../utils/cardRenderer');

// Active games keyed by userId.
const activeGames = new Map();

const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('🃏 Play blackjack against the dealer. Hit, Stand, or Double!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

/**
 * Generates the card table PNG and wraps it in a Discord AttachmentBuilder.
 * @param {object} state - The game state.
 * @param {string} playerName - The player's display name.
 * @param {boolean} showDealer - Whether to reveal all dealer cards.
 * @returns {AttachmentBuilder}
 */
function buildCardImage(state, playerName, showDealer) {
  const playerVal = handValue(state.playerHand);
  // Show the value of the dealer's visible card when not fully revealed.
  const dealerVal = showDealer
    ? handValue(state.dealerHand)
    : handValue([state.dealerHand[0]]);

  const pngBuffer = renderBlackjackTable({
    playerHand: state.playerHand,
    dealerHand: state.dealerHand,
    playerValue: playerVal,
    dealerValue: dealerVal,
    showDealer,
    playerName,
    outcome: state.outcome || null,
  });

  return new AttachmentBuilder(pngBuffer, { name: 'blackjack.png' });
}

/**
 * Builds the game embed for the current state.
 */
function buildEmbed(interaction, state, _showDealer = false) {
  const playerVal = handValue(state.playerHand);

  let color;
  let title = `${EMOJIS.blackjack}  B L A C K J A C K  ${EMOJIS.blackjack}`;

  if (state.outcome) {
    switch (state.outcome) {
    case 'blackjack':
      color = COLORS.jackpot;
      title = `${EMOJIS.blackjack}✨  B L A C K J A C K !  ✨${EMOJIS.blackjack}`;
      break;
    case 'win':
      color = COLORS.win;
      title = `${EMOJIS.blackjack}${EMOJIS.winner}  Y O U   W I N  ${EMOJIS.winner}${EMOJIS.blackjack}`;
      break;
    case 'push':
      color = COLORS.warning;
      title = `${EMOJIS.blackjack}🤝  P U S H  🤝${EMOJIS.blackjack}`;
      break;
    case 'lose':
    case 'bust':
      color = COLORS.lose;
      title = state.outcome === 'bust'
        ? `${EMOJIS.blackjack}💥  B U S T !  💥${EMOJIS.blackjack}`
        : `${EMOJIS.blackjack}😔  D E A L E R   W I N S  😔${EMOJIS.blackjack}`;
      break;
    default:
      color = COLORS.neutral;
    }
  } else {
    color = COLORS.neutral;
  }

  let description = `${DIVIDER}\n`;

  // Outcome section.
  if (state.outcome) {
    description += '\n';
    switch (state.outcome) {
    case 'blackjack':
      description += `${SPARKLE_LINE}\n`;
      description += `🎰 **BLACKJACK!** Won **${state.payout.toLocaleString()}** coins!\n`;
      description += SPARKLE_LINE;
      break;
    case 'win':
      description += `🎉 **YOU WIN!** +**${state.payout.toLocaleString()}** coins\n`;
      break;
    case 'push':
      description += `🤝 **Push.** Bet of **${state.bet.toLocaleString()}** returned.\n`;
      break;
    case 'lose':
      description += `💀 **Dealer wins.** -**${state.bet.toLocaleString()}** coins\n`;
      break;
    case 'bust':
      description += `💥 **BUST!** -**${state.bet.toLocaleString()}** coins\n`;
      break;
    default:
      break;
    }
    description += `\n${DIVIDER}`;
  } else {
    if (playerVal === 21) description += ' 🔥';
    description += `\n${DIVIDER}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setImage('attachment://blackjack.png')
    .setTimestamp();

  if (state.outcome) {
    embed.addFields(
      { name: `${EMOJIS.coin} Balance`, value: `\`${state.newBalance.toLocaleString()}\``, inline: true },
      { name: `${EMOJIS.blackjack} Bet`, value: `\`${state.bet.toLocaleString()}\``, inline: true }
    );
    embed.setFooter({ text: `${EMOJIS.shield} Provably Fair | /fairness` });

    if (state.vipLevelUp) {
      embed.addFields({
        name: '⭐ VIP Level Up!',
        value: `You reached **${state.vipLevelUp.name}**!`,
        inline: false,
      });
    }
  } else {
    embed.setFooter({
      text: `Bet: ${state.bet.toLocaleString()} | Balance: ${getBalance(state.userId).toLocaleString()}`,
    });
  }

  return embed;
}

/**
 * Builds the action row with Hit/Stand/Double buttons.
 */
function buildButtons(userId, canDouble) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`blackjack:hit:${userId}`)
      .setLabel('HIT')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🃏'),
    new ButtonBuilder()
      .setCustomId(`blackjack:stand:${userId}`)
      .setLabel('STAND')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✋'),
    new ButtonBuilder()
      .setCustomId(`blackjack:double:${userId}`)
      .setLabel('DOUBLE')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('1496967698431738070')
      .setDisabled(!canDouble)
  );
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ You already have an active blackjack game. Finish it first.',
      ephemeral: true,
    });
  }

  const bet = interaction.options.getInteger('bet');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  let state;
  try {
    state = startBlackjack(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const playerName = interaction.user.username;

  // ── Multi-frame dealing animation ──
  const dealFrames = [
    '🎴 Shuffling the deck...',
    '🃏 Dealing your first card...',
    '🃏 Dealing dealer\'s card...',
    '🃏 Dealing your second card...',
    '🂠 Dealer takes a face-down card...',
  ];

  const dealingEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.blackjack}  B L A C K J A C K  ${EMOJIS.blackjack}`)
    .setDescription(`${DIVIDER}\n\n${dealFrames[0]}\n\n${DIVIDER}`)
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [dealingEmbed], fetchReply: true });

  // Animate through dealing frames.
  for (let i = 1; i < dealFrames.length; i++) {
    await sleep(500);
    dealingEmbed.setDescription(`${DIVIDER}\n\n${dealFrames[i]}\n\n${DIVIDER}`);
    await msg.edit({ embeds: [dealingEmbed] });
  }
  await sleep(400);

  // If the game resolved immediately (natural blackjack), show final state.
  if (state.outcome) {
    const embed = buildEmbed(interaction, state, true);
    const attachment = buildCardImage(state, playerName, true);
    return msg.edit({ embeds: [embed], files: [attachment], components: [] });
  }

  activeGames.set(userId, state);

  // Check if the user can afford to double.
  const canDouble = getBalance(userId) >= bet;
  const embed = buildEmbed(interaction, state);
  const attachment = buildCardImage(state, playerName, false);
  const row = buildButtons(userId, canDouble);

  return msg.edit({ embeds: [embed], files: [attachment], components: [row] });
}

async function handleButton(interaction) {
  const [, action, ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: '❌ This is not your game!', ephemeral: true });
  }

  const state = activeGames.get(ownerId);
  if (!state) {
    return interaction.reply({
      content: '❌ No active game found. Start a new one with /blackjack.',
      ephemeral: true,
    });
  }

  // ── Action animation text ──
  const actionMessages = {
    hit: '🃏 Drawing a card...',
    stand: '✋ Standing — dealer\'s turn...',
    double: `${EMOJIS.lightning} Doubling down!`,
  };

  // Show brief animation frame before processing.
  const animEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.blackjack}  B L A C K J A C K  ${EMOJIS.blackjack}`)
    .setDescription(`${DIVIDER}\n\n${actionMessages[action] || '...'}\n\n${DIVIDER}`)
    .setColor(COLORS.pending);

  await interaction.update({ embeds: [animEmbed], components: [] });
  await sleep(600);

  let updatedState;
  try {
    switch (action) {
    case 'hit':
      updatedState = hit(state);
      break;
    case 'stand':
      updatedState = stand(state);
      break;
    case 'double':
      updatedState = double(state);
      break;
    default:
      return interaction.followUp({ content: '❌ Unknown action.', ephemeral: true });
    }
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.followUp({
        content: '❌ Insufficient funds to double down.',
        ephemeral: true,
      });
    }
    throw error;
  }

  const playerName = interaction.user.username;

  // If the game is resolved, clean up and show final state.
  if (updatedState.outcome) {
    activeGames.delete(ownerId);

    // Show dealer drawing animation when standing or doubling.
    if (action === 'stand' || action === 'double') {
      const dealerDrawEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.blackjack}  B L A C K J A C K  ${EMOJIS.blackjack}`)
        .setDescription(`${DIVIDER}\n\n🎴 Dealer reveals cards...\n\n${DIVIDER}`)
        .setColor(COLORS.pending);
      await interaction.editReply({ embeds: [dealerDrawEmbed] });
      await sleep(700);
    }

    const embed = buildEmbed(interaction, updatedState, true);
    const attachment = buildCardImage(updatedState, playerName, true);
    return interaction.editReply({ embeds: [embed], files: [attachment], components: [] });
  }

  // Game continues -- update the embed with buttons.
  activeGames.set(ownerId, updatedState);
  const canDouble = getBalance(ownerId) >= updatedState.bet && updatedState.playerHand.length === 2;
  const embed = buildEmbed(interaction, updatedState);
  const attachment = buildCardImage(updatedState, playerName, false);
  const row = buildButtons(ownerId, canDouble);

  return interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
}

module.exports = { data, execute, handleButton };
