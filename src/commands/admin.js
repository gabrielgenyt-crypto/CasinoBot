const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');
const { updateBalance, getBalance, ensureWallet } = require('../utils/wallet');

const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin-only commands for managing the casino.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('ban')
      .setDescription('Ban a user from the casino.')
      .addUserOption((opt) => opt.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Ban reason').setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName('unban')
      .setDescription('Unban a user from the casino.')
      .addUserOption((opt) => opt.setName('user').setDescription('User to unban').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('balance')
      .setDescription('Adjust a user\'s balance.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Amount to add (negative to subtract)').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason for adjustment').setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName('promo')
      .setDescription('Create a promo code.')
      .addStringOption((opt) => opt.setName('code').setDescription('The promo code').setRequired(true))
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Coin amount per claim').setRequired(true).setMinValue(1))
      .addIntegerOption((opt) => opt.setName('max_uses').setDescription('Maximum number of uses (default 1)').setRequired(false).setMinValue(1))
      .addStringOption((opt) => opt.setName('expires').setDescription('Expiry date (ISO format, e.g. 2026-12-31)').setRequired(false))
  )
  .addSubcommand((sub) =>
    sub.setName('stats').setDescription('View global casino statistics.')
  )
  .addSubcommand((sub) =>
    sub
      .setName('approve')
      .setDescription('Approve a pending withdrawal request.')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Withdrawal request ID').setRequired(true))
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'ban') {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const existing = db.prepare('SELECT user_id FROM bans WHERE user_id = ?').get(target.id);
    if (existing) {
      return interaction.reply({ content: `${target.username} is already banned.`, ephemeral: true });
    }

    db.prepare('INSERT INTO bans (user_id, reason, banned_by) VALUES (?, ?, ?)')
      .run(target.id, reason, interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('User Banned')
      .setDescription(`**${target.username}** has been banned from the casino.`)
      .setColor(0xe74c3c)
      .addFields({ name: 'Reason', value: reason, inline: false })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'unban') {
    const target = interaction.options.getUser('user');
    const result = db.prepare('DELETE FROM bans WHERE user_id = ?').run(target.id);

    if (result.changes === 0) {
      return interaction.reply({ content: `${target.username} is not banned.`, ephemeral: true });
    }

    return interaction.reply({ content: `**${target.username}** has been unbanned.` });
  }

  if (sub === 'balance') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'admin adjustment';

    ensureWallet(target.id);

    try {
      const newBalance = updateBalance(target.id, amount, `admin: ${reason}`);
      const sign = amount >= 0 ? '+' : '';

      const embed = new EmbedBuilder()
        .setTitle('Balance Adjusted')
        .setDescription(`**${target.username}**'s balance adjusted by **${sign}${amount}**`)
        .setColor(0xf1c40f)
        .addFields(
          { name: 'New Balance', value: `${newBalance}`, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return interaction.reply({
          content: `Cannot subtract ${Math.abs(amount)} — user only has ${getBalance(target.id)} coins.`,
          ephemeral: true,
        });
      }
      throw error;
    }
  }

  if (sub === 'promo') {
    const code = interaction.options.getString('code').toUpperCase();
    const amount = interaction.options.getInteger('amount');
    const maxUses = interaction.options.getInteger('max_uses') || 1;
    const expires = interaction.options.getString('expires') || null;

    const existing = db.prepare('SELECT code FROM promo_codes WHERE code = ?').get(code);
    if (existing) {
      return interaction.reply({ content: `Promo code **${code}** already exists.`, ephemeral: true });
    }

    db.prepare(
      'INSERT INTO promo_codes (code, amount, max_uses, expires_at, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(code, amount, maxUses, expires, interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('Promo Code Created')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Code', value: `\`${code}\``, inline: true },
        { name: 'Amount', value: `${amount} coins`, inline: true },
        { name: 'Max Uses', value: `${maxUses}`, inline: true },
        { name: 'Expires', value: expires || 'Never', inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
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
        { name: 'Total Balance (all users)', value: `${totalBalance}`, inline: true },
        { name: 'Total Games Played', value: `${totalGames}`, inline: true },
        { name: 'Total Wagered', value: `${totalWagered}`, inline: true },
        { name: 'Total Payouts', value: `${totalPayout}`, inline: true },
        { name: 'House Profit', value: `${houseProfit}`, inline: true },
        { name: 'Pending Withdrawals', value: `${pendingWithdrawals.count} (${pendingWithdrawals.total} coins)`, inline: false }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'approve') {
    const requestId = interaction.options.getInteger('id');

    const request = db.prepare('SELECT * FROM withdraw_requests WHERE id = ? AND status = ?')
      .get(requestId, 'pending');

    if (!request) {
      return interaction.reply({ content: `No pending withdrawal request with ID ${requestId}.`, ephemeral: true });
    }

    db.prepare('UPDATE withdraw_requests SET status = ?, reviewed_by = ?, updated_at = ? WHERE id = ?')
      .run('approved', interaction.user.id, new Date().toISOString(), requestId);

    const embed = new EmbedBuilder()
      .setTitle('Withdrawal Approved')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Request ID', value: `${requestId}`, inline: true },
        { name: 'User', value: `<@${request.user_id}>`, inline: true },
        { name: 'Amount', value: `${request.amount}`, inline: true },
        { name: 'Chain', value: request.chain, inline: true },
        { name: 'Address', value: `\`${request.address}\``, inline: false }
      )
      .setFooter({ text: 'Blockchain transaction must be sent manually or via automation.' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
