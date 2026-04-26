const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playKeno, POOL_SIZE, MAX_PICKS } = require('../games/keno');
const { COLORS, sleep } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { formatAmount, formatBalance } = require('../utils/formatAmount');
const { renderAnimationFrame, renderKeno } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('keno')
  .setDescription('🎱 Pick up to 10 numbers and match the draw!')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName('picks')
      .setDescription('Your numbers separated by spaces (1-40, up to 10)')
      .setRequired(true)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const picksRaw = interaction.options.getString('picks');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${formatAmount(balance)}**`,
      ephemeral: true,
    });
  }

  // Parse picks.
  const picks = [...new Set(
    picksRaw
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= POOL_SIZE)
  )];

  if (picks.length < 1 || picks.length > MAX_PICKS) {
    return interaction.reply({
      content: `❌ Pick between 1 and ${MAX_PICKS} unique numbers from 1-${POOL_SIZE}.`,
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playKeno(userId, bet, picks);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    if (error.message === 'INVALID_PICKS' || error.message === 'DUPLICATE_PICKS' || error.message === 'INVALID_PICK_RANGE') {
      return interaction.reply({ content: `❌ Invalid picks. Choose 1-${MAX_PICKS} unique numbers from 1-${POOL_SIZE}.`, ephemeral: true });
    }
    throw error;
  }

  // ── Animation frame: Drawing PNG ──
  const animBuffer = renderAnimationFrame({
    title: 'K E N O',
    status: 'Drawing . . .',
    accentColor: '#e91e63',
    playerName: interaction.user.username,
    subtitle: `${picks.length} numbers picked`,
  });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'drawing.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle('🎱  K E N O  🎱')
    .setColor(COLORS.pending)
    .setImage('attachment://drawing.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  await sleep(1800);

  // ── Result ──
  const color = result.won ? COLORS.win : COLORS.lose;

  // Render the keno board PNG.
  const pngBuffer = renderKeno({
    poolSize: POOL_SIZE,
    picks: result.picks,
    drawn: result.drawn,
    hits: result.hits,
    won: result.won,
    hitCount: result.hitCount,
    multiplier: result.multiplier,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'keno.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(result.won ? `🎱${EMOJIS.coin}  K E N O  ${EMOJIS.coin}🎱` : '🎱  K E N O  🎱')
    .setDescription(
      result.won
        ? `**${result.hitCount}/${result.picks.length}** matched! **+${formatAmount(result.payout)}** (${result.multiplier}x)`
        : `**${result.hitCount}/${result.picks.length}** matched -- better luck next time!`
    )
    .setColor(color)
    .setImage('attachment://keno.png')
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
