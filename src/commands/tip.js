const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');

const data = new SlashCommandBuilder()
  .setName('tip')
  .setDescription('Send coins to another user.')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('The user to tip').setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt.setName('amount').setDescription('Amount to send').setRequired(true).setMinValue(1)
  );

async function execute(interaction) {
  const senderId = interaction.user.id;
  const recipient = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  if (recipient.id === senderId) {
    return interaction.reply({ content: 'You cannot tip yourself.', ephemeral: true });
  }

  if (recipient.bot) {
    return interaction.reply({ content: 'You cannot tip a bot.', ephemeral: true });
  }

  ensureWallet(senderId);
  ensureWallet(recipient.id);

  const balance = getBalance(senderId);
  if (amount > balance) {
    return interaction.reply({
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  try {
    updateBalance(senderId, -amount, `tip to ${recipient.id}`);
    updateBalance(recipient.id, amount, `tip from ${senderId}`);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const embed = new EmbedBuilder()
    .setTitle('Tip Sent')
    .setDescription(
      `**${interaction.user.username}** tipped **${amount}** coins to **${recipient.username}**`
    )
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Your Balance', value: `${getBalance(senderId)}`, inline: true },
      { name: `${recipient.username}'s Balance`, value: `${getBalance(recipient.id)}`, inline: true }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
