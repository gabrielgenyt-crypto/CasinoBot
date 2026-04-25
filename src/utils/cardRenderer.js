const { createCanvas } = require('@napi-rs/canvas');

// ─── Layout Constants ───────────────────────────────────────────────────────
const CARD_W = 100;
const CARD_H = 140;
const CARD_RADIUS = 10;
const CARD_GAP = 14;
const HAND_PADDING = 32;
const LABEL_HEIGHT = 36;
const SECTION_GAP = 28;

// ─── Color Palette ──────────────────────────────────────────────────────────
const CARD_BG = '#ffffff';
const CARD_BORDER = '#d0d0d0';
const CARD_BACK = '#2c5aa0';
const CARD_BACK_PATTERN = '#1e3f73';
const RED = '#e53935';
const BLACK = '#1a1a1a';
const VALUE_BG = 'rgba(0, 0, 0, 0.65)';
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
  // Card shadow.
  roundRect(ctx, x + 3, y + 3, CARD_W, CARD_H, CARD_RADIUS);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();

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
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, x + 8, y + 6);

  // Top-left suit (small).
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText(suitInfo.symbol, x + 9, y + 28);

  // Center suit (large).
  ctx.font = '46px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suitInfo.symbol, x + CARD_W / 2, y + CARD_H / 2);

  // Bottom-right rank (rotated).
  ctx.save();
  ctx.translate(x + CARD_W - 8, y + CARD_H - 6);
  ctx.rotate(Math.PI);
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, 0, 0);
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText(suitInfo.symbol, 1, 22);
  ctx.restore();
}

/**
 * Draws a face-down card (card back).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
function drawCardBack(ctx, x, y) {
  // Card shadow.
  roundRect(ctx, x + 3, y + 3, CARD_W, CARD_H, CARD_RADIUS);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();

  // Card body with gradient.
  roundRect(ctx, x, y, CARD_W, CARD_H, CARD_RADIUS);
  const backGrad = ctx.createLinearGradient(x, y, x, y + CARD_H);
  backGrad.addColorStop(0, '#3a6fc4');
  backGrad.addColorStop(1, CARD_BACK);
  ctx.fillStyle = backGrad;
  ctx.fill();
  ctx.strokeStyle = '#1a3a6b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner border.
  const inset = 6;
  roundRect(ctx, x + inset, y + inset, CARD_W - inset * 2, CARD_H - inset * 2, CARD_RADIUS - 2);
  ctx.strokeStyle = CARD_BACK_PATTERN;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Diamond pattern (larger).
  ctx.fillStyle = CARD_BACK_PATTERN;
  const cx = x + CARD_W / 2;
  const cy = y + CARD_H / 2;
  const size = 16;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();

  // Smaller diamonds around center.
  const smallSize = 6;
  const offsets = [[-20, -20], [20, -20], [-20, 20], [20, 20]];
  for (const [dx, dy] of offsets) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + dy - smallSize);
    ctx.lineTo(cx + dx + smallSize, cy + dy);
    ctx.lineTo(cx + dx, cy + dy + smallSize);
    ctx.lineTo(cx + dx - smallSize, cy + dy);
    ctx.closePath();
    ctx.fill();
  }

  // Question mark.
  ctx.fillStyle = '#8bb8e8';
  ctx.font = 'bold 36px Arial, sans-serif';
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
function drawValueBadge(ctx, x, y, text, glowColor) {
  const padding = 12;
  ctx.font = 'bold 20px Arial, sans-serif';
  const metrics = ctx.measureText(text);
  const badgeW = Math.max(metrics.width + padding * 2, 40);
  const badgeH = 32;

  // Glow behind badge.
  if (glowColor) {
    glowCircle(ctx, x + badgeW / 2, y + badgeH / 2, badgeH, glowColor);
  }

  roundRect(ctx, x, y, badgeW, badgeH, badgeH / 2);
  ctx.fillStyle = VALUE_BG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = VALUE_COLOR;
  ctx.font = 'bold 20px Arial, sans-serif';
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
  outcome = null,
}) {
  // Extra width for the value badge next to cards.
  const BADGE_SPACE = 60;
  // Calculate canvas dimensions.
  const maxCards = Math.max(playerHand.length, dealerHand.length, 2);
  const contentW = handWidth(maxCards) + BADGE_SPACE;
  const canvasW = Math.max(contentW + HAND_PADDING * 2, 380);
  const canvasH =
    HAND_PADDING +          // top padding
    LABEL_HEIGHT +          // "Dealer" label
    CARD_H +                // dealer cards
    SECTION_GAP +           // gap between hands
    LABEL_HEIGHT +          // "Player" label
    CARD_H +                // player cards
    HAND_PADDING;           // bottom padding

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // ── Dark gradient background (neon casino style) ──
  gradientRect(ctx, 0, 0, canvasW, canvasH, 14, '#0a1a10', '#0d1117');

  // Neon border based on outcome.
  let borderColor = '#1a6b3c';
  if (outcome === 'win' || outcome === 'blackjack') borderColor = '#00ff88';
  else if (outcome === 'lose' || outcome === 'bust') borderColor = '#ff3366';
  else if (outcome === 'push') borderColor = '#ff9900';

  roundRect(ctx, 0, 0, canvasW, canvasH, 14);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Ambient glow in the center.
  glowCircle(ctx, canvasW / 2, canvasH / 2, canvasH * 0.6,
    'rgba(26, 107, 60, 0.08)');

  // Subtle horizontal felt lines.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvasH; i += 5) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvasW, i);
    ctx.stroke();
  }

  // Separator line between dealer and player.
  const sepY = HAND_PADDING + LABEL_HEIGHT + CARD_H + SECTION_GAP / 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(HAND_PADDING, sepY);
  ctx.lineTo(canvasW - HAND_PADDING, sepY);
  ctx.stroke();

  let cursorY = HAND_PADDING;

  // ── Dealer label ──
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('DEALER', HAND_PADDING, cursorY + 2);

  // Show dealer value next to label.
  const dealerLabelVal = showDealer ? String(dealerValue) : String(dealerValue);
  ctx.fillStyle = '#aaaacc';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(`  ${dealerLabelVal}`, HAND_PADDING + ctx.measureText('DEALER').width + 4, cursorY + 4);
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

  // Dealer value badge (right of last card) with glow.
  const dealerBadgeX = HAND_PADDING + dealerHand.length * (CARD_W + CARD_GAP) + 8;
  const dealerGlow = showDealer ? 'rgba(255, 107, 107, 0.2)' : null;
  drawValueBadge(ctx, dealerBadgeX, cursorY + CARD_H / 2 - 16, String(dealerValue), dealerGlow);

  cursorY += CARD_H + SECTION_GAP;

  // ── Player label ──
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const displayName = playerName.length > 14 ? playerName.substring(0, 14) + '..' : playerName;
  ctx.fillText(displayName.toUpperCase(), HAND_PADDING, cursorY + 2);

  // Show player value next to label.
  ctx.fillStyle = '#aaaacc';
  ctx.font = 'bold 16px Arial, sans-serif';
  const nameWidth = ctx.measureText(displayName.toUpperCase()).width;
  ctx.fillText(`  ${playerValue}`, HAND_PADDING + nameWidth + 4, cursorY + 4);
  cursorY += LABEL_HEIGHT;

  // ── Player cards ──
  for (let i = 0; i < playerHand.length; i++) {
    const cardX = HAND_PADDING + i * (CARD_W + CARD_GAP);
    drawCard(ctx, cardX, cursorY, playerHand[i]);
  }

  // Player value badge with glow.
  const playerBadgeX = HAND_PADDING + playerHand.length * (CARD_W + CARD_GAP) + 8;
  const playerGlowColor = playerValue === 21 ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 229, 255, 0.2)';
  drawValueBadge(ctx, playerBadgeX, cursorY + CARD_H / 2 - 16, String(playerValue), playerGlowColor);

  return canvas.toBuffer('image/png');
}

// ─── Coinflip Renderer ──────────────────────────────────────────────────────

const COIN_RADIUS = 72;
const COIN_BORDER = 8;
const COIN_CANVAS_W = 420;
const COIN_CANVAS_H = 280;

/**
 * Renders a coinflip result as a PNG buffer with neon glow effects.
 *
 * @param {object} options
 * @param {'heads'|'tails'} options.side - The side the coin landed on.
 * @param {boolean} options.won - Whether the player won.
 * @param {string} [options.playerName='Player'] - Display name for the player.
 * @returns {Buffer} PNG image buffer.
 */
function renderCoinflip({ side, won, playerName = 'Player' }) {
  const canvas = createCanvas(COIN_CANVAS_W, COIN_CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Dark gradient background.
  gradientRect(ctx, 0, 0, COIN_CANVAS_W, COIN_CANVAS_H, 16,
    won ? '#0a2a1a' : '#2a0a0a', '#0d1117');

  // Border glow.
  roundRect(ctx, 0, 0, COIN_CANVAS_W, COIN_CANVAS_H, 16);
  ctx.strokeStyle = won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2;
  ctx.stroke();

  const cx = COIN_CANVAS_W / 2;
  const cy = 130;

  // Outer neon glow ring.
  const glowColor = won ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 102, 0.15)';
  glowCircle(ctx, cx, cy, COIN_RADIUS + 40, glowColor);

  // Coin shadow.
  ctx.beginPath();
  ctx.arc(cx + 3, cy + 4, COIN_RADIUS + COIN_BORDER, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fill();

  // Coin outer ring (gold gradient).
  ctx.beginPath();
  ctx.arc(cx, cy, COIN_RADIUS + COIN_BORDER, 0, Math.PI * 2);
  const outerGrad = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy, COIN_RADIUS + COIN_BORDER);
  outerGrad.addColorStop(0, '#ffe066');
  outerGrad.addColorStop(1, '#b8860b');
  ctx.fillStyle = outerGrad;
  ctx.fill();

  // Coin inner circle (shiny gold).
  ctx.beginPath();
  ctx.arc(cx, cy, COIN_RADIUS, 0, Math.PI * 2);
  const innerGrad = ctx.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, COIN_RADIUS);
  innerGrad.addColorStop(0, '#fff8dc');
  innerGrad.addColorStop(0.4, '#ffd700');
  innerGrad.addColorStop(1, '#daa520');
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Inner ring detail.
  ctx.beginPath();
  ctx.arc(cx, cy, COIN_RADIUS - 10, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139, 105, 20, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Side label on the coin.
  ctx.fillStyle = '#6b4e0a';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side === 'heads' ? 'H' : 'T', cx, cy);

  // Side text below the coin.
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(side.toUpperCase(), cx, cy + COIN_RADIUS + COIN_BORDER + 12);

  // Player label at the top.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, cx, 14);

  // Win/loss badge.
  const badgeText = won ? 'WIN' : 'LOSS';
  const badgeColor = won ? '#00ff88' : '#ff3366';
  ctx.fillStyle = badgeColor;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(badgeText, cx, 38);

  return canvas.toBuffer('image/png');
}

// ─── Slots Renderer ─────────────────────────────────────────────────────────

const SLOT_REEL_SIZE = 100;
const SLOT_GAP = 20;
const SLOT_CANVAS_W = 480;
const SLOT_CANVAS_H = 280;

// Plain-text fallback symbols for canvas rendering (Discord custom emojis
// cannot be drawn on a server-side canvas).
const SLOT_SYMBOL_MAP = {
  diamond: { text: '\u2666', color: '#00e5ff', glow: 'rgba(0, 229, 255, 0.3)' },
  seven: { text: '7', color: '#ff1744', glow: 'rgba(255, 23, 68, 0.3)' },
  bell: { text: '\u266A', color: '#ffd700', glow: 'rgba(255, 215, 0, 0.3)' },
  cherry: { text: '\u2764', color: '#ff3366', glow: 'rgba(255, 51, 102, 0.3)' },
  lemon: { text: 'L', color: '#ffee00', glow: 'rgba(255, 238, 0, 0.3)' },
  orange: { text: 'O', color: '#ff9100', glow: 'rgba(255, 145, 0, 0.3)' },
  grape: { text: 'G', color: '#aa66cc', glow: 'rgba(170, 102, 204, 0.3)' },
};

/**
 * Renders a slot machine result as a PNG buffer with neon effects.
 *
 * @param {object} options
 * @param {Array<{emoji: string, name: string}>} options.reels - The 3 reel results.
 * @param {boolean} options.won - Whether the player won.
 * @param {number} options.multiplier - The payout multiplier.
 * @param {string} [options.playerName='Player'] - Display name for the player.
 * @returns {Buffer} PNG image buffer.
 */
function renderSlots({ reels, won, multiplier, playerName = 'Player' }) {
  const canvas = createCanvas(SLOT_CANVAS_W, SLOT_CANVAS_H);
  const ctx = canvas.getContext('2d');

  const isJackpot = multiplier >= 10;

  // Dark gradient background.
  const bgTop = isJackpot ? '#1a1400' : won ? '#0a1a10' : '#12081e';
  const bgBot = '#0d1117';
  gradientRect(ctx, 0, 0, SLOT_CANVAS_W, SLOT_CANVAS_H, 16, bgTop, bgBot);

  // Neon border.
  roundRect(ctx, 0, 0, SLOT_CANVAS_W, SLOT_CANVAS_H, 16);
  ctx.strokeStyle = isJackpot ? '#ffd700' : won ? '#00ff88' : '#9b59b6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ambient glow behind reels.
  if (isJackpot) {
    glowCircle(ctx, SLOT_CANVAS_W / 2, 120, 160, 'rgba(255, 215, 0, 0.08)');
  }

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, SLOT_CANVAS_W / 2, 14);

  // Machine frame.
  const totalReelW = 3 * SLOT_REEL_SIZE + 2 * SLOT_GAP;
  const frameX = (SLOT_CANVAS_W - totalReelW) / 2 - 16;
  const frameY = 46;
  const frameW = totalReelW + 32;
  const frameH = SLOT_REEL_SIZE + 32;
  roundRect(ctx, frameX, frameY, frameW, frameH, 12);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();
  ctx.strokeStyle = isJackpot ? '#ffd700' : '#333355';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw 3 reel boxes.
  const startX = (SLOT_CANVAS_W - totalReelW) / 2;
  const reelY = 62;

  for (let i = 0; i < 3; i++) {
    const rx = startX + i * (SLOT_REEL_SIZE + SLOT_GAP);
    const sym = SLOT_SYMBOL_MAP[reels[i].name] || { text: '?', color: '#ffffff', glow: 'rgba(255,255,255,0.2)' };

    // Symbol glow behind reel.
    if (won) {
      glowCircle(ctx, rx + SLOT_REEL_SIZE / 2, reelY + SLOT_REEL_SIZE / 2, SLOT_REEL_SIZE / 2 + 10, sym.glow);
    }

    // Reel background.
    roundRect(ctx, rx, reelY, SLOT_REEL_SIZE, SLOT_REEL_SIZE, 10);
    ctx.fillStyle = '#0d0d1a';
    ctx.fill();
    ctx.strokeStyle = won ? sym.color : '#333355';
    ctx.lineWidth = won ? 2.5 : 1.5;
    ctx.stroke();

    // Symbol.
    ctx.fillStyle = sym.color;
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sym.text, rx + SLOT_REEL_SIZE / 2, reelY + SLOT_REEL_SIZE / 2);
  }

  // Win line across reels.
  if (won) {
    const lineY = reelY + SLOT_REEL_SIZE / 2;
    ctx.strokeStyle = isJackpot ? '#ffd700' : '#00ff88';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(startX - 8, lineY);
    ctx.lineTo(startX + totalReelW + 8, lineY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Multiplier / result text.
  const labelY = frameY + frameH + 20;
  if (won) {
    ctx.fillStyle = isJackpot ? '#ffd700' : '#00ff88';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${multiplier}x`, SLOT_CANVAS_W / 2, labelY);
  } else {
    ctx.fillStyle = '#666688';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('No match', SLOT_CANVAS_W / 2, labelY);
  }

  return canvas.toBuffer('image/png');
}

// ─── Crash Renderer ─────────────────────────────────────────────────────────

const CRASH_CANVAS_W = 500;
const CRASH_CANVAS_H = 300;
const CRASH_GRAPH_PAD = 60;
const CRASH_GRAPH_TOP = 50;
const CRASH_GRAPH_BOTTOM = 240;

/**
 * Renders a crash game result as a PNG buffer with a neon multiplier graph.
 *
 * @param {object} options
 * @param {number} options.crashPoint - The multiplier where the game crashed.
 * @param {number} options.cashout - The player's auto-cashout target.
 * @param {boolean} options.won - Whether the player cashed out in time.
 * @param {string} [options.playerName='Player'] - Display name for the player.
 * @returns {Buffer} PNG image buffer.
 */
function renderCrash({ crashPoint, cashout, won, playerName = 'Player' }) {
  const canvas = createCanvas(CRASH_CANVAS_W, CRASH_CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Dark gradient background.
  gradientRect(ctx, 0, 0, CRASH_CANVAS_W, CRASH_CANVAS_H, 16, '#0a0e14', '#0d1117');

  // Neon border.
  roundRect(ctx, 0, 0, CRASH_CANVAS_W, CRASH_CANVAS_H, 16);
  ctx.strokeStyle = won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, CRASH_CANVAS_W / 2, 10);

  // Graph area.
  const graphLeft = CRASH_GRAPH_PAD;
  const graphRight = CRASH_CANVAS_W - 30;
  const graphW = graphRight - graphLeft;
  const graphH = CRASH_GRAPH_BOTTOM - CRASH_GRAPH_TOP;

  // Axis lines.
  ctx.strokeStyle = '#222233';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphLeft, CRASH_GRAPH_TOP);
  ctx.lineTo(graphLeft, CRASH_GRAPH_BOTTOM);
  ctx.lineTo(graphRight, CRASH_GRAPH_BOTTOM);
  ctx.stroke();

  // Y-axis labels.
  const maxY = Math.max(crashPoint, cashout, 2);
  const ySteps = 5;
  ctx.fillStyle = '#555577';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= ySteps; i++) {
    const val = 1 + (maxY - 1) * (i / ySteps);
    const y = CRASH_GRAPH_BOTTOM - (i / ySteps) * graphH;
    ctx.fillText(`${val.toFixed(1)}x`, graphLeft - 8, y);

    // Grid line.
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(graphLeft, y);
      ctx.lineTo(graphRight, y);
      ctx.stroke();
    }
  }

  // Gradient fill under the curve.
  const curveColor = won ? '#00ff88' : '#ff3366';
  const steps = 80;
  ctx.beginPath();
  ctx.moveTo(graphLeft, CRASH_GRAPH_BOTTOM);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 + t * (crashPoint - 1);
    const x = graphLeft + t * graphW;
    const y = CRASH_GRAPH_BOTTOM - ((m - 1) / (maxY - 1)) * graphH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(graphLeft + graphW, CRASH_GRAPH_BOTTOM);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, CRASH_GRAPH_TOP, 0, CRASH_GRAPH_BOTTOM);
  fillGrad.addColorStop(0, won ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 102, 0.15)');
  fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Draw the multiplier curve (neon line).
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 + t * (crashPoint - 1);
    const x = graphLeft + t * graphW;
    const y = CRASH_GRAPH_BOTTOM - ((m - 1) / (maxY - 1)) * graphH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = curveColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Crash / cashout marker with glow.
  const markerM = won ? cashout : crashPoint;
  const markerT = (markerM - 1) / (crashPoint - 1 || 1);
  const markerX = graphLeft + Math.min(markerT, 1) * graphW;
  const markerY = CRASH_GRAPH_BOTTOM - ((markerM - 1) / (maxY - 1)) * graphH;

  // Marker glow.
  glowCircle(ctx, markerX, markerY, 20, won ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 51, 102, 0.4)');

  ctx.beginPath();
  ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
  ctx.fillStyle = curveColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Marker label.
  ctx.fillStyle = curveColor;
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    won ? `${cashout}x` : `${crashPoint}x`,
    markerX,
    markerY - 14
  );

  // Result text at the bottom.
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = curveColor;
  ctx.fillText(
    won ? `Cashed out at ${cashout}x` : `Crashed at ${crashPoint}x`,
    CRASH_CANVAS_W / 2,
    CRASH_GRAPH_BOTTOM + 14
  );

  return canvas.toBuffer('image/png');
}

// ─── Dice Renderer ──────────────────────────────────────────────────────────

const DICE_CANVAS_W = 460;
const DICE_CANVAS_H = 260;
const DIE_SIZE = 72;

/**
 * Draws a single die face with pips and a neon glow.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Top-left x.
 * @param {number} y - Top-left y.
 * @param {number} value - Die face value (1-6). Values > 6 show a dot.
 * @param {string} glowColor - Glow color for the die border.
 */
function drawDie(ctx, x, y, value, glowColor) {
  // Shadow.
  roundRect(ctx, x + 3, y + 3, DIE_SIZE, DIE_SIZE, 10);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fill();

  // Die body (dark with gradient).
  roundRect(ctx, x, y, DIE_SIZE, DIE_SIZE, 10);
  const dieGrad = ctx.createLinearGradient(x, y, x, y + DIE_SIZE);
  dieGrad.addColorStop(0, '#2a2a3e');
  dieGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = dieGrad;
  ctx.fill();
  ctx.strokeStyle = glowColor || '#555577';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pip positions (relative to die center).
  const cx = x + DIE_SIZE / 2;
  const cy = y + DIE_SIZE / 2;
  const off = 16;
  const pipR = 5;

  const pipPositions = {
    1: [[0, 0]],
    2: [[-off, -off], [off, off]],
    3: [[-off, -off], [0, 0], [off, off]],
    4: [[-off, -off], [off, -off], [-off, off], [off, off]],
    5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
    6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
  };

  ctx.fillStyle = '#e0e0e0';
  const pips = pipPositions[value] || [[0, 0]];
  for (const [dx, dy] of pips) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders a dice game result as a PNG buffer with neon slider.
 *
 * @param {object} options
 * @param {number} options.roll - The dice roll result (1-100).
 * @param {number} options.target - The target number.
 * @param {'over'|'under'} options.direction - The bet direction.
 * @param {boolean} options.won - Whether the player won.
 * @param {string} [options.playerName='Player'] - Display name for the player.
 * @returns {Buffer} PNG image buffer.
 */
function renderDice({ roll, target, direction, won, playerName = 'Player' }) {
  const canvas = createCanvas(DICE_CANVAS_W, DICE_CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Dark gradient background.
  gradientRect(ctx, 0, 0, DICE_CANVAS_W, DICE_CANVAS_H, 16,
    won ? '#0a1a14' : '#1a0a0a', '#0d1117');

  // Neon border.
  roundRect(ctx, 0, 0, DICE_CANVAS_W, DICE_CANVAS_H, 16);
  ctx.strokeStyle = won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, DICE_CANVAS_W / 2, 12);

  // Draw a die showing the roll.
  const dieFace = ((roll - 1) % 6) + 1;
  const dieX = DICE_CANVAS_W / 2 - DIE_SIZE / 2;
  const dieY = 40;
  const dieGlowColor = won ? '#00ff88' : '#ff3366';

  // Die glow.
  glowCircle(ctx, dieX + DIE_SIZE / 2, dieY + DIE_SIZE / 2, DIE_SIZE / 2 + 15, won ? 'rgba(0,255,136,0.12)' : 'rgba(255,51,102,0.12)');

  drawDie(ctx, dieX, dieY, dieFace, dieGlowColor);

  // Roll number below the die.
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(roll), DICE_CANVAS_W / 2, dieY + DIE_SIZE + 10);

  // Slider bar.
  const sliderY = 175;
  const sliderH = 14;
  const sliderLeft = 40;
  const sliderRight = DICE_CANVAS_W - 40;
  const sliderW = sliderRight - sliderLeft;

  // Background bar.
  roundRect(ctx, sliderLeft, sliderY, sliderW, sliderH, sliderH / 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = '#333355';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Win zone highlight with gradient.
  if (direction === 'over') {
    const zoneX = sliderLeft + (target / 100) * sliderW;
    roundRect(ctx, zoneX, sliderY, sliderRight - zoneX, sliderH, sliderH / 2);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.fill();
  } else {
    const zoneW = (target / 100) * sliderW;
    roundRect(ctx, sliderLeft, sliderY, zoneW, sliderH, sliderH / 2);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.fill();
  }

  // Target marker with glow.
  const targetX = sliderLeft + (target / 100) * sliderW;
  glowCircle(ctx, targetX, sliderY + sliderH / 2, 12, 'rgba(255, 153, 0, 0.3)');
  ctx.fillStyle = '#ff9900';
  ctx.beginPath();
  ctx.arc(targetX, sliderY + sliderH / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Roll marker with glow.
  const rollX = sliderLeft + (roll / 100) * sliderW;
  const rollColor = won ? '#00ff88' : '#ff3366';
  glowCircle(ctx, rollX, sliderY + sliderH / 2, 16, won ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)');
  ctx.fillStyle = rollColor;
  ctx.beginPath();
  ctx.arc(rollX, sliderY + sliderH / 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Labels below slider.
  ctx.font = '12px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#555577';
  ctx.textAlign = 'left';
  ctx.fillText('1', sliderLeft, sliderY + sliderH + 6);
  ctx.textAlign = 'right';
  ctx.fillText('100', sliderRight, sliderY + sliderH + 6);

  // Direction label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${direction.toUpperCase()} ${target}`,
    DICE_CANVAS_W / 2,
    sliderY + sliderH + 24
  );

  return canvas.toBuffer('image/png');
}

// ─── Roulette Renderer ──────────────────────────────────────────────────────

const ROULETTE_CANVAS_W = 420;
const ROULETTE_CANVAS_H = 320;
const WHEEL_RADIUS = 100;

const ROULETTE_COLORS = {
  red: '#e53935',
  black: '#212121',
  green: '#2e7d32',
};

/**
 * Renders a roulette result as a PNG buffer with a glowing wheel.
 *
 * @param {object} options
 * @param {number} options.number - The winning number (0-36).
 * @param {string} options.color - The winning color ('red', 'black', or 'green').
 * @param {boolean} options.won - Whether the player won.
 * @param {string} [options.playerName='Player'] - Display name for the player.
 * @returns {Buffer} PNG image buffer.
 */
function renderRoulette({ number, color, won, playerName = 'Player' }) {
  const canvas = createCanvas(ROULETTE_CANVAS_W, ROULETTE_CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Dark gradient background.
  gradientRect(ctx, 0, 0, ROULETTE_CANVAS_W, ROULETTE_CANVAS_H, 16, '#0a0e0a', '#0d1117');

  // Neon border.
  roundRect(ctx, 0, 0, ROULETTE_CANVAS_W, ROULETTE_CANVAS_H, 16);
  ctx.strokeStyle = won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, ROULETTE_CANVAS_W / 2, 12);

  const cx = ROULETTE_CANVAS_W / 2;
  const cy = 150;

  // Outer glow ring.
  const numColor = ROULETTE_COLORS[color] || '#ffffff';
  glowCircle(ctx, cx, cy, WHEEL_RADIUS + 30, won ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 51, 102, 0.08)');

  // Outer wheel ring (metallic).
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_RADIUS + 8, 0, Math.PI * 2);
  const ringGrad = ctx.createRadialGradient(cx, cy, WHEEL_RADIUS, cx, cy, WHEEL_RADIUS + 8);
  ringGrad.addColorStop(0, '#a08050');
  ringGrad.addColorStop(1, '#6b5030');
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Wheel segments.
  const segments = 37;
  const segAngle = (Math.PI * 2) / segments;
  const wheelOrder = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
    11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
    22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];
  const redSet = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  for (let i = 0; i < segments; i++) {
    const startAngle = i * segAngle - Math.PI / 2;
    const endAngle = startAngle + segAngle;
    const num = wheelOrder[i];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, WHEEL_RADIUS, startAngle, endAngle);
    ctx.closePath();

    if (num === 0) {
      ctx.fillStyle = ROULETTE_COLORS.green;
    } else if (redSet.has(num)) {
      ctx.fillStyle = ROULETTE_COLORS.red;
    } else {
      ctx.fillStyle = ROULETTE_COLORS.black;
    }
    ctx.fill();

    // Segment border.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Inner circle (hub) with gradient.
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 32);
  hubGrad.addColorStop(0, '#3a3a3a');
  hubGrad.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#a08050';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Winning number in the center with glow.
  glowCircle(ctx, cx, cy, 20, numColor === '#212121' ? 'rgba(255,255,255,0.15)' : numColor.replace(')', ',0.3)').replace('rgb', 'rgba'));
  ctx.fillStyle = numColor === '#212121' ? '#ffffff' : numColor;
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), cx, cy);

  // Result label below the wheel.
  ctx.fillStyle = numColor === '#212121' ? '#ffffff' : numColor;
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${number} ${color.toUpperCase()}`,
    cx,
    cy + WHEEL_RADIUS + 18
  );

  return canvas.toBuffer('image/png');
}

// ─── Russian Roulette Renderer ──────────────────────────────────────────────

const RR_CANVAS_W = 420;
const RR_CANVAS_H = 300;
const CHAMBER_RADIUS = 80;
const BULLET_RADIUS = 10;

/**
 * Renders a Russian Roulette result as a PNG buffer with a glowing
 * revolver cylinder and the winner highlighted.
 *
 * @param {object} options
 * @param {Array<{id: string, username: string}>} options.players - All players.
 * @param {string} options.winnerUsername - The winner's display name.
 * @param {number} options.pot - The total prize pot.
 * @returns {Buffer} PNG image buffer.
 */
function renderRussianRoulette({ players, winnerUsername, pot }) {
  const canvas = createCanvas(RR_CANVAS_W, RR_CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Dark gradient background.
  gradientRect(ctx, 0, 0, RR_CANVAS_W, RR_CANVAS_H, 16, '#1a0a0a', '#0d1117');

  // Neon border (red theme).
  roundRect(ctx, 0, 0, RR_CANVAS_W, RR_CANVAS_H, 16);
  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title.
  ctx.fillStyle = '#ff3366';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('RUSSIAN ROULETTE', RR_CANVAS_W / 2, 14);

  const cx = RR_CANVAS_W / 2;
  const cy = 145;

  // Outer glow.
  glowCircle(ctx, cx, cy, CHAMBER_RADIUS + 30, 'rgba(255, 51, 102, 0.06)');

  // Cylinder body (metallic gradient).
  ctx.beginPath();
  ctx.arc(cx, cy, CHAMBER_RADIUS + 8, 0, Math.PI * 2);
  const outerGrad = ctx.createRadialGradient(cx, cy, CHAMBER_RADIUS - 10, cx, cy, CHAMBER_RADIUS + 8);
  outerGrad.addColorStop(0, '#555555');
  outerGrad.addColorStop(1, '#333333');
  ctx.fillStyle = outerGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, CHAMBER_RADIUS, 0, Math.PI * 2);
  const innerGrad = ctx.createRadialGradient(cx - 10, cy - 10, 5, cx, cy, CHAMBER_RADIUS);
  innerGrad.addColorStop(0, '#444444');
  innerGrad.addColorStop(1, '#222222');
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Draw chambers for each player.
  const count = Math.max(players.length, 2);
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const bx = cx + Math.cos(angle) * (CHAMBER_RADIUS - 24);
    const by = cy + Math.sin(angle) * (CHAMBER_RADIUS - 24);

    const player = players[i];
    const isWinner = player && player.username === winnerUsername;

    // Chamber glow for winner.
    if (isWinner) {
      glowCircle(ctx, bx, by, BULLET_RADIUS + 10, 'rgba(0, 255, 136, 0.4)');
    }

    // Chamber circle.
    ctx.beginPath();
    ctx.arc(bx, by, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isWinner ? '#00ff88' : '#0d0d0d';
    ctx.fill();
    ctx.strokeStyle = isWinner ? '#00ff88' : '#555555';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Center hub.
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
  hubGrad.addColorStop(0, '#666666');
  hubGrad.addColorStop(1, '#333333');
  ctx.fillStyle = hubGrad;
  ctx.fill();

  // Winner label.
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${winnerUsername} wins ${pot.toLocaleString()} coins!`,
    cx,
    cy + CHAMBER_RADIUS + 18
  );

  return canvas.toBuffer('image/png');
}

// ─── Shared Gradient & Glow Helpers ─────────────────────────────────────────

/**
 * Fills a rounded rectangle with a vertical gradient.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - Corner radius.
 * @param {string} colorTop - Top gradient color.
 * @param {string} colorBottom - Bottom gradient color.
 */
function gradientRect(ctx, x, y, w, h, r, colorTop, colorBottom) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Draws a glowing circle (radial gradient fading to transparent).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {string} color - Core glow color (hex).
 */
function glowCircle(ctx, cx, cy, radius, color) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a horizontal separator line with a subtle glow.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {string} color
 */
function glowLine(ctx, x, y, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ─── Balance / Wallet Card Renderer ─────────────────────────────────────────

const WALLET_W = 480;
const WALLET_H = 260;

/**
 * Renders a wallet/balance card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.playerName - Display name.
 * @param {number} options.balance - Current coin balance.
 * @param {string} options.tier - Tier label (WHALE, HIGH ROLLER, etc.).
 * @param {number} options.gamesPlayed - Total games played.
 * @param {number} options.wins - Total wins.
 * @param {string} options.winRate - Win rate string (e.g. "52.3").
 * @param {string} options.vipName - VIP level name.
 * @param {number} options.vipLevel - VIP tier number.
 * @returns {Buffer} PNG image buffer.
 */
function renderBalance({
  playerName = 'Player',
  balance = 0,
  tier = 'ROOKIE',
  gamesPlayed = 0,
  wins = 0,
  winRate = '0.0',
  vipName = 'None',
  vipLevel = 0,
}) {
  const canvas = createCanvas(WALLET_W, WALLET_H);
  const ctx = canvas.getContext('2d');

  // Background gradient.
  gradientRect(ctx, 0, 0, WALLET_W, WALLET_H, 16, '#0f0c29', '#1a1a3e');

  // Accent glow in top-right.
  glowCircle(ctx, WALLET_W - 60, 50, 120, 'rgba(255, 215, 0, 0.08)');

  // Border.
  roundRect(ctx, 0, 0, WALLET_W, WALLET_H, 16);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player name.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, 24, 20);

  // Tier badge.
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(tier, WALLET_W - 24, 24);

  // Separator.
  glowLine(ctx, 24, 48, WALLET_W - 48, '#ffd700');

  // Balance label.
  ctx.fillStyle = '#888899';
  ctx.font = '13px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('BALANCE', 24, 60);

  // Balance value.
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillText(balance.toLocaleString(), 24, 78);

  // "COINS" label.
  ctx.fillStyle = '#888899';
  ctx.font = 'bold 14px Arial, sans-serif';
  const balTextW = ctx.measureText(balance.toLocaleString()).width;
  ctx.fillText('COINS', 24 + balTextW + 10, 100);

  // Separator.
  glowLine(ctx, 24, 135, WALLET_W - 48, '#333355');

  // Stats row.
  const statsY = 150;
  const colW = (WALLET_W - 48) / 4;

  const statItems = [
    { label: 'GAMES', value: String(gamesPlayed) },
    { label: 'WINS', value: String(wins) },
    { label: 'WIN RATE', value: `${winRate}%` },
    { label: 'VIP', value: `${vipName} (T${vipLevel})` },
  ];

  for (let i = 0; i < statItems.length; i++) {
    const sx = 24 + i * colW;

    ctx.fillStyle = '#666688';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(statItems[i].label, sx, statsY);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(statItems[i].value, sx, statsY + 16);
  }

  // Bottom accent bar.
  const barY = WALLET_H - 30;
  roundRect(ctx, 24, barY, WALLET_W - 48, 6, 3);
  const barGrad = ctx.createLinearGradient(24, barY, WALLET_W - 24, barY);
  barGrad.addColorStop(0, '#ffd700');
  barGrad.addColorStop(0.5, '#ff6b35');
  barGrad.addColorStop(1, '#ffd700');
  ctx.fillStyle = barGrad;
  ctx.fill();

  return canvas.toBuffer('image/png');
}

// ─── Stats Card Renderer ────────────────────────────────────────────────────

const STATS_W = 500;
const STATS_H = 340;

/**
 * Renders a player stats card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.playerName - Display name.
 * @param {number} options.balance - Current balance.
 * @param {number} options.gamesPlayed - Total games.
 * @param {number} options.wins - Total wins.
 * @param {number} options.losses - Total losses.
 * @param {string} options.winRate - Win rate string.
 * @param {number} options.totalWagered - Total wagered.
 * @param {number} options.netProfit - Net profit (can be negative).
 * @param {Array<{game: string, games: number, wins: number, profit: number}>} options.perGame
 * @param {{game: string, profit: number}|null} options.biggestWin
 * @returns {Buffer} PNG image buffer.
 */
function renderStats({
  playerName = 'Player',
  balance = 0,
  gamesPlayed = 0,
  wins = 0,
  losses = 0,
  winRate = '0.0',
  totalWagered = 0,
  netProfit = 0,
  perGame = [],
  biggestWin = null,
}) {
  const rowCount = Math.min(perGame.length, 6);
  const dynamicH = STATS_H + rowCount * 22;
  const canvas = createCanvas(STATS_W, dynamicH);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, STATS_W, dynamicH, 16, '#0d1117', '#161b22');

  // Border.
  roundRect(ctx, 0, 0, STATS_W, dynamicH, 16);
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glow.
  glowCircle(ctx, 80, 40, 100, 'rgba(52, 152, 219, 0.06)');

  // Title.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${playerName}'s Stats`, 24, 18);

  glowLine(ctx, 24, 48, STATS_W - 48, '#3498db');

  // Top stats grid (2 rows x 3 cols).
  const gridY = 60;
  const gColW = (STATS_W - 48) / 3;
  const topStats = [
    { label: 'BALANCE', value: balance.toLocaleString(), color: '#ffd700' },
    { label: 'GAMES', value: String(gamesPlayed), color: '#e0e0e0' },
    { label: 'WIN RATE', value: `${winRate}%`, color: '#00ff88' },
    { label: 'WINS / LOSSES', value: `${wins}W / ${losses}L`, color: '#e0e0e0' },
    { label: 'WAGERED', value: totalWagered.toLocaleString(), color: '#e0e0e0' },
    { label: 'NET PROFIT', value: `${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}`, color: netProfit >= 0 ? '#00ff88' : '#ff3366' },
  ];

  for (let i = 0; i < topStats.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const sx = 24 + col * gColW;
    const sy = gridY + row * 48;

    ctx.fillStyle = '#666688';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(topStats[i].label, sx, sy);

    ctx.fillStyle = topStats[i].color;
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(topStats[i].value, sx, sy + 16);
  }

  // Per-game breakdown.
  let curY = gridY + 110;
  glowLine(ctx, 24, curY, STATS_W - 48, '#333355');
  curY += 12;

  ctx.fillStyle = '#888899';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GAME BREAKDOWN', 24, curY);
  curY += 22;

  for (let i = 0; i < rowCount; i++) {
    const g = perGame[i];
    const gProfit = g.profit;
    const gSign = gProfit >= 0 ? '+' : '';
    const gWinRate = ((g.wins / g.games) * 100).toFixed(0);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(g.game.toUpperCase(), 24, curY);

    ctx.fillStyle = '#888899';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(`${g.games} games  ${g.wins}W  ${gWinRate}%`, 140, curY);

    ctx.fillStyle = gProfit >= 0 ? '#00ff88' : '#ff3366';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${gSign}${gProfit.toLocaleString()}`, STATS_W - 24, curY);

    curY += 22;
  }

  // Biggest win.
  if (biggestWin) {
    curY += 6;
    glowLine(ctx, 24, curY, STATS_W - 48, '#333355');
    curY += 14;

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`BIGGEST WIN: ${biggestWin.game.toUpperCase()} +${biggestWin.profit.toLocaleString()}`, 24, curY);
  }

  return canvas.toBuffer('image/png');
}

// ─── Leaderboard Renderer ───────────────────────────────────────────────────

const LB_W = 480;
const LB_ROW_H = 32;
const LB_HEADER_H = 70;
const LB_PAD = 20;

/**
 * Renders a leaderboard as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.title - Leaderboard title.
 * @param {Array<{rank: number, name: string, value: string}>} options.rows - Up to 10 rows.
 * @returns {Buffer} PNG image buffer.
 */
function renderLeaderboard({ title = 'Leaderboard', rows = [] }) {
  const count = Math.min(rows.length, 10);
  const canvasH = LB_HEADER_H + count * LB_ROW_H + LB_PAD * 2;
  const canvas = createCanvas(LB_W, canvasH);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, LB_W, canvasH, 16, '#1a0a2e', '#0d1117');

  // Border.
  roundRect(ctx, 0, 0, LB_W, canvasH, 16);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glow.
  glowCircle(ctx, LB_W / 2, 30, 140, 'rgba(255, 215, 0, 0.06)');

  // Title.
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, LB_W / 2, 18);

  glowLine(ctx, 24, 52, LB_W - 48, '#ffd700');

  // Rows.
  const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
  let curY = LB_HEADER_H;

  for (let i = 0; i < count; i++) {
    const row = rows[i];

    // Highlight top 3 rows.
    if (i < 3) {
      roundRect(ctx, 16, curY - 2, LB_W - 32, LB_ROW_H - 2, 6);
      ctx.fillStyle = `rgba(255, 215, 0, ${0.08 - i * 0.02})`;
      ctx.fill();
    }

    // Rank.
    ctx.fillStyle = i < 3 ? medalColors[i] : '#666688';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`#${row.rank}`, 28, curY + 6);

    // Name.
    ctx.fillStyle = i < 3 ? '#ffffff' : '#cccccc';
    ctx.font = i < 3 ? 'bold 14px Arial, sans-serif' : '14px Arial, sans-serif';
    ctx.fillText(row.name, 70, curY + 6);

    // Value.
    ctx.fillStyle = i < 3 ? '#ffd700' : '#aaaacc';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(row.value, LB_W - 28, curY + 6);

    curY += LB_ROW_H;
  }

  return canvas.toBuffer('image/png');
}

// ─── History Renderer ───────────────────────────────────────────────────────

const HIST_W = 500;
const HIST_ROW_H = 28;
const HIST_HEADER_H = 60;

/**
 * Renders a game history card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.playerName - Display name.
 * @param {Array<{game: string, bet: number, profit: number, won: boolean, date: string}>} options.games
 * @returns {Buffer} PNG image buffer.
 */
function renderHistory({ playerName = 'Player', games = [] }) {
  const count = Math.min(games.length, 15);
  const canvasH = HIST_HEADER_H + count * HIST_ROW_H + 30;
  const canvas = createCanvas(HIST_W, canvasH);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, HIST_W, canvasH, 16, '#0d1117', '#1a1a2e');

  // Border.
  roundRect(ctx, 0, 0, HIST_W, canvasH, 16);
  ctx.strokeStyle = '#9b59b6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${playerName}'s History`, 24, 16);

  glowLine(ctx, 24, 44, HIST_W - 48, '#9b59b6');

  // Column headers.
  let curY = HIST_HEADER_H;
  ctx.fillStyle = '#666688';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('#', 24, curY - 16);
  ctx.fillText('GAME', 50, curY - 16);
  ctx.fillText('BET', 180, curY - 16);
  ctx.fillText('RESULT', 260, curY - 16);
  ctx.textAlign = 'right';
  ctx.fillText('DATE', HIST_W - 24, curY - 16);

  // Rows.
  for (let i = 0; i < count; i++) {
    const g = games[i];
    const sign = g.profit >= 0 ? '+' : '';

    // Alternating row bg.
    if (i % 2 === 0) {
      roundRect(ctx, 16, curY - 2, HIST_W - 32, HIST_ROW_H - 2, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fill();
    }

    // Row number.
    ctx.fillStyle = '#555566';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${i + 1}`, 24, curY + 5);

    // Game name.
    ctx.fillStyle = '#cccccc';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText(g.game, 50, curY + 5);

    // Bet.
    ctx.fillStyle = '#aaaacc';
    ctx.fillText(g.bet.toLocaleString(), 180, curY + 5);

    // Result.
    ctx.fillStyle = g.won ? '#00ff88' : '#ff3366';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(`${sign}${g.profit.toLocaleString()}`, 260, curY + 5);

    // Date.
    ctx.fillStyle = '#555566';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(g.date, HIST_W - 24, curY + 6);

    curY += HIST_ROW_H;
  }

  return canvas.toBuffer('image/png');
}

// ─── VIP Card Renderer ──────────────────────────────────────────────────────

const VIP_W = 460;
const VIP_H = 240;

/**
 * Renders a VIP status card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.playerName - Display name.
 * @param {string} options.levelName - Current VIP level name.
 * @param {number} options.levelNum - Current VIP tier number.
 * @param {number} options.totalWagered - Total wagered amount.
 * @param {string} options.cashbackRate - Cashback rate string (e.g. "2.5").
 * @param {string|null} options.nextLevelName - Next level name or null if max.
 * @param {number} options.progress - Progress to next level (0-1).
 * @returns {Buffer} PNG image buffer.
 */
function renderVip({
  playerName = 'Player',
  levelName = 'None',
  levelNum = 0,
  totalWagered = 0,
  cashbackRate = '0.0',
  nextLevelName = null,
  progress = 0,
}) {
  const canvas = createCanvas(VIP_W, VIP_H);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, VIP_W, VIP_H, 16, '#1a0a2e', '#2d1b4e');

  // Border.
  roundRect(ctx, 0, 0, VIP_W, VIP_H, 16);
  ctx.strokeStyle = '#e91e63';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glow.
  glowCircle(ctx, VIP_W - 80, 60, 120, 'rgba(233, 30, 99, 0.08)');

  // Title.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${playerName} - VIP Status`, 24, 18);

  glowLine(ctx, 24, 46, VIP_W - 48, '#e91e63');

  // Level badge.
  const badgeX = 24;
  const badgeY = 60;
  roundRect(ctx, badgeX, badgeY, 160, 50, 10);
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + 160, badgeY + 50);
  badgeGrad.addColorStop(0, '#e91e63');
  badgeGrad.addColorStop(1, '#9c27b0');
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(levelName, badgeX + 80, badgeY + 18);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(`Tier ${levelNum}`, badgeX + 80, badgeY + 38);

  // Stats.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const infoX = 210;

  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('TOTAL WAGERED', infoX, 62);
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(totalWagered.toLocaleString(), infoX, 78);

  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('CASHBACK RATE', infoX + 160, 62);
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(`${cashbackRate}%`, infoX + 160, 78);

  // Progress bar.
  const barY = 135;
  glowLine(ctx, 24, barY - 10, VIP_W - 48, '#333355');

  if (nextLevelName) {
    ctx.fillStyle = '#888899';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Next: ${nextLevelName}`, 24, barY);

    ctx.fillStyle = '#888899';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${(progress * 100).toFixed(1)}%`, VIP_W - 24, barY);

    // Bar background.
    const pbY = barY + 20;
    roundRect(ctx, 24, pbY, VIP_W - 48, 14, 7);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // Bar fill.
    const fillW = Math.max((VIP_W - 48) * Math.min(progress, 1), 14);
    roundRect(ctx, 24, pbY, fillW, 14, 7);
    const pbGrad = ctx.createLinearGradient(24, pbY, 24 + fillW, pbY);
    pbGrad.addColorStop(0, '#e91e63');
    pbGrad.addColorStop(1, '#ff6b35');
    ctx.fillStyle = pbGrad;
    ctx.fill();
  } else {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MAX LEVEL REACHED', VIP_W / 2, barY + 10);
  }

  return canvas.toBuffer('image/png');
}

// ─── Tip Card Renderer ──────────────────────────────────────────────────────

const TIP_W = 400;
const TIP_H = 180;

/**
 * Renders a tip/transfer card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.senderName - Sender display name.
 * @param {string} options.recipientName - Recipient display name.
 * @param {number} options.amount - Amount tipped.
 * @param {number} options.senderBalance - Sender's new balance.
 * @param {number} options.recipientBalance - Recipient's new balance.
 * @returns {Buffer} PNG image buffer.
 */
function renderTip({
  senderName = 'Sender',
  recipientName = 'Recipient',
  amount = 0,
  senderBalance = 0,
  recipientBalance = 0,
}) {
  const canvas = createCanvas(TIP_W, TIP_H);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, TIP_W, TIP_H, 16, '#0d1117', '#0a2a1a');

  // Border.
  roundRect(ctx, 0, 0, TIP_W, TIP_H, 16);
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title.
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('COIN TRANSFER', TIP_W / 2, 16);

  glowLine(ctx, 24, 42, TIP_W - 48, '#2ecc71');

  // Transfer visual: sender -> amount -> recipient.
  const midY = 75;

  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(senderName, 80, midY);

  // Arrow.
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText(`${amount.toLocaleString()}`, TIP_W / 2, midY - 4);
  ctx.fillStyle = '#888899';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('coins', TIP_W / 2, midY + 22);

  // Arrow lines.
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, midY + 8);
  ctx.lineTo(160, midY + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(TIP_W - 160, midY + 8);
  ctx.lineTo(TIP_W - 140, midY + 8);
  ctx.stroke();

  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(recipientName, TIP_W - 80, midY);

  // Balances.
  glowLine(ctx, 24, 120, TIP_W - 48, '#333355');

  ctx.fillStyle = '#888899';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${senderName}: ${senderBalance.toLocaleString()}`, 24, 132);
  ctx.textAlign = 'right';
  ctx.fillText(`${recipientName}: ${recipientBalance.toLocaleString()}`, TIP_W - 24, 132);

  return canvas.toBuffer('image/png');
}

// ─── Deposit Card Renderer ──────────────────────────────────────────────────

const DEP_W = 440;
const DEP_H = 200;

/**
 * Renders a deposit address card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.chain - Blockchain name (ETH, BSC, etc.).
 * @param {string} options.address - Deposit address.
 * @param {string} options.tokens - Supported tokens string.
 * @param {number} options.confirmations - Required confirmations.
 * @returns {Buffer} PNG image buffer.
 */
function renderDeposit({
  chain = 'ETH',
  address = '',
  tokens = '',
  confirmations = 12,
}) {
  const canvas = createCanvas(DEP_W, DEP_H);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, DEP_W, DEP_H, 16, '#0d1117', '#0a1a2e');

  // Border.
  roundRect(ctx, 0, 0, DEP_W, DEP_H, 16);
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chain badge.
  const badgeW = 80;
  roundRect(ctx, 24, 16, badgeW, 28, 6);
  ctx.fillStyle = '#3498db';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(chain, 24 + badgeW / 2, 30);

  // Title.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Deposit Address', 120, 20);

  glowLine(ctx, 24, 52, DEP_W - 48, '#3498db');

  // Address box.
  roundRect(ctx, 24, 64, DEP_W - 48, 36, 8);
  ctx.fillStyle = '#0a0a1a';
  ctx.fill();
  ctx.strokeStyle = '#333355';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#00ff88';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Truncate address if too long.
  const displayAddr = address.length > 46 ? address.substring(0, 22) + '...' + address.substring(address.length - 22) : address;
  ctx.fillText(displayAddr, DEP_W / 2, 82);

  // Info row.
  const infoY = 118;
  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SUPPORTED TOKENS', 24, infoY);
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(tokens, 24, infoY + 16);

  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('CONFIRMATIONS', DEP_W - 24, infoY);
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(String(confirmations), DEP_W - 24, infoY + 16);

  // Warning.
  ctx.fillStyle = '#ff9900';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Only send supported tokens. Other tokens may be lost.', DEP_W / 2, DEP_H - 22);

  return canvas.toBuffer('image/png');
}

// ─── Withdraw Card Renderer ─────────────────────────────────────────────────

const WD_W = 440;
const WD_H = 220;

/**
 * Renders a withdrawal request card as a PNG buffer.
 *
 * @param {object} options
 * @param {number} options.requestId - Request ID.
 * @param {number} options.amount - Withdrawal amount.
 * @param {string} options.chain - Blockchain.
 * @param {string} options.address - Destination address.
 * @param {string} options.status - Request status.
 * @param {boolean} options.needsApproval - Whether admin approval is needed.
 * @returns {Buffer} PNG image buffer.
 */
function renderWithdraw({
  requestId = 0,
  amount = 0,
  chain = 'ETH',
  address = '',
  status = 'Pending',
  needsApproval = false,
}) {
  const canvas = createCanvas(WD_W, WD_H);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, WD_W, WD_H, 16, '#0d1117', '#1a0a0a');

  // Border.
  const borderColor = needsApproval ? '#f1c40f' : '#2ecc71';
  roundRect(ctx, 0, 0, WD_W, WD_H, 16);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Withdrawal Request', 24, 16);

  // Request ID badge.
  ctx.fillStyle = borderColor;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`#${requestId}`, WD_W - 24, 20);

  glowLine(ctx, 24, 44, WD_W - 48, borderColor);

  // Amount.
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(amount.toLocaleString(), WD_W / 2, 56);
  ctx.fillStyle = '#888899';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('COINS', WD_W / 2, 92);

  // Address box.
  roundRect(ctx, 24, 112, WD_W - 48, 30, 6);
  ctx.fillStyle = '#0a0a1a';
  ctx.fill();

  ctx.fillStyle = '#aaaacc';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const wdAddr = address.length > 46 ? address.substring(0, 22) + '...' + address.substring(address.length - 22) : address;
  ctx.fillText(wdAddr, WD_W / 2, 127);

  // Bottom info.
  const btmY = 155;
  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CHAIN', 24, btmY);
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(chain, 24, btmY + 16);

  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STATUS', WD_W / 2, btmY);
  ctx.fillStyle = needsApproval ? '#f1c40f' : '#2ecc71';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText(status, WD_W / 2, btmY + 16);

  return canvas.toBuffer('image/png');
}

// ─── Daily / Weekly Reward Renderer ─────────────────────────────────────────

const REWARD_W = 420;
const REWARD_H = 200;

/**
 * Renders a daily/weekly reward card as a PNG buffer.
 *
 * @param {object} options
 * @param {string} options.type - 'daily' or 'weekly'.
 * @param {number} options.amount - Coins awarded.
 * @param {number} options.streak - Current streak count.
 * @param {number} options.newBalance - New balance after reward.
 * @param {string} options.playerName - Display name.
 * @returns {Buffer} PNG image buffer.
 */
function renderReward({
  type = 'daily',
  amount = 0,
  streak = 1,
  newBalance = 0,
  playerName = 'Player',
}) {
  const canvas = createCanvas(REWARD_W, REWARD_H);
  const ctx = canvas.getContext('2d');

  const isWeekly = type === 'weekly';
  const accentColor = isWeekly ? '#9b59b6' : '#2ecc71';

  // Background.
  gradientRect(ctx, 0, 0, REWARD_W, REWARD_H, 16,
    isWeekly ? '#1a0a2e' : '#0a1a0a',
    isWeekly ? '#0d0520' : '#0d1117'
  );

  // Border.
  roundRect(ctx, 0, 0, REWARD_W, REWARD_H, 16);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glow.
  glowCircle(ctx, REWARD_W / 2, 80, 100, `${accentColor}22`);

  // Title.
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(isWeekly ? 'WEEKLY CHEST' : 'DAILY REWARD', REWARD_W / 2, 16);

  ctx.fillStyle = '#888899';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText(playerName, REWARD_W / 2, 42);

  // Amount.
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText(`+${amount.toLocaleString()}`, REWARD_W / 2, 65);
  ctx.fillStyle = '#888899';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('COINS', REWARD_W / 2, 110);

  // Streak and balance.
  glowLine(ctx, 24, 132, REWARD_W - 48, '#333355');

  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('STREAK', 24, 142);
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(`${streak} ${isWeekly ? 'weeks' : 'days'}`, 24, 158);

  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('NEW BALANCE', REWARD_W - 24, 142);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(newBalance.toLocaleString(), REWARD_W - 24, 158);

  return canvas.toBuffer('image/png');
}

// ─── Mines Renderer ─────────────────────────────────────────────────────────

const MINES_TILE = 44;
const MINES_GAP = 6;
const MINES_GRID = 5;
const MINES_PAD = 24;

/**
 * Renders a mines game board as a PNG buffer.
 *
 * @param {object} options
 * @param {number[]} options.revealed - Indices of revealed safe tiles.
 * @param {number[]} options.minePositions - Indices of mine tiles.
 * @param {boolean} options.exploded - Whether the player hit a mine.
 * @param {boolean} options.cashedOut - Whether the player cashed out.
 * @param {number} options.multiplier - Current multiplier.
 * @param {string} [options.playerName='Player'] - Display name.
 * @returns {Buffer} PNG image buffer.
 */
function renderMines({
  revealed = [],
  minePositions = [],
  exploded = false,
  cashedOut = false,
  multiplier = 1,
  playerName = 'Player',
}) {
  const gridPx = MINES_GRID * MINES_TILE + (MINES_GRID - 1) * MINES_GAP;
  const canvasW = gridPx + MINES_PAD * 2;
  const canvasH = gridPx + MINES_PAD * 2 + 70; // extra for header + footer
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  const gameOver = exploded || cashedOut;
  const mineSet = new Set(minePositions);
  const revealedSet = new Set(revealed);

  // Background.
  gradientRect(ctx, 0, 0, canvasW, canvasH, 16,
    exploded ? '#1a0a0a' : cashedOut ? '#0a1a10' : '#0d0e14', '#0d1117');

  // Border.
  roundRect(ctx, 0, 0, canvasW, canvasH, 16);
  ctx.strokeStyle = exploded ? '#ff3366' : cashedOut ? '#00ff88' : '#9b59b6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, canvasW / 2, 12);

  // Draw grid.
  const gridStartX = MINES_PAD;
  const gridStartY = 42;

  for (let row = 0; row < MINES_GRID; row++) {
    for (let col = 0; col < MINES_GRID; col++) {
      const idx = row * MINES_GRID + col;
      const tx = gridStartX + col * (MINES_TILE + MINES_GAP);
      const ty = gridStartY + row * (MINES_TILE + MINES_GAP);

      const isMine = mineSet.has(idx);
      const isRevealed = revealedSet.has(idx);
      const showMine = gameOver && isMine;

      if (isRevealed && !isMine) {
        // Revealed safe tile (gem).
        roundRect(ctx, tx, ty, MINES_TILE, MINES_TILE, 6);
        ctx.fillStyle = '#0a2a1a';
        ctx.fill();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Gem symbol.
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2666', tx + MINES_TILE / 2, ty + MINES_TILE / 2);
      } else if (showMine) {
        // Revealed mine.
        const hitThis = isRevealed && isMine;
        roundRect(ctx, tx, ty, MINES_TILE, MINES_TILE, 6);
        ctx.fillStyle = hitThis ? '#4a0a0a' : '#2a0a0a';
        ctx.fill();
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = hitThis ? 3 : 1.5;
        ctx.stroke();

        if (hitThis) {
          glowCircle(ctx, tx + MINES_TILE / 2, ty + MINES_TILE / 2, MINES_TILE / 2, 'rgba(255,51,102,0.3)');
        }

        // Mine symbol.
        ctx.fillStyle = '#ff3366';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2716', tx + MINES_TILE / 2, ty + MINES_TILE / 2);
      } else {
        // Hidden tile.
        roundRect(ctx, tx, ty, MINES_TILE, MINES_TILE, 6);
        const tileGrad = ctx.createLinearGradient(tx, ty, tx, ty + MINES_TILE);
        tileGrad.addColorStop(0, '#2a2a3e');
        tileGrad.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = tileGrad;
        ctx.fill();
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // Footer: multiplier.
  const footerY = gridStartY + MINES_GRID * (MINES_TILE + MINES_GAP) + 10;
  if (cashedOut) {
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${multiplier}x`, canvasW / 2, footerY);
  } else if (exploded) {
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BOOM!', canvasW / 2, footerY);
  } else {
    ctx.fillStyle = '#9b59b6';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${multiplier}x`, canvasW / 2, footerY);
  }

  return canvas.toBuffer('image/png');
}

// ─── Plinko Renderer ────────────────────────────────────────────────────────

const PLINKO_W = 420;
const PLINKO_H = 360;
const PLINKO_ROWS = 8;

/**
 * Renders a plinko board result as a PNG buffer.
 *
 * @param {object} options
 * @param {number[]} options.path - Array of 0/1 for each row (0=left, 1=right).
 * @param {number} options.slot - The final slot index (0 to PLINKO_ROWS).
 * @param {number} options.multiplier - The payout multiplier.
 * @param {boolean} options.won - Whether the player profited.
 * @param {string} [options.playerName='Player'] - Display name.
 * @returns {Buffer} PNG image buffer.
 */
function renderPlinko({ path = [], slot = 0, multiplier = 1, won = false, playerName = 'Player' }) {
  const canvas = createCanvas(PLINKO_W, PLINKO_H);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, PLINKO_W, PLINKO_H, 16, '#0d0a1a', '#0d1117');

  // Border.
  roundRect(ctx, 0, 0, PLINKO_W, PLINKO_H, 16);
  ctx.strokeStyle = won ? '#00ff88' : '#ff9900';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, PLINKO_W / 2, 12);

  const pegRadius = 4;
  const startY = 50;
  const rowSpacing = 28;
  const pegSpacing = 32;

  // Draw pegs and ball path.
  let ballX = PLINKO_W / 2;
  let ballY = startY;

  for (let row = 0; row < PLINKO_ROWS; row++) {
    const pegsInRow = row + 3;
    const rowWidth = (pegsInRow - 1) * pegSpacing;
    const rowStartX = (PLINKO_W - rowWidth) / 2;
    const rowY = startY + row * rowSpacing;

    for (let p = 0; p < pegsInRow; p++) {
      const px = rowStartX + p * pegSpacing;

      ctx.beginPath();
      ctx.arc(px, rowY, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#555577';
      ctx.fill();
    }

    // Ball position after this row.
    if (row < path.length) {
      const dir = path[row]; // 0=left, 1=right
      const nextPegsInRow = row + 4;
      const nextRowWidth = (nextPegsInRow - 1) * pegSpacing;
      const nextRowStartX = (PLINKO_W - nextRowWidth) / 2;
      const nextRowY = startY + (row + 1) * rowSpacing;

      // Calculate ball position between pegs.
      const pegIdx = Math.floor((ballX - rowStartX) / pegSpacing);
      const nextPegIdx = Math.min(pegIdx + dir, nextPegsInRow - 1);
      ballX = nextRowStartX + nextPegIdx * pegSpacing;
      ballY = nextRowY;

      // Draw trail segment.
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ballX, ballY - rowSpacing);
      ctx.lineTo(ballX, ballY);
      ctx.stroke();
    }
  }

  // Draw ball at final position.
  glowCircle(ctx, ballX, ballY, 16, 'rgba(255, 215, 0, 0.3)');
  ctx.beginPath();
  ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
  const ballGrad = ctx.createRadialGradient(ballX - 2, ballY - 2, 1, ballX, ballY, 8);
  ballGrad.addColorStop(0, '#fff8dc');
  ballGrad.addColorStop(1, '#ffd700');
  ctx.fillStyle = ballGrad;
  ctx.fill();

  // Draw multiplier slots at the bottom.
  const slotCount = PLINKO_ROWS + 1;
  const slotW = 36;
  const slotH = 28;
  const slotGap = 4;
  const totalSlotW = slotCount * slotW + (slotCount - 1) * slotGap;
  const slotStartX = (PLINKO_W - totalSlotW) / 2;
  const slotY = startY + PLINKO_ROWS * rowSpacing + 20;

  // Multiplier values (symmetric, higher at edges).
  const slotMultipliers = [];
  const mid = Math.floor(slotCount / 2);
  for (let i = 0; i < slotCount; i++) {
    const dist = Math.abs(i - mid);
    slotMultipliers.push(parseFloat((1 + dist * 0.8).toFixed(1)));
  }

  for (let i = 0; i < slotCount; i++) {
    const sx = slotStartX + i * (slotW + slotGap);
    const isActive = i === slot;
    const m = slotMultipliers[i];

    roundRect(ctx, sx, slotY, slotW, slotH, 4);
    if (isActive) {
      ctx.fillStyle = won ? '#0a2a1a' : '#2a1a00';
      ctx.fill();
      ctx.strokeStyle = won ? '#00ff88' : '#ff9900';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = isActive ? (won ? '#00ff88' : '#ff9900') : '#666688';
    ctx.font = isActive ? 'bold 12px Arial, sans-serif' : '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${m}x`, sx + slotW / 2, slotY + slotH / 2);
  }

  // Result text.
  const resultY = slotY + slotH + 16;
  ctx.fillStyle = won ? '#00ff88' : '#ff9900';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${multiplier}x`, PLINKO_W / 2, resultY);

  return canvas.toBuffer('image/png');
}

// ─── Wheel of Fortune Renderer ──────────────────────────────────────────────

const WOF_W = 420;
const WOF_H = 340;
const WOF_RADIUS = 120;

/**
 * Renders a wheel of fortune result as a PNG buffer.
 *
 * @param {object} options
 * @param {Array<{label: string, multiplier: number, color: string}>} options.segments - Wheel segments.
 * @param {number} options.winningIndex - Index of the winning segment.
 * @param {number} options.multiplier - The payout multiplier.
 * @param {boolean} options.won - Whether the player profited.
 * @param {string} [options.playerName='Player'] - Display name.
 * @returns {Buffer} PNG image buffer.
 */
function renderWheel({
  segments = [],
  winningIndex = 0,
  multiplier = 1,
  won = false,
  playerName = 'Player',
}) {
  const canvas = createCanvas(WOF_W, WOF_H);
  const ctx = canvas.getContext('2d');

  // Background.
  gradientRect(ctx, 0, 0, WOF_W, WOF_H, 16, '#0d0a1a', '#0d1117');

  // Border.
  roundRect(ctx, 0, 0, WOF_W, WOF_H, 16);
  ctx.strokeStyle = won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, WOF_W / 2, 12);

  const cx = WOF_W / 2;
  const cy = 160;
  const segCount = segments.length || 1;
  const segAngle = (Math.PI * 2) / segCount;

  // Outer glow.
  glowCircle(ctx, cx, cy, WOF_RADIUS + 30, won ? 'rgba(0, 255, 136, 0.06)' : 'rgba(255, 51, 102, 0.06)');

  // Outer ring.
  ctx.beginPath();
  ctx.arc(cx, cy, WOF_RADIUS + 8, 0, Math.PI * 2);
  const ringGrad = ctx.createRadialGradient(cx, cy, WOF_RADIUS, cx, cy, WOF_RADIUS + 8);
  ringGrad.addColorStop(0, '#888888');
  ringGrad.addColorStop(1, '#444444');
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Rotate so winning segment is at the top (pointer position).
  const rotationOffset = -winningIndex * segAngle - segAngle / 2 - Math.PI / 2;

  // Draw segments.
  for (let i = 0; i < segCount; i++) {
    const startAngle = rotationOffset + i * segAngle;
    const endAngle = startAngle + segAngle;
    const seg = segments[i] || { color: '#333355' };

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, WOF_RADIUS, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Segment label.
    const midAngle = startAngle + segAngle / 2;
    const labelR = WOF_RADIUS * 0.65;
    const lx = cx + Math.cos(midAngle) * labelR;
    const ly = cy + Math.sin(midAngle) * labelR;

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seg.label || '', 0, 0);
    ctx.restore();
  }

  // Center hub.
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
  hubGrad.addColorStop(0, '#555555');
  hubGrad.addColorStop(1, '#222222');
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pointer (triangle at top).
  const pointerY = cy - WOF_RADIUS - 12;
  ctx.beginPath();
  ctx.moveTo(cx, pointerY + 18);
  ctx.lineTo(cx - 10, pointerY);
  ctx.lineTo(cx + 10, pointerY);
  ctx.closePath();
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Result text.
  const resultY = cy + WOF_RADIUS + 20;
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${multiplier}x`, WOF_W / 2, resultY);

  return canvas.toBuffer('image/png');
}

// ─── Game Animation Renderers ───────────────────────────────────────────────
// These produce "in-progress" PNG images shown during the animation phase of
// each game, replacing the old text-based embed frames.

const ANIM_W = 420;
const ANIM_H = 200;

/**
 * Shared helper: renders a generic game animation PNG with a title, an
 * animated-style status line, and an optional icon drawn via a callback.
 *
 * @param {object} options
 * @param {string} options.title - Game title (e.g. "COINFLIP").
 * @param {string} options.status - Status text (e.g. "Flipping . . .").
 * @param {string} options.accentColor - Neon accent color.
 * @param {string} [options.playerName] - Player display name.
 * @param {string} [options.subtitle] - Extra info line below status.
 * @param {(ctx: CanvasRenderingContext2D, cx: number, cy: number) => void} [options.drawIcon]
 * @returns {Buffer} PNG image buffer.
 */
function renderAnimationFrame({
  title,
  status,
  accentColor = '#5865f2',
  playerName = '',
  subtitle = '',
  drawIcon = null,
}) {
  const canvas = createCanvas(ANIM_W, ANIM_H);
  const ctx = canvas.getContext('2d');

  // Dark gradient background.
  gradientRect(ctx, 0, 0, ANIM_W, ANIM_H, 16, '#0d1117', '#0a0e14');

  // Neon border.
  roundRect(ctx, 0, 0, ANIM_W, ANIM_H, 16);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ambient glow.
  glowCircle(ctx, ANIM_W / 2, ANIM_H / 2, 120, `${accentColor}18`);

  // Player name (top-left).
  if (playerName) {
    ctx.fillStyle = '#888899';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(playerName, 20, 14);
  }

  // Title.
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, ANIM_W / 2, 40);

  // Optional icon.
  if (drawIcon) {
    drawIcon(ctx, ANIM_W / 2, 100);
  }

  // Status text.
  const statusY = drawIcon ? 140 : 95;
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(status, ANIM_W / 2, statusY);

  // Subtitle.
  if (subtitle) {
    ctx.fillStyle = '#666688';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(subtitle, ANIM_W / 2, statusY + 30);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Coinflip animation: shows a spinning coin icon with "Flipping . . ."
 */
function renderCoinflipAnim({ playerName = '', choice = '' } = {}) {
  return renderAnimationFrame({
    title: 'C O I N F L I P',
    status: 'Flipping . . .',
    accentColor: '#ffd700',
    playerName,
    subtitle: choice ? `Picked ${choice.toUpperCase()}` : '',
    drawIcon: (ctx, cx, cy) => {
      // Spinning coin (ellipse to suggest rotation).
      ctx.beginPath();
      ctx.ellipse(cx, cy, 28, 22, 0, 0, Math.PI * 2);
      const coinGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 28);
      coinGrad.addColorStop(0, '#fff8dc');
      coinGrad.addColorStop(0.5, '#ffd700');
      coinGrad.addColorStop(1, '#b8860b');
      ctx.fillStyle = coinGrad;
      ctx.fill();
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Question mark.
      ctx.fillStyle = '#6b4e0a';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy);
    },
  });
}

/**
 * Slots animation: shows slot reels with "Rolling . . ."
 */
function renderSlotsAnim({ playerName = '' } = {}) {
  return renderAnimationFrame({
    title: 'S L O T   M A C H I N E',
    status: 'Rolling . . .',
    accentColor: '#9b59b6',
    playerName,
    drawIcon: (ctx, cx, cy) => {
      // Three reel boxes with question marks.
      const reelW = 44;
      const reelH = 44;
      const gap = 14;
      const totalW = 3 * reelW + 2 * gap;
      const startX = cx - totalW / 2;
      for (let i = 0; i < 3; i++) {
        const rx = startX + i * (reelW + gap);
        const ry = cy - reelH / 2;
        roundRect(ctx, rx, ry, reelW, reelH, 8);
        ctx.fillStyle = '#0d0d1a';
        ctx.fill();
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', rx + reelW / 2, cy);
      }
    },
  });
}

/**
 * Crash animation: shows a rocket icon with "Launching . . ."
 */
function renderCrashAnim({ playerName = '', cashout = 0 } = {}) {
  return renderAnimationFrame({
    title: 'C R A S H',
    status: 'Launching . . .',
    accentColor: '#ff6b35',
    playerName,
    subtitle: cashout ? `Target: ${cashout}x` : '',
    drawIcon: (ctx, cx, cy) => {
      // Rocket triangle.
      ctx.beginPath();
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx - 14, cy + 16);
      ctx.lineTo(cx + 14, cy + 16);
      ctx.closePath();
      const rocketGrad = ctx.createLinearGradient(cx, cy - 22, cx, cy + 16);
      rocketGrad.addColorStop(0, '#ff6b35');
      rocketGrad.addColorStop(1, '#ff3366');
      ctx.fillStyle = rocketGrad;
      ctx.fill();
      // Flame.
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 16);
      ctx.lineTo(cx, cy + 30);
      ctx.lineTo(cx + 8, cy + 16);
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();
    },
  });
}

/**
 * Dice animation: shows a die icon with "Rolling . . ."
 */
function renderDiceAnim({ playerName = '', direction = '', target = 0 } = {}) {
  return renderAnimationFrame({
    title: 'D I C E',
    status: 'Rolling . . .',
    accentColor: '#3498db',
    playerName,
    subtitle: direction && target ? `${direction.toUpperCase()} ${target}` : '',
    drawIcon: (ctx, cx, cy) => {
      // Die face.
      const size = 44;
      roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 8);
      const dieGrad = ctx.createLinearGradient(cx, cy - size / 2, cx, cy + size / 2);
      dieGrad.addColorStop(0, '#2a2a3e');
      dieGrad.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = dieGrad;
      ctx.fill();
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Question mark.
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy);
    },
  });
}

/**
 * Roulette animation: shows a wheel icon with "Spinning . . ."
 */
function renderRouletteAnim({ playerName = '', betLabel = '' } = {}) {
  return renderAnimationFrame({
    title: 'R O U L E T T E',
    status: 'Spinning . . .',
    accentColor: '#2e7d32',
    playerName,
    subtitle: betLabel ? `Bet: ${betLabel}` : '',
    drawIcon: (ctx, cx, cy) => {
      // Simplified wheel circle.
      const r = 26;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      const wheelGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      wheelGrad.addColorStop(0, '#333333');
      wheelGrad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = wheelGrad;
      ctx.fill();
      // Colored segments (simplified).
      const colors = ['#e53935', '#212121', '#2e7d32', '#212121', '#e53935', '#212121'];
      const segAngle = (Math.PI * 2) / colors.length;
      for (let i = 0; i < colors.length; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r - 2, i * segAngle, (i + 1) * segAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
      }
      // Center hub.
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#555555';
      ctx.fill();
    },
  });
}

/**
 * Plinko animation: shows a ball icon with "Dropping . . ."
 */
function renderPlinkoAnim({ playerName = '' } = {}) {
  return renderAnimationFrame({
    title: 'P L I N K O',
    status: 'Dropping . . .',
    accentColor: '#ff9900',
    playerName,
    drawIcon: (ctx, cx, cy) => {
      // Pegs.
      const pegR = 4;
      const positions = [
        [cx - 24, cy - 12], [cx, cy - 12], [cx + 24, cy - 12],
        [cx - 12, cy + 4], [cx + 12, cy + 4],
        [cx - 24, cy + 20], [cx, cy + 20], [cx + 24, cy + 20],
      ];
      for (const [px, py] of positions) {
        ctx.beginPath();
        ctx.arc(px, py, pegR, 0, Math.PI * 2);
        ctx.fillStyle = '#555577';
        ctx.fill();
      }
      // Ball at top.
      ctx.beginPath();
      ctx.arc(cx, cy - 28, 7, 0, Math.PI * 2);
      const ballGrad = ctx.createRadialGradient(cx - 2, cy - 30, 1, cx, cy - 28, 7);
      ballGrad.addColorStop(0, '#fff8dc');
      ballGrad.addColorStop(1, '#ffd700');
      ctx.fillStyle = ballGrad;
      ctx.fill();
    },
  });
}

/**
 * Wheel animation: shows a wheel icon with "Spinning . . ."
 */
function renderWheelAnim({ playerName = '' } = {}) {
  return renderAnimationFrame({
    title: 'W H E E L',
    status: 'Spinning . . .',
    accentColor: '#e91e63',
    playerName,
    drawIcon: (ctx, cx, cy) => {
      // Simplified wheel.
      const r = 26;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#444444';
      ctx.fill();
      const segColors = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#b71c1c', '#424242'];
      const segAngle = (Math.PI * 2) / segColors.length;
      for (let i = 0; i < segColors.length; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, i * segAngle, (i + 1) * segAngle);
        ctx.closePath();
        ctx.fillStyle = segColors[i];
        ctx.fill();
      }
      // Hub.
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#555555';
      ctx.fill();
      // Pointer.
      ctx.beginPath();
      ctx.moveTo(cx, cy - r - 8);
      ctx.lineTo(cx - 6, cy - r - 16);
      ctx.lineTo(cx + 6, cy - r - 16);
      ctx.closePath();
      ctx.fillStyle = '#ffd700';
      ctx.fill();
    },
  });
}

/**
 * Blackjack dealing animation: shows cards being dealt with "Dealing . . ."
 */
function renderBlackjackAnim({ playerName = '' } = {}) {
  return renderAnimationFrame({
    title: 'B L A C K J A C K',
    status: 'Dealing . . .',
    accentColor: '#1a6b3c',
    playerName,
    drawIcon: (ctx, cx, cy) => {
      // Two overlapping card backs.
      const cw = 36;
      const ch = 50;
      for (let i = 0; i < 2; i++) {
        const ox = cx - 24 + i * 20;
        const oy = cy - ch / 2 + i * 4;
        roundRect(ctx, ox, oy, cw, ch, 6);
        const cardGrad = ctx.createLinearGradient(ox, oy, ox, oy + ch);
        cardGrad.addColorStop(0, '#3a6fc4');
        cardGrad.addColorStop(1, '#2c5aa0');
        ctx.fillStyle = cardGrad;
        ctx.fill();
        ctx.strokeStyle = '#1a3a6b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Inner diamond.
        const dcx = ox + cw / 2;
        const dcy = oy + ch / 2;
        ctx.fillStyle = '#1e3f73';
        ctx.beginPath();
        ctx.moveTo(dcx, dcy - 8);
        ctx.lineTo(dcx + 8, dcy);
        ctx.lineTo(dcx, dcy + 8);
        ctx.lineTo(dcx - 8, dcy);
        ctx.closePath();
        ctx.fill();
      }
    },
  });
}

module.exports = {
  renderBlackjackTable,
  renderCoinflip,
  renderSlots,
  renderCrash,
  renderDice,
  renderRoulette,
  renderRussianRoulette,
  renderBalance,
  renderStats,
  renderLeaderboard,
  renderHistory,
  renderVip,
  renderTip,
  renderDeposit,
  renderWithdraw,
  renderReward,
  renderMines,
  renderPlinko,
  renderWheel,
  renderAnimationFrame,
  renderCoinflipAnim,
  renderSlotsAnim,
  renderCrashAnim,
  renderDiceAnim,
  renderRouletteAnim,
  renderPlinkoAnim,
  renderWheelAnim,
  renderBlackjackAnim,
};
