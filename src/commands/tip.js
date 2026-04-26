const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');
const { COLORS } = require('../utils/animations');
const { renderTip } = require('../utils/cardRenderer');
const { formatAmount } = require('../utils/formatAmount');

const data = new SlashCommandBuilder()
  .setName('tip')
  .setDescription('Send funds to another user.')
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
      content: `Insufficient funds. Your balance: **${formatAmount(balance)}**`,
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

  const senderBalance = getBalance(senderId);
  const recipientBalance = getBalance(recipient.id);

  const pngBuffer = renderTip({
    senderName: interaction.user.username,
    recipientName: recipient.username,
    amount,
    senderBalance,
    recipientBalance,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'tip.png' });

  const embed = new EmbedBuilder()
    .setTitle('Coin Transfer')
    .setColor(COLORS.win)
    .setImage('attachment://tip.png')
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
