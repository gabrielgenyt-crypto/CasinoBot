const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ensureWallet } = require('../utils/wallet');
const { getOrCreateDepositAddress } = require('../utils/hdWallet');
const { COLORS } = require('../utils/animations');
const { renderDeposit } = require('../utils/cardRenderer');

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

  const pngBuffer = renderDeposit({
    chain,
    address: result.address,
    tokens: TOKEN_INFO[chain],
    confirmations: CONFIRMATIONS[chain],
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'deposit.png' });

  const embed = new EmbedBuilder()
    .setTitle(`Deposit — ${chain}`)
    .setColor(COLORS.info)
    .setImage('attachment://deposit.png')
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
}

module.exports = { data, execute };
