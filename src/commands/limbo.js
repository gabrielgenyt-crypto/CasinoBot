const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playLimbo } = require('../games/limbo');
const { COLORS, sleep } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount, formatBalance } = require('../utils/formatAmount');
const { renderAnimationFrame } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('limbo')
  .setDescription('🎯 Set a target multiplier -- beat it to win!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addNumberOption((opt) =>
    opt
      .setName('target')
      .setDescription('Target multiplier (1.01 - 1000)')
      .setRequired(true)
      .setMinValue(1.01)
      .setMaxValue(1000)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const target = interaction.options.getNumber('target');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playLimbo(userId, bet, target);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    if (error.message === 'INVALID_TARGET') {
      return interaction.reply({ content: '❌ Target must be between 1.01 and 1000.', ephemeral: true });
    }
    throw error;
  }

  // ── Animation frame ──
  const winChance = (0.99 / target * 100).toFixed(1);
  const animBuffer = renderAnimationFrame({
    title: 'L I M B O',
    status: 'Generating . . .',
    accentColor: '#ff6b35',
    playerName: interaction.user.username,
    subtitle: `Target: ${target}x (${winChance}% chance)`,
  });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'limbo.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle('🎯  L I M B O  🎯')
    .setColor(COLORS.pending)
    .setImage('attachment://limbo.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  await sleep(1500);

  // ── Result ──
  const color = result.won ? COLORS.win : COLORS.lose;

  const finalEmbed = new EmbedBuilder()
    .setTitle(result.won ? `🎯${EMOJIS.coin}  ${result.multiplier}x  ${EMOJIS.coin}🎯` : `🎯  ${result.multiplier}x  🎯`)
    .setDescription(
      result.won
        ? `Rolled **${result.multiplier}x** >= **${result.target}x** target!\n**+${formatAmount(result.payout)}**`
        : `Rolled **${result.multiplier}x** -- needed **${result.target}x** or higher`
    )
    .setColor(color)
    .addFields(
      { name: '🎯 Target', value: `\`${result.target}x\``, inline: true },
      { name: `${EMOJIS.coin} Balance`, value: `\`${formatBalance(result.newBalance)}\``, inline: true },
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

  return msg.edit({ embeds: [finalEmbed], files: [] });
}

module.exports = { data, execute };
