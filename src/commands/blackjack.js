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
  formatHand,
} = require('../games/blackjack');

// Active games keyed by userId.
const activeGames = new Map();

const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Play blackjack against the dealer. Hit, Stand, or Double!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

/**
 * Builds the game embed for the current state.
 */
function buildEmbed(interaction, state, showDealer = false) {
  const playerVal = handValue(state.playerHand);
  const dealerCards = showDealer
    ? formatHand(state.dealerHand)
    : `${state.dealerHand[0].display} ??`;
  const dealerVal = showDealer
    ? handValue(state.dealerHand)
    : '?';

  const embed = new EmbedBuilder()
    .setTitle('Blackjack')
    .setColor(state.outcome ? (state.outcome === 'lose' || state.outcome === 'bust' ? 0xe74c3c : state.outcome === 'push' ? 0xf1c40f : 0x2ecc71) : 0x3498db)
    .addFields(
      { name: `Dealer (${dealerVal})`, value: dealerCards, inline: false },
      { name: `${interaction.user.username} (${playerVal})`, value: formatHand(state.playerHand), inline: false }
    );

  if (state.outcome) {
    let outcomeText;
    switch (state.outcome) {
    case 'blackjack':
      outcomeText = `Blackjack! Won **${state.payout}** coins!`;
      break;
    case 'win':
      outcomeText = `You win! Won **${state.payout}** coins!`;
      break;
    case 'push':
      outcomeText = `Push. Bet of **${state.bet}** returned.`;
      break;
    case 'lose':
      outcomeText = `Dealer wins. Lost **${state.bet}** coins.`;
      break;
    case 'bust':
      outcomeText = `Bust! Lost **${state.bet}** coins.`;
      break;
    default:
      outcomeText = '';
    }
    embed.setDescription(outcomeText);
    embed.setFooter({ text: `Balance: ${state.newBalance}` });
  } else {
    embed.setFooter({ text: `Bet: ${state.bet} | Balance: ${getBalance(state.userId)}` });
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
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`blackjack:stand:${userId}`)
      .setLabel('Stand')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`blackjack:double:${userId}`)
      .setLabel('Double')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canDouble)
  );
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  if (activeGames.has(userId)) {
    return interaction.reply({
      content: 'You already have an active blackjack game. Finish it first.',
      ephemeral: true,
    });
  }

  const bet = interaction.options.getInteger('bet');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  let state;
  try {
    state = startBlackjack(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // If the game resolved immediately (natural blackjack), show final state.
  if (state.outcome) {
    const embed = buildEmbed(interaction, state, true);
    return interaction.reply({ embeds: [embed] });
  }

  activeGames.set(userId, state);

  // Check if the user can afford to double.
  const canDouble = getBalance(userId) >= bet;
  const embed = buildEmbed(interaction, state);
  const row = buildButtons(userId, canDouble);

  return interaction.reply({ embeds: [embed], components: [row] });
}

async function handleButton(interaction) {
  const [, action, ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'This is not your game!', ephemeral: true });
  }

  const state = activeGames.get(ownerId);
  if (!state) {
    return interaction.reply({
      content: 'No active game found. Start a new one with /blackjack.',
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
      return interaction.reply({ content: 'Unknown action.', ephemeral: true });
    }
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({
        content: 'Insufficient funds to double down.',
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
