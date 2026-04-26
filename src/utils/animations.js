const { EmbedBuilder } = require('discord.js');
const { formatAmount } = require('./formatAmount');

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  win: 0x00ff88,       // Neon green.
  lose: 0xff3366,      // Hot pink/red.
  jackpot: 0xffd700,   // Gold.
  neutral: 0x5865f2,   // Discord blurple.
  pending: 0x2f3136,   // Dark embed.
  vip: 0xe91e63,       // Pink.
  info: 0x00bfff,      // Cyan.
  warning: 0xff9900,   // Orange.
};

// ─── ASCII Art & Decorations ────────────────────────────────────────────────
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const DIVIDER_THIN = '─────────────────────────────';
const SPARKLE_LINE = '✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦';

/**
 * Creates a progress bar using block characters.
 * @param {number} current - Current value.
 * @param {number} max - Maximum value.
 * @param {number} [length=10] - Bar length in characters.
 * @returns {string}
 */
function progressBar(current, max, length = 10) {
  const ratio = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.round(ratio * 100)}%`;
}

/**
 * Generates a multiplier graph for crash-style displays.
 * @param {number} multiplier - The multiplier value.
 * @returns {string}
 */
function crashGraph(multiplier) {
  const height = 5;
  const width = 15;
  const lines = [];

  for (let row = height; row >= 1; row--) {
    const threshold = 1 + (row / height) * (multiplier - 1);
    let line = '';
    for (let col = 0; col < width; col++) {
      const colMultiplier = 1 + (col / width) * multiplier;
      if (colMultiplier >= threshold) {
        line += '█';
      } else {
        line += '░';
      }
    }
    const label = threshold.toFixed(1).padStart(5) + 'x';
    lines.push(`\`${label}\` ${line}`);
  }
  lines.push(`\`${''.padStart(5)}\` ${'▔'.repeat(width)}`);
  return lines.join('\n');
}

/**
 * Generates a slot machine frame with the given symbols.
 * @param {string[]} symbols - Array of 3 emoji symbols.
 * @param {boolean} [spinning=false] - Whether to show spinning effect.
 * @returns {string}
 */
function slotMachine(symbols, spinning = false) {
  const top = '╔═══╦═══╦═══╗';
  const bottom = '╚═══╩═══╩═══╝';
  const sep = '║';

  if (spinning) {
    return [
      '```',
      top,
      `${sep} ? ${sep} ? ${sep} ? ${sep}`,
      bottom,
      '```',
    ].join('\n');
  }

  return [
    '```',
    top,
    `${sep} ${symbols[0]} ${sep} ${symbols[1]} ${sep} ${symbols[2]} ${sep}`,
    bottom,
    '```',
  ].join('\n');
}

/**
 * Generates a roulette wheel frame.
 * @param {number} [phase=0] - Animation phase (0-3).
 * @returns {string}
 */
function rouletteWheel(phase = 0) {
  const frames = [
    '🔴⚫🟢⚫🔴⚫🔴⚫🟢⚫',
    '⚫🔴⚫🟢⚫🔴⚫🔴⚫🟢',
    '🟢⚫🔴⚫🟢⚫🔴⚫🔴⚫',
    '⚫🟢⚫🔴⚫🟢⚫🔴⚫🔴',
  ];
  return `> ${frames[phase % frames.length]}`;
}

/**
 * Generates a coin animation frame.
 * @param {number} phase - Animation phase (0-5).
 * @returns {string}
 */
function coinFrame(phase) {
  const frames = [
    '🪙 ⬆️\n*flipping...*',
    '  🪙\n*spinning...*',
    '    🪙 ⬇️\n*falling...*',
    '  🪙\n*bouncing...*',
    '🪙\n*settling...*',
  ];
  return frames[phase % frames.length];
}

/**
 * Generates dice rolling frames.
 * @param {number} phase - Animation phase.
 * @returns {string}
 */
function diceFrame(phase) {
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const idx = phase % faces.length;
  return `# ${faces[idx]}  ${faces[(idx + 3) % 6]}  ${faces[(idx + 1) % 6]}`;
}

/**
 * Generates a card reveal string.
 * @param {string[]} revealed - Cards already revealed.
 * @param {number} total - Total cards to show.
 * @returns {string}
 */
function cardReveal(revealed, total) {
  const hidden = total - revealed.length;
  return revealed.join(' ') + ' 🂠'.repeat(hidden);
}

/**
 * Builds a win celebration banner.
 * @param {number} amount - Amount won.
 * @param {boolean} [isJackpot=false] - Whether this is a jackpot.
 * @returns {string}
 */
function winBanner(amount, isJackpot = false) {
  if (isJackpot) {
    return [
      SPARKLE_LINE,
      '🎰 **J A C K P O T** 🎰',
      `💰 **+${formatAmount(amount)}** 💰`,
      SPARKLE_LINE,
    ].join('\n');
  }
  return [
    '🎉 **W I N** 🎉',
    `**+${formatAmount(amount)}**`,
  ].join('\n');
}

/**
 * Builds a loss banner.
 * @param {number} amount - Amount lost.
 * @returns {string}
 */
function lossBanner(amount) {
  return `💀 **-${formatAmount(amount)}**`;
}

/**
 * Creates a styled game embed with consistent branding.
 * @param {object} options
 * @param {string} options.title - Embed title.
 * @param {string} options.description - Embed description.
 * @param {number} options.color - Embed color.
 * @param {string} [options.thumbnail] - Thumbnail URL.
 * @param {Array<{name: string, value: string, inline?: boolean}>} [options.fields] - Embed fields.
 * @param {string} [options.footer] - Footer text.
 * @returns {EmbedBuilder}
 */
function styledEmbed({ title, description, color, thumbnail, fields, footer }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (thumbnail) embed.setThumbnail(thumbnail);
  if (fields) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });

  return embed;
}

/**
 * Runs a multi-frame animation by editing a message.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction.
 * @param {Array<EmbedBuilder>} frames - Array of embed frames.
 * @param {number} [delay=800] - Delay between frames in ms.
 * @returns {Promise<import('discord.js').Message>}
 */
async function animateEmbed(interaction, frames, delay = 800) {
  if (frames.length === 0) throw new Error('No frames provided');

  // Send the first frame.
  const msg = await interaction.reply({ embeds: [frames[0]], fetchReply: true });

  // Edit through remaining frames.
  for (let i = 1; i < frames.length; i++) {
    await sleep(delay);
    await msg.edit({ embeds: [frames[i]] });
  }

  return msg;
}

/**
 * Runs a multi-frame animation with components (buttons etc).
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {Array<{embed: EmbedBuilder, components?: Array}>} frames
 * @param {number} [delay=800]
 * @returns {Promise<import('discord.js').Message>}
 */
async function animateWithComponents(interaction, frames, delay = 800) {
  if (frames.length === 0) throw new Error('No frames provided');

  const first = frames[0];
  const msg = await interaction.reply({
    embeds: [first.embed],
    components: first.components || [],
    fetchReply: true,
  });

  for (let i = 1; i < frames.length; i++) {
    await sleep(delay);
    await msg.edit({
      embeds: [frames[i].embed],
      components: frames[i].components || [],
    });
  }

  return msg;
}

/**
 * Promise-based sleep.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  COLORS,
  DIVIDER,
  DIVIDER_THIN,
  SPARKLE_LINE,
  progressBar,
  crashGraph,
  slotMachine,
  rouletteWheel,
  coinFrame,
  diceFrame,
  cardReveal,
  winBanner,
  lossBanner,
  styledEmbed,
  animateEmbed,
  animateWithComponents,
  sleep,
};
