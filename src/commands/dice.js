const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playDice } = require('../games/dice');

const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll a dice (1-100). Bet over or under a target number.')
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

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const direction = interaction.options.getString('direction');
  const target = interaction.options.getInteger('target');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  // Validate the target produces a valid win chance.
  const winChance =
    direction === 'over' ? (100 - target) / 100 : (target - 1) / 100;
  if (winChance <= 0 || winChance >= 1) {
    return interaction.reply({
      content: 'Invalid target for that direction. Ensure there is a chance to win and lose.',
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playDice(userId, bet, direction, target);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const winChancePercent = (winChance * 100).toFixed(1);
  const outcomeText = result.won
    ? `You won **${result.payout}** coins!`
    : `You lost **${bet}** coins.`;

  const embed = new EmbedBuilder()
    .setTitle(`Dice - Rolled ${result.roll}`)
    .setDescription(
      `**${interaction.user.username}** bet **${bet}** on **${direction} ${target}**\n` +
      `Roll: **${result.roll}** ${result.won ? '>' : '<'} ${target}\n\n` +
      outcomeText
    )
    .setColor(color)
    .addFields(
      { name: 'Multiplier', value: `${result.multiplier}x`, inline: true },
      { name: 'Win Chance', value: `${winChancePercent}%`, inline: true },
      { name: 'Balance', value: `${result.newBalance}`, inline: true },
      { name: 'Nonce', value: `${result.nonce}`, inline: true },
      { name: 'Seed Hash', value: `\`${result.serverSeedHash.substring(0, 16)}...\``, inline: true }
    )
    .setFooter({ text: 'Provably Fair | /fairness to verify' });

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
