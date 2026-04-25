const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCoinflip } = require('../games/coinflip');
const {
  COLORS,
  DIVIDER,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderCoinflip } = require('../utils/cardRenderer');

// Temporary store for pending bets (userId -> bet amount).
// Cleared once the user picks heads or tails.
const pendingBets = new Map();

const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('🪙 Flip a coin! Heads or tails -- double your bet.')
  .addIntegerOption((option) =>
    option
      .setName('bet')
      .setDescription('Amount to wager')
      .setRequired(true)
      .setMinValue(1)
  );

/**
 * Handles the /coinflip slash command. Shows an embed with Heads/Tails buttons.
 */
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

  // Store the pending bet so the button handler can retrieve it.
  pendingBets.set(userId, bet);

  const embed = new EmbedBuilder()
    .setTitle('🪙  C O I N F L I P  🪙')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '     ╭─────╮\n' +
      '     │  ?  │\n' +
      '     ╰─────╯\n' +
      '```\n' +
      `**${interaction.user.username}** wagered **${bet.toLocaleString()}** coins\n` +
      'Pick a side!\n\n' +
      DIVIDER
    )
    .setColor(COLORS.neutral)
    .setFooter({ text: `Balance: ${balance.toLocaleString()} coins` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coinflip:heads:${userId}`)
      .setLabel('HEADS')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('1496966950914490598'),
    new ButtonBuilder()
      .setCustomId(`coinflip:tails:${userId}`)
      .setLabel('TAILS')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('1496966376169148617')
  );

  return interaction.reply({ embeds: [embed], components: [row] });
}

/**
 * Handles button clicks for the coinflip game.
 */
async function handleButton(interaction) {
  const [, choice, ownerId] = interaction.customId.split(':');

  // Only the user who started the game can click.
  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      content: '❌ This is not your game!',
      ephemeral: true,
    });
  }

  const bet = pendingBets.get(ownerId);
  if (!bet) {
    return interaction.reply({
      content: '❌ This game has already been played or expired.',
      ephemeral: true,
    });
  }

  // Remove the pending bet so it can't be played twice.
  pendingBets.delete(ownerId);

  let result;
  try {
    result = playCoinflip(ownerId, bet, choice);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.update({
        content: '❌ You no longer have enough coins for this bet.',
        embeds: [],
        components: [],
      });
    }
    throw error;
  }

  const choiceEmoji = choice === 'heads' ? EMOJIS.heads : EMOJIS.tails;

  // ── Frame 1: Coin in the air ──
  const frame1 = new EmbedBuilder()
    .setTitle('🪙  C O I N F L I P  🪙')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '         🪙 ⬆️\n' +
      '      *flipping*\n' +
      '```\n' +
      `${choiceEmoji} You picked **${choice.toUpperCase()}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  await interaction.update({ embeds: [frame1], components: [] });

  // ── Frame 2: Coin spinning ──
  await sleep(600);
  const frame2 = new EmbedBuilder()
    .setTitle('🪙  C O I N F L I P  🪙')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '           🪙\n' +
      '       *spinning*\n' +
      '```\n' +
      `${choiceEmoji} You picked **${choice.toUpperCase()}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  await interaction.editReply({ embeds: [frame2] });

  // ── Frame 3: Coin falling ──
  await sleep(600);
  const frame3 = new EmbedBuilder()
    .setTitle('🪙  C O I N F L I P  🪙')
    .setDescription(
      `${DIVIDER}\n\n` +
      '```\n' +
      '      🪙 ⬇️\n' +
      '      *falling*\n' +
      '```\n' +
      `${choiceEmoji} You picked **${choice.toUpperCase()}**\n\n` +
      DIVIDER
    )
    .setColor(COLORS.pending);

  await interaction.editReply({ embeds: [frame3] });

  // ── Frame 4: Result ──
  await sleep(800);

  const color = result.won ? COLORS.win : COLORS.lose;

  // Render the coinflip result image.
  const pngBuffer = renderCoinflip({
    side: result.side,
    won: result.won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'coinflip.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(`🪙  ${result.side.toUpperCase()}!  🪙`)
    .setDescription(
      result.won
        ? `**+${result.payout.toLocaleString()}** coins`
        : `You picked **${choice.toUpperCase()}** -- better luck next time!`
    )
    .setColor(color)
    .setImage('attachment://coinflip.png')
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

  return interaction.editReply({ embeds: [finalEmbed], files: [attachment] });
}

module.exports = { data, execute, handleButton };
