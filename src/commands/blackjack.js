const {
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

const name = 'blackjack';
const aliases = ['bj'];
const description = 'Play blackjack! Usage: =blackjack <bet>';

const activeGames = new Map();

function buildEmbed(username, state, showDealer = false) {
  const playerVal = handValue(state.playerHand);
  const dealerCards = showDealer
    ? formatHand(state.dealerHand)
    : `${state.dealerHand[0].display} ??`;
  const dealerVal = showDealer ? handValue(state.dealerHand) : '?';

  const embed = new EmbedBuilder()
    .setTitle('Blackjack')
    .setColor(state.outcome ? (state.outcome === 'lose' || state.outcome === 'bust' ? 0xe74c3c : state.outcome === 'push' ? 0xf1c40f : 0x2ecc71) : 0x3498db)
    .addFields(
      { name: `Dealer (${dealerVal})`, value: dealerCards, inline: false },
      { name: `${username} (${playerVal})`, value: formatHand(state.playerHand), inline: false }
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

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (activeGames.has(userId)) {
    return message.reply('You already have an active blackjack game. Finish it first.');
  }

  if (args.length < 1) {
    return message.reply('Usage: `=blackjack <bet>`\nExample: `=blackjack 100`');
  }

  const bet = parseInt(args[0], 10);
  if (isNaN(bet) || bet < 1) {
    return message.reply('Bet must be a positive number.');
  }

  const balance = getBalance(userId);
  if (bet > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  let state;
  try {
    state = startBlackjack(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    throw error;
  }

  if (state.outcome) {
    const embed = buildEmbed(message.author.username, state, true);
    return message.reply({ embeds: [embed] });
  }

  activeGames.set(userId, state);

  const canDouble = getBalance(userId) >= bet;
  const embed = buildEmbed(message.author.username, state);
  const row = buildButtons(userId, canDouble);

  return message.reply({ embeds: [embed], components: [row] });
}

async function handleButton(interaction) {
  const [, action, ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'This is not your game!', ephemeral: true });
  }

  const state = activeGames.get(ownerId);
  if (!state) {
    return interaction.reply({ content: 'No active game. Start one with =blackjack.', ephemeral: true });
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
      return interaction.reply({ content: 'Insufficient funds to double.', ephemeral: true });
    }
    throw error;
  }

  if (updatedState.outcome) {
    activeGames.delete(ownerId);
    const embed = buildEmbed(interaction.user.username, updatedState, true);
    return interaction.update({ embeds: [embed], components: [] });
  }

  activeGames.set(ownerId, updatedState);
  const canDouble = getBalance(ownerId) >= updatedState.bet && updatedState.playerHand.length === 2;
  const embed = buildEmbed(interaction.user.username, updatedState);
  const row = buildButtons(ownerId, canDouble);

  return interaction.update({ embeds: [embed], components: [row] });
}

module.exports = { name, aliases, description, execute, handleButton };
