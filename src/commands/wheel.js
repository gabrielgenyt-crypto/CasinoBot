const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playWheel } = require('../games/wheel');
const { COLORS, sleep } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderWheel } = require('../utils/cardRenderer');

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
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
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

  // ── Frame 1: Wheel spinning ──
  const frame1 = new EmbedBuilder()
    .setTitle('🎡  W H E E L  🎡')
    .setDescription('The wheel is spinning...')
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [frame1], fetchReply: true });

  // ── Frame 2: Slowing down ──
  await sleep(800);
  const frame2 = new EmbedBuilder()
    .setTitle('🎡  W H E E L  🎡')
    .setDescription('Slowing down...')
    .setColor(COLORS.pending);
  await msg.edit({ embeds: [frame2] });

  // ── Frame 3: Result ──
  await sleep(1000);

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
        ? `**+${result.payout.toLocaleString()}** coins (${result.multiplier}x)`
        : `Landed on **${result.segment.label}** -- **${result.payout.toLocaleString()}** coins back`
    )
    .setColor(color)
    .setImage('attachment://wheel.png')
    .addFields(
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
