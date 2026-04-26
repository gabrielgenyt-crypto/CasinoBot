/**
 * Conversion rate: 5 coins = 1 EUR.
 */
const COINS_PER_EUR = 5;

/**
 * Formats a coin amount with its EUR equivalent.
 *
 * Examples:
 *   formatAmount(1000)  -> "1,000 coins (~200.00 EUR)"
 *   formatAmount(5)     -> "5 coins (~1.00 EUR)"
 *   formatAmount(0)     -> "0 coins (~0.00 EUR)"
 *
 * @param {number} amount - The coin amount (must be a non-negative number).
 * @returns {string} Formatted string with coins and EUR.
 */
function formatAmount(amount) {
  const euros = (amount / COINS_PER_EUR).toFixed(2);
  return `${amount.toLocaleString()} coins (~${euros} EUR)`;
}

/**
 * Formats a coin amount as a short inline value (for embed field values).
 *
 * Example:
 *   formatBalance(2500) -> "2,500 (~500.00 EUR)"
 *
 * @param {number} amount - The coin amount.
 * @returns {string}
 */
function formatBalance(amount) {
  const euros = (amount / COINS_PER_EUR).toFixed(2);
  return `${amount.toLocaleString()} (~${euros} EUR)`;
}

module.exports = { formatAmount, formatBalance, COINS_PER_EUR };
