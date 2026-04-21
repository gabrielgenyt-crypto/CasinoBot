const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureWallet } = require('../utils/wallet');
const { getOrCreateDepositAddress } = require('../utils/hdWallet');

const SUPPORTED_CHAINS = ['ETH', 'BSC', 'SOL', 'MATIC'];

const TOKEN_INFO = {
  ETH: 'ETH, USDT, USDC',
  BSC: 'BNB, USDT, USDC',
  SOL: 'SOL, USDC',
  MATIC: 'MATIC, USDT, USDC',
};

const CONFIRMATIONS = {
  ETH: 12,
  BSC: 15,
  SOL: 32,
  MATIC: 128,
};

const data = new SlashCommandBuilder()
  .setName('deposit')
  .setDescription('Get your unique deposit address for a blockchain.')
  .addStringOption((opt) =>
    opt
      .setName('chain')
      .setDescription('Blockchain to deposit on')
      .setRequired(true)
      .addChoices(
        ...SUPPORTED_CHAINS.map((c) => ({ name: c, value: c }))
      )
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const chain = interaction.options.getString('chain');

  let result;
  try {
    result = getOrCreateDepositAddress(userId, chain);
  } catch (error) {
    if (error.message.includes('WALLET_MNEMONIC')) {
      return interaction.reply({
        content: 'Deposit system is not configured yet. Contact an admin.',
        ephemeral: true,
      });
    }
    throw error;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Deposit — ${chain}`)
    .setDescription(
      `Send **${chain}** tokens to your unique address below.\n` +
      `Balance credited after **${CONFIRMATIONS[chain]}** confirmations.\n\n` +
      `**\`${result.address}\`**`
    )
    .setColor(result.isNew ? 0x2ecc71 : 0x3498db)
    .addFields(
      { name: 'Supported Tokens', value: TOKEN_INFO[chain], inline: true },
      { name: 'Confirmations', value: `${CONFIRMATIONS[chain]}`, inline: true }
    )
    .setFooter({ text: 'Only send supported tokens to this address. Other tokens may be lost.' });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
