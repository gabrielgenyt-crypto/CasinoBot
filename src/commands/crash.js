const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCrash } = require('../games/crash');
const {
  COLORS,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderCrash, renderCrashAnim } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('crash')
  .setDescription('🚀 Ride the multiplier! Cash out before it crashes.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addNumberOption((opt) =>
    opt
      .setName('cashout')
      .setDescription('Auto-cashout multiplier (e.g. 2.0)')
      .setRequired(true)
      .setMinValue(1.01)
      .setMaxValue(1000)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const cashout = interaction.options.getNumber('cashout');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  // Play the game first so we know the outcome.
  let result;
  try {
    result = playCrash(userId, bet, cashout);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // ── Animation frame: Launching PNG ──
  const animBuffer = renderCrashAnim({
    playerName: interaction.user.username,
    cashout,
  });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'launching.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.rocket}  C R A S H  ${EMOJIS.rocket}`)
    .setColor(COLORS.pending)
    .setImage('attachment://launching.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  // ── Result after delay ──
  await sleep(2000);

  const won = result.won;
  const color = won ? COLORS.win : COLORS.lose;

  // Render the crash graph image.
  const pngBuffer = renderCrash({
    crashPoint: result.crashPoint,
    cashout: result.cashout,
    won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'crash.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(won ? `${EMOJIS.rocket}${EMOJIS.coin}  CASHED OUT  ${EMOJIS.coin}${EMOJIS.rocket}` : '💥  C R A S H E D  💥')
    .setDescription(
      won
        ? `**+${result.payout.toLocaleString()}** coins at **${result.cashout}x**`
        : `Crashed at **${result.crashPoint}x** -- target was **${result.cashout}x**`
    )
    .setColor(color)
    .setImage('attachment://crash.png')
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
