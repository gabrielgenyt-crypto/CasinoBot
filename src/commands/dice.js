const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playDice } = require('../games/dice');
const {
  COLORS,
  DIVIDER,
  SPARKLE_LINE,
  winBanner,
  lossBanner,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderDice } = require('../utils/cardRenderer');

// Dice face emojis for animation.
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('🎲 Roll a dice (1-100). Bet over or under a target number.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName('direction')
      .setDescription('Over or under the target')
      .setRequired(true)
      .addChoices(
        { name: 'Over', value: 'over' },
        { name: 'Under', value: 'under' }
      )
  )
  .addIntegerOption((opt) =>
    opt
      .setName('target')
      .setDescription('Target number (1-99)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(99)
  );

/**
 * Builds a visual slider showing where the roll landed relative to the target.
 * @param {number} roll - The actual roll (1-100).
 * @param {number} target - The target number.
 * @param {string} direction - 'over' or 'under'.
 * @returns {string}
 */
function rollSlider(roll, target, direction) {
  const width = 20;
  const rollPos = Math.round((roll / 100) * width);
  const targetPos = Math.round((target / 100) * width);

  let bar = '';
  for (let i = 0; i <= width; i++) {
    if (i === rollPos) {
      bar += '🔵';
    } else if (i === targetPos) {
      bar += '🔶';
    } else if (direction === 'over' && i > targetPos) {
      bar += '▓';
    } else if (direction === 'under' && i < targetPos) {
      bar += '▓';
    } else {
      bar += '░';
    }
  }
  return `\`1\` ${bar} \`100\``;
}

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const direction = interaction.options.getString('direction');
  const target = interaction.options.getInteger('target');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  // Validate the target produces a valid win chance.
  const winChance =
    direction === 'over' ? (100 - target) / 100 : (target - 1) / 100;
  if (winChance <= 0 || winChance >= 1) {
    return interaction.reply({
      content: '❌ Invalid target for that direction. Ensure there is a chance to win and lose.',
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playDice(userId, bet, direction, target);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const dirEmoji = direction === 'over' ? '📈' : '📉';
  const winChancePercent = (winChance * 100).toFixed(1);

  // ── Frame 1: Rolling ──
  const randFace = () => DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)];
  const frame1 = new EmbedBuilder()
    .setTitle(`${EMOJIS.dice}  D I C E  ${EMOJIS.dice}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `# ${randFace()}  ${randFace()}  ${randFace()}\n\n` +
      '🔄 Rolling the dice...\n' +
      `${dirEmoji} **${direction.toUpperCase()} ${target}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [frame1], fetchReply: true });

  // ── Frame 2: Still rolling ──
  await sleep(600);
  const frame2 = new EmbedBuilder()
    .setTitle(`${EMOJIS.dice}  D I C E  ${EMOJIS.dice}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `# ${randFace()}  ${randFace()}  ${randFace()}\n\n` +
      '🔄 Bouncing...\n' +
      `${dirEmoji} **${direction.toUpperCase()} ${target}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame2] });

  // ── Frame 3: Slowing down ──
  await sleep(600);
  const frame3 = new EmbedBuilder()
    .setTitle(`${EMOJIS.dice}  D I C E  ${EMOJIS.dice}`)
    .setDescription(
      `${DIVIDER}\n\n` +
      `# ${randFace()}  ${randFace()}  ${randFace()}\n\n` +
      '🎲 Settling...\n' +
      `${dirEmoji} **${direction.toUpperCase()} ${target}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame3] });

  // ── Frame 4: Result ──
  await sleep(800);

  const color = result.won ? COLORS.win : COLORS.lose;
  const isBigWin = result.won && result.multiplier >= 3;
  const outcomeText = result.won
    ? winBanner(result.payout, isBigWin)
    : lossBanner(bet);

  const resultEmoji = result.won ? '✅' : '❌';
  const comparison = direction === 'over'
    ? `**${result.roll}** ${result.won ? '>' : '≤'} **${target}**`
    : `**${result.roll}** ${result.won ? '<' : '≥'} **${target}**`;

  // Render the dice result image.
  const pngBuffer = renderDice({
    roll: result.roll,
    target,
    direction,
    won: result.won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'dice.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(
      isBigWin
        ? `${EMOJIS.dice}${EMOJIS.coin}  ROLLED ${result.roll}  ${EMOJIS.coin}${EMOJIS.dice}`
        : `${EMOJIS.dice}  ROLLED ${result.roll}  ${EMOJIS.dice}`
    )
    .setDescription(
      (isBigWin ? `${SPARKLE_LINE}\n` : '') +
      `${DIVIDER}\n\n` +
      `# ${EMOJIS.dice} ${result.roll}\n\n` +
      `${rollSlider(result.roll, target, direction)}\n\n` +
      `${resultEmoji} ${comparison}\n` +
      `${dirEmoji} Target: **${direction} ${target}**\n\n` +
      `${outcomeText}\n\n` +
      DIVIDER +
      (isBigWin ? `\n${SPARKLE_LINE}` : '')
    )
    .setColor(color)
    .setImage('attachment://dice.png')
    .addFields(
      { name: '🎯 Multiplier', value: `\`${result.multiplier}x\``, inline: true },
      { name: '📊 Win Chance', value: `\`${winChancePercent}%\``, inline: true },
      { name: `${EMOJIS.coin} Balance`, value: `\`${result.newBalance.toLocaleString()}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${result.nonce}\``, inline: true },
      { name: `${EMOJIS.shield} Seed`, value: `\`${result.serverSeedHash.substring(0, 12)}...\``, inline: true }
    )
    .setFooter({ text: `${EMOJIS.shield} Provably Fair | /fairness` })
    .setTimestamp();

  if (result.vipLevelUp) {
    finalEmbed.addFields({
      name: '⭐ VIP Level Up!',
      value: `You reached **${result.vipLevelUp.name}**!`,
      inline: false,
    });
  }

  return msg.edit({ embeds: [finalEmbed], files: [attachment] });
}

module.exports = { data, execute };
