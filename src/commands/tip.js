const { EmbedBuilder } = require('discord.js');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');

const name = 'tip';
const aliases = ['give', 'send'];
const description = 'Send coins to another user. Usage: =tip @user <amount>';

async function execute(message, args) {
  const senderId = message.author.id;
  const recipient = message.mentions.users.first();

  if (!recipient) {
    return message.reply('Usage: `=tip @user <amount>`\nExample: `=tip @friend 100`');
  }

  // The amount could be args[0] or args[1] depending on whether the mention is first.
  const amountStr = args.find((a) => !a.startsWith('<@') && !isNaN(parseInt(a, 10)));
  const amount = parseInt(amountStr, 10);

  if (!amount || amount < 1) {
    return message.reply('Amount must be a positive number.');
  }

  if (recipient.id === senderId) {
    return message.reply('You cannot tip yourself.');
  }
  if (recipient.bot) {
    return message.reply('You cannot tip a bot.');
  }

  ensureWallet(senderId);
  ensureWallet(recipient.id);

  const balance = getBalance(senderId);
  if (amount > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  try {
    updateBalance(senderId, -amount, `tip to ${recipient.id}`);
    updateBalance(recipient.id, amount, `tip from ${senderId}`);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    throw error;
  }

  const embed = new EmbedBuilder()
    .setTitle('Tip Sent')
    .setDescription(`**${message.author.username}** tipped **${amount}** coins to **${recipient.username}**`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Your Balance', value: `${getBalance(senderId)}`, inline: true },
      { name: `${recipient.username}'s Balance`, value: `${getBalance(recipient.id)}`, inline: true }
    )
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
