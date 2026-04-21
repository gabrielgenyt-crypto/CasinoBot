const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { getBalance, updateBalance, ensureWallet } = require('../utils/wallet');
const { validateAddress, isBlockedAddress } = require('../utils/addressValidator');
const { log, ACTIONS } = require('../utils/auditLog');

const name = 'withdraw';
const aliases = ['wd'];
const description = 'Withdraw coins. Usage: =withdraw <amount> <chain> <address>';

const SUPPORTED_CHAINS = ['ETH', 'BSC', 'SOL', 'MATIC'];
const DAILY_LIMIT = 50000;
const LARGE_WITHDRAWAL_THRESHOLD = 10000;

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (args.length < 3) {
    return message.reply('Usage: `=withdraw <amount> <chain> <address>`\nExample: `=withdraw 1000 ETH 0x123...`');
  }

  const amount = parseInt(args[0], 10);
  const chain = args[1].toUpperCase();
  const rawAddress = args[2];

  if (isNaN(amount) || amount < 100) {
    return message.reply('Minimum withdrawal is 100 coins.');
  }
  if (!SUPPORTED_CHAINS.includes(chain)) {
    return message.reply(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);
  }

  const validation = validateAddress(chain, rawAddress);
  if (!validation.valid) {
    return message.reply(`Invalid ${chain} address: ${validation.error}`);
  }
  const address = validation.address;

  if (isBlockedAddress(address)) {
    return message.reply('This address is blocked.');
  }

  const balance = getBalance(userId);
  if (amount > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyTotal = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM withdraw_requests WHERE user_id = ? AND created_at >= ? AND status != ?'
  ).get(userId, today, 'rejected');

  if (dailyTotal.total + amount > DAILY_LIMIT) {
    return message.reply(`Daily limit is **${DAILY_LIMIT}** coins. Already requested: **${dailyTotal.total}** today.`);
  }

  const whitelistCount = db.prepare(
    'SELECT COUNT(*) as count FROM withdraw_whitelist WHERE user_id = ?'
  ).get(userId).count;

  if (whitelistCount > 0) {
    const isWhitelisted = db.prepare(
      'SELECT id FROM withdraw_whitelist WHERE user_id = ? AND chain = ? AND address = ?'
    ).get(userId, chain, address);
    if (!isWhitelisted) {
      return message.reply('This address is not on your whitelist.');
    }
  }

  try {
    updateBalance(userId, -amount, `withdrawal request: ${chain}`);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return message.reply('Insufficient funds.');
    }
    throw error;
  }

  const needsApproval = amount >= LARGE_WITHDRAWAL_THRESHOLD;
  const result = db.prepare(
    'INSERT INTO withdraw_requests (user_id, chain, address, amount, status) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, chain, address, amount, 'pending');

  log(userId, ACTIONS.WITHDRAW_REQUEST, {
    details: JSON.stringify({ id: result.lastInsertRowid, chain, address, amount, needsApproval }),
  });

  const embed = new EmbedBuilder()
    .setTitle('Withdrawal Request Created')
    .setColor(needsApproval ? 0xf1c40f : 0x2ecc71)
    .addFields(
      { name: 'Request ID', value: `#${result.lastInsertRowid}`, inline: true },
      { name: 'Amount', value: `${amount}`, inline: true },
      { name: 'Chain', value: chain, inline: true },
      { name: 'Address', value: `\`${address}\``, inline: false },
      { name: 'Status', value: needsApproval ? 'Pending Admin Approval' : 'Pending Processing', inline: false }
    )
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
