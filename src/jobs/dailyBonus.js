const cron = require('node-cron');
const db = require('../utils/database');
const { fetchPrices } = require('../utils/priceService');
const { processAutoWithdrawals } = require('../services/withdrawProcessor');

/**
 * Starts all scheduled cron jobs. Called once when the bot is ready.
 * @param {import('discord.js').Client} client - The Discord.js client.
 */
const startCronJobs = (client) => {
  // Midnight UTC: clean expired daily claim records.
  cron.schedule('0 0 * * *', () => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const result = db
      .prepare('DELETE FROM daily_claims WHERE last_claim < ?')
      .run(cutoff);
    console.log(`[CRON] Cleaned ${result.changes} expired daily claim(s).`);
  }, { timezone: 'UTC' });

  // Midnight UTC: clean expired self-exclusions.
  cron.schedule('0 0 * * *', () => {
    const now = new Date().toISOString();
    const result = db
      .prepare('DELETE FROM self_exclusions WHERE permanent = 0 AND excluded_until < ?')
      .run(now);
    if (result.changes > 0) {
      console.log(`[CRON] Removed ${result.changes} expired self-exclusion(s).`);
    }
  }, { timezone: 'UTC' });

  // Every 5 minutes: warm the price cache.
  cron.schedule('*/5 * * * *', async () => {
    try {
      await fetchPrices();
    } catch (error) {
      console.warn('[CRON] Price cache warm failed:', error.message);
    }
  });

  // Weekly (Sunday midnight): clean old rate limit entries and stale audit logs.
  cron.schedule('0 0 * * 0', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM rate_limits WHERE used_at < ?').run(thirtyDaysAgo);

    // Keep audit logs for 90 days.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const auditResult = db.prepare('DELETE FROM audit_log WHERE created_at < ?').run(ninetyDaysAgo);
    if (auditResult.changes > 0) {
      console.log(`[CRON] Archived ${auditResult.changes} old audit log entries.`);
    }
  }, { timezone: 'UTC' });

  // Every 2 minutes: process auto-withdrawals for small amounts.
  cron.schedule('*/2 * * * *', async () => {
    try {
      await processAutoWithdrawals(client);
    } catch (error) {
      console.warn('[CRON] Auto-withdrawal processing failed:', error.message);
    }
  });

  console.log('[CRON] All scheduled jobs registered.');
};

module.exports = { startCronJobs };
