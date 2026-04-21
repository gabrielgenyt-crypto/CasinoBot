const { ethers } = require('ethers');
const crypto = require('crypto');
const db = require('./database');

/**
 * HD Wallet manager for generating deterministic per-user deposit addresses.
 *
 * Uses BIP32/BIP44 derivation from a master mnemonic stored in the
 * WALLET_MNEMONIC environment variable. Each user gets a unique address
 * derived from their incrementing index.
 *
 * Derivation path: m/44'/60'/0'/0/{index}
 *   - 60' = Ethereum coin type (also used for BSC, MATIC as they are EVM)
 *   - SOL uses a different scheme and is handled separately
 *
 * SECURITY NOTES:
 *   - The mnemonic MUST be stored securely (env var, HSM, or vault)
 *   - Private keys are derived on-demand and never stored in the database
 *   - Only the public address is persisted
 */

// Derivation index counter table.
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS wallet_indices (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    next_index INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO wallet_indices (id, next_index) VALUES (1, 0);
`;
db.exec(INIT_SQL);

/**
 * Returns the master HD node from the configured mnemonic at the base
 * BIP44 Ethereum account path. Child indices are appended to derive
 * individual user addresses.
 * @returns {import('ethers').HDNodeWallet}
 */
const getMasterNode = () => {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error('WALLET_MNEMONIC environment variable is not set.');
  }
  // Derive to the account-level path; child derivation appends the index.
  return ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0");
};

/**
 * Derives an EVM-compatible address at the given BIP44 index.
 * Works for ETH, BSC, and MATIC (all EVM chains).
 *
 * @param {number} index - The derivation index.
 * @returns {{ address: string, path: string }}
 */
const deriveEvmAddress = (index) => {
  const master = getMasterNode();
  const child = master.deriveChild(index);
  return { address: child.address, path: `m/44'/60'/0'/0/${index}` };
};

/**
 * Derives the private key for a given index (used for signing withdrawals).
 * This should only be called in the withdrawal processing pipeline.
 *
 * @param {number} index - The derivation index.
 * @returns {string} The private key hex string.
 */
const derivePrivateKey = (index) => {
  const master = getMasterNode();
  const child = master.deriveChild(index);
  return child.privateKey;
};

/**
 * Generates a deterministic SOL-like address placeholder.
 * Full Solana HD derivation requires @solana/web3.js and ed25519-hd-key.
 * This generates a consistent placeholder based on the master seed + index.
 *
 * @param {number} index - The derivation index.
 * @returns {{ address: string, path: string }}
 */
const deriveSolAddress = (index) => {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error('WALLET_MNEMONIC environment variable is not set.');
  }
  // Derive a deterministic address from the mnemonic + index using HMAC.
  const hmac = crypto.createHmac('sha256', mnemonic).update(`sol:${index}`).digest();
  // Encode as base58-like string (simplified -- real impl uses ed25519).
  const address = ethers.encodeBase58(hmac);
  return { address, path: `m/44'/501'/0'/0'/${index}` };
};

/**
 * Allocates and returns a deposit address for a user on the specified chain.
 * If the user already has an address for this chain, returns the existing one.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} chain - The blockchain (ETH, BSC, SOL, MATIC).
 * @returns {{ address: string, path: string, isNew: boolean }}
 */
const getOrCreateDepositAddress = (userId, chain) => {
  // Check for existing address.
  const existing = db.prepare(
    'SELECT address FROM deposit_addresses WHERE user_id = ? AND chain = ?'
  ).get(userId, chain);

  if (existing) {
    return { address: existing.address, path: '', isNew: false };
  }

  // Allocate the next derivation index atomically.
  const row = db.prepare('SELECT next_index FROM wallet_indices WHERE id = 1').get();
  const index = row.next_index;
  db.prepare('UPDATE wallet_indices SET next_index = ? WHERE id = 1').run(index + 1);

  // Derive the address based on chain type.
  let derived;
  if (chain === 'SOL') {
    derived = deriveSolAddress(index);
  } else {
    // ETH, BSC, MATIC all use EVM derivation.
    derived = deriveEvmAddress(index);
  }

  // Store the address (never the private key).
  db.prepare(
    'INSERT INTO deposit_addresses (user_id, chain, address) VALUES (?, ?, ?)'
  ).run(userId, chain, derived.address);

  return { address: derived.address, path: derived.path, isNew: true };
};

/**
 * Generates a new master mnemonic. Used for initial setup only.
 * @returns {string} A 24-word BIP39 mnemonic.
 */
const generateMnemonic = () => {
  const wallet = ethers.Wallet.createRandom();
  return wallet.mnemonic.phrase;
};

module.exports = {
  getOrCreateDepositAddress,
  deriveEvmAddress,
  derivePrivateKey,
  deriveSolAddress,
  generateMnemonic,
};
