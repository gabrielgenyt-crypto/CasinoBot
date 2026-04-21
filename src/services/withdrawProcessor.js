const { ethers } = require('ethers');
const db = require('../utils/database');
const { derivePrivateKey } = require('../utils/hdWallet');
const { log, ACTIONS } = require('../utils/auditLog');

/**
 * Withdrawal processing service. Handles automatic sending of small
 * withdrawals and queuing of large ones for admin approval.
 *
 * Small withdrawals (below AUTO_SEND_THRESHOLD) are processed automatically
 * if an RPC URL is configured for the chain. Large withdrawals require
 * admin approval via /admin approve.
 */

const AUTO_SEND_THRESHOLD = 1000; // Coins. Below this, auto-send.

// RPC URLs per chain (from environment).
const getRpcUrl = (chain) => {
  const urls = {
    ETH: process.env.ETH_RPC_URL,
    BSC: process.env.BSC_RPC_URL,
    MATIC: process.env.MATIC_RPC_URL,
  };
  return urls[chain];
};

// Hot wallet derivation index (index 0 is the house hot wallet).
const HOT_WALLET_INDEX = 0;

/**
 * Processes a single withdrawal request by sending an on-chain transaction.
 *
 * @param {object} request - The withdrawal request row from the database.
 * @param {import('discord.js').Client} [discordClient] - Optional Discord client for DM notifications.
 * @returns {Promise<{ success: boolean, txHash: string|null, error: string|null }>}
 */
const processWithdrawal = async (request, discordClient) => {
  const rpcUrl = getRpcUrl(request.chain);
  if (!rpcUrl) {
    return { success: false, txHash: null, error: `No RPC URL configured for ${request.chain}` };
  }

  if (request.chain === 'SOL') {
    // Solana requires @solana/web3.js -- not implemented in this scaffold.
    return { success: false, txHash: null, error: 'SOL withdrawals require Solana SDK integration' };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = derivePrivateKey(HOT_WALLET_INDEX);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Convert coin amount to ETH/native token amount.
    // In production, use the price service for accurate conversion.
    // For now, assume 1 coin = 0.001 native token (placeholder rate).
    const nativeAmount = ethers.parseEther(String(request.amount * 0.001));

    // Estimate gas.
    const gasEstimate = await provider.estimateGas({
      to: request.address,
      value: nativeAmount,
    });

    const feeData = await provider.getFeeData();

    const tx = await wallet.sendTransaction({
      to: request.address,
      value: nativeAmount,
      gasLimit: gasEstimate,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    });

    // Wait for 1 confirmation.
    const receipt = await tx.wait(1);

    // Update the request status.
    db.prepare(
      'UPDATE withdraw_requests SET status = ?, tx_hash = ?, updated_at = ? WHERE id = ?'
    ).run('completed', receipt.hash, new Date().toISOString(), request.id);

    log(request.user_id, ACTIONS.WITHDRAW_REQUEST, {
      details: JSON.stringify({ id: request.id, txHash: receipt.hash, status: 'completed' }),
    });

    // Notify the user via DM.
    if (discordClient) {
      const { notifyWithdrawalUpdate } = require('./notifications');
      await notifyWithdrawalUpdate(discordClient, request.user_id, {
        status: 'completed',
        amount: request.amount,
        chain: request.chain,
        txHash: receipt.hash,
      });
    }

    console.log(`[WITHDRAW] Processed #${request.id}: ${receipt.hash}`);
    return { success: true, txHash: receipt.hash, error: null };
  } catch (error) {
    console.error(`[WITHDRAW] Failed #${request.id}:`, error.message);

    // Mark as failed but don't refund automatically -- admin should review.
    db.prepare(
      'UPDATE withdraw_requests SET status = ?, updated_at = ? WHERE id = ?'
    ).run('failed', new Date().toISOString(), request.id);

    return { success: false, txHash: null, error: error.message };
  }
};

/**
 * Processes all pending withdrawal requests that are below the auto-send
 * threshold. Called periodically by a cron job.
 *
 * @param {import('discord.js').Client} [discordClient] - Optional Discord client.
 */
const processAutoWithdrawals = async (discordClient) => {
  const pending = db.prepare(
    'SELECT * FROM withdraw_requests WHERE status = ? AND amount < ? ORDER BY created_at ASC LIMIT 10'
  ).all('pending', AUTO_SEND_THRESHOLD);

  if (pending.length === 0) return;

  console.log(`[WITHDRAW] Processing ${pending.length} auto-withdrawal(s)...`);

  for (const request of pending) {
    await processWithdrawal(request, discordClient);
  }
};

module.exports = {
  processWithdrawal,
  processAutoWithdrawals,
  AUTO_SEND_THRESHOLD,
};
