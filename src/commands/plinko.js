const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playPlinko } = require('../games/plinko');
const { COLORS, sleep } = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderPlinko } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('plinko')
  .setDescription('📍 Drop a ball through pegs! Land on edge slots for big wins.')
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
    result = playPlinko(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // ── Frame 1: Ball dropping ──
  const frame1 = new EmbedBuilder()
    .setTitle('📍  P L I N K O  📍')
    .setDescription('The ball is dropping...')
    .setColor(COLORS.pending);

  const msg = await interaction.reply({ embeds: [frame1], fetchReply: true });

  // ── Frame 2: Result ──
  await sleep(1200);

  const color = result.won ? COLORS.win : COLORS.lose;

  const pngBuffer = renderPlinko({
    path: result.path,
    slot: result.slot,
    multiplier: result.multiplier,
    won: result.won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'plinko.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(result.won ? `📍${EMOJIS.coin}  PLINKO WIN  ${EMOJIS.coin}📍` : '📍  P L I N K O  📍')
    .setDescription(
      result.won
        ? `**+${result.payout.toLocaleString()}** coins (${result.multiplier}x)`
        : `Landed on **${result.multiplier}x** -- **${result.payout.toLocaleString()}** coins back`
    )
    .setColor(color)
    .setImage('attachment://plinko.png')
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
