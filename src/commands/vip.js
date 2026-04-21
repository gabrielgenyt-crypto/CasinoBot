const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const {
  VIP_LEVELS,
  getVipRecord,
  getLevelForWagered,
  claimCashback,
} = require('../utils/vip');

const data = new SlashCommandBuilder()
  .setName('vip')
  .setDescription('View your VIP status or claim cashback.')
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('View your current VIP level and progress.')
  )
  .addSubcommand((sub) =>
    sub.setName('cashback').setDescription('Claim your VIP cashback on losses.')
  )
  .addSubcommand((sub) =>
    sub.setName('levels').setDescription('View all VIP levels and their benefits.')
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);
  const sub = interaction.options.getSubcommand();

  if (sub === 'status') {
    const record = getVipRecord(userId);
    const currentLevel = getLevelForWagered(record.total_wagered);
    const nextLevel = VIP_LEVELS[currentLevel.level + 1];

    const embed = new EmbedBuilder()
      .setTitle(`VIP Status — ${interaction.user.username}`)
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

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'cashback') {
    const result = claimCashback(userId);

    if (!result) {
      return interaction.reply({
        content: 'No cashback available. You need VIP status and net losses since your last claim.',
        ephemeral: true,
      });
    }

    const newBalance = updateBalance(userId, result.amount, 'vip cashback');

    const embed = new EmbedBuilder()
      .setTitle('VIP Cashback Claimed')
      .setDescription(`Received **${result.amount}** coins cashback (${(result.level.cashbackRate * 100).toFixed(1)}% rate)`)
      .setColor(0x2ecc71)
      .addFields({ name: 'New Balance', value: `${newBalance}`, inline: true })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
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

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
