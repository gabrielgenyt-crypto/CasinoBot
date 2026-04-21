const crypto = require('crypto');
const db = require('./database');

// Referral bonus: the referrer gets this amount when someone uses their code.
const REFERRAL_BONUS = 250;

/**
 * Generates a short unique referral code for a user.
 * @returns {string} An 8-character alphanumeric code.
 */
const generateCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

/**
 * Gets or creates a referral record for a user, returning their unique code.
 * @param {string} userId - The Discord user ID.
 * @returns {{ referral_code: string, referred_by: string|null, referral_count: number, referral_earnings: number }}
 */
const getReferralRecord = (userId) => {
  let record = db.prepare('SELECT * FROM referrals WHERE user_id = ?').get(userId);
  if (!record) {
    const code = generateCode();
    db.prepare(
      'INSERT INTO referrals (user_id, referral_code) VALUES (?, ?)'
    ).run(userId, code);
    record = db.prepare('SELECT * FROM referrals WHERE user_id = ?').get(userId);
  }
  return record;
};

/**
 * Applies a referral code for a new user. The referrer receives a bonus.
 * Returns null if the code is invalid or the user already used a referral.
 *
 * @param {string} userId - The new user's Discord ID.
 * @param {string} code - The referral code to apply.
 * @returns {{ referrerId: string, bonus: number } | null}
 */
const applyReferral = (userId, code) => {
  // Check if the user already has a referral.
  const existing = db.prepare('SELECT referred_by FROM referrals WHERE user_id = ?').get(userId);
  if (existing && existing.referred_by) return null;

  // Find the referrer by code.
  const referrer = db.prepare('SELECT user_id FROM referrals WHERE referral_code = ?').get(code);
  if (!referrer) return null;

  // Cannot refer yourself.
  if (referrer.user_id === userId) return null;

  // Ensure the new user has a referral record.
  getReferralRecord(userId);

  // Update the new user's referred_by.
  db.prepare('UPDATE referrals SET referred_by = ? WHERE user_id = ?')
    .run(referrer.user_id, userId);

  // Credit the referrer and increment their count.
  db.prepare(
    'UPDATE referrals SET referral_count = referral_count + 1, referral_earnings = referral_earnings + ? WHERE user_id = ?'
  ).run(REFERRAL_BONUS, referrer.user_id);

  return { referrerId: referrer.user_id, bonus: REFERRAL_BONUS };
};

module.exports = { getReferralRecord, applyReferral, REFERRAL_BONUS };
