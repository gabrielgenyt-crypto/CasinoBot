const db = require('./database');

/**
 * In-memory token bucket rate limiter. Each user gets a bucket per command
 * that refills over time. This prevents spam without requiring Redis.
 *
 * Default: 5 uses per 60 seconds per command per user.
 */

// Map<string, { tokens: number, lastRefill: number }>
// Key format: "userId:command"
const buckets = new Map();

// Default rate limit configuration. Can be overridden per command.
const DEFAULT_CONFIG = {
  maxTokens: 5,
  refillRate: 5,       // tokens per interval
  refillInterval: 60,  // seconds
};

// Per-command overrides (stricter limits for expensive operations).
const COMMAND_LIMITS = {
  withdraw: { maxTokens: 2, refillRate: 2, refillInterval: 300 },
  tip: { maxTokens: 3, refillRate: 3, refillInterval: 60 },
  claim: { maxTokens: 1, refillRate: 1, refillInterval: 60 },
};

/**
 * Gets the rate limit config for a command.
 * @param {string} command - The command name.
 * @returns {object} The rate limit config.
 */
const getConfig = (command) => COMMAND_LIMITS[command] || DEFAULT_CONFIG;

/**
 * Checks if a user is rate-limited for a command. If not, consumes a token.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} command - The command name.
 * @returns {{ limited: boolean, retryAfter: number }} retryAfter in seconds.
 */
const checkRateLimit = (userId, command) => {
  const key = `${userId}:${command}`;
  const config = getConfig(command);
  const now = Date.now() / 1000;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time.
  const elapsed = now - bucket.lastRefill;
  const refillAmount = Math.floor(elapsed / config.refillInterval) * config.refillRate;
  if (refillAmount > 0) {
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    // Calculate when the next token will be available.
    const nextRefill = config.refillInterval - (elapsed % config.refillInterval);
    return { limited: true, retryAfter: Math.ceil(nextRefill) };
  }

  bucket.tokens--;
  return { limited: false, retryAfter: 0 };
};

/**
 * Checks if a user is banned from the casino.
 * @param {string} userId - The Discord user ID.
 * @returns {{ banned: boolean, reason: string|null }}
 */
const checkBan = (userId) => {
  const ban = db.prepare('SELECT reason FROM bans WHERE user_id = ?').get(userId);
  return { banned: !!ban, reason: ban ? ban.reason : null };
};

/**
 * Checks if a user is self-excluded.
 * @param {string} userId - The Discord user ID.
 * @returns {{ excluded: boolean, until: string|null, permanent: boolean }}
 */
const checkExclusion = (userId) => {
  const exclusion = db.prepare('SELECT * FROM self_exclusions WHERE user_id = ?').get(userId);
  if (!exclusion) return { excluded: false, until: null, permanent: false };

  if (exclusion.permanent) return { excluded: true, until: null, permanent: true };

  if (exclusion.excluded_until && new Date(exclusion.excluded_until) > new Date()) {
    return { excluded: true, until: exclusion.excluded_until, permanent: false };
  }

  // Exclusion has expired -- remove it.
  db.prepare('DELETE FROM self_exclusions WHERE user_id = ?').run(userId);
  return { excluded: false, until: null, permanent: false };
};

/**
 * Runs all pre-command checks (ban, exclusion, rate limit).
 * Returns an error message string if blocked, or null if the command can proceed.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} command - The command name.
 * @returns {string|null} Error message or null.
 */
const runChecks = (userId, command) => {
  // Admin commands bypass all checks.
  if (command === 'admin') return null;

  const ban = checkBan(userId);
  if (ban.banned) {
    return `You are banned from the casino. Reason: ${ban.reason || 'No reason provided'}`;
  }

  // Info commands bypass exclusion and rate limits.
  const infoCommands = ['balance', 'stats', 'history', 'leaderboard', 'fairness', 'vip'];
  if (infoCommands.includes(command)) return null;

  const exclusion = checkExclusion(userId);
  if (exclusion.excluded) {
    if (exclusion.permanent) {
      return 'You have permanently self-excluded from the casino.';
    }
    return `You are self-excluded until ${exclusion.until}. Use /exclude to manage.`;
  }

  const rateLimit = checkRateLimit(userId, command);
  if (rateLimit.limited) {
    return `Slow down! Try again in ${rateLimit.retryAfter} second(s).`;
  }

  return null;
};

// Periodically clean up stale buckets (every 5 minutes).
setInterval(() => {
  const now = Date.now() / 1000;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 600) {
      buckets.delete(key);
    }
  }
}, 300000);

module.exports = { checkRateLimit, checkBan, checkExclusion, runChecks };
