const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const { ensureWallet, updateBalance } = require('../utils/wallet');

const data = new SlashCommandBuilder()
  .setName('claim')
  .setDescription('Claim a promo code or your daily faucet.')
  .addSubcommand((sub) =>
    sub
      .setName('promo')
      .setDescription('Redeem a promo code.')
      .addStringOption((opt) =>
        opt.setName('code').setDescription('The promo code').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('faucet').setDescription('Claim your daily faucet (same as /daily).')
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);
  const sub = interaction.options.getSubcommand();

  if (sub === 'promo') {
    const code = interaction.options.getString('code').toUpperCase();

    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code);
    if (!promo) {
      return interaction.reply({ content: 'Invalid promo code.', ephemeral: true });
    }

    // Check expiry.
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return interaction.reply({ content: 'This promo code has expired.', ephemeral: true });
    }

    // Check max uses.
    if (promo.uses >= promo.max_uses) {
      return interaction.reply({ content: 'This promo code has been fully redeemed.', ephemeral: true });
    }

    // Check if user already claimed.
    const claimed = db.prepare(
      'SELECT id FROM promo_claims WHERE user_id = ? AND code = ?'
    ).get(userId, code);
    if (claimed) {
      return interaction.reply({ content: 'You already claimed this promo code.', ephemeral: true });
    }

    // Claim it.
    db.prepare('INSERT INTO promo_claims (user_id, code) VALUES (?, ?)').run(userId, code);
    db.prepare('UPDATE promo_codes SET uses = uses + 1 WHERE code = ?').run(code);
    const newBalance = updateBalance(userId, promo.amount, `promo code: ${code}`);

    const embed = new EmbedBuilder()
      .setTitle('Promo Code Redeemed!')
      .setDescription(`You received **${promo.amount}** coins from code **${code}**`)
      .setColor(0x2ecc71)
      .addFields({ name: 'New Balance', value: `${newBalance}`, inline: true })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'faucet') {
    // Reuse the daily bonus logic.
    const DAILY_AMOUNT = 500;
    const COOLDOWN_HOURS = 24;
    const now = new Date();

    const claim = db.prepare('SELECT last_claim FROM daily_claims WHERE user_id = ?').get(userId);
    if (claim) {
      const lastClaim = new Date(claim.last_claim);
      const hoursElapsed = (now - lastClaim) / (1000 * 60 * 60);
      if (hoursElapsed < COOLDOWN_HOURS) {
        const remaining = COOLDOWN_HOURS - hoursElapsed;
        const hours = Math.floor(remaining);
        const minutes = Math.floor((remaining - hours) * 60);
        return interaction.reply({
          content: `Already claimed. Come back in **${hours}h ${minutes}m**.`,
          ephemeral: true,
        });
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

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
