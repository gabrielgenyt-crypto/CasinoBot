const db = require('./database');

/**
 * VIP level thresholds (total wagered) and their benefits.
 * Level 0 = no VIP. Levels 1-5 correspond to Bronze through Diamond.
 */
const VIP_LEVELS = [
  { level: 0, name: 'None', threshold: 0, cashbackRate: 0, roleName: null },
  { level: 1, name: 'Bronze', threshold: 10000, cashbackRate: 0.005, roleName: 'VIP Bronze' },
  { level: 2, name: 'Silver', threshold: 50000, cashbackRate: 0.01, roleName: 'VIP Silver' },
  { level: 3, name: 'Gold', threshold: 200000, cashbackRate: 0.015, roleName: 'VIP Gold' },
  { level: 4, name: 'Platinum', threshold: 1000000, cashbackRate: 0.02, roleName: 'VIP Platinum' },
  { level: 5, name: 'Diamond', threshold: 5000000, cashbackRate: 0.03, roleName: 'VIP Diamond' },
];

/**
 * Returns the VIP level info for a given total wagered amount.
 * @param {number} totalWagered - The user's total wagered amount.
 * @returns {object} The VIP level object.
 */
const getLevelForWagered = (totalWagered) => {
  let result = VIP_LEVELS[0];
  for (const level of VIP_LEVELS) {
    if (totalWagered >= level.threshold) {
      result = level;
    }
  }
  return result;
};

/**
 * Retrieves or creates the VIP record for a user.
 * @param {string} userId - The Discord user ID.
 * @returns {{ user_id: string, level: number, total_wagered: number, cashback_claimed: string|null }}
 */
const getVipRecord = (userId) => {
  let record = db.prepare('SELECT * FROM vip WHERE user_id = ?').get(userId);
  if (!record) {
    db.prepare('INSERT INTO vip (user_id, level, total_wagered) VALUES (?, 0, 0)').run(userId);
    record = db.prepare('SELECT * FROM vip WHERE user_id = ?').get(userId);
  }
  return record;
};

/**
 * Adds to a user's total wagered amount and recalculates their VIP level.
 * Returns the new level if it changed, or null if unchanged.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} wagered - The amount wagered in this game.
 * @returns {{ newLevel: object|null, totalWagered: number, currentLevel: object }}
 */
const addWagered = (userId, wagered) => {
  const record = getVipRecord(userId);
  const newTotal = record.total_wagered + wagered;
  const oldLevelInfo = getLevelForWagered(record.total_wagered);
  const newLevelInfo = getLevelForWagered(newTotal);

  db.prepare('UPDATE vip SET total_wagered = ?, level = ? WHERE user_id = ?')
    .run(newTotal, newLevelInfo.level, userId);

  return {
    newLevel: newLevelInfo.level > oldLevelInfo.level ? newLevelInfo : null,
    totalWagered: newTotal,
    currentLevel: newLevelInfo,
  };
};

/**
 * Calculates and claims cashback for a user based on their losses since
 * the last claim. Cashback rate depends on VIP level.
 *
 * @param {string} userId - The Discord user ID.
 * @returns {{ amount: number, level: object } | null} Null if no cashback available.
 */
const claimCashback = (userId) => {
  const record = getVipRecord(userId);
  const levelInfo = getLevelForWagered(record.total_wagered);

  if (levelInfo.cashbackRate <= 0) return null;

  // Calculate net losses since last cashback claim.
  const lastClaim = record.cashback_claimed || '1970-01-01T00:00:00.000Z';
  const stats = db.prepare(
    'SELECT COALESCE(SUM(bet), 0) as wagered, COALESCE(SUM(payout), 0) as earned FROM game_history WHERE user_id = ? AND created_at > ?'
  ).get(userId, lastClaim);

  const netLoss = stats.wagered - stats.earned;
  if (netLoss <= 0) return null;

  const cashbackAmount = Math.floor(netLoss * levelInfo.cashbackRate);
  if (cashbackAmount <= 0) return null;

  // Mark as claimed.
  db.prepare('UPDATE vip SET cashback_claimed = ? WHERE user_id = ?')
    .run(new Date().toISOString(), userId);

  return { amount: cashbackAmount, level: levelInfo };
};

/**
 * Returns the VIP level info object for a given level number.
 * @param {number} level - The VIP level (0-5).
 * @returns {object}
 */
const getVipLevelInfo = (level) => VIP_LEVELS[level] || VIP_LEVELS[0];

module.exports = {
  VIP_LEVELS,
  getLevelForWagered,
  getVipRecord,
  addWagered,
  claimCashback,
  getVipLevelInfo,
};
