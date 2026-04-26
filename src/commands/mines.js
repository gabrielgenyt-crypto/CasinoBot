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
  startMines,
  revealTile,
  cashOut,
  getMultiplier,
  GRID_SIZE,
} = require('../games/mines');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount } = require('../utils/formatAmount');
const { renderMines } = require('../utils/cardRenderer');

// Active games keyed by userId.
const activeGames = new Map();

const data = new SlashCommandBuilder()
  .setName('mines')
  .setDescription('💎 Reveal tiles on a 5x5 grid. Avoid the mines!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('mines')
      .setDescription('Number of mines (1-24)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(24)
  );

/**
 * Builds the mines board image attachment.
 */
function buildImage(state, playerName) {
  const pngBuffer = renderMines({
    revealed: state.revealed,
    minePositions: state.minePositions,
    exploded: state.status === 'exploded',
    cashedOut: state.status === 'cashed_out',
    multiplier: state.multiplier,
    playerName,
  });
  return new AttachmentBuilder(pngBuffer, { name: 'mines.png' });
}

/**
 * Builds the game embed.
 */
function buildEmbed(state) {
  let color;
  let title;
  let description;

  if (state.status === 'exploded') {
    color = COLORS.lose;
    title = '💥  M I N E !  💥';
    description = `**-${formatAmount(state.bet)}**`;
  } else if (state.status === 'cashed_out') {
    color = COLORS.win;
    title = `💎${EMOJIS.coin}  CASHED OUT  ${EMOJIS.coin}💎`;
    description = `**+${formatAmount(state.payout)}** (${state.multiplier}x)`;
  } else {
    color = COLORS.neutral;
    title = '💎  M I N E S  💎';
    const nextMultiplier = getMultiplier(state.revealed.length + 1, state.mineCount);
    description = `${state.revealed.length} revealed | Next: **${nextMultiplier}x**\nPick a tile or cash out!`;
  }

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setImage('attachment://mines.png')
    .setTimestamp();
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ You already have an active mines game. Finish it first.',
      ephemeral: true,
    });
  }

  const bet = interaction.options.getInteger('bet');
  const mineCount = interaction.options.getInteger('mines');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  let state;
  try {
    state = startMines(userId, bet, mineCount);
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

  // Discord allows max 5 action rows. We use 5 for the grid.
  // Cashout button goes in the embed footer as a hint; we handle it via
  // a separate button in the last row.
  // Actually, we need 5 rows for tiles + 1 for cashout = 6, but Discord max is 5.
  // Solution: use 4 rows of tiles + 1 row with cashout. Show a 4x5 grid + last row as cashout.
  // Better: use 5 rows, but replace the 5th row with cashout when tiles are revealed.
  // Simplest: just use 5 rows of tiles. Add cashout as a separate message component.
  // Discord limit is 5 action rows total. So we do 4 tile rows + 1 cashout row = 5 rows.
  // That means a 4x5 = 20 tile grid instead of 5x5 = 25. Let's keep 5x5 but only show
  // tile buttons for the first 4 rows, and the 5th row is the cashout.
  // Actually, let's just do the full 5 rows of tiles and no cashout button.
  // The player cashes out by clicking a "CASH OUT" button that replaces the grid after first reveal.

  // Compromise: show the grid as the PNG image, and use a simple set of buttons.
  const components = [];
  // Row 1-4: tile buttons (4 rows x 5 cols = 20 tiles)
  for (let row = 0; row < 4; row++) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col;
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines:tile:${userId}:${idx}`)
          .setLabel(`${idx + 1}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    components.push(actionRow);
  }
  // Row 5: last 5 tiles + cashout (but that's 6 buttons, max is 5 per row).
  // Use row 5 for the last 5 tiles.
  const lastRow = new ActionRowBuilder();
  for (let col = 0; col < GRID_SIZE; col++) {
    const idx = 4 * GRID_SIZE + col;
    lastRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`mines:tile:${userId}:${idx}`)
        .setLabel(`${idx + 1}`)
        .setStyle(ButtonStyle.Secondary)
    );
  }
  components.push(lastRow);

  // We can't fit a cashout button with 5 rows of tiles. Instead, we'll
  // replace the grid with fewer rows after the first reveal to make room.
  // For now, send without cashout. The handleButton will rebuild with cashout.

  return interaction.reply({ embeds: [embed], files: [attachment], components });
}

/**
 * Rebuilds the components with revealed tiles disabled and a cashout row.
 */
function rebuildComponents(userId, state) {
  const revealedSet = new Set(state.revealed);
  const components = [];

  // 4 rows of tiles.
  for (let row = 0; row < 4; row++) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col;
      const isRevealed = revealedSet.has(idx);
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines:tile:${userId}:${idx}`)
          .setLabel(isRevealed ? '💎' : `${idx + 1}`)
          .setStyle(isRevealed ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(isRevealed)
      );
    }
    components.push(actionRow);
  }

  // 5th row: last 5 tiles OR cashout button.
  // If player has revealed at least 1 tile, show cashout + remaining last-row tiles.
  if (state.revealed.length > 0) {
    const cashoutRow = new ActionRowBuilder();
    // Add remaining last-row tile buttons (up to 3) + cashout.
    let added = 0;
    for (let col = 0; col < GRID_SIZE && added < 4; col++) {
      const idx = 4 * GRID_SIZE + col;
      const isRevealed = revealedSet.has(idx);
      cashoutRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines:tile:${userId}:${idx}`)
          .setLabel(isRevealed ? '💎' : `${idx + 1}`)
          .setStyle(isRevealed ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(isRevealed)
      );
      added++;
    }
    // Add cashout button.
    const payout = Math.floor(state.bet * state.multiplier);
    cashoutRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`mines:cashout:${userId}`)
        .setLabel(`${payout}`)
        .setStyle(ButtonStyle.Danger)
    );
    components.push(cashoutRow);
  } else {
    // No reveals yet, show all last-row tiles.
    const lastRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = 4 * GRID_SIZE + col;
      lastRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines:tile:${userId}:${idx}`)
          .setLabel(`${idx + 1}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    components.push(lastRow);
  }

  return components;
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
      content: '❌ No active game found. Start a new one with /mines.',
      ephemeral: true,
    });
  }

  const playerName = interaction.user.username;

  if (action === 'cashout') {
    try {
      cashOut(state);
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }

    activeGames.delete(ownerId);
    const embed = buildEmbed(state);
    const attachment = buildImage(state, playerName);
    return interaction.update({ embeds: [embed], files: [attachment], components: [] });
  }

  if (action === 'tile') {
    const tileIndex = parseInt(parts[3], 10);

    try {
      revealTile(state, tileIndex);
    } catch (error) {
      if (error.message === 'ALREADY_REVEALED') {
        return interaction.reply({ content: '❌ Already revealed.', ephemeral: true });
      }
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }

    if (state.status !== 'playing') {
      // Game over.
      activeGames.delete(ownerId);
      const embed = buildEmbed(state);
      const attachment = buildImage(state, playerName);
      return interaction.update({ embeds: [embed], files: [attachment], components: [] });
    }

    // Game continues.
    activeGames.set(ownerId, state);
    const embed = buildEmbed(state);
    const attachment = buildImage(state, playerName);
    const components = rebuildComponents(ownerId, state);
    return interaction.update({ embeds: [embed], files: [attachment], components });
  }

  return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
}

module.exports = { data, execute, handleButton };
