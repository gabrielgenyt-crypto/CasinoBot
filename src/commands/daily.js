const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { updateBalance, ensureWallet } = require('../utils/wallet');

const name = 'daily';
const aliases = ['faucet'];
const description = 'Claim your daily bonus. Usage: =daily';

const DAILY_AMOUNT = 500;
const COOLDOWN_HOURS = 24;

async function execute(message) {
  const userId = message.author.id;
  ensureWallet(userId);

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

  const newBalance = updateBalance(userId, DAILY_AMOUNT, 'daily bonus');

  const embed = new EmbedBuilder()
    .setTitle('Daily Bonus')
    .setDescription(`**${message.author.username}** claimed **${DAILY_AMOUNT}** coins!`)
    .setColor(0x2ecc71)
    .addFields({ name: 'New Balance', value: `${newBalance}`, inline: true })
    .setTimestamp();

  return message.reply({ embeds: [embed] });
}

module.exports = { name, aliases, description, execute };
