const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playRoulette, BET_TYPES } = require('../games/roulette');

// Build choices from BET_TYPES plus a few number examples.
const betChoices = [
  ...Object.entries(BET_TYPES).map(([key, val]) => ({
    name: val.label,
    value: key,
  })),
];

const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('European roulette. Bet on colors, numbers, dozens, and more.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Bet type (red, black, even, odd, low, high, dozen1-3, col1-3, or a number 0-36)')
      .setRequired(true)
      .addChoices(...betChoices.slice(0, 25))
  )
  .addIntegerOption((opt) =>
    opt
      .setName('number')
      .setDescription('Straight-up number bet (0-36). Overrides type if provided.')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(36)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const numberBet = interaction.options.getInteger('number');
  const typeBet = interaction.options.getString('type');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  // If a number is provided, use it as a straight-up bet.
  const betType = numberBet !== null ? String(numberBet) : typeBet;

  let result;
  try {
    result = playRoulette(userId, bet, betType);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    if (error.message === 'INVALID_BET_TYPE') {
      return interaction.reply({ content: 'Invalid bet type.', ephemeral: true });
    }
    throw error;
  }

  const colorEmoji = { red: '🔴', black: '⚫', green: '🟢' };
  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const outcomeText = result.won
    ? `Won **${result.payout}** coins!`
    : `Lost **${bet}** coins.`;

  const embed = new EmbedBuilder()
    .setTitle(`Roulette - ${colorEmoji[result.color]} ${result.number}`)
    .setDescription(
      `**${interaction.user.username}** bet **${bet}** on **${result.betLabel}**\n` +
      `The ball landed on **${result.number}** (${result.color})\n\n` +
      outcomeText
    )
    .setColor(color)
    .addFields(
      { name: 'Balance', value: `${result.newBalance}`, inline: true },
      { name: 'Nonce', value: `${result.nonce}`, inline: true },
      { name: 'Seed Hash', value: `\`${result.serverSeedHash.substring(0, 16)}...\``, inline: true }
    )
    .setFooter({ text: 'Provably Fair | /fairness to verify' });

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
