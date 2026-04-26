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
// All games can now be launched from the dashboard. Simple games only need a
// bet; advanced games open a modal for extra options before launching.

const SIMPLE_GAMES = [
  { value: 'blackjack', label: 'Blackjack', emoji: '\u2660', description: 'Beat the dealer to 21' },
  { value: 'slots', label: 'Slots', emoji: '\u2666', description: '5 reels + jackpot' },
  { value: 'scratch', label: 'Scratch Card', emoji: '\uD83C\uDF9F', description: 'Match 3 symbols to win' },
  { value: 'coinflip', label: 'Coinflip', emoji: '\uD83E\uDE99', description: '50/50 heads or tails' },
  { value: 'wheel', label: 'Wheel', emoji: '\uD83C\uDFA1', description: 'Spin the wheel of fortune' },
  { value: 'hilo', label: 'Hi-Lo', emoji: '\uD83C\uDFB4', description: 'Higher or lower card game' },
  { value: 'plinko', label: 'Plinko', emoji: '\u26AA', description: 'Drop the ball for prizes' },
  { value: 'russianroulette', label: 'Russian Roulette', emoji: '\uD83D\uDD2B', description: 'Last one standing wins' },
];

const ADVANCED_GAMES = [
  { value: 'dice', label: 'Dice', emoji: '\uD83C\uDFB2', description: 'Pick direction + target' },
  { value: 'crash', label: 'Crash', emoji: '\uD83D\uDE80', description: 'Set cashout multiplier' },
  { value: 'mines', label: 'Mines', emoji: '\uD83D\uDCA3', description: 'Choose mine count' },
  { value: 'roulette', label: 'Roulette', emoji: '\uD83C\uDFA8', description: 'Pick your bet type' },
  { value: 'keno', label: 'Keno', emoji: '\uD83C\uDFB1', description: 'Pick your numbers' },
  { value: 'limbo', label: 'Limbo', emoji: '\uD83C\uDFAF', description: 'Set target multiplier' },
  { value: 'tower', label: 'Tower', emoji: '\uD83D\uDDFC', description: 'Pick difficulty level' },
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
      label: g.label,
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
 * Builds the bet amount button rows. All games now enable bet buttons.
 * For advanced games, pressing a bet button opens a modal for extra options.
 * @param {string} userId
 * @param {string|null} selectedGame - Currently selected game (null = none).
 * @returns {ActionRowBuilder[]}
 */
function buildBetButtons(userId, selectedGame) {
  const disabled = !selectedGame;
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

/**
 * Builds a modal for an advanced game that needs extra options.
 * @param {string} ownerId
 * @param {string} gameName
 * @param {number} betAmount
 * @returns {ModalBuilder}
 */
function buildAdvancedModal(ownerId, gameName, betAmount) {
  const modal = new ModalBuilder()
    .setCustomId(`dashboard:advmodal:${ownerId}:${gameName}:${betAmount}`)
    .setTitle(`Play ${gameName.charAt(0).toUpperCase() + gameName.slice(1)}`);

  switch (gameName) {
  case 'dice': {
    const dirInput = new TextInputBuilder()
      .setCustomId('direction')
      .setLabel('Direction (over or under)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('over')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(5);
    const targetInput = new TextInputBuilder()
      .setCustomId('target')
      .setLabel('Target number (1-100)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('50')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);
    modal.addComponents(
      new ActionRowBuilder().addComponents(dirInput),
      new ActionRowBuilder().addComponents(targetInput)
    );
    break;
  }
  case 'crash': {
    const cashoutInput = new TextInputBuilder()
      .setCustomId('cashout')
      .setLabel('Auto-cashout multiplier (e.g. 2.0)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('2.0')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(6);
    modal.addComponents(new ActionRowBuilder().addComponents(cashoutInput));
    break;
  }
  case 'mines': {
    const minesInput = new TextInputBuilder()
      .setCustomId('mines')
      .setLabel('Number of mines (1-24)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('5')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);
    modal.addComponents(new ActionRowBuilder().addComponents(minesInput));
    break;
  }
  case 'roulette': {
    const typeInput = new TextInputBuilder()
      .setCustomId('bet_type')
      .setLabel('Bet type (red, black, even, odd, 0-36, etc.)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('red')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);
    modal.addComponents(new ActionRowBuilder().addComponents(typeInput));
    break;
  }
  case 'keno': {
    const picksInput = new TextInputBuilder()
      .setCustomId('picks')
      .setLabel('Your numbers (1-40, space separated, up to 10)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('3 7 12 25 33')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(50);
    modal.addComponents(new ActionRowBuilder().addComponents(picksInput));
    break;
  }
  case 'limbo': {
    const targetInput = new TextInputBuilder()
      .setCustomId('target')
      .setLabel('Target multiplier (1.01 - 1000)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('2.0')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(6);
    modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
    break;
  }
  case 'tower': {
    const diffInput = new TextInputBuilder()
      .setCustomId('difficulty')
      .setLabel('Difficulty (easy or medium)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('easy')
      .setRequired(false)
      .setMinLength(0)
      .setMaxLength(6);
    modal.addComponents(new ActionRowBuilder().addComponents(diffInput));
    break;
  }
  default:
    break;
  }

  return modal;
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

  // Update the dashboard with the selected game and enabled bet buttons.
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
    // For simple games, just ask for bet amount.
    if (SIMPLE_GAME_SET.has(session.game)) {
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

    // For advanced games, open a modal with bet + extra options.
    const modal = buildAdvancedModal(ownerId, session.game, 0);
    // Add bet amount as the first field.
    const betInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('Bet amount')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 2500')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);
    // Prepend bet input to the modal.
    modal.components.unshift(new ActionRowBuilder().addComponents(betInput));
    // Update the custom ID to use advmodal with bet=0 (will read from field).
    modal.setCustomId(`dashboard:advmodal:${ownerId}:${session.game}:0`);
    return interaction.showModal(modal);
  }

  // Preset bet amount.
  if (action === 'bet') {
    const betAmount = parseInt(parts[3], 10);

    // For simple games, launch directly.
    if (SIMPLE_GAME_SET.has(session.game)) {
      return launchGame(interaction, ownerId, session.game, betAmount);
    }

    // For advanced games, open a modal for extra options.
    const modal = buildAdvancedModal(ownerId, session.game, betAmount);
    return interaction.showModal(modal);
  }
}

// ─── Modal Handler (custom bet amount + advanced game options) ──────────────

async function handleModal(interaction) {
  const parts = interaction.customId.split(':');
  const modalType = parts[1]; // 'modal' or 'advmodal'
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '\u274C This is not your dashboard!',
      ephemeral: true,
    });
  }

  // Simple game custom bet modal.
  if (modalType === 'modal') {
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

  // Advanced game modal with extra options.
  if (modalType === 'advmodal') {
    const gameName = parts[3];
    let betAmount = parseInt(parts[4], 10);

    // If bet was 0, read it from the modal field.
    if (betAmount === 0) {
      const rawBet = interaction.fields.getTextInputValue('bet_amount');
      betAmount = parseInt(rawBet, 10);
      if (isNaN(betAmount) || betAmount < 1) {
        return interaction.reply({
          content: '\u274C Invalid bet amount. Enter a positive number.',
          ephemeral: true,
        });
      }
    }

    return launchAdvancedGame(interaction, ownerId, gameName, betAmount);
  }
}

// ─── Game Launcher (simple games) ───────────────────────────────────────────

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

  const optionsProxy = {
    getInteger: (name) => (name === 'bet' ? betAmount : null),
    getString: () => null,
    getNumber: () => null,
    getUser: () => null,
  };

  const proxyInteraction = {
    ...interaction,
    options: optionsProxy,
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    client: interaction.client,
    replied: false,
    deferred: false,
    reply: (...args) => interaction.reply(...args),
    editReply: (...args) => interaction.editReply(...args),
    followUp: (...args) => interaction.followUp(...args),
  };

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

// ─── Advanced Game Launcher ─────────────────────────────────────────────────

/**
 * Launches an advanced game by reading extra options from the modal fields
 * and building a proxy interaction with the correct option getters.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {string} userId
 * @param {string} gameName
 * @param {number} betAmount
 */
async function launchAdvancedGame(interaction, userId, gameName, betAmount) {
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

  // Parse extra options from the modal fields based on game type.
  let extraOptions = {};
  try {
    extraOptions = parseAdvancedOptions(interaction, gameName);
  } catch (error) {
    return interaction.reply({
      content: `\u274C ${error.message}`,
      ephemeral: true,
    });
  }

  // Build a proxy interaction with the correct option getters.
  const optionsProxy = {
    getInteger: (name) => {
      if (name === 'bet') return betAmount;
      if (name in extraOptions && typeof extraOptions[name] === 'number' && Number.isInteger(extraOptions[name])) {
        return extraOptions[name];
      }
      return null;
    },
    getString: (name) => {
      if (name in extraOptions && typeof extraOptions[name] === 'string') {
        return extraOptions[name];
      }
      return null;
    },
    getNumber: (name) => {
      if (name in extraOptions && typeof extraOptions[name] === 'number') {
        return extraOptions[name];
      }
      return null;
    },
    getUser: () => null,
  };

  const proxyInteraction = {
    ...interaction,
    options: optionsProxy,
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    client: interaction.client,
    replied: false,
    deferred: false,
    reply: (...args) => interaction.reply(...args),
    editReply: (...args) => interaction.editReply(...args),
    followUp: (...args) => interaction.followUp(...args),
  };

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

/**
 * Parses extra options from modal fields for each advanced game type.
 * Returns an object mapping option names to their parsed values.
 *
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @param {string} gameName
 * @returns {object} Parsed options.
 */
function parseAdvancedOptions(interaction, gameName) {
  switch (gameName) {
  case 'dice': {
    const direction = interaction.fields.getTextInputValue('direction').trim().toLowerCase();
    if (direction !== 'over' && direction !== 'under') {
      throw new Error('Direction must be "over" or "under".');
    }
    const target = parseInt(interaction.fields.getTextInputValue('target').trim(), 10);
    if (isNaN(target) || target < 1 || target > 100) {
      throw new Error('Target must be a number between 1 and 100.');
    }
    return { direction, target };
  }
  case 'crash': {
    const cashout = parseFloat(interaction.fields.getTextInputValue('cashout').trim());
    if (isNaN(cashout) || cashout < 1.01 || cashout > 1000) {
      throw new Error('Cashout must be between 1.01 and 1000.');
    }
    return { cashout };
  }
  case 'mines': {
    const mines = parseInt(interaction.fields.getTextInputValue('mines').trim(), 10);
    if (isNaN(mines) || mines < 1 || mines > 24) {
      throw new Error('Mines must be between 1 and 24.');
    }
    return { mines };
  }
  case 'roulette': {
    const betType = interaction.fields.getTextInputValue('bet_type').trim().toLowerCase();
    // Check if it's a number bet.
    const numBet = parseInt(betType, 10);
    if (!isNaN(numBet) && numBet >= 0 && numBet <= 36) {
      return { type: betType, number: numBet };
    }
    return { type: betType };
  }
  case 'keno': {
    const picksRaw = interaction.fields.getTextInputValue('picks').trim();
    return { picks: picksRaw };
  }
  case 'limbo': {
    const target = parseFloat(interaction.fields.getTextInputValue('target').trim());
    if (isNaN(target) || target < 1.01 || target > 1000) {
      throw new Error('Target must be between 1.01 and 1000.');
    }
    return { target };
  }
  case 'tower': {
    const diffRaw = interaction.fields.getTextInputValue('difficulty').trim().toLowerCase();
    const difficulty = diffRaw === 'medium' ? 'medium' : 'easy';
    return { difficulty };
  }
  default:
    return {};
  }
}

module.exports = { data, execute, handleSelectMenu, handleButton, handleModal };
