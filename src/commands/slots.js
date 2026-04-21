const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playSlots } = require('../games/slots');

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Spin the slot machine! Match symbols to win.')
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
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playSlots(userId, bet);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const reelDisplay = result.reels.map((r) => r.emoji).join(' | ');
  const color = result.won ? 0x2ecc71 : 0xe74c3c;

  let outcomeText;
  if (result.multiplier >= 10) {
    outcomeText = `JACKPOT! **${result.multiplier}x** — won **${result.payout}** coins!`;
  } else if (result.won) {
    outcomeText = `**${result.multiplier}x** — won **${result.payout}** coins!`;
  } else {
    outcomeText = `No match. Lost **${bet}** coins.`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Slots')
    .setDescription(
      `**[ ${reelDisplay} ]**\n\n` +
      `${interaction.user.username} bet **${bet}** coins\n` +
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
