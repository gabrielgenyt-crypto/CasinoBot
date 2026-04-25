const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');
const { validateAddress, isBlockedAddress } = require('../utils/addressValidator');
const { log, ACTIONS } = require('../utils/auditLog');
const { COLORS } = require('../utils/animations');
const { renderWithdraw } = require('../utils/cardRenderer');

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
  const rawAddress = interaction.options.getString('address');
  const balance = getBalance(userId);

  // Validate the destination address.
  const validation = validateAddress(chain, rawAddress);
  if (!validation.valid) {
    return interaction.reply({
      content: `Invalid ${chain} address: ${validation.error}`,
      ephemeral: true,
    });
  }
  const address = validation.address;

  if (isBlockedAddress(address)) {
    return interaction.reply({
      content: 'This address is blocked. Contact support if you believe this is an error.',
      ephemeral: true,
    });
  }

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

  log(userId, ACTIONS.WITHDRAW_REQUEST, {
    details: JSON.stringify({ id: result.lastInsertRowid, chain, address, amount, needsApproval }),
  });

  const statusText = needsApproval ? 'Pending Admin Approval' : 'Pending Processing';

  const pngBuffer = renderWithdraw({
    requestId: result.lastInsertRowid,
    amount,
    chain,
    address,
    status: statusText,
    needsApproval,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'withdraw.png' });

  const embed = new EmbedBuilder()
    .setTitle('Withdrawal Request Created')
    .setColor(needsApproval ? COLORS.warning : COLORS.win)
    .setImage('attachment://withdraw.png')
    .setTimestamp();

  return interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
}

module.exports = { data, execute };
