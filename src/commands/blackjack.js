const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

// Active games keyed by userId.
const activeGames = new Map();

const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('🃏 Play blackjack against the dealer. Hit, Stand, or Double!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

/**
 * Formats a hand with fancy card boxes.
 */
function fancyHand(hand) {
  return hand.map((c) => `\`[${c.display}]\``).join(' ');
}

/**
 * Builds the game embed for the current state.
 */
function buildEmbed(interaction, state, showDealer = false) {
  const playerVal = handValue(state.playerHand);
  const dealerCards = showDealer
    ? fancyHand(state.dealerHand)
    : `\`[${state.dealerHand[0].display}]\` \`[??]\``;
  const dealerVal = showDealer
    ? handValue(state.dealerHand)
    : '?';

  let color;
  let title = '🃏  B L A C K J A C K  🃏';

  if (state.outcome) {
    switch (state.outcome) {
    case 'blackjack':
      color = COLORS.jackpot;
      title = '🃏✨  B L A C K J A C K !  ✨🃏';
      break;
    case 'win':
      color = COLORS.win;
      title = '🃏🎉  Y O U   W I N  🎉🃏';
      break;
    case 'push':
      color = COLORS.warning;
      title = '🃏🤝  P U S H  🤝🃏';
      break;
    case 'lose':
    case 'bust':
      color = COLORS.lose;
      title = state.outcome === 'bust'
        ? '🃏💥  B U S T !  💥🃏'
        : '🃏😔  D E A L E R   W I N S  😔🃏';
      break;
    default:
      color = COLORS.neutral;
    }
  } else {
    color = COLORS.neutral;
  }

  let description = `${DIVIDER}\n\n`;

  // Dealer section.
  description += `**Dealer** (${dealerVal})\n`;
  description += `${dealerCards}\n\n`;

  // Player section.
  description += `**${interaction.user.username}** (${playerVal})`;
  if (playerVal === 21 && !state.outcome) description += ' 🔥';
  description += '\n';
  description += `${fancyHand(state.playerHand)}\n\n`;

  // Outcome section.
  if (state.outcome) {
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
    description += DIVIDER;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (state.outcome) {
    embed.addFields(
      { name: '💰 Balance', value: `\`${state.newBalance.toLocaleString()}\``, inline: true },
      { name: '🎲 Bet', value: `\`${state.bet.toLocaleString()}\``, inline: true }
    );
    embed.setFooter({ text: '🔒 Provably Fair | /fairness to verify' });

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
      .setEmoji('⚡')
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

  // ── Dealing animation ──
  const dealingEmbed = new EmbedBuilder()
    .setTitle('🃏  B L A C K J A C K  🃏')
    .setDescription(
      `${DIVIDER}\n\n` +
      '🎴 Dealing cards...\n\n' +
      '`[??]` `[??]`\n\n' +
      '`[??]` `[??]`\n\n' +
      DIVIDER
    )
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [dealingEmbed], fetchReply: true });
  await sleep(800);

  // If the game resolved immediately (natural blackjack), show final state.
  if (state.outcome) {
    const embed = buildEmbed(interaction, state, true);
    return msg.edit({ embeds: [embed], components: [] });
  }

  activeGames.set(userId, state);

  // Check if the user can afford to double.
  const canDouble = getBalance(userId) >= bet;
  const embed = buildEmbed(interaction, state);
  const row = buildButtons(userId, canDouble);

  return msg.edit({ embeds: [embed], components: [row] });
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
      return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
    }
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({
        content: '❌ Insufficient funds to double down.',
        ephemeral: true,
      });
    }
    throw error;
  }

  // If the game is resolved, clean up and show final state.
  if (updatedState.outcome) {
    activeGames.delete(ownerId);
    const embed = buildEmbed(interaction, updatedState, true);
    return interaction.update({ embeds: [embed], components: [] });
  }

  // Game continues -- update the embed with buttons.
  activeGames.set(ownerId, updatedState);
  const canDouble = getBalance(ownerId) >= updatedState.bet && updatedState.playerHand.length === 2;
  const embed = buildEmbed(interaction, updatedState);
  const row = buildButtons(ownerId, canDouble);

  return interaction.update({ embeds: [embed], components: [row] });
}

module.exports = { data, execute, handleButton };
