const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { COLORS, DIVIDER } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View all available commands and game guides.');

// ─── Help Categories ────────────────────────────────────────────────────────

const CATEGORIES = {
  games: {
    label: 'Casino Games',
    emoji: '🎰',
    description: 'All casino games you can play',
    fields: [
      {
        name: `${EMOJIS.blackjack} /blackjack <bet>`,
        value: 'Classic 21 — hit, stand, or double down against the dealer.',
      },
      {
        name: `${EMOJIS.slots} /slots <bet>`,
        value: 'Spin the reels and match symbols for multiplied payouts.',
      },
      {
        name: `${EMOJIS.dice} /dice <bet> <over|under> <target>`,
        value: 'Roll 1-100 and bet whether the result lands over or under your target.',
      },
      {
        name: `${EMOJIS.roulette} /roulette <bet> <choice>`,
        value: 'Place bets on numbers, colors, or ranges on the roulette wheel.',
      },
      {
        name: '🪙 /coinflip <bet> <heads|tails>',
        value: 'Simple 50/50 coin toss — pick heads or tails.',
      },
      {
        name: `${EMOJIS.rocket} /crash <bet> <cashout>`,
        value: 'Watch the multiplier climb and cash out before it crashes.',
      },
      {
        name: `${EMOJIS.diamond} /mines <bet> <mines>`,
        value: 'Reveal tiles on a 5x5 grid — avoid the hidden mines.',
      },
      {
        name: '🎯 /plinko <bet> <risk>',
        value: 'Drop a ball through pegs and land on a multiplier slot.',
      },
      {
        name: '🎡 /wheel <bet>',
        value: 'Spin the wheel of fortune for a random multiplier.',
      },
      {
        name: '🔫 /russianroulette <bet>',
        value: 'Multiplayer elimination — last one standing wins the pot.',
      },
      {
        name: '🎱 /keno <bet> <picks>',
        value: 'Pick up to 10 numbers from 1-40 and match the draw.',
      },
      {
        name: '🎯 /limbo <bet> <target>',
        value: 'Set a target multiplier — beat it to win instantly.',
      },
      {
        name: '🗼 /tower <bet> [difficulty]',
        value: 'Climb floors by picking safe tiles. Cash out anytime.',
      },
      {
        name: '🃏 /hilo <bet>',
        value: 'Guess if the next card is higher or lower. Keep going to multiply.',
      },
    ],
  },
  economy: {
    label: 'Economy & Wallet',
    emoji: '💰',
    description: 'Manage your balance and finances',
    fields: [
      {
        name: `${EMOJIS.coin} /balance`,
        value: 'Check your current balance and wallet overview.',
      },
      {
        name: '📅 /daily',
        value: 'Claim your free daily reward (streak bonuses!).',
      },
      {
        name: '📦 /weekly',
        value: 'Open your weekly chest for a larger reward.',
      },
      {
        name: '🎁 /claim',
        value: 'Claim any pending bonuses or rewards.',
      },
      {
        name: `${EMOJIS.money} /tip <user> <amount>`,
        value: 'Send funds to another player.',
      },
      {
        name: `${EMOJIS.crypto} /deposit`,
        value: 'Get your crypto deposit address to add funds.',
      },
      {
        name: '📤 /withdraw <amount> <address>',
        value: 'Withdraw funds to your crypto wallet.',
      },
    ],
  },
  stats: {
    label: 'Stats & Social',
    emoji: '📊',
    description: 'Track your progress and compete',
    fields: [
      {
        name: '📈 /stats',
        value: 'View your detailed game statistics and win rates.',
      },
      {
        name: '📜 /history',
        value: 'Browse your recent game history.',
      },
      {
        name: `${EMOJIS.trophy} /leaderboard`,
        value: 'See the top players ranked by balance, wins, or profit.',
      },
      {
        name: `${EMOJIS.crown} /vip`,
        value: 'Check your VIP level, perks, and progress.',
      },
      {
        name: '🔗 /referral',
        value: 'Get your referral link and earn bonus rewards.',
      },
      {
        name: `${EMOJIS.shield} /fairness`,
        value: 'Verify game results with our provably fair system.',
      },
    ],
  },
};

/**
 * Builds the main help overview embed.
 * @returns {EmbedBuilder}
 */
function buildOverviewEmbed() {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.casino}  CryptoVault Casino  ${EMOJIS.casino}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `${EMOJIS.diamond} **Welcome to CryptoVault Casino!**\n` +
      'Your provably fair crypto casino on Discord.\n\n' +
      '**Select a category below** to see all available commands.\n\n' +
      '🎰 **Casino Games** — 14 provably fair games\n' +
      '💰 **Economy & Wallet** — Deposits, withdrawals, tips\n' +
      '📊 **Stats & Social** — Leaderboards, VIP, history\n\n' +
      `${DIVIDER}`
    )
    .setColor(COLORS.jackpot)
    .setFooter({ text: `${EMOJIS.shield} All games are provably fair | /fairness to verify` })
    .setTimestamp();
}

/**
 * Builds a category-specific embed.
 * @param {string} categoryKey - The category key.
 * @returns {EmbedBuilder}
 */
function buildCategoryEmbed(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return buildOverviewEmbed();

  const embed = new EmbedBuilder()
    .setTitle(`${cat.emoji}  ${cat.label}`)
    .setDescription(`${DIVIDER}\n\n${cat.description}\n\n${DIVIDER}`)
    .setColor(COLORS.info)
    .setTimestamp()
    .setFooter({ text: 'Use the menu below to switch categories | /help' });

  for (const field of cat.fields) {
    embed.addFields({ name: field.name, value: field.value, inline: false });
  }

  return embed;
}

/**
 * Builds the category select menu.
 * @param {string} userId - The user's ID for scoping the interaction.
 * @returns {ActionRowBuilder}
 */
function buildSelectMenu(userId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`help:category:${userId}`)
      .setPlaceholder('Select a category...')
      .addOptions(
        {
          label: 'Overview',
          description: 'Back to the main help page',
          value: 'overview',
          emoji: '🏠',
        },
        ...Object.entries(CATEGORIES).map(([key, cat]) => ({
          label: cat.label,
          description: cat.description,
          value: key,
          emoji: cat.emoji,
        }))
      )
  );
}

async function execute(interaction) {
  const embed = buildOverviewEmbed();
  const row = buildSelectMenu(interaction.user.id);

  return interaction.reply({ embeds: [embed], components: [row] });
}

async function handleSelectMenu(interaction) {
  const [, , ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '❌ Use /help to open your own help menu.',
      ephemeral: true,
    });
  }

  const selected = interaction.values[0];
  const embed = selected === 'overview'
    ? buildOverviewEmbed()
    : buildCategoryEmbed(selected);
  const row = buildSelectMenu(ownerId);

  return interaction.update({ embeds: [embed], components: [row] });
}

module.exports = { data, execute, handleSelectMenu };
