const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { ensureWallet, updateBalance } = require('../utils/wallet');

const name = 'claim';
const aliases = ['promo', 'redeem'];
const description = 'Claim a promo code or daily faucet. Usage: =claim <promo|faucet> [code]';

const DAILY_AMOUNT = 500;
const COOLDOWN_HOURS = 24;

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  const sub = (args[0] || '').toLowerCase();

  if (sub === 'promo' || sub === 'redeem') {
    const code = (args[1] || '').toUpperCase();
    if (!code) {
      return message.reply('Usage: `=claim promo <code>`');
    }

    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code);
    if (!promo) {
      return message.reply('Invalid promo code.');
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return message.reply('This promo code has expired.');
    }
    if (promo.uses >= promo.max_uses) {
      return message.reply('This promo code has been fully redeemed.');
    }

    const claimed = db.prepare('SELECT id FROM promo_claims WHERE user_id = ? AND code = ?').get(userId, code);
    if (claimed) {
      return message.reply('You already claimed this promo code.');
    }

    db.prepare('INSERT INTO promo_claims (user_id, code) VALUES (?, ?)').run(userId, code);
    db.prepare('UPDATE promo_codes SET uses = uses + 1 WHERE code = ?').run(code);
    const newBalance = updateBalance(userId, promo.amount, `promo code: ${code}`);

    const embed = new EmbedBuilder()
      .setTitle('Promo Code Redeemed!')
      .setDescription(`You received **${promo.amount}** coins from code **${code}**`)
      .setColor(0x2ecc71)
      .addFields({ name: 'New Balance', value: `${newBalance}`, inline: true })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'faucet' || sub === 'daily' || !sub) {
    const now = new Date();
    const claim = db.prepare('SELECT last_claim FROM daily_claims WHERE user_id = ?').get(userId);
    if (claim) {
      const lastClaim = new Date(claim.last_claim);
      const hoursElapsed = (now - lastClaim) / (1000 * 60 * 60);
      if (hoursElapsed < COOLDOWN_HOURS) {
        const remaining = COOLDOWN_HOURS - hoursElapsed;
        const hours = Math.floor(remaining);
        const minutes = Math.floor((remaining - hours) * 60);
        return message.reply(`Already claimed. Come back in **${hours}h ${minutes}m**.`);
      }
    }

    db.prepare(
      'INSERT INTO daily_claims (user_id, last_claim) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_claim = ?'
    ).run(userId, now.toISOString(), now.toISOString());

    const newBalance = updateBalance(userId, DAILY_AMOUNT, 'daily faucet');

    const embed = new EmbedBuilder()
      .setTitle('Daily Faucet')
      .setDescription(`Claimed **${DAILY_AMOUNT}** coins!`)
      .setColor(0x2ecc71)
      .addFields({ name: 'New Balance', value: `${newBalance}`, inline: true })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  return message.reply('Usage: `=claim <promo|faucet> [code]`');
}

module.exports = { name, aliases, description, execute };
