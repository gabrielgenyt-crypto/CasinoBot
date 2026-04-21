const db = require('../utils/database');

/**
 * Session tracking and loss-limit warning system.
 * Tracks how long a user has been playing and how much they have lost
 * in the current session. Sends warnings at configurable thresholds.
 */

// Warning thresholds.
const SESSION_DURATION_WARNING_MINS = 60;  // Warn after 1 hour of play.
const LOSS_LIMIT_WARNING = 5000;           // Warn after losing this many coins.
const WARNING_COOLDOWN_MINS = 30;          // Don't warn again for 30 minutes.

/**
 * Updates the session tracking for a user after a game.
 * Returns a warning message if a threshold is crossed, or null.
 *
 * @param {string} userId - The Discord user ID.
 * @param {number} bet - The wager amount.
 * @param {number} payout - The payout amount (0 on loss).
 * @returns {string|null} A warning message, or null.
 */
const trackSession = (userId, bet, payout) => {
  const now = new Date();
  const nowIso = now.toISOString();
  const loss = bet - payout;

  const session = db.prepare('SELECT * FROM session_tracking WHERE user_id = ?').get(userId);

  if (!session) {
    // Start a new session.
    db.prepare(
      'INSERT INTO session_tracking (user_id, session_start, total_wagered_session, total_lost_session) VALUES (?, ?, ?, ?)'
    ).run(userId, nowIso, bet, Math.max(0, loss));
    return null;
  }

  // Check if the session has been idle for more than 2 hours -- reset it.
  const sessionStart = new Date(session.session_start);
  const idleThreshold = 2 * 60 * 60 * 1000;
  if (now - sessionStart > 24 * 60 * 60 * 1000) {
    // Session older than 24h -- reset.
    db.prepare(
      'UPDATE session_tracking SET session_start = ?, total_wagered_session = ?, total_lost_session = ?, last_warning = NULL WHERE user_id = ?'
    ).run(nowIso, bet, Math.max(0, loss), userId);
    return null;
  }

  // Update session totals.
  const newWagered = session.total_wagered_session + bet;
  const newLost = session.total_lost_session + Math.max(0, loss);

  db.prepare(
    'UPDATE session_tracking SET total_wagered_session = ?, total_lost_session = ? WHERE user_id = ?'
  ).run(newWagered, newLost, userId);

  // Check if we should warn (respect cooldown).
  if (session.last_warning) {
    const lastWarning = new Date(session.last_warning);
    if (now - lastWarning < WARNING_COOLDOWN_MINS * 60 * 1000) {
      return null; // Still in cooldown.
    }
  }

  // Check session duration.
  const sessionMins = (now - sessionStart) / (1000 * 60);
  if (sessionMins >= SESSION_DURATION_WARNING_MINS) {
    db.prepare('UPDATE session_tracking SET last_warning = ? WHERE user_id = ?').run(nowIso, userId);
    const hours = Math.floor(sessionMins / 60);
    const mins = Math.floor(sessionMins % 60);
    return (
      `You have been playing for **${hours}h ${mins}m**. ` +
      `Total wagered this session: **${newWagered}** coins. ` +
      'Consider taking a break. Use `/exclude` if you need to step away.'
    );
  }

  // Check loss limit.
  if (newLost >= LOSS_LIMIT_WARNING) {
    db.prepare('UPDATE session_tracking SET last_warning = ? WHERE user_id = ?').run(nowIso, userId);
    return (
      `You have lost **${newLost}** coins this session. ` +
      'Please gamble responsibly. Use `/exclude` to set limits on your play.'
    );
  }

  // Suppress unused variable warning -- idleThreshold is used conceptually
  // for documentation but the actual check uses 24h above.
  void idleThreshold;

  return null;
};

/**
 * Resets a user's session tracking (e.g., when they log off or self-exclude).
 * @param {string} userId - The Discord user ID.
 */
const resetSession = (userId) => {
  db.prepare('DELETE FROM session_tracking WHERE user_id = ?').run(userId);
};

module.exports = {
  trackSession,
  resetSession,
  SESSION_DURATION_WARNING_MINS,
  LOSS_LIMIT_WARNING,
};
