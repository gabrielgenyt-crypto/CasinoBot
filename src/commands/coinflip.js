const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCoinflip } = require('../games/coinflip');

// Temporary store for pending bets (userId -> bet amount).
// Cleared once the user picks heads or tails.
const pendingBets = new Map();

const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin! Heads or tails -- double your bet.')
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
      content: `You don't have enough coins. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  // Store the pending bet so the button handler can retrieve it.
  pendingBets.set(userId, bet);

  const embed = new EmbedBuilder()
    .setTitle('Coinflip')
    .setDescription(
      `**${interaction.user.username}** wagered **${bet}** coins.\nPick a side!`
    )
    .setColor(0xf1c40f)
    .setFooter({ text: `Balance: ${balance}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coinflip:heads:${userId}`)
      .setLabel('Heads')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🪙'),
    new ButtonBuilder()
      .setCustomId(`coinflip:tails:${userId}`)
      .setLabel('Tails')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🪙')
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
      content: 'This is not your game!',
      ephemeral: true,
    });
  }

  const bet = pendingBets.get(ownerId);
  if (!bet) {
    return interaction.reply({
      content: 'This game has already been played or expired.',
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
        content: 'You no longer have enough coins for this bet.',
        embeds: [],
        components: [],
      });
    }
    throw error;
  }

  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const outcomeText = result.won
    ? `You won **${result.payout}** coins!`
    : `You lost **${bet}** coins.`;

  const embed = new EmbedBuilder()
    .setTitle(`Coinflip - ${result.side.toUpperCase()}`)
    .setDescription(
      `${interaction.user.username} picked **${choice}**.\n` +
      `The coin landed on **${result.side}**.\n\n` +
      outcomeText
    )
    .setColor(color)
    .addFields(
      { name: 'Balance', value: `${result.newBalance}`, inline: true },
      { name: 'Nonce', value: `${result.nonce}`, inline: true },
      { name: 'Seed Hash', value: `\`${result.serverSeedHash.substring(0, 16)}...\``, inline: true }
    )
    .setFooter({ text: 'Use /fairness to verify results' });

  return interaction.update({ embeds: [embed], components: [] });
}

module.exports = { data, execute, handleButton };
