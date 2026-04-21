const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const { getReferralRecord, applyReferral, REFERRAL_BONUS } = require('../utils/referral');

const data = new SlashCommandBuilder()
  .setName('referral')
  .setDescription('View your referral code or use someone else\'s.')
  .addSubcommand((sub) =>
    sub.setName('code').setDescription('Get your unique referral code to share.')
  )
  .addSubcommand((sub) =>
    sub
      .setName('use')
      .setDescription('Apply a referral code (one-time, for new users).')
      .addStringOption((opt) =>
        opt.setName('code').setDescription('The referral code').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('info').setDescription('View your referral stats.')
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);
  const sub = interaction.options.getSubcommand();

  if (sub === 'code') {
    const record = getReferralRecord(userId);

    const embed = new EmbedBuilder()
      .setTitle('Your Referral Code')
      .setDescription(
        'Share this code with friends:\n\n' +
        `**\`${record.referral_code}\`**\n\n` +
        `They use \`/referral use ${record.referral_code}\` and you earn **${REFERRAL_BONUS}** coins per referral!`
      )
      .setColor(0x3498db);

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'use') {
    const code = interaction.options.getString('code').toUpperCase();
    const result = applyReferral(userId, code);

    if (!result) {
      return interaction.reply({
        content: 'Invalid code, already used a referral, or you cannot refer yourself.',
        ephemeral: true,
      });
    }

    // Credit the referrer.
    updateBalance(result.referrerId, result.bonus, 'referral bonus');

    // Also give the new user a small welcome bonus.
    const welcomeBonus = Math.floor(result.bonus / 2);
    updateBalance(userId, welcomeBonus, 'referral welcome bonus');

    const embed = new EmbedBuilder()
      .setTitle('Referral Applied!')
      .setDescription(
        `You used <@${result.referrerId}>'s referral code.\n` +
        `You received **${welcomeBonus}** coins as a welcome bonus!\n` +
        `Your referrer received **${result.bonus}** coins.`
      )
      .setColor(0x2ecc71);

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'info') {
    const record = getReferralRecord(userId);

    const embed = new EmbedBuilder()
      .setTitle('Referral Stats')
      .setColor(0x9b59b6)
      .addFields(
        { name: 'Your Code', value: `\`${record.referral_code}\``, inline: true },
        { name: 'Referrals', value: `${record.referral_count}`, inline: true },
        { name: 'Earnings', value: `${record.referral_earnings} coins`, inline: true },
        { name: 'Referred By', value: record.referred_by ? `<@${record.referred_by}>` : 'None', inline: true }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

module.exports = { data, execute };
