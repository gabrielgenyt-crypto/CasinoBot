const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { ensureWallet } = require('../utils/wallet');

const SUPPORTED_CHAINS = ['ETH', 'BSC', 'SOL', 'MATIC'];

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

  // Check if the user already has an address for this chain.
  let record = db.prepare(
    'SELECT address FROM deposit_addresses WHERE user_id = ? AND chain = ?'
  ).get(userId, chain);

  if (!record) {
    // In production, this would derive an HD wallet address (BIP32/BIP39).
    // For now, generate a placeholder address to demonstrate the flow.
    const placeholder = `0x${require('crypto').randomBytes(20).toString('hex')}`;

    db.prepare(
      'INSERT INTO deposit_addresses (user_id, chain, address) VALUES (?, ?, ?)'
    ).run(userId, chain, placeholder);

    record = { address: placeholder };
  }

  const embed = new EmbedBuilder()
    .setTitle(`Deposit — ${chain}`)
    .setDescription(
      `Send **${chain}** tokens to the address below.\n` +
      'Your balance will be credited automatically after confirmations.\n\n' +
      `**\`${record.address}\`**`
    )
    .setColor(0x3498db)
    .addFields(
      { name: 'Supported Tokens', value: chain === 'ETH' ? 'ETH, USDT, USDC' : chain === 'BSC' ? 'BNB, USDT, USDC' : chain === 'SOL' ? 'SOL, USDC' : 'MATIC, USDT, USDC', inline: false },
      { name: 'Note', value: 'Blockchain listener integration required for automatic crediting. Contact admin for manual deposits.', inline: false }
    )
    .setFooter({ text: 'Only send supported tokens to this address.' });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
