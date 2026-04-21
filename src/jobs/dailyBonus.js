const cron = require('node-cron');
const db = require('../utils/database');

/**
 * Starts scheduled cron jobs. Called once when the bot is ready.
 * @param {import('discord.js').Client} _client - The Discord.js client.
 */
const startCronJobs = (_client) => {
  // Run every day at midnight UTC: clear expired daily claim records
  // so users don't accumulate stale rows forever.
  cron.schedule('0 0 * * *', () => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const result = db
      .prepare('DELETE FROM daily_claims WHERE last_claim < ?')
      .run(cutoff);
    console.log(`[CRON] Cleaned ${result.changes} expired daily claim(s).`);
  }, {
    timezone: 'UTC',
  });

  console.log('[CRON] Daily cleanup job scheduled (midnight UTC).');
};

module.exports = { startCronJobs };
