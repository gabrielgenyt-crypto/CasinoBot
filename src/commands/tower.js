const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const {
  startTower,
  climbFloor,
  cashOutTower,
  getMultiplier,
  TILES_PER_FLOOR,
  TOTAL_FLOORS,
} = require('../games/tower');
const { COLORS } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount, formatBalance } = require('../utils/formatAmount');

// Active games keyed by userId.
const activeGames = new Map();

const data = new SlashCommandBuilder()
  .setName('tower')
  .setDescription('🗼 Climb the tower! Pick safe tiles to reach the top.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName('difficulty')
      .setDescription('Difficulty level')
      .setRequired(false)
      .addChoices(
        { name: 'Easy (1 trap)', value: 'easy' },
        { name: 'Medium (2 traps)', value: 'medium' }
      )
  );

/**
 * Builds the tower game embed.
 */
function buildEmbed(state) {
  let color;
  let title;
  let description;

  if (state.status === 'exploded') {
    color = COLORS.lose;
    title = '💥  T R A P !  💥';
    description = `**-${formatAmount(state.bet)}**`;
  } else if (state.status === 'cashed_out') {
    color = COLORS.win;
    title = `🗼${EMOJIS.coin}  CASHED OUT  ${EMOJIS.coin}🗼`;
    description = `**+${formatAmount(state.payout)}** (${state.multiplier}x)`;
  } else {
    color = COLORS.neutral;
    title = '🗼  T O W E R  🗼';
    const nextMult = getMultiplier(state.currentFloor + 1, state.traps);
    description = `Floor **${state.currentFloor}/${TOTAL_FLOORS}** | Current: **${state.multiplier}x**\nNext floor: **${nextMult}x** | Pick a tile!`;
  }

  // Build a visual tower.
  const lines = [];
  for (let f = TOTAL_FLOORS - 1; f >= 0; f--) {
    const floorNum = f + 1;
    let row;
    if (f < state.currentFloor) {
      // Cleared floor.
      const traps = state.trapPositions[f];
      row = Array.from({ length: TILES_PER_FLOOR }, (_, i) =>
        traps.includes(i) ? '💀' : '✅'
      ).join(' ');
    } else if (f === state.currentFloor && state.status === 'exploded') {
      // Exploded floor.
      const traps = state.trapPositions[f];
      row = Array.from({ length: TILES_PER_FLOOR }, (_, i) =>
        traps.includes(i) ? '💥' : '⬜'
      ).join(' ');
    } else if (state.status !== 'playing' && f > state.currentFloor) {
      // Reveal traps on game over.
      const traps = state.trapPositions[f];
      row = Array.from({ length: TILES_PER_FLOOR }, (_, i) =>
        traps.includes(i) ? '💀' : '⬜'
      ).join(' ');
    } else {
      row = '❓ ❓ ❓';
    }
    const mult = getMultiplier(floorNum, state.traps);
    lines.push(`\`F${String(floorNum).padStart(2)}\` ${row}  \`${mult}x\``);
  }

  description += '\n\n' + lines.join('\n');

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
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
 * Builds the tile selection buttons + cashout.
 */
function buildButtons(userId, state) {
  const tileRow = new ActionRowBuilder();
  for (let i = 0; i < TILES_PER_FLOOR; i++) {
    tileRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`tower:tile:${userId}:${i}`)
        .setLabel(`Tile ${i + 1}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓')
    );
  }

  if (state.currentFloor > 0) {
    const payout = Math.floor(state.bet * state.multiplier);
    tileRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`tower:cashout:${userId}`)
        .setLabel(`${payout}`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  return [tileRow];
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ You already have an active tower game. Finish it first.',
      ephemeral: true,
    });
  }

  const bet = interaction.options.getInteger('bet');
  const difficulty = interaction.options.getString('difficulty') || 'easy';
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  let state;
  try {
    state = startTower(userId, bet, difficulty);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  activeGames.set(userId, state);

  const embed = buildEmbed(state);
  const components = buildButtons(userId, state);

  return interaction.reply({ embeds: [embed], components });
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
      content: '❌ No active game found. Start a new one with /tower.',
      ephemeral: true,
    });
  }

  if (action === 'cashout') {
    try {
      cashOutTower(state);
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }
    activeGames.delete(ownerId);
    const embed = buildEmbed(state);
    return interaction.update({ embeds: [embed], components: [] });
  }

  if (action === 'tile') {
    const tile = parseInt(parts[3], 10);

    try {
      climbFloor(state, tile);
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }

    if (state.status !== 'playing') {
      activeGames.delete(ownerId);
      const embed = buildEmbed(state);
      return interaction.update({ embeds: [embed], components: [] });
    }

    // Game continues.
    activeGames.set(ownerId, state);
    const embed = buildEmbed(state);
    const components = buildButtons(ownerId, state);
    return interaction.update({ embeds: [embed], components });
  }

  return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
}

module.exports = { data, execute, handleButton };
