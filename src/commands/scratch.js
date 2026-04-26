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
  buyScratchCard,
  revealTile,
  revealAll,
  GRID_SIZE,
  TOTAL_TILES,
} = require('../games/scratch');
const { COLORS, sleep } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderScratchCard, renderScratchAnim } = require('../utils/cardRenderer');

// Active scratch cards keyed by userId.
const activeCards = new Map();

const data = new SlashCommandBuilder()
  .setName('scratch')
  .setDescription('🎟️ Buy a scratch card! Reveal tiles and match 3 symbols to win.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Card price (wager amount)').setRequired(true).setMinValue(1)
  );

/**
 * Builds the scratch card image attachment.
 */
function buildImage(state, playerName) {
  const pngBuffer = renderScratchCard({
    tiles: state.tiles,
    revealed: state.revealed,
    complete: state.status === 'complete',
    matches: state.matches,
    payout: state.payout,
    playerName,
  });
  return new AttachmentBuilder(pngBuffer, { name: 'scratch.png' });
}

/**
 * Builds the game embed.
 */
function buildEmbed(state) {
  const complete = state.status === 'complete';
  const won = state.payout > 0;

  let color;
  let title;
  let description;

  if (complete && won) {
    color = state.payout >= state.bet * 20 ? COLORS.jackpot : COLORS.win;
    title = `🎟️${EMOJIS.coin}  WINNER!  ${EMOJIS.coin}🎟️`;
    const matchLines = state.matches.map(
      (m) => `${m.emoji} ${m.count}x ${m.label} = **${m.multiplier}x**`
    );
    description = matchLines.join('\n') + `\n\n**+${state.payout.toLocaleString()}** coins`;
  } else if (complete) {
    color = COLORS.lose;
    title = '🎟️  S C R A T C H   C A R D  🎟️';
    description = 'No matches -- better luck next time!';
  } else {
    color = COLORS.neutral;
    title = '🎟️  S C R A T C H   C A R D  🎟️';
    description = `Scratch tiles to reveal prizes!\n${state.revealed.length}/${TOTAL_TILES} revealed`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setImage('attachment://scratch.png')
    .setTimestamp();

  if (complete) {
    embed.addFields(
      { name: `${EMOJIS.coin} Balance`, value: `\`${state.newBalance.toLocaleString()}\``, inline: true },
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
  } else {
    embed.setFooter({
      text: `Bet: ${state.bet.toLocaleString()} | Match 3 symbols to win!`,
    });
  }

  return embed;
}

/**
 * Builds the button grid for scratching tiles + a reveal-all button.
 */
function buildComponents(userId, state) {
  const revealedSet = new Set(state.revealed);
  const components = [];

  // 3 rows of 3 tile buttons.
  for (let row = 0; row < GRID_SIZE; row++) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col;
      const isRevealed = revealedSet.has(idx);

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`scratch:tile:${userId}:${idx}`)
          .setLabel(isRevealed ? state.tiles[idx].emoji : `${idx + 1}`)
          .setStyle(isRevealed ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(isRevealed)
      );
    }
    components.push(actionRow);
  }

  // 4th row: Reveal All button.
  const revealAllRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`scratch:revealall:${userId}`)
      .setLabel('REVEAL ALL')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🎟️')
  );
  components.push(revealAllRow);

  return components;
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  if (activeCards.has(userId)) {
    return interaction.reply({
      content: '❌ You already have an active scratch card. Finish it first.',
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
    state = buyScratchCard(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  activeCards.set(userId, state);

  const playerName = interaction.user.username;

  // ── Animation frame ──
  const animBuffer = renderScratchAnim({ playerName });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'scratching.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle('🎟️  S C R A T C H   C A R D  🎟️')
    .setColor(COLORS.pending)
    .setImage('attachment://scratching.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });
  await sleep(1200);

  // Show the card with buttons.
  const embed = buildEmbed(state);
  const attachment = buildImage(state, playerName);
  const components = buildComponents(userId, state);

  return msg.edit({ embeds: [embed], files: [attachment], components });
}

async function handleButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: '❌ This is not your card!', ephemeral: true });
  }

  const state = activeCards.get(ownerId);
  if (!state) {
    return interaction.reply({
      content: '❌ No active scratch card found. Buy a new one with /scratch.',
      ephemeral: true,
    });
  }

  const playerName = interaction.user.username;

  if (action === 'revealall') {
    try {
      revealAll(state);
    } catch (error) {
      return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }

    activeCards.delete(ownerId);
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

    // Check if the card auto-completed (all tiles revealed).
    if (state.status === 'complete') {
      activeCards.delete(ownerId);
      const embed = buildEmbed(state);
      const attachment = buildImage(state, playerName);
      return interaction.update({ embeds: [embed], files: [attachment], components: [] });
    }

    // Card still in progress.
    activeCards.set(ownerId, state);
    const embed = buildEmbed(state);
    const attachment = buildImage(state, playerName);
    const components = buildComponents(ownerId, state);
    return interaction.update({ embeds: [embed], files: [attachment], components });
  }

  return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
}

module.exports = { data, execute, handleButton };
