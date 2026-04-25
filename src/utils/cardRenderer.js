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

// ─── Coinflip Renderer ──────────────────────────────────────────────────────

const COIN_RADIUS = 64;
const COIN_BORDER = 6;
const COIN_CANVAS_W = 320;
const COIN_CANVAS_H = 220;

/**
 * Renders a coinflip result as a PNG buffer.
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

  // Background.
  roundRect(ctx, 0, 0, COIN_CANVAS_W, COIN_CANVAS_H, 12);
  ctx.fillStyle = won ? '#1a4a2a' : '#4a1a1a';
  ctx.fill();
  ctx.strokeStyle = won ? '#2a7a3a' : '#7a2a2a';
  ctx.lineWidth = 3;
  ctx.stroke();

  const cx = COIN_CANVAS_W / 2;
  const cy = 100;

  // Coin outer ring (gold).
  ctx.beginPath();
  ctx.arc(cx, cy, COIN_RADIUS + COIN_BORDER, 0, Math.PI * 2);
  ctx.fillStyle = '#c9a800';
  ctx.fill();

  // Coin inner circle.
  ctx.beginPath();
  ctx.arc(cx, cy, COIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();

  // Inner ring detail.
  ctx.beginPath();
  ctx.arc(cx, cy, COIN_RADIUS - 8, 0, Math.PI * 2);
  ctx.strokeStyle = '#c9a800';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Side label on the coin.
  ctx.fillStyle = '#8b6914';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side === 'heads' ? 'H' : 'T', cx, cy);

  // Side text below the coin.
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(side.toUpperCase(), cx, cy + COIN_RADIUS + COIN_BORDER + 8);

  // Player label at the top.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, cx, 10);

  return canvas.toBuffer('image/png');
}

// ─── Slots Renderer ─────────────────────────────────────────────────────────

const SLOT_REEL_SIZE = 80;
const SLOT_GAP = 16;
const SLOT_CANVAS_W = 360;
const SLOT_CANVAS_H = 200;

// Plain-text fallback symbols for canvas rendering (Discord custom emojis
// cannot be drawn on a server-side canvas).
const SLOT_SYMBOL_MAP = {
  diamond: { text: '\u2666', color: '#00bfff' },
  seven: { text: '7', color: '#ff4444' },
  bell: { text: '\u266A', color: '#ffd700' },
  cherry: { text: '\u2764', color: '#ff3366' },
  lemon: { text: 'L', color: '#ffee00' },
  orange: { text: 'O', color: '#ff9900' },
  grape: { text: 'G', color: '#9b59b6' },
};

/**
 * Renders a slot machine result as a PNG buffer.
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

  // Background.
  const isJackpot = multiplier >= 10;
  roundRect(ctx, 0, 0, SLOT_CANVAS_W, SLOT_CANVAS_H, 12);
  ctx.fillStyle = isJackpot ? '#3a2a00' : won ? '#1a4a2a' : '#2a1a2a';
  ctx.fill();
  ctx.strokeStyle = isJackpot ? '#ffd700' : won ? '#2a7a3a' : '#5a2a5a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, SLOT_CANVAS_W / 2, 10);

  // Draw 3 reel boxes.
  const totalReelW = 3 * SLOT_REEL_SIZE + 2 * SLOT_GAP;
  const startX = (SLOT_CANVAS_W - totalReelW) / 2;
  const reelY = 40;

  for (let i = 0; i < 3; i++) {
    const rx = startX + i * (SLOT_REEL_SIZE + SLOT_GAP);

    // Reel background.
    roundRect(ctx, rx, reelY, SLOT_REEL_SIZE, SLOT_REEL_SIZE, 8);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = isJackpot ? '#ffd700' : '#444466';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Symbol.
    const sym = SLOT_SYMBOL_MAP[reels[i].name] || { text: '?', color: '#ffffff' };
    ctx.fillStyle = sym.color;
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sym.text, rx + SLOT_REEL_SIZE / 2, reelY + SLOT_REEL_SIZE / 2);
  }

  // Multiplier / result text.
  const labelY = reelY + SLOT_REEL_SIZE + 20;
  if (won) {
    ctx.fillStyle = isJackpot ? '#ffd700' : '#00ff88';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${multiplier}x`, SLOT_CANVAS_W / 2, labelY);
  } else {
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('No match', SLOT_CANVAS_W / 2, labelY);
  }

  return canvas.toBuffer('image/png');
}

// ─── Crash Renderer ─────────────────────────────────────────────────────────

const CRASH_CANVAS_W = 400;
const CRASH_CANVAS_H = 220;
const CRASH_GRAPH_PAD = 50;
const CRASH_GRAPH_TOP = 40;
const CRASH_GRAPH_BOTTOM = 180;

/**
 * Renders a crash game result as a PNG buffer showing the multiplier graph.
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

  // Background.
  roundRect(ctx, 0, 0, CRASH_CANVAS_W, CRASH_CANVAS_H, 12);
  ctx.fillStyle = '#0d1117';
  ctx.fill();
  ctx.strokeStyle = won ? '#2a7a3a' : '#7a2a2a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, CRASH_CANVAS_W / 2, 8);

  // Graph area.
  const graphLeft = CRASH_GRAPH_PAD;
  const graphRight = CRASH_CANVAS_W - 20;
  const graphW = graphRight - graphLeft;
  const graphH = CRASH_GRAPH_BOTTOM - CRASH_GRAPH_TOP;

  // Axis lines.
  ctx.strokeStyle = '#333344';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(graphLeft, CRASH_GRAPH_TOP);
  ctx.lineTo(graphLeft, CRASH_GRAPH_BOTTOM);
  ctx.lineTo(graphRight, CRASH_GRAPH_BOTTOM);
  ctx.stroke();

  // Y-axis labels.
  const maxY = Math.max(crashPoint, cashout, 2);
  const ySteps = 4;
  ctx.fillStyle = '#666688';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= ySteps; i++) {
    const val = 1 + (maxY - 1) * (i / ySteps);
    const y = CRASH_GRAPH_BOTTOM - (i / ySteps) * graphH;
    ctx.fillText(`${val.toFixed(1)}x`, graphLeft - 6, y);

    // Grid line.
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(graphLeft, y);
      ctx.lineTo(graphRight, y);
      ctx.stroke();
    }
  }

  // Draw the multiplier curve.
  const steps = 60;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 + t * (crashPoint - 1);
    const x = graphLeft + t * graphW;
    const y = CRASH_GRAPH_BOTTOM - ((m - 1) / (maxY - 1)) * graphH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Crash / cashout marker.
  const markerM = won ? cashout : crashPoint;
  const markerT = (markerM - 1) / (crashPoint - 1 || 1);
  const markerX = graphLeft + Math.min(markerT, 1) * graphW;
  const markerY = CRASH_GRAPH_BOTTOM - ((markerM - 1) / (maxY - 1)) * graphH;

  ctx.beginPath();
  ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.fill();

  // Marker label.
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    won ? `${cashout}x` : `${crashPoint}x`,
    markerX,
    markerY - 10
  );

  // Result text at the bottom.
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.fillText(
    won ? `Cashed out at ${cashout}x` : `Crashed at ${crashPoint}x`,
    CRASH_CANVAS_W / 2,
    CRASH_GRAPH_BOTTOM + 8
  );

  return canvas.toBuffer('image/png');
}

// ─── Dice Renderer ──────────────────────────────────────────────────────────

const DICE_CANVAS_W = 380;
const DICE_CANVAS_H = 200;
const DIE_SIZE = 60;

/**
 * Draws a single die face with pips at the given position.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Top-left x.
 * @param {number} y - Top-left y.
 * @param {number} value - Die face value (1-6). Values > 6 show a dot.
 */
function drawDie(ctx, x, y, value) {
  // Die body.
  roundRect(ctx, x, y, DIE_SIZE, DIE_SIZE, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pip positions (relative to die center).
  const cx = x + DIE_SIZE / 2;
  const cy = y + DIE_SIZE / 2;
  const off = 14;
  const pipR = 4;

  const pipPositions = {
    1: [[0, 0]],
    2: [[-off, -off], [off, off]],
    3: [[-off, -off], [0, 0], [off, off]],
    4: [[-off, -off], [off, -off], [-off, off], [off, off]],
    5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
    6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
  };

  ctx.fillStyle = '#1a1a1a';
  const pips = pipPositions[value] || [[0, 0]];
  for (const [dx, dy] of pips) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders a dice game result as a PNG buffer showing the roll and slider.
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

  // Background.
  roundRect(ctx, 0, 0, DICE_CANVAS_W, DICE_CANVAS_H, 12);
  ctx.fillStyle = won ? '#1a3a2a' : '#3a1a1a';
  ctx.fill();
  ctx.strokeStyle = won ? '#2a7a3a' : '#7a2a2a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, DICE_CANVAS_W / 2, 8);

  // Draw a die showing the roll (use last digit mapped to 1-6 for the face).
  const dieFace = ((roll - 1) % 6) + 1;
  drawDie(ctx, DICE_CANVAS_W / 2 - DIE_SIZE / 2, 30, dieFace);

  // Roll number below the die.
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(roll), DICE_CANVAS_W / 2, 30 + DIE_SIZE + 8);

  // Slider bar.
  const sliderY = 140;
  const sliderH = 12;
  const sliderLeft = 30;
  const sliderRight = DICE_CANVAS_W - 30;
  const sliderW = sliderRight - sliderLeft;

  // Background bar.
  roundRect(ctx, sliderLeft, sliderY, sliderW, sliderH, sliderH / 2);
  ctx.fillStyle = '#333344';
  ctx.fill();

  // Win zone highlight.
  if (direction === 'over') {
    const zoneX = sliderLeft + (target / 100) * sliderW;
    roundRect(ctx, zoneX, sliderY, sliderRight - zoneX, sliderH, sliderH / 2);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.fill();
  } else {
    const zoneW = (target / 100) * sliderW;
    roundRect(ctx, sliderLeft, sliderY, zoneW, sliderH, sliderH / 2);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.fill();
  }

  // Target marker.
  const targetX = sliderLeft + (target / 100) * sliderW;
  ctx.fillStyle = '#ff9900';
  ctx.beginPath();
  ctx.arc(targetX, sliderY + sliderH / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  // Roll marker.
  const rollX = sliderLeft + (roll / 100) * sliderW;
  ctx.fillStyle = won ? '#00ff88' : '#ff3366';
  ctx.beginPath();
  ctx.arc(rollX, sliderY + sliderH / 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // Labels below slider.
  ctx.font = '11px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'left';
  ctx.fillText('1', sliderLeft, sliderY + sliderH + 4);
  ctx.textAlign = 'right';
  ctx.fillText('100', sliderRight, sliderY + sliderH + 4);

  // Direction label.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${direction.toUpperCase()} ${target}`,
    DICE_CANVAS_W / 2,
    sliderY + sliderH + 20
  );

  return canvas.toBuffer('image/png');
}

// ─── Roulette Renderer ──────────────────────────────────────────────────────

const ROULETTE_CANVAS_W = 320;
const ROULETTE_CANVAS_H = 240;
const WHEEL_RADIUS = 80;

const ROULETTE_COLORS = {
  red: '#d32f2f',
  black: '#1a1a1a',
  green: '#2e7d32',
};

/**
 * Renders a roulette result as a PNG buffer showing the wheel and number.
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

  // Background.
  roundRect(ctx, 0, 0, ROULETTE_CANVAS_W, ROULETTE_CANVAS_H, 12);
  ctx.fillStyle = '#0a1a0a';
  ctx.fill();
  ctx.strokeStyle = won ? '#2a7a3a' : '#7a2a2a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Player label.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(playerName, ROULETTE_CANVAS_W / 2, 8);

  const cx = ROULETTE_CANVAS_W / 2;
  const cy = 120;

  // Outer wheel ring.
  ctx.beginPath();
  ctx.arc(cx, cy, WHEEL_RADIUS + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#8b7355';
  ctx.fill();

  // Wheel segments (simplified: alternating red/black with green at top).
  const segments = 37;
  const segAngle = (Math.PI * 2) / segments;
  // European roulette order.
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
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Inner circle (hub).
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#2a2a2a';
  ctx.fill();
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Winning number in the center.
  const numColor = ROULETTE_COLORS[color] || '#ffffff';
  ctx.fillStyle = numColor;
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), cx, cy);

  // Result label below the wheel.
  ctx.fillStyle = numColor;
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${number} ${color.toUpperCase()}`,
    cx,
    cy + WHEEL_RADIUS + 14
  );

  return canvas.toBuffer('image/png');
}

// ─── Russian Roulette Renderer ──────────────────────────────────────────────

const RR_CANVAS_W = 320;
const RR_CANVAS_H = 220;
const CHAMBER_RADIUS = 60;
const BULLET_RADIUS = 8;

/**
 * Renders a Russian Roulette result as a PNG buffer showing the revolver
 * cylinder with the winner highlighted.
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

  // Background.
  roundRect(ctx, 0, 0, RR_CANVAS_W, RR_CANVAS_H, 12);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#7a2a2a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Title.
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('RUSSIAN ROULETTE', RR_CANVAS_W / 2, 8);

  const cx = RR_CANVAS_W / 2;
  const cy = 110;

  // Cylinder body.
  ctx.beginPath();
  ctx.arc(cx, cy, CHAMBER_RADIUS + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#555555';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, CHAMBER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#333333';
  ctx.fill();

  // Draw chambers for each player.
  const count = Math.max(players.length, 2);
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const bx = cx + Math.cos(angle) * (CHAMBER_RADIUS - 20);
    const by = cy + Math.sin(angle) * (CHAMBER_RADIUS - 20);

    const player = players[i];
    const isWinner = player && player.username === winnerUsername;

    // Chamber circle.
    ctx.beginPath();
    ctx.arc(bx, by, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isWinner ? '#00ff88' : '#1a1a1a';
    ctx.fill();
    ctx.strokeStyle = isWinner ? '#00ff88' : '#666666';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Center hub.
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#444444';
  ctx.fill();

  // Winner label.
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${winnerUsername} wins ${pot.toLocaleString()} coins!`,
    cx,
    cy + CHAMBER_RADIUS + 14
  );

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderBlackjackTable,
  renderCoinflip,
  renderSlots,
  renderCrash,
  renderDice,
  renderRoulette,
  renderRussianRoulette,
};
