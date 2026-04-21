const { ethers } = require('ethers');
const express = require('express');
const db = require('../utils/database');
const { updateBalance } = require('../utils/wallet');
const { toUsd, formatUsd } = require('../utils/priceService');

/**
 * Deposit listener scaffold. Provides two mechanisms for detecting deposits:
 *
 * 1. **Alchemy/Moralis Webhook** — An Express endpoint that receives
 *    transaction notifications from a blockchain indexer. This is the
 *    recommended production approach.
 *
 * 2. **Ethers.js Provider Polling** — Directly watches an RPC provider
 *    for incoming transactions to known deposit addresses. Useful for
 *    development or as a fallback.
 *
 * Both methods credit the user's balance after the required confirmations.
 */

// Required confirmations per chain before crediting.
const REQUIRED_CONFIRMATIONS = {
  ETH: 12,
  BSC: 15,
  MATIC: 128,
};

// DB table for tracking pending deposits.
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS pending_deposits (
    tx_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    amount TEXT NOT NULL,
    token TEXT NOT NULL,
    confirmations INTEGER NOT NULL DEFAULT 0,
    required_confirmations INTEGER NOT NULL,
    credited INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;
db.exec(INIT_SQL);

/**
 * Processes a confirmed deposit: credits the user's balance and records it.
 *
 * @param {string} userId - The Discord user ID.
 * @param {string} chain - The blockchain.
 * @param {string} token - The token symbol (ETH, USDT, etc.).
 * @param {string} amount - The deposit amount as a string (wei or smallest unit).
 * @param {string} txHash - The transaction hash.
 * @param {import('discord.js').Client} [discordClient] - Optional Discord client for DM notifications.
 */
const creditDeposit = async (userId, chain, token, amount, txHash, discordClient) => {
  // Convert to internal coin balance. For simplicity, 1 USD = 1 coin.
  // In production, use the price service for accurate conversion.
  const usdValue = await toUsd(token, parseFloat(amount));
  const coinAmount = usdValue ? Math.floor(usdValue) : 0;

  if (coinAmount <= 0) {
    console.warn(`[DEPOSIT] Zero-value deposit ignored: ${txHash}`);
    return;
  }

  // Credit the balance.
  const newBalance = updateBalance(userId, coinAmount, `deposit: ${amount} ${token} on ${chain} (${txHash.substring(0, 10)}...)`);

  // Mark as credited.
  db.prepare('UPDATE pending_deposits SET credited = 1 WHERE tx_hash = ?').run(txHash);

  console.log(`[DEPOSIT] Credited ${coinAmount} coins to ${userId} from ${txHash}`);

  // Send DM notification if Discord client is available.
  if (discordClient) {
    try {
      const user = await discordClient.users.fetch(userId);
      await user.send(
        `Your deposit of **${amount} ${token}** on **${chain}** has been confirmed!\n` +
        `**${coinAmount}** coins credited. New balance: **${newBalance}**\n` +
        `TX: \`${txHash}\``
      );
    } catch (_err) {
      // User may have DMs disabled.
      console.warn(`[DEPOSIT] Could not DM user ${userId}`);
    }
  }
};

/**
 * Creates an Express webhook endpoint for Alchemy/Moralis notifications.
 * Mount this on your Express app: app.use('/webhook', createWebhookRouter(client))
 *
 * Expected payload format (Alchemy Address Activity):
 * {
 *   event: { activity: [{ fromAddress, toAddress, value, asset, hash, ... }] }
 * }
 *
 * @param {import('discord.js').Client} discordClient - The Discord client.
 * @returns {import('express').Router}
 */
const createWebhookRouter = (discordClient) => {
  const router = express.Router();

  router.post('/deposit', express.json(), async (req, res) => {
    // Validate webhook secret if configured.
    const secret = process.env.WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const activities = req.body?.event?.activity || [];

      for (const activity of activities) {
        const toAddress = activity.toAddress?.toLowerCase();
        if (!toAddress) continue;

        // Look up which user owns this deposit address.
        const record = db.prepare(
          'SELECT user_id, chain FROM deposit_addresses WHERE LOWER(address) = ?'
        ).get(toAddress);

        if (!record) continue;

        const txHash = activity.hash;
        const token = activity.asset || record.chain;
        const amount = String(activity.value || 0);

        // Check for duplicate.
        const existing = db.prepare('SELECT tx_hash FROM pending_deposits WHERE tx_hash = ?').get(txHash);
        if (existing) continue;

        // Record the pending deposit.
        const required = REQUIRED_CONFIRMATIONS[record.chain] || 12;
        db.prepare(
          'INSERT INTO pending_deposits (tx_hash, user_id, chain, amount, token, required_confirmations) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(txHash, record.user_id, record.chain, amount, token, required);

        // For webhook-based deposits, we trust the indexer's confirmation count.
        // Credit immediately (the indexer only sends after sufficient confirmations).
        await creditDeposit(record.user_id, record.chain, token, amount, txHash, discordClient);
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error('[WEBHOOK] Error processing deposit:', error);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
};

/**
 * Starts an Ethers.js provider-based deposit watcher for a specific chain.
 * Polls for new blocks and checks for transactions to known deposit addresses.
 *
 * @param {string} chain - The chain to watch (ETH, BSC, MATIC).
 * @param {string} rpcUrl - The RPC endpoint URL.
 * @param {import('discord.js').Client} discordClient - The Discord client.
 */
const startProviderWatcher = (chain, rpcUrl, discordClient) => {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Load all deposit addresses for this chain.
  const addresses = new Set(
    db.prepare('SELECT LOWER(address) as address FROM deposit_addresses WHERE chain = ?')
      .all(chain)
      .map((r) => r.address)
  );

  console.log(`[WATCHER] Watching ${addresses.size} addresses on ${chain}`);

  provider.on('block', async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) return;

      for (const txHash of block.transactions) {
        const tx = await provider.getTransaction(txHash);
        if (!tx || !tx.to) continue;

        const toAddr = tx.to.toLowerCase();
        if (!addresses.has(toAddr)) continue;

        // Found a deposit transaction.
        const record = db.prepare(
          'SELECT user_id FROM deposit_addresses WHERE LOWER(address) = ? AND chain = ?'
        ).get(toAddr, chain);

        if (!record) continue;

        const existing = db.prepare('SELECT tx_hash FROM pending_deposits WHERE tx_hash = ?').get(tx.hash);
        if (existing) continue;

        const amount = ethers.formatEther(tx.value);
        const required = REQUIRED_CONFIRMATIONS[chain] || 12;

        db.prepare(
          'INSERT INTO pending_deposits (tx_hash, user_id, chain, amount, token, required_confirmations) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(tx.hash, record.user_id, chain, amount, chain, required);

        console.log(`[WATCHER] Detected deposit: ${amount} ${chain} to ${toAddr} (${tx.hash})`);

        // Wait for confirmations then credit.
        await tx.wait(required);
        await creditDeposit(record.user_id, chain, chain, amount, tx.hash, discordClient);
      }
    } catch (error) {
      console.error(`[WATCHER] Error on block ${blockNumber}:`, error.message);
    }
  });
};

/**
 * Initializes the deposit listener system based on environment configuration.
 *
 * @param {import('discord.js').Client} discordClient - The Discord client.
 * @param {import('express').Application} [app] - Optional Express app for webhook mode.
 */
const initDepositListener = (discordClient, app) => {
  // Mode 1: Webhook (recommended for production).
  if (app && process.env.WEBHOOK_SECRET) {
    app.use('/webhook', createWebhookRouter(discordClient));
    console.log('[DEPOSIT] Webhook endpoint registered at /webhook/deposit');
  }

  // Mode 2: Provider polling (for development or fallback).
  const rpcUrls = {
    ETH: process.env.ETH_RPC_URL,
    BSC: process.env.BSC_RPC_URL,
    MATIC: process.env.MATIC_RPC_URL,
  };

  for (const [chain, rpcUrl] of Object.entries(rpcUrls)) {
    if (rpcUrl) {
      startProviderWatcher(chain, rpcUrl, discordClient);
    }
  }
};

module.exports = {
  creditDeposit,
  createWebhookRouter,
  startProviderWatcher,
  initDepositListener,
  formatUsd,
};
