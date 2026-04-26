const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playWheel } = require('../games/wheel');
const { COLORS, sleep } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount, formatBalance } = require('../utils/formatAmount');
const { renderWheel, renderWheelAnim } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('wheel')
  .setDescription('🎡 Spin the Wheel of Fortune! Land on a multiplier to win.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playWheel(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // ── Animation frame: Spinning PNG ──
  const animBuffer = renderWheelAnim({ playerName: interaction.user.username });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'spinning.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle('🎡  W H E E L  🎡')
    .setColor(COLORS.pending)
    .setImage('attachment://spinning.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  // ── Result after delay ──
  await sleep(1800);

  const isBigWin = result.multiplier >= 5;
  const color = result.won ? (isBigWin ? COLORS.jackpot : COLORS.win) : COLORS.lose;

  const pngBuffer = renderWheel({
    segments: result.segments,
    winningIndex: result.winningIndex,
    multiplier: result.multiplier,
    won: result.won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'wheel.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(
      isBigWin
        ? `🎡${EMOJIS.coin}  ${result.segment.label}  ${EMOJIS.coin}🎡`
        : `🎡  ${result.segment.label}  🎡`
    )
    .setDescription(
      result.won
        ? `**+${formatAmount(result.payout)}** (${result.multiplier}x)`
        : `Landed on **${result.segment.label}** -- **${formatAmount(result.payout)}** back`
    )
    .setColor(color)
    .setImage('attachment://wheel.png')
    .addFields(
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

  return msg.edit({ embeds: [finalEmbed], files: [attachment] });
}

module.exports = { data, execute };
