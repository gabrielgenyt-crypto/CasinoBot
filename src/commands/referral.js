const { EmbedBuilder } = require('discord.js');
const { ensureWallet, updateBalance } = require('../utils/wallet');
const { getReferralRecord, applyReferral, REFERRAL_BONUS } = require('../utils/referral');

const name = 'referral';
const aliases = ['ref', 'invite'];
const description = 'Referral system. Usage: =referral <code|use|info> [code]';

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);
  const sub = (args[0] || 'code').toLowerCase();

  if (sub === 'code') {
    const record = getReferralRecord(userId);

    const embed = new EmbedBuilder()
      .setTitle('Your Referral Code')
      .setDescription(
        'Share this code with friends:\n\n' +
        `**\`${record.referral_code}\`**\n\n` +
        `They use \`=referral use ${record.referral_code}\` and you earn **${REFERRAL_BONUS}** coins!`
      )
      .setColor(0x3498db);

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'use') {
    const code = (args[1] || '').toUpperCase();
    if (!code) {
      return message.reply('Usage: `=referral use <code>`');
    }

    const result = applyReferral(userId, code);
    if (!result) {
      return message.reply('Invalid code, already used a referral, or you cannot refer yourself.');
    }

    updateBalance(result.referrerId, result.bonus, 'referral bonus');
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

    return message.reply({ embeds: [embed] });
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

    return message.reply({ embeds: [embed] });
  }

  return message.reply('Usage: `=referral <code|use|info> [code]`');
}

module.exports = { name, aliases, description, execute };
