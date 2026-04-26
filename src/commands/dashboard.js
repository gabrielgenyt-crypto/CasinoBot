const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const db = require('../utils/database');
const { COLORS } = require('../utils/animations');
const { getVipRecord, getLevelForWagered } = require('../utils/vip');
const { getJackpotPool } = require('../utils/jackpot');
const EMOJIS = require('../utils/emojis');
const { formatAmount } = require('../utils/formatAmount');
const { renderDashboard } = require('../utils/cardRenderer');

// ─── Game Definitions ───────────────────────────────────────────────────────
// Games that only need a bet can be launched directly from the dashboard.
// Games that need extra options redirect the user to the specific command.

const SIMPLE_GAMES = [
  { value: 'blackjack', label: 'Blackjack', emoji: '\u2660', description: 'Beat the dealer to 21' },
  { value: 'slots', label: 'Slots', emoji: '\u2666', description: '5 reels + jackpot' },
  { value: 'scratch', label: 'Scratch Card', emoji: '\uD83C\uDF9F', description: 'Match 3 symbols to win' },
  { value: 'coinflip', label: 'Coinflip', emoji: '\uD83E\uDE99', description: '50/50 heads or tails' },
  { value: 'wheel', label: 'Wheel', emoji: '\uD83C\uDFA1', description: 'Spin the wheel of fortune' },
  { value: 'hilo', label: 'Hi-Lo', emoji: '\uD83C\uDCA0', description: 'Higher or lower card game' },
  { value: 'russianroulette', label: 'Russian Roulette', emoji: '\uD83D\uDD2B', description: 'Last one standing wins' },
];

const ADVANCED_GAMES = [
  { value: 'dice', label: 'Dice', emoji: '\uD83C\uDFB2', description: 'Needs direction + target' },
  { value: 'crash', label: 'Crash', emoji: '\uD83D\uDE80', description: 'Needs cashout multiplier' },
  { value: 'mines', label: 'Mines', emoji: '\uD83D\uDCA3', description: 'Needs mine count' },
  { value: 'roulette', label: 'Roulette', emoji: '\uD83C\uDFA8', description: 'Needs bet choice' },
  { value: 'keno', label: 'Keno', emoji: '\uD83C\uDFB1', description: 'Needs number picks' },
  { value: 'limbo', label: 'Limbo', emoji: '\uD83C\uDFAF', description: 'Needs target multiplier' },
  { value: 'tower', label: 'Tower', emoji: '\uD83D\uDDFC', description: 'Needs difficulty' },
  { value: 'plinko', label: 'Plinko', emoji: '\u26AA', description: 'Needs risk level' },
];

const SIMPLE_GAME_SET = new Set(SIMPLE_GAMES.map((g) => g.value));

// Preset bet amounts shown as buttons.
const BET_PRESETS = [100, 500, 1000, 5000, 10000];

// Pending dashboard sessions: userId -> { game, bet }.
const sessions = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('View your full casino dashboard with balance, stats, and all games.');

/**
 * Computes the balance tier label.
 * @param {number} balance
 * @returns {string}
 */
function getTier(balance) {
  if (balance >= 100000) return 'WHALE';
  if (balance >= 50000) return 'HIGH ROLLER';
  if (balance >= 10000) return 'BALLER';
  if (balance >= 1000) return 'PLAYER';
  return 'ROOKIE';
}

/**
 * Fetches user data and renders the dashboard PNG + embed.
 * @param {string} userId
 * @param {string} username
 * @returns {{ embed: EmbedBuilder, attachment: AttachmentBuilder }}
 */
function buildDashboard(userId, username) {
  const balance = getBalance(userId);
  const stats = db
    .prepare('SELECT COUNT(*) as games, SUM(won) as wins FROM game_history WHERE user_id = ?')
    .get(userId);

  const gamesPlayed = stats?.games || 0;
  const wins = stats?.wins || 0;
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0';
  const vipRecord = getVipRecord(userId);
  const vipLevel = getLevelForWagered(vipRecord.total_wagered);
  const tier = getTier(balance);

  const jackpot = getJackpotPool();

  const pngBuffer = renderDashboard({
    playerName: username,
    balance,
    tier,
    gamesPlayed,
    wins,
    winRate,
    vipName: vipLevel.name,
    vipLevel: vipLevel.level,
    jackpotAmount: jackpot.amount,
  });

  const attachment = new AttachmentBuilder(pngBuffer, { name: 'dashboard.png' });
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.casino}  CryptoVault Casino  ${EMOJIS.casino}`)
    .setColor(COLORS.jackpot)
    .setImage('attachment://dashboard.png')
    .setTimestamp();

  return { embed, attachment };
}

/**
 * Builds the game select dropdown menu.
 * @param {string} userId
 * @returns {ActionRowBuilder}
 */
function buildGameSelect(userId) {
  const allGames = [
    ...SIMPLE_GAMES.map((g) => ({
      label: g.label,
      value: g.value,
      emoji: g.emoji,
      description: g.description,
    })),
    ...ADVANCED_GAMES.map((g) => ({
      label: `${g.label} \u2192`,
      value: g.value,
      emoji: g.emoji,
      description: g.description,
    })),
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`dashboard:game:${userId}`)
      .setPlaceholder('Select a game to play...')
      .addOptions(allGames)
  );
}

/**
 * Builds the bet amount button rows. Returns two ActionRowBuilder instances
 * because Discord limits each row to 5 buttons (we have 5 presets + 1 custom).
 * @param {string} userId
 * @param {string|null} selectedGame - Currently selected game (null = none).
 * @returns {ActionRowBuilder[]}
 */
function buildBetButtons(userId, selectedGame) {
  const disabled = !selectedGame || !SIMPLE_GAME_SET.has(selectedGame);
  const presetButtons = BET_PRESETS.map((amount) => {
    const label = amount >= 1000 ? `${(amount / 1000).toFixed(0)}K` : String(amount);
    return new ButtonBuilder()
      .setCustomId(`dashboard:bet:${userId}:${amount}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled);
  });

  const customButton = new ButtonBuilder()
    .setCustomId(`dashboard:custom:${userId}`)
    .setLabel('Custom')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('\u270F\uFE0F')
    .setDisabled(disabled);

  return [
    new ActionRowBuilder().addComponents(presetButtons),
    new ActionRowBuilder().addComponents(customButton),
  ];
}

/**
 * Builds a status row showing the current selection.
 * @param {object} session - { game, bet }
 * @returns {string}
 */
function buildFooterText(session) {
  const parts = [];
  if (session?.game) {
    const gameDef = [...SIMPLE_GAMES, ...ADVANCED_GAMES].find((g) => g.value === session.game);
    parts.push(`Game: ${gameDef?.label || session.game}`);
  }
  if (session?.bet) {
    parts.push(`Bet: ${session.bet.toLocaleString()}`);
  }
  if (parts.length === 0) {
    return 'Select a game, then choose your bet amount';
  }
  return parts.join(' \u2022 ');
}

// ─── Command Execution ──────────────────────────────────────────────────────

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  // Reset any previous session.
  sessions.set(userId, { game: null, bet: null });

  const { embed, attachment } = buildDashboard(userId, interaction.user.username);
  embed.setFooter({ text: buildFooterText(null) });

  const gameRow = buildGameSelect(userId);
  const betRows = buildBetButtons(userId, null);

  return interaction.reply({
    embeds: [embed],
    files: [attachment],
    components: [gameRow, ...betRows],
  });
}

// ─── Select Menu Handler (game selection) ───────────────────────────────────

async function handleSelectMenu(interaction) {
  const [, , ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '\u274C Use /dashboard to open your own dashboard.',
      ephemeral: true,
    });
  }

  const selectedGame = interaction.values[0];
  const session = sessions.get(ownerId) || { game: null, bet: null };
  session.game = selectedGame;
  sessions.set(ownerId, session);

  // If the game needs extra options, tell the user and keep the dashboard.
  if (!SIMPLE_GAME_SET.has(selectedGame)) {
    const gameDef = ADVANCED_GAMES.find((g) => g.value === selectedGame);
    const { embed, attachment } = buildDashboard(ownerId, interaction.user.username);
    embed.setFooter({ text: `Use /${selectedGame} to play ${gameDef?.label || selectedGame} (needs extra options)` });

    const gameRow = buildGameSelect(ownerId);
    const betRows = buildBetButtons(ownerId, selectedGame);

    return interaction.update({
      embeds: [embed],
      files: [attachment],
      components: [gameRow, ...betRows],
    });
  }

  // Simple game selected -- enable bet buttons.
  const { embed, attachment } = buildDashboard(ownerId, interaction.user.username);
  embed.setFooter({ text: buildFooterText(session) });

  const gameRow = buildGameSelect(ownerId);
  const betRows = buildBetButtons(ownerId, selectedGame);

  return interaction.update({
    embeds: [embed],
    files: [attachment],
    components: [gameRow, ...betRows],
  });
}

// ─── Button Handler (bet selection + game launch) ───────────────────────────

async function handleButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1]; // 'bet' or 'custom'
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '\u274C This is not your dashboard!',
      ephemeral: true,
    });
  }

  const session = sessions.get(ownerId);
  if (!session?.game) {
    return interaction.reply({
      content: '\u274C Select a game first!',
      ephemeral: true,
    });
  }

  // Custom bet -> open a modal.
  if (action === 'custom') {
    const modal = new ModalBuilder()
      .setCustomId(`dashboard:modal:${ownerId}`)
      .setTitle('Enter Bet Amount');

    const betInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('How much do you want to bet?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 2500')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);

    modal.addComponents(new ActionRowBuilder().addComponents(betInput));
    return interaction.showModal(modal);
  }

  // Preset bet amount.
  if (action === 'bet') {
    const betAmount = parseInt(parts[3], 10);
    return launchGame(interaction, ownerId, session.game, betAmount);
  }
}

// ─── Modal Handler (custom bet amount) ──────────────────────────────────────

async function handleModal(interaction) {
  const [, , ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '\u274C This is not your dashboard!',
      ephemeral: true,
    });
  }

  const session = sessions.get(ownerId);
  if (!session?.game) {
    return interaction.reply({
      content: '\u274C Session expired. Use /dashboard again.',
      ephemeral: true,
    });
  }

  const rawBet = interaction.fields.getTextInputValue('bet_amount');
  const betAmount = parseInt(rawBet, 10);

  if (isNaN(betAmount) || betAmount < 1) {
    return interaction.reply({
      content: '\u274C Invalid bet amount. Enter a positive number.',
      ephemeral: true,
    });
  }

  return launchGame(interaction, ownerId, session.game, betAmount);
}

// ─── Game Launcher ──────────────────────────────────────────────────────────

/**
 * Validates the bet and dispatches to the selected game command.
 *
 * For simple games (bet-only), we call the game's execute function directly
 * by constructing a lightweight interaction proxy that provides the expected
 * options. This avoids duplicating game logic.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {string} userId
 * @param {string} gameName
 * @param {number} betAmount
 */
async function launchGame(interaction, userId, gameName, betAmount) {
  ensureWallet(userId);
  const balance = getBalance(userId);

  if (betAmount > balance) {
    return interaction.reply({
      content: `\u274C Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  // Clean up the session.
  sessions.delete(userId);

  // Build a proxy interaction that mimics a slash command interaction so the
  // game command's execute() works without modification. We forward the real
  // interaction's reply/editReply/followUp methods and inject the bet option.
  const optionsProxy = {
    getInteger: (name) => (name === 'bet' ? betAmount : null),
    getString: () => null,
    getNumber: () => null,
    getUser: () => null,
  };

  // For coinflip, the game shows heads/tails buttons after the initial reply,
  // so we need to make sure the interaction is treated as a fresh reply.
  // We create a thin wrapper that delegates to the real interaction.
  const proxyInteraction = {
    ...interaction,
    // Override options to inject the bet.
    options: optionsProxy,
    // Use the real user info.
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    client: interaction.client,
    // For button/modal interactions, we need reply (not update).
    replied: false,
    deferred: false,
    reply: (...args) => interaction.reply(...args),
    editReply: (...args) => interaction.editReply(...args),
    followUp: (...args) => interaction.followUp(...args),
  };

  // Look up the game command from the client's command collection.
  const command = interaction.client.commands?.get(gameName);
  if (!command) {
    return interaction.reply({
      content: `\u274C Game "${gameName}" not found.`,
      ephemeral: true,
    });
  }

  try {
    await command.execute(proxyInteraction);
  } catch (error) {
    console.error(`[DASHBOARD] Error launching ${gameName}:`, error);
    const errorReply = {
      content: `\u274C Failed to launch ${gameName}. Try using /${gameName} directly.`,
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(errorReply);
    }
    return interaction.reply(errorReply);
  }
}

module.exports = { data, execute, handleSelectMenu, handleButton, handleModal };
