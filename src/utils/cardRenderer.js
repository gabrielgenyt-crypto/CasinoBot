const { createCanvas } = require('@napi-rs/canvas');

// ─── Layout Constants ───────────────────────────────────────────────────────
const CARD_W = 80;
const CARD_H = 112;
const CARD_RADIUS = 8;
const CARD_GAP = 12;
const HAND_PADDING = 24;
const LABEL_HEIGHT = 28;
const SECTION_GAP = 18;

// ─── Color Palette ──────────────────────────────────────────────────────────
const TABLE_COLOR = '#1a6b3c';
const TABLE_BORDER = '#145a30';
const CARD_BG = '#ffffff';
const CARD_BORDER = '#cccccc';
const CARD_BACK = '#2c5aa0';
const CARD_BACK_PATTERN = '#1e3f73';
const RED = '#d32f2f';
const BLACK = '#1a1a1a';
const LABEL_COLOR = '#e0e0e0';
const VALUE_BG = 'rgba(0, 0, 0, 0.55)';
const VALUE_COLOR = '#ffffff';

// ─── Suit Symbols ───────────────────────────────────────────────────────────
const SUIT_SYMBOLS = {
  '♠': { symbol: '\u2660', color: BLACK },
  '♣': { symbol: '\u2663', color: BLACK },
  '♥': { symbol: '\u2665', color: RED },
  '♦': { symbol: '\u2666', color: RED },
};

/**
 * Draws a rounded rectangle path on the canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - Corner radius.
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Draws a single face-up playing card.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {{ rank: string, suit: string }} card
 */
function drawCard(ctx, x, y, card) {
  // Card body.
  roundRect(ctx, x, y, CARD_W, CARD_H, CARD_RADIUS);
  ctx.fillStyle = CARD_BG;
  ctx.fill();
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const suitInfo = SUIT_SYMBOLS[card.suit] || { symbol: card.suit, color: BLACK };
  ctx.fillStyle = suitInfo.color;

  // Top-left rank.
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, x + 6, y + 5);

  // Top-left suit (small).
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText(suitInfo.symbol, x + 7, y + 24);

  // Center suit (large).
  ctx.font = '36px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suitInfo.symbol, x + CARD_W / 2, y + CARD_H / 2);

  // Bottom-right rank (rotated).
  ctx.save();
  ctx.translate(x + CARD_W - 6, y + CARD_H - 5);
  ctx.rotate(Math.PI);
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, 0, 0);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText(suitInfo.symbol, 1, 19);
  ctx.restore();
}

/**
 * Draws a face-down card (card back).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
function drawCardBack(ctx, x, y) {
  // Card body.
  roundRect(ctx, x, y, CARD_W, CARD_H, CARD_RADIUS);
  ctx.fillStyle = CARD_BACK;
  ctx.fill();
  ctx.strokeStyle = '#1a3a6b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner border.
  const inset = 5;
  roundRect(ctx, x + inset, y + inset, CARD_W - inset * 2, CARD_H - inset * 2, CARD_RADIUS - 2);
  ctx.strokeStyle = CARD_BACK_PATTERN;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Diamond pattern.
  ctx.fillStyle = CARD_BACK_PATTERN;
  const cx = x + CARD_W / 2;
  const cy = y + CARD_H / 2;
  const size = 12;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();

  // Question mark.
  ctx.fillStyle = '#6b9fd3';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy);
}

/**
 * Draws a value badge (pill shape) next to a hand.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} text - The value text (e.g. "21" or "?").
 */
function drawValueBadge(ctx, x, y, text) {
  const padding = 8;
  ctx.font = 'bold 16px Arial, sans-serif';
  const metrics = ctx.measureText(text);
  const badgeW = metrics.width + padding * 2;
  const badgeH = 24;

  roundRect(ctx, x, y, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = VALUE_BG;
  ctx.fill();

  ctx.fillStyle = VALUE_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + badgeW / 2, y + badgeH / 2);
}

/**
 * Calculates the total canvas width needed for a hand of cards.
 * @param {number} cardCount - Number of cards in the hand.
 * @returns {number}
 */
function handWidth(cardCount) {
  return Math.max(cardCount, 1) * (CARD_W + CARD_GAP) - CARD_GAP;
}

/**
 * Renders the blackjack table as a PNG buffer.
 *
 * @param {object} options
 * @param {Array<{rank: string, suit: string}>} options.playerHand - Player's cards.
 * @param {Array<{rank: string, suit: string}>} options.dealerHand - Dealer's cards.
 * @param {number} options.playerValue - Player's hand value.
 * @param {number|string} options.dealerValue - Dealer's hand value (number or "?").
 * @param {boolean} [options.showDealer=false] - Whether to reveal all dealer cards.
 * @param {string} [options.playerName='Player'] - Display name for the player.
 * @returns {Buffer} PNG image buffer.
 */
function renderBlackjackTable({
  playerHand,
  dealerHand,
  playerValue,
  dealerValue,
  showDealer = false,
  playerName = 'Player',
}) {
  // Calculate canvas dimensions.
  const maxCards = Math.max(playerHand.length, dealerHand.length);
  const contentW = handWidth(maxCards);
  const canvasW = contentW + HAND_PADDING * 2;
  const canvasH =
    HAND_PADDING +          // top padding
    LABEL_HEIGHT +          // "Dealer (value)" label
    CARD_H +                // dealer cards
    SECTION_GAP +           // gap between hands
    LABEL_HEIGHT +          // "Player (value)" label
    CARD_H +                // player cards
    HAND_PADDING;           // bottom padding

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // ── Table background ──
  roundRect(ctx, 0, 0, canvasW, canvasH, 12);
  ctx.fillStyle = TABLE_COLOR;
  ctx.fill();
  ctx.strokeStyle = TABLE_BORDER;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Subtle felt texture lines.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvasH; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvasW, i);
    ctx.stroke();
  }

  let cursorY = HAND_PADDING;

  // ── Dealer label ──
  const dealerLabel = `Dealer (${dealerValue})`;
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(dealerLabel, HAND_PADDING, cursorY);
  cursorY += LABEL_HEIGHT;

  // ── Dealer cards ──
  for (let i = 0; i < dealerHand.length; i++) {
    const cardX = HAND_PADDING + i * (CARD_W + CARD_GAP);
    if (i === 0 || showDealer) {
      drawCard(ctx, cardX, cursorY, dealerHand[i]);
    } else {
      drawCardBack(ctx, cardX, cursorY);
    }
  }

  // Dealer value badge (right of last card).
  const dealerBadgeX = HAND_PADDING + dealerHand.length * (CARD_W + CARD_GAP) + 4;
  drawValueBadge(ctx, dealerBadgeX, cursorY + CARD_H / 2 - 12, String(dealerValue));

  cursorY += CARD_H + SECTION_GAP;

  // ── Player label ──
  const playerLabel = `${playerName} (${playerValue})`;
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(playerLabel, HAND_PADDING, cursorY);
  cursorY += LABEL_HEIGHT;

  // ── Player cards ──
  for (let i = 0; i < playerHand.length; i++) {
    const cardX = HAND_PADDING + i * (CARD_W + CARD_GAP);
    drawCard(ctx, cardX, cursorY, playerHand[i]);
  }

  // Player value badge.
  const playerBadgeX = HAND_PADDING + playerHand.length * (CARD_W + CARD_GAP) + 4;
  drawValueBadge(ctx, playerBadgeX, cursorY + CARD_H / 2 - 12, String(playerValue));

  return canvas.toBuffer('image/png');
}

module.exports = { renderBlackjackTable };
