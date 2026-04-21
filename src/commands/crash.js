const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCrash } = require('../games/crash');

const data = new SlashCommandBuilder()
  .setName('crash')
  .setDescription('Ride the multiplier! Cash out before it crashes.')
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
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playCrash(userId, bet, cashout);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const crashEmoji = result.crashPoint <= 1.2 ? '💥' : '📈';
  const outcomeText = result.won
    ? `Cashed out at **${result.cashout}x** — won **${result.payout}** coins!`
    : `Crashed at **${result.crashPoint}x** before your **${result.cashout}x** target.`;

  const embed = new EmbedBuilder()
    .setTitle(`${crashEmoji} Crash - ${result.crashPoint}x`)
    .setDescription(
      `**${interaction.user.username}** bet **${bet}** coins\n` +
      `Target: **${result.cashout}x** | Crashed at: **${result.crashPoint}x**\n\n` +
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
