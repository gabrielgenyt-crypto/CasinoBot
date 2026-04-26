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
  startHilo,
  guessHilo,
  cashOutHilo,
  guessMultiplier,
} = require('../games/hilo');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount, formatBalance } = require('../utils/formatAmount');
const { renderHilo } = require('../utils/cardRenderer');

// Active games keyed by userId.
const activeGames = new Map();

const data = new SlashCommandBuilder()
  .setName('hilo')
  .setDescription('🃏 Guess if the next card is higher or lower!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

/**
 * Generates the Hi-Lo board PNG and wraps it in a Discord AttachmentBuilder.
 * @param {object} state - The game state.
 * @param {string} playerName - The player's display name.
 * @returns {AttachmentBuilder}
 */
function buildImage(state, playerName) {
  const pngBuffer = renderHilo({
    cards: state.cards,
    status: state.status,
    roundMultiplier: state.roundMultiplier,
    playerName,
  });
  return new AttachmentBuilder(pngBuffer, { name: 'hilo.png' });
}

/**
 * Builds the game embed.
 */
function buildEmbed(state) {
  let color;
  let title;
  let description;

  if (state.status === 'lost') {
    color = COLORS.lose;
    title = '🃏💀  W R O N G  💀🃏';
    description = `**-${formatAmount(state.bet)}**`;
  } else if (state.status === 'cashed_out') {
    color = COLORS.win;
    title = `🃏${EMOJIS.coin}  CASHED OUT  ${EMOJIS.coin}🃏`;
    description = `**+${formatAmount(state.payout)}** (${state.roundMultiplier}x)`;
  } else {
    color = COLORS.neutral;
    title = '🃏  H I - L O  🃏';
    const current = state.currentCard;
    const hiMult = guessMultiplier(current.value, 'higher');
    const loMult = guessMultiplier(current.value, 'lower');
    const sameMult = guessMultiplier(current.value, 'same');

    description =
      `Multiplier: **${state.roundMultiplier}x**\n\n` +
      `📈 Higher: **${hiMult > 0 ? hiMult + 'x' : '---'}** | ` +
      `📉 Lower: **${loMult > 0 ? loMult + 'x' : '---'}** | ` +
      `🟰 Same: **${sameMult > 0 ? sameMult + 'x' : '---'}**`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setImage('attachment://hilo.png')
    .setTimestamp();

  if (state.status !== 'playing') {
    embed.addFields(
      { name: `${EMOJIS.coin} Balance`, value: `\`${formatBalance(state.newBalance)}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${state.nonce}\``, inline: true },
      { name: `${EMOJIS.shield} Seed`, value: `\`${state.serverSeedHash.substring(0, 12)}...\``, inline: true }
    );
    embed.setFooter({ text: `${EMOJIS.shield} Provably Fair | /fairness` });

    if (state.vipLevelUp) {
      embed.addFields({
        name: '⭐ VIP Level Up!',
        value: `You reached **${state.vipLevelUp.name}**!`,
        inline: false,
      });
    }
  }

  return embed;
}

/**
 * Builds the action buttons.
 */
function buildButtons(userId, state) {
  const current = state.currentCard;
  const hiMult = guessMultiplier(current.value, 'higher');
  const loMult = guessMultiplier(current.value, 'lower');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hilo:higher:${userId}`)
      .setLabel('HIGHER')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📈')
      .setDisabled(hiMult === 0),
    new ButtonBuilder()
      .setCustomId(`hilo:lower:${userId}`)
      .setLabel('LOWER')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📉')
      .setDisabled(loMult === 0),
    new ButtonBuilder()
      .setCustomId(`hilo:same:${userId}`)
      .setLabel('SAME')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🟰')
  );

  // Add cashout button if at least one guess has been made.
  if (state.cards.length >= 2) {
    const payout = Math.floor(state.bet * state.roundMultiplier);
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`hilo:cashout:${userId}`)
        .setLabel(`${payout}`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  return [row];
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ You already have an active Hi-Lo game. Finish it first.',
      ephemeral: true,
    });
  }

  const bet = interaction.options.getInteger('bet');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  let state;
  try {
    state = startHilo(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  activeGames.set(userId, state);

  const playerName = interaction.user.username;
  const embed = buildEmbed(state);
  const attachment = buildImage(state, playerName);
  const components = buildButtons(userId, state);

  return interaction.reply({ embeds: [embed], files: [attachment], components });
}

async function handleButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: '❌ This is not your game!', ephemeral: true });
  }

  const state = activeGames.get(ownerId);
  if (!state) {
    return interaction.reply({
      content: '❌ No active game found. Start a new one with /hilo.',
      ephemeral: true,
    });
  }

  const playerName = interaction.user.username;

  if (action === 'cashout') {
    try {
      cashOutHilo(state);
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }
    activeGames.delete(ownerId);
    const embed = buildEmbed(state);
    const attachment = buildImage(state, playerName);
    return interaction.update({ embeds: [embed], files: [attachment], components: [] });
  }

  if (['higher', 'lower', 'same'].includes(action)) {
    try {
      guessHilo(state, action);
    } catch (error) {
      if (error.message === 'IMPOSSIBLE_GUESS') {
        return interaction.reply({ content: '❌ That guess is impossible with this card.', ephemeral: true });
      }
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }

    if (state.status !== 'playing') {
      activeGames.delete(ownerId);
      const embed = buildEmbed(state);
      const attachment = buildImage(state, playerName);
      return interaction.update({ embeds: [embed], files: [attachment], components: [] });
    }

    // Game continues.
    activeGames.set(ownerId, state);
    const embed = buildEmbed(state);
    const attachment = buildImage(state, playerName);
    const components = buildButtons(ownerId, state);
    return interaction.update({ embeds: [embed], files: [attachment], components });
  }

  return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
}

module.exports = { data, execute, handleButton };
