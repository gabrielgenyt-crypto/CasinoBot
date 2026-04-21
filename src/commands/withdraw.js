const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');

const SUPPORTED_CHAINS = ['ETH', 'BSC', 'SOL', 'MATIC'];
const DAILY_LIMIT = 50000;
const LARGE_WITHDRAWAL_THRESHOLD = 10000;

const data = new SlashCommandBuilder()
  .setName('withdraw')
  .setDescription('Withdraw coins to a blockchain address.')
  .addIntegerOption((opt) =>
    opt.setName('amount').setDescription('Amount to withdraw').setRequired(true).setMinValue(100)
  )
  .addStringOption((opt) =>
    opt
      .setName('chain')
      .setDescription('Blockchain to withdraw on')
      .setRequired(true)
      .addChoices(
        ...SUPPORTED_CHAINS.map((c) => ({ name: c, value: c }))
      )
  )
  .addStringOption((opt) =>
    opt.setName('address').setDescription('Destination wallet address').setRequired(true)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const amount = interaction.options.getInteger('amount');
  const chain = interaction.options.getString('chain');
  const address = interaction.options.getString('address');
  const balance = getBalance(userId);

  if (amount > balance) {
    return interaction.reply({
      content: `Insufficient funds. Your balance: **${balance}**`,
      ephemeral: true,
    });
  }

  // Check daily withdrawal limit.
  const today = new Date().toISOString().split('T')[0];
  const dailyTotal = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM withdraw_requests WHERE user_id = ? AND created_at >= ? AND status != ?'
  ).get(userId, today, 'rejected');

  if (dailyTotal.total + amount > DAILY_LIMIT) {
    return interaction.reply({
      content: `Daily withdrawal limit is **${DAILY_LIMIT}** coins. You have already requested **${dailyTotal.total}** today.`,
      ephemeral: true,
    });
  }

  // Check whitelist (optional -- if user has whitelisted addresses, enforce it).
  const whitelistCount = db.prepare(
    'SELECT COUNT(*) as count FROM withdraw_whitelist WHERE user_id = ?'
  ).get(userId).count;

  if (whitelistCount > 0) {
    const isWhitelisted = db.prepare(
      'SELECT id FROM withdraw_whitelist WHERE user_id = ? AND chain = ? AND address = ?'
    ).get(userId, chain, address);

    if (!isWhitelisted) {
      return interaction.reply({
        content: 'This address is not on your whitelist. Add it with `/withdraw whitelist` first (24h cooldown applies).',
        ephemeral: true,
      });
    }
  }

  // Deduct balance.
  try {
    updateBalance(userId, -amount, `withdrawal request: ${chain}`);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  // Determine if this needs admin approval.
  const status = amount >= LARGE_WITHDRAWAL_THRESHOLD ? 'pending' : 'pending';
  const needsApproval = amount >= LARGE_WITHDRAWAL_THRESHOLD;

  // Create the withdrawal request.
  const result = db.prepare(
    'INSERT INTO withdraw_requests (user_id, chain, address, amount, status) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, chain, address, amount, status);

  const embed = new EmbedBuilder()
    .setTitle('Withdrawal Request Created')
    .setColor(needsApproval ? 0xf1c40f : 0x2ecc71)
    .addFields(
      { name: 'Request ID', value: `#${result.lastInsertRowid}`, inline: true },
      { name: 'Amount', value: `${amount}`, inline: true },
      { name: 'Chain', value: chain, inline: true },
      { name: 'Address', value: `\`${address}\``, inline: false },
      { name: 'Status', value: needsApproval ? 'Pending Admin Approval (large amount)' : 'Pending Processing', inline: false }
    )
    .setFooter({ text: 'Blockchain transaction integration required for automatic processing.' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
