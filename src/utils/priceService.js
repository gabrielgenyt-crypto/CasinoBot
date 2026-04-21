/**
 * CoinGecko price service with in-memory caching.
 * Fetches live crypto prices and caches them for 60 seconds to avoid
 * hitting rate limits on the free API tier.
 */

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Map chain symbols to CoinGecko IDs.
const COIN_IDS = {
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  MATIC: 'matic-network',
  USDT: 'tether',
  USDC: 'usd-coin',
};

// Cache: { prices: {}, lastFetch: timestamp }
let cache = { prices: {}, lastFetch: 0 };
const CACHE_TTL_MS = 60 * 1000; // 60 seconds.

/**
 * Fetches current USD prices for all supported coins from CoinGecko.
 * Results are cached for 60 seconds.
 *
 * @returns {Promise<Record<string, number>>} Map of symbol -> USD price.
 */
const fetchPrices = async () => {
  const now = Date.now();
  if (now - cache.lastFetch < CACHE_TTL_MS && Object.keys(cache.prices).length > 0) {
    return cache.prices;
  }

  const ids = Object.values(COIN_IDS).join(',');
  const url = `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[PRICE] CoinGecko API returned ${response.status}`);
      return cache.prices; // Return stale cache on error.
    }

    const data = await response.json();

    // Map CoinGecko IDs back to our symbols.
    const prices = {};
    for (const [symbol, geckoId] of Object.entries(COIN_IDS)) {
      if (data[geckoId] && data[geckoId].usd) {
        prices[symbol] = data[geckoId].usd;
      }
    }

    cache = { prices, lastFetch: now };
    return prices;
  } catch (error) {
    console.warn('[PRICE] Failed to fetch prices:', error.message);
    return cache.prices; // Return stale cache on network error.
  }
};

/**
 * Gets the USD price for a specific coin.
 * @param {string} symbol - The coin symbol (ETH, BNB, SOL, MATIC, USDT, USDC).
 * @returns {Promise<number|null>} The USD price, or null if unavailable.
 */
const getPrice = async (symbol) => {
  const prices = await fetchPrices();
  return prices[symbol] || null;
};

/**
 * Converts a coin amount to its USD equivalent.
 * @param {string} symbol - The coin symbol.
 * @param {number} amount - The amount of the coin.
 * @returns {Promise<number|null>} The USD value, or null if price unavailable.
 */
const toUsd = async (symbol, amount) => {
  const price = await getPrice(symbol);
  if (price === null) return null;
  return Math.round(amount * price * 100) / 100;
};

/**
 * Formats a price for display.
 * @param {number|null} usdValue - The USD value.
 * @returns {string} Formatted string like "$1,234.56" or "N/A".
 */
const formatUsd = (usdValue) => {
  if (usdValue === null || usdValue === undefined) return 'N/A';
  return `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

module.exports = { fetchPrices, getPrice, toUsd, formatUsd, COIN_IDS };
