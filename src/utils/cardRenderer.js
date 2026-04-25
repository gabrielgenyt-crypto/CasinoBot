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
};
