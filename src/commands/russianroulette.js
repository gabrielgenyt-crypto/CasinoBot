const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');
const {
  COLORS,
  DIVIDER,
  sleep,
} = require('../utils/animations');

// Active lobbies keyed by channelId (one game per channel).
const lobbies = new Map();

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const LOBBY_TIMEOUT_MS = 60 * 1000; // 60 seconds to fill the lobby.

const data = new SlashCommandBuilder()
  .setName('russianroulette')
  .setDescription('🔫 Start a Russian Roulette game! Last one standing wins the pot.')
  .addIntegerOption((opt) =>
    opt
      .setName('bet')
      .setDescription('Buy-in amount per player')
      .setRequired(true)
      .setMinValue(10)
  );

/**
 * Builds the lobby embed showing current players.
 */
function buildLobbyEmbed(lobby) {
  const playerList = lobby.players
    .map((p, i) => `\`${i + 1}.\` <@${p.id}> ${i === 0 ? '(Host)' : ''}`)
    .join('\n');

  return new EmbedBuilder()
    .setTitle('🔫  R U S S I A N   R O U L E T T E  🔫')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '     🔫 💀 🎯 💀 🔫\n' +
      '```\n' +
      `Buy-in: **${lobby.bet.toLocaleString()}** coins\n` +
      `Prize Pool: **${(lobby.bet * lobby.players.length).toLocaleString()}** coins\n\n` +
      `**Players (${lobby.players.length}/${MAX_PLAYERS}):**\n` +
      `${playerList}\n\n` +
      `Need at least **${MIN_PLAYERS}** players to start.\n\n` +
      DIVIDER
    )
    .setColor(COLORS.neutral)
    .setFooter({ text: 'Lobby closes in 60 seconds' })
    .setTimestamp();
}

/**
 * Builds the lobby action row.
 */
function buildLobbyButtons(channelId, canStart) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`russianroulette:join:${channelId}`)
      .setLabel('JOIN')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎯'),
    new ButtonBuilder()
      .setCustomId(`russianroulette:start:${channelId}`)
      .setLabel('START')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔫')
      .setDisabled(!canStart),
    new ButtonBuilder()
      .setCustomId(`russianroulette:leave:${channelId}`)
      .setLabel('LEAVE')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚪')
  );
}

async function execute(interaction) {
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  if (lobbies.has(channelId)) {
    return interaction.reply({
      content: '❌ A Russian Roulette game is already in progress in this channel.',
      ephemeral: true,
    });
  }

  ensureWallet(userId);
  const bet = interaction.options.getInteger('bet');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  // Deduct buy-in from host.
  updateBalance(userId, -bet, 'russian roulette buy-in');

  const lobby = {
    bet,
    hostId: userId,
    players: [{ id: userId, username: interaction.user.username }],
    started: false,
  };

  lobbies.set(channelId, lobby);

  const embed = buildLobbyEmbed(lobby);
  const row = buildLobbyButtons(channelId, lobby.players.length >= MIN_PLAYERS);

  await interaction.reply({ embeds: [embed], components: [row] });

  // Auto-expire the lobby after timeout.
  setTimeout(() => {
    const currentLobby = lobbies.get(channelId);
    if (currentLobby && !currentLobby.started) {
      lobbies.delete(channelId);
      // Refund all players.
      for (const player of currentLobby.players) {
        updateBalance(player.id, currentLobby.bet, 'russian roulette refund (timeout)');
      }
      interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔫  LOBBY EXPIRED  🔫')
            .setDescription(
              `${DIVIDER}\n\n` +
              'Not enough players joined in time.\n' +
              'All buy-ins have been refunded.\n\n' +
              DIVIDER
            )
            .setColor(COLORS.lose),
        ],
        components: [],
      }).catch(() => {});
    }
  }, LOBBY_TIMEOUT_MS);
}

/**
 * Runs the actual Russian Roulette game with animations.
 */
async function runGame(interaction, lobby, channelId) {
  lobby.started = true;

  const players = [...lobby.players];
  const totalPot = lobby.bet * players.length;
  const alive = [...players];

  // ── Intro frame ──
  const introEmbed = new EmbedBuilder()
    .setTitle('🔫💀  R U S S I A N   R O U L E T T E  💀🔫')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '  🔫 The cylinder spins...\n' +
      '  *click* *click* *click*\n' +
      '```\n' +
      `**${alive.length}** players. **1** bullet. **${totalPot.toLocaleString()}** coins.\n\n` +
      alive.map((p) => `💚 <@${p.id}>`).join('\n') + '\n\n' +
      DIVIDER
    )
    .setColor(COLORS.lose);

  await interaction.editReply({ embeds: [introEmbed], components: [] });

  // ── Elimination rounds ──
  const eliminated = [];

  while (alive.length > 1) {
    await sleep(1500);

    // Pick a random player to eliminate.
    const unluckyIndex = Math.floor(Math.random() * alive.length);
    const unlucky = alive[unluckyIndex];
    alive.splice(unluckyIndex, 1);
    eliminated.push(unlucky);

    const statusList = [
      ...alive.map((p) => `💚 <@${p.id}>`),
      ...eliminated.map((p) => `💀 ~~<@${p.id}>~~`),
    ];

    // Suspense frame.
    const suspenseEmbed = new EmbedBuilder()
      .setTitle('🔫💀  R U S S I A N   R O U L E T T E  💀🔫')
      .setDescription(
        `${DIVIDER}\n\n` +
        '```\n' +
        `  🔫 ${unlucky.username} pulls the trigger...\n` +
        '```\n\n' +
        DIVIDER
      )
      .setColor(COLORS.warning);

    await interaction.editReply({ embeds: [suspenseEmbed] });
    await sleep(1200);

    // Result frame.
    const roundEmbed = new EmbedBuilder()
      .setTitle('🔫💀  R U S S I A N   R O U L E T T E  💀🔫')
      .setDescription(
        `${DIVIDER}\n\n` +
        '```\n' +
        '  💥 BANG!\n' +
        '```\n' +
        `💀 **${unlucky.username}** has been eliminated!\n\n` +
        statusList.join('\n') + '\n\n' +
        `**${alive.length}** player(s) remaining\n\n` +
        DIVIDER
      )
      .setColor(COLORS.lose);

    await interaction.editReply({ embeds: [roundEmbed] });
  }

  // ── Winner announcement ──
  await sleep(1500);

  const winner = alive[0];
  const newBalance = updateBalance(winner.id, totalPot, 'russian roulette winner');

  const winEmbed = new EmbedBuilder()
    .setTitle('🔫🏆  S U R V I V O R  🏆🔫')
    .setDescription(
      '✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦\n' +
      `${DIVIDER}\n\n` +
      '```\n' +
      '  🏆 WINNER WINNER! 🏆\n' +
      '```\n' +
      `🎉 **${winner.username}** survived and takes the pot!\n\n` +
      `💰 **+${totalPot.toLocaleString()} coins**\n\n` +
      '**Final standings:**\n' +
      `🏆 <@${winner.id}> — **WINNER**\n` +
      eliminated.reverse().map((p, i) =>
        `\`${i + 2}.\` 💀 <@${p.id}>`
      ).join('\n') + '\n\n' +
      `${DIVIDER}\n` +
      '✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦'
    )
    .setColor(COLORS.jackpot)
    .addFields(
      { name: '💰 Prize', value: `\`${totalPot.toLocaleString()}\``, inline: true },
      { name: '👥 Players', value: `\`${players.length}\``, inline: true },
      { name: '💰 Winner Balance', value: `\`${newBalance.toLocaleString()}\``, inline: true }
    )
    .setFooter({ text: 'Only the brave survive...' })
    .setTimestamp();

  await interaction.editReply({ embeds: [winEmbed] });

  // Clean up the lobby.
  lobbies.delete(channelId);
}

async function handleButton(interaction) {
  const [, action, channelId] = interaction.customId.split(':');
  const userId = interaction.user.id;
  const lobby = lobbies.get(channelId);

  if (!lobby) {
    return interaction.reply({
      content: '❌ This game lobby no longer exists.',
      ephemeral: true,
    });
  }

  if (lobby.started) {
    return interaction.reply({
      content: '❌ This game has already started.',
      ephemeral: true,
    });
  }

  if (action === 'join') {
    // Check if already in the lobby.
    if (lobby.players.some((p) => p.id === userId)) {
      return interaction.reply({
        content: '❌ You are already in this game.',
        ephemeral: true,
      });
    }

    if (lobby.players.length >= MAX_PLAYERS) {
      return interaction.reply({
        content: '❌ This lobby is full.',
        ephemeral: true,
      });
    }

    ensureWallet(userId);
    const balance = getBalance(userId);
    if (balance < lobby.bet) {
      return interaction.reply({
        content: `❌ Insufficient funds. You need **${lobby.bet.toLocaleString()}** coins.`,
        ephemeral: true,
      });
    }

    // Deduct buy-in.
    updateBalance(userId, -lobby.bet, 'russian roulette buy-in');
    lobby.players.push({ id: userId, username: interaction.user.username });

    const embed = buildLobbyEmbed(lobby);
    const row = buildLobbyButtons(channelId, lobby.players.length >= MIN_PLAYERS);
    return interaction.update({ embeds: [embed], components: [row] });
  }

  if (action === 'leave') {
    const playerIndex = lobby.players.findIndex((p) => p.id === userId);
    if (playerIndex === -1) {
      return interaction.reply({
        content: '❌ You are not in this game.',
        ephemeral: true,
      });
    }

    // Refund and remove.
    updateBalance(userId, lobby.bet, 'russian roulette refund (left)');
    lobby.players.splice(playerIndex, 1);

    // If host left or no players remain, cancel the game.
    if (lobby.players.length === 0) {
      lobbies.delete(channelId);
      const cancelEmbed = new EmbedBuilder()
        .setTitle('🔫  GAME CANCELLED  🔫')
        .setDescription(
          `${DIVIDER}\n\nAll players left. Game cancelled.\n\n${DIVIDER}`
        )
        .setColor(COLORS.lose);
      return interaction.update({ embeds: [cancelEmbed], components: [] });
    }

    // Update host if needed.
    if (userId === lobby.hostId) {
      lobby.hostId = lobby.players[0].id;
    }

    const embed = buildLobbyEmbed(lobby);
    const row = buildLobbyButtons(channelId, lobby.players.length >= MIN_PLAYERS);
    return interaction.update({ embeds: [embed], components: [row] });
  }

  if (action === 'start') {
    // Only host can start.
    if (userId !== lobby.hostId) {
      return interaction.reply({
        content: '❌ Only the host can start the game.',
        ephemeral: true,
      });
    }

    if (lobby.players.length < MIN_PLAYERS) {
      return interaction.reply({
        content: `❌ Need at least **${MIN_PLAYERS}** players to start.`,
        ephemeral: true,
      });
    }

    await runGame(interaction, lobby, channelId);
    return;
  }

  return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
}

module.exports = { data, execute, handleButton };
