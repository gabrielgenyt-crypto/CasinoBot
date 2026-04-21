const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');
const { updateBalance, getBalance, ensureWallet } = require('../utils/wallet');
const { getEntries: getAuditEntries } = require('../utils/auditLog');

const name = 'admin';
const aliases = [];
const description = 'Admin commands. Usage: =admin <ban|unban|balance|promo|stats|approve|audit> [args]';

async function execute(message, args) {
  // Check admin permission.
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('Admin only.');
  }

  const sub = (args[0] || '').toLowerCase();

  if (sub === 'ban') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Usage: `=admin ban @user [reason]`');
    const reason = args.slice(2).join(' ') || 'No reason provided';

    const existing = db.prepare('SELECT user_id FROM bans WHERE user_id = ?').get(target.id);
    if (existing) return message.reply(`${target.username} is already banned.`);

    db.prepare('INSERT INTO bans (user_id, reason, banned_by) VALUES (?, ?, ?)')
      .run(target.id, reason, message.author.id);

    const embed = new EmbedBuilder()
      .setTitle('User Banned')
      .setDescription(`**${target.username}** has been banned.`)
      .setColor(0xe74c3c)
      .addFields({ name: 'Reason', value: reason, inline: false })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'unban') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Usage: `=admin unban @user`');

    const result = db.prepare('DELETE FROM bans WHERE user_id = ?').run(target.id);
    if (result.changes === 0) return message.reply(`${target.username} is not banned.`);

    return message.reply(`**${target.username}** has been unbanned.`);
  }

  if (sub === 'balance' || sub === 'bal') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('Usage: `=admin balance @user <amount> [reason]`');

    const amount = parseInt(args[2], 10);
    if (isNaN(amount)) return message.reply('Amount must be a number.');

    const reason = args.slice(3).join(' ') || 'admin adjustment';
    ensureWallet(target.id);

    try {
      const newBalance = updateBalance(target.id, amount, `admin: ${reason}`);
      const sign = amount >= 0 ? '+' : '';

      const embed = new EmbedBuilder()
        .setTitle('Balance Adjusted')
        .setDescription(`**${target.username}** adjusted by **${sign}${amount}**`)
        .setColor(0xf1c40f)
        .addFields(
          { name: 'New Balance', value: `${newBalance}`, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    } catch (error) {
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return message.reply(`Cannot subtract — user only has ${getBalance(target.id)} coins.`);
      }
      throw error;
    }
  }

  if (sub === 'promo') {
    const code = (args[1] || '').toUpperCase();
    const amount = parseInt(args[2], 10);
    const maxUses = parseInt(args[3], 10) || 1;

    if (!code || isNaN(amount) || amount < 1) {
      return message.reply('Usage: `=admin promo <code> <amount> [max_uses]`');
    }

    const existing = db.prepare('SELECT code FROM promo_codes WHERE code = ?').get(code);
    if (existing) return message.reply(`Promo code **${code}** already exists.`);

    db.prepare(
      'INSERT INTO promo_codes (code, amount, max_uses, created_by) VALUES (?, ?, ?, ?)'
    ).run(code, amount, maxUses, message.author.id);

    const embed = new EmbedBuilder()
      .setTitle('Promo Code Created')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Code', value: `\`${code}\``, inline: true },
        { name: 'Amount', value: `${amount}`, inline: true },
        { name: 'Max Uses', value: `${maxUses}`, inline: true }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'stats') {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM wallets').get().count;
    const totalBalance = db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM wallets').get().total;
    const totalGames = db.prepare('SELECT COUNT(*) as count FROM game_history').get().count;
    const totalWagered = db.prepare('SELECT COALESCE(SUM(bet), 0) as total FROM game_history').get().total;
    const totalPayout = db.prepare('SELECT COALESCE(SUM(payout), 0) as total FROM game_history').get().total;
    const houseProfit = totalWagered - totalPayout;

    const pendingWithdrawals = db.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM withdraw_requests WHERE status = ?'
    ).get('pending');

    const embed = new EmbedBuilder()
      .setTitle('Casino Statistics')
      .setColor(0x3498db)
      .addFields(
        { name: 'Total Users', value: `${totalUsers}`, inline: true },
        { name: 'Total Balance', value: `${totalBalance}`, inline: true },
        { name: 'Total Games', value: `${totalGames}`, inline: true },
        { name: 'Total Wagered', value: `${totalWagered}`, inline: true },
        { name: 'Total Payouts', value: `${totalPayout}`, inline: true },
        { name: 'House Profit', value: `${houseProfit}`, inline: true },
        { name: 'Pending Withdrawals', value: `${pendingWithdrawals.count} (${pendingWithdrawals.total} coins)`, inline: false }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'approve') {
    const requestId = parseInt(args[1], 10);
    if (isNaN(requestId)) return message.reply('Usage: `=admin approve <id>`');

    const request = db.prepare('SELECT * FROM withdraw_requests WHERE id = ? AND status = ?')
      .get(requestId, 'pending');
    if (!request) return message.reply(`No pending withdrawal #${requestId}.`);

    db.prepare('UPDATE withdraw_requests SET status = ?, reviewed_by = ?, updated_at = ? WHERE id = ?')
      .run('approved', message.author.id, new Date().toISOString(), requestId);

    const embed = new EmbedBuilder()
      .setTitle('Withdrawal Approved')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'ID', value: `${requestId}`, inline: true },
        { name: 'User', value: `<@${request.user_id}>`, inline: true },
        { name: 'Amount', value: `${request.amount}`, inline: true },
        { name: 'Chain', value: request.chain, inline: true },
        { name: 'Address', value: `\`${request.address}\``, inline: false }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'audit') {
    const target = message.mentions.users.first();
    const action = args.find((a) => !a.startsWith('<@') && a !== 'audit');
    const limit = parseInt(args[args.length - 1], 10) || 15;

    const entries = getAuditEntries({
      userId: target?.id,
      action: action && !isNaN(parseInt(action, 10)) ? undefined : action,
      limit: Math.min(limit, 50),
    });

    if (entries.length === 0) return message.reply('No audit log entries found.');

    const lines = entries.map((e) => {
      const tgt = e.target_id ? ` -> <@${e.target_id}>` : '';
      const details = e.details ? ` | ${e.details.substring(0, 50)}` : '';
      return `\`${e.created_at}\` <@${e.user_id}>${tgt} **${e.action}**${details}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Audit Log')
      .setDescription(lines.join('\n').substring(0, 4000))
      .setColor(0x95a5a6)
      .setFooter({ text: `Showing ${entries.length} entries` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  return message.reply('Usage: `=admin <ban|unban|balance|promo|stats|approve|audit> [args]`');
}

module.exports = { name, aliases, description, execute };
