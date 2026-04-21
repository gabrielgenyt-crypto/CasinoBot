const { EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');

const name = 'balance';
const aliases = ['bal', 'wallet'];
const description = 'Check your coin balance. Usage: =balance';

async function execute(message) {
  const userId = message.author.id;
  ensureWallet(userId);

  const balance = getBalance(userId);

  const embed = new EmbedBuilder()
    .setTitle('Wallet')
    .setDescription(`**${message.author.username}**'s balance`)
    .setColor(0x3498db)
    .addFields({ name: 'Coins', value: `${balance}`, inline: true })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
