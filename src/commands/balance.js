const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your current coin balance.');

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const balance = getBalance(userId);

  const embed = new EmbedBuilder()
    .setTitle('Wallet')
    .setDescription(`**${interaction.user.username}**'s balance`)
    .setColor(0x3498db)
    .addFields({ name: 'Coins', value: `${balance}`, inline: true })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { data, execute };
