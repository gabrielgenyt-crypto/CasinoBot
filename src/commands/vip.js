const { EmbedBuilder } = require('discord.js');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const {
  VIP_LEVELS,
  getVipRecord,
  getLevelForWagered,
  claimCashback,
} = require('../utils/vip');

const name = 'vip';
const aliases = [];
const description = 'VIP system. Usage: =vip <status|cashback|levels>';

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);
  const sub = (args[0] || 'status').toLowerCase();

  if (sub === 'status') {
    const record = getVipRecord(userId);
    const currentLevel = getLevelForWagered(record.total_wagered);
    const nextLevel = VIP_LEVELS[currentLevel.level + 1];

    const embed = new EmbedBuilder()
      .setTitle(`VIP Status — ${message.author.username}`)
      .setColor(currentLevel.level >= 4 ? 0xe91e63 : currentLevel.level >= 2 ? 0xf1c40f : 0x95a5a6)
      .addFields(
        { name: 'Level', value: `**${currentLevel.name}** (Tier ${currentLevel.level})`, inline: true },
        { name: 'Total Wagered', value: `${record.total_wagered}`, inline: true },
        { name: 'Cashback Rate', value: `${(currentLevel.cashbackRate * 100).toFixed(1)}%`, inline: true }
      );

    if (nextLevel) {
      const remaining = nextLevel.threshold - record.total_wagered;
      const progress = ((record.total_wagered / nextLevel.threshold) * 100).toFixed(1);
      embed.addFields({
        name: `Next: ${nextLevel.name}`,
        value: `${remaining} more wagered needed (${progress}% progress)`,
        inline: false,
      });
    } else {
      embed.addFields({ name: 'Status', value: 'Maximum VIP level reached!', inline: false });
    }

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'cashback') {
    const result = claimCashback(userId);
    if (!result) {
      return message.reply('No cashback available. You need VIP status and net losses since your last claim.');
    }

    const newBalance = updateBalance(userId, result.amount, 'vip cashback');

    const embed = new EmbedBuilder()
      .setTitle('VIP Cashback Claimed')
      .setDescription(`Received **${result.amount}** coins cashback (${(result.level.cashbackRate * 100).toFixed(1)}% rate)`)
      .setColor(0x2ecc71)
      .addFields({ name: 'New Balance', value: `${newBalance}`, inline: true })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'levels') {
    const lines = VIP_LEVELS.filter((l) => l.level > 0).map((l) =>
      `**Tier ${l.level} — ${l.name}**\nWager: ${l.threshold.toLocaleString()} | Cashback: ${(l.cashbackRate * 100).toFixed(1)}%`
    );

    const embed = new EmbedBuilder()
      .setTitle('VIP Levels')
      .setDescription(lines.join('\n\n'))
      .setColor(0xe91e63)
      .setFooter({ text: 'Level up automatically by wagering more!' });

    return message.reply({ embeds: [embed] });
  }

  return message.reply('Usage: `=vip <status|cashback|levels>`');
}

module.exports = { name, aliases, description, execute };
