const db = require('./database');

/**
 * Immutable audit log for all sensitive actions. Every entry records
 * who did what, when, and from where. Rows are append-only -- no
 * UPDATE or DELETE should ever be run on this table.
 */

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action);
`;
db.exec(INIT_SQL);

/**
 * Known audit actions for type safety and consistency.
 */
const ACTIONS = {
  // Auth & session.
  LOGIN: 'login',
  NEW_IP: 'new_ip',

  // Financial.
  DEPOSIT: 'deposit',
  WITHDRAW_REQUEST: 'withdraw_request',
  WITHDRAW_APPROVED: 'withdraw_approved',
  WITHDRAW_REJECTED: 'withdraw_rejected',
  BALANCE_ADJUST: 'balance_adjust',
  TIP_SENT: 'tip_sent',
  TIP_RECEIVED: 'tip_received',

  // Admin.
  BAN: 'ban',
  UNBAN: 'unban',
  PROMO_CREATED: 'promo_created',
  PROMO_CLAIMED: 'promo_claimed',

  // Security.
  SEED_ROTATED: 'seed_rotated',
  CLIENT_SEED_CHANGED: 'client_seed_changed',
  SELF_EXCLUDE: 'self_exclude',
  ADDRESS_WHITELISTED: 'address_whitelisted',

  // Game.
  BIG_WIN: 'big_win',
};

/**
 * Writes an immutable audit log entry.
 *
 * @param {string} userId - The user who performed the action.
 * @param {string} action - The action type (use ACTIONS constants).
 * @param {object} [options] - Additional options.
 * @param {string} [options.targetId] - The target user ID (for admin actions).
 * @param {string} [options.details] - JSON string or description of the action.
 * @param {string} [options.ip] - The IP address (for web/API actions).
 */
const log = (userId, action, options = {}) => {
  const { targetId, details, ip } = options;
  db.prepare(
    'INSERT INTO audit_log (user_id, action, target_id, details, ip) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, action, targetId || null, details || null, ip || null);
};

/**
 * Retrieves recent audit log entries, optionally filtered.
 *
 * @param {object} [filters] - Optional filters.
 * @param {string} [filters.userId] - Filter by user ID.
 * @param {string} [filters.action] - Filter by action type.
 * @param {number} [filters.limit] - Max entries to return (default 50).
 * @returns {Array<object>}
 */
const getEntries = (filters = {}) => {
  const { userId, action, limit = 50 } = filters;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];

  if (userId) {
    sql += ' AND (user_id = ? OR target_id = ?)';
    params.push(userId, userId);
  }
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
};

module.exports = { log, getEntries, ACTIONS };
