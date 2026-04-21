const crypto = require('crypto');
const db = require('./database');

/**
 * Generates a cryptographically random server seed.
 * @returns {string} A 32-byte hex-encoded seed.
 */
const generateServerSeed = () => crypto.randomBytes(32).toString('hex');

/**
 * Hashes a server seed with SHA-256 so it can be shared with the user
 * before the game without revealing the actual seed.
 * @param {string} serverSeed - The raw server seed.
 * @returns {string} The SHA-256 hash of the seed.
 */
const hashServerSeed = (serverSeed) =>
  crypto.createHash('sha256').update(serverSeed).digest('hex');

/**
 * Produces a deterministic float in [0, 1) from the combined seed inputs.
 * Uses HMAC-SHA256 to ensure the result is unpredictable without the server seed.
 *
 * @param {string} serverSeed - The secret server seed.
 * @param {string} clientSeed - The user-provided client seed.
 * @param {number} nonce - An incrementing counter per seed pair.
 * @returns {number} A float between 0 (inclusive) and 1 (exclusive).
 */
const generateResult = (serverSeed, clientSeed, nonce) => {
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');

  // Use the first 8 hex characters (32 bits) to derive a float.
  return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
};

/**
 * Retrieves (or creates) the seed record for a user and returns the next
 * game result. Automatically increments the nonce after each call.
 *
 * @param {string} userId - The Discord user ID.
 * @returns {{ result: number, nonce: number, serverSeedHash: string }}
 */
const getNextResult = (userId) => {
  let seed = db.prepare('SELECT * FROM seeds WHERE user_id = ?').get(userId);

  if (!seed) {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    db.prepare(
      'INSERT INTO seeds (user_id, server_seed, client_seed, nonce, server_seed_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, serverSeed, 'default', 0, serverSeedHash);
    seed = db.prepare('SELECT * FROM seeds WHERE user_id = ?').get(userId);
  }

  const result = generateResult(seed.server_seed, seed.client_seed, seed.nonce);
  const nonce = seed.nonce;

  // Increment the nonce for the next game.
  db.prepare('UPDATE seeds SET nonce = nonce + 1 WHERE user_id = ?').run(userId);

  return {
    result,
    nonce,
    serverSeedHash: seed.server_seed_hash,
  };
};

/**
 * Rotates the server seed for a user. Returns the old server seed so the
 * user can verify past results, and provides the hash of the new seed.
 *
 * @param {string} userId - The Discord user ID.
 * @returns {{ oldServerSeed: string, newServerSeedHash: string }}
 */
const rotateSeed = (userId) => {
  const current = db.prepare('SELECT server_seed FROM seeds WHERE user_id = ?').get(userId);
  const oldServerSeed = current ? current.server_seed : null;

  const newServerSeed = generateServerSeed();
  const newServerSeedHash = hashServerSeed(newServerSeed);

  db.prepare(
    'INSERT INTO seeds (user_id, server_seed, client_seed, nonce, server_seed_hash) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET server_seed = ?, client_seed = \'default\', nonce = 0, server_seed_hash = ?'
  ).run(userId, newServerSeed, 'default', 0, newServerSeedHash, newServerSeed, newServerSeedHash);

  return { oldServerSeed, newServerSeedHash };
};

/**
 * Allows a user to set their own client seed for additional fairness control.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} clientSeed - The new client seed.
 */
const setClientSeed = (userId, clientSeed) => {
  // Ensure a seed record exists first.
  getNextResult(userId);
  db.prepare('UPDATE seeds SET client_seed = ? WHERE user_id = ?').run(clientSeed, userId);
};

module.exports = {
  generateServerSeed,
  hashServerSeed,
  generateResult,
  getNextResult,
  rotateSeed,
  setClientSeed,
};
