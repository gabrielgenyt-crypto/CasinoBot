const { EmbedBuilder } = require('discord.js');
const { ensureWallet } = require('../utils/wallet');
const { getOrCreateDepositAddress } = require('../utils/hdWallet');

const name = 'deposit';
const aliases = ['dep'];
const description = 'Get your deposit address. Usage: =deposit <ETH|BSC|SOL|MATIC>';

const SUPPORTED_CHAINS = ['ETH', 'BSC', 'SOL', 'MATIC'];
const TOKEN_INFO = { ETH: 'ETH, USDT, USDC', BSC: 'BNB, USDT, USDC', SOL: 'SOL, USDC', MATIC: 'MATIC, USDT, USDC' };
const CONFIRMATIONS = { ETH: 12, BSC: 15, SOL: 32, MATIC: 128 };

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  const chain = (args[0] || '').toUpperCase();
  if (!SUPPORTED_CHAINS.includes(chain)) {
    return message.reply(`Usage: \`=deposit <${SUPPORTED_CHAINS.join('|')}>\``);
  }

  let result;
  try {
    result = getOrCreateDepositAddress(userId, chain);
  } catch (error) {
    if (error.message.includes('WALLET_MNEMONIC')) {
      return message.reply('Deposit system is not configured yet. Contact an admin.');
    }
    throw error;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Deposit — ${chain}`)
    .setDescription(
      `Send **${chain}** tokens to your address below.\n` +
      `Credited after **${CONFIRMATIONS[chain]}** confirmations.\n\n` +
      `**\`${result.address}\`**`
    )
    .setColor(result.isNew ? 0x2ecc71 : 0x3498db)
    .addFields(
      { name: 'Supported Tokens', value: TOKEN_INFO[chain], inline: true },
      { name: 'Confirmations', value: `${CONFIRMATIONS[chain]}`, inline: true }
    )
    .setFooter({ text: 'Only send supported tokens to this address.' });

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
