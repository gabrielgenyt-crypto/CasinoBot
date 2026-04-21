const { ethers } = require('ethers');

/**
 * Blockchain address validation utilities.
 * Validates addresses before they are used for withdrawals or whitelisting.
 */

/**
 * Validates an EVM address (ETH, BSC, MATIC).
 * Checks format and optionally verifies the checksum.
 *
 * @param {string} address - The address to validate.
 * @returns {{ valid: boolean, checksummed: string|null, error: string|null }}
 */
const validateEvmAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return { valid: false, checksummed: null, error: 'Address is required.' };
  }

  // Must start with 0x and be 42 characters.
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { valid: false, checksummed: null, error: 'Invalid EVM address format.' };
  }

  try {
    const checksummed = ethers.getAddress(address);
    return { valid: true, checksummed, error: null };
  } catch (_err) {
    return { valid: false, checksummed: null, error: 'Invalid EVM address checksum.' };
  }
};

/**
 * Validates a Solana address (base58, 32-44 characters).
 *
 * @param {string} address - The address to validate.
 * @returns {{ valid: boolean, error: string|null }}
 */
const validateSolAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required.' };
  }

  // Solana addresses are base58-encoded, typically 32-44 characters.
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { valid: false, error: 'Invalid Solana address format.' };
  }

  return { valid: true, error: null };
};

/**
 * Validates an address for the given chain.
 *
 * @param {string} chain - The blockchain (ETH, BSC, SOL, MATIC).
 * @param {string} address - The address to validate.
 * @returns {{ valid: boolean, address: string|null, error: string|null }}
 */
const validateAddress = (chain, address) => {
  if (chain === 'SOL') {
    const result = validateSolAddress(address);
    return { valid: result.valid, address: result.valid ? address : null, error: result.error };
  }

  // ETH, BSC, MATIC are all EVM.
  const result = validateEvmAddress(address);
  return {
    valid: result.valid,
    address: result.checksummed,
    error: result.error,
  };
};

/**
 * Checks if an address is a known contract address that should be blocked
 * (e.g., token contracts, DEX routers). This is a basic blocklist approach.
 *
 * @param {string} _address - The address to check.
 * @returns {boolean} True if the address is blocked.
 */
const isBlockedAddress = (_address) => {
  // In production, maintain a blocklist of known contract addresses.
  // For now, this is a placeholder.
  return false;
};

module.exports = { validateEvmAddress, validateSolAddress, validateAddress, isBlockedAddress };
