const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const {
  VIP_LEVELS,
  getVipRecord,
  getLevelForWagered,
  claimCashback,
} = require('../utils/vip');
const { COLORS } = require('../utils/animations');
const { renderVip } = require('../utils/cardRenderer');
const { formatAmount, formatBalance } = require('../utils/formatAmount');

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

    const progress = nextLevel
      ? record.total_wagered / nextLevel.threshold
      : 1;

    const pngBuffer = renderVip({
      playerName: interaction.user.username,
      levelName: currentLevel.name,
      levelNum: currentLevel.level,
      totalWagered: record.total_wagered,
      cashbackRate: (currentLevel.cashbackRate * 100).toFixed(1),
      nextLevelName: nextLevel ? nextLevel.name : null,
      progress,
    });
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'vip.png' });

    const embed = new EmbedBuilder()
      .setTitle(`VIP Status — ${interaction.user.username}`)
      .setColor(COLORS.vip)
      .setImage('attachment://vip.png')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], files: [attachment] });
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
      .setDescription(`Received **${formatAmount(result.amount)}** cashback (${(result.level.cashbackRate * 100).toFixed(1)}% rate)`)
      .setColor(COLORS.win)
      .addFields({ name: 'New Balance', value: `\`${formatBalance(newBalance)}\``, inline: true })
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
      .setColor(COLORS.vip)
      .setFooter({ text: 'Level up automatically by wagering more!' });

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
