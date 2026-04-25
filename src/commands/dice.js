const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playDice } = require('../games/dice');
const {
  COLORS,
  sleep,
} = require('../utils/animations');
const EMOJIS = require('../utils/emojis');
const { renderDice, renderDiceAnim } = require('../utils/cardRenderer');

const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('🎲 Roll a dice (1-100). Bet over or under a target number.')
  .addIntegerOption((opt) =>
    opt.setName('bet').setDescription('Amount to wager').setRequired(true).setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName('direction')
      .setDescription('Over or under the target')
      .setRequired(true)
      .addChoices(
        { name: 'Over', value: 'over' },
        { name: 'Under', value: 'under' }
      )
  )
  .addIntegerOption((opt) =>
    opt
      .setName('target')
      .setDescription('Target number (1-99)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(99)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  ensureWallet(userId);

  const bet = interaction.options.getInteger('bet');
  const direction = interaction.options.getString('direction');
  const target = interaction.options.getInteger('target');
  const balance = getBalance(userId);

  if (bet > balance) {
    return interaction.reply({
      content: `❌ Insufficient funds. Your balance: **${balance.toLocaleString()}** coins`,
      ephemeral: true,
    });
  }

  // Validate the target produces a valid win chance.
  const winChance =
    direction === 'over' ? (100 - target) / 100 : (target - 1) / 100;
  if (winChance <= 0 || winChance >= 1) {
    return interaction.reply({
      content: '❌ Invalid target for that direction. Ensure there is a chance to win and lose.',
      ephemeral: true,
    });
  }

  let result;
  try {
    result = playDice(userId, bet, direction, target);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.reply({ content: '❌ Insufficient funds.', ephemeral: true });
    }
    throw error;
  }

  const winChancePercent = (winChance * 100).toFixed(1);

  // ── Animation frame: Rolling PNG ──
  const animBuffer = renderDiceAnim({
    playerName: interaction.user.username,
    direction,
    target,
  });
  const animAttachment = new AttachmentBuilder(animBuffer, { name: 'rolling.png' });

  const animEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.dice}  D I C E  ${EMOJIS.dice}`)
    .setColor(COLORS.pending)
    .setImage('attachment://rolling.png');

  const msg = await interaction.reply({ embeds: [animEmbed], files: [animAttachment], fetchReply: true });

  // ── Result after delay ──
  await sleep(1800);

  const color = result.won ? COLORS.win : COLORS.lose;

  // Render the dice result image.
  const pngBuffer = renderDice({
    roll: result.roll,
    target,
    direction,
    won: result.won,
    playerName: interaction.user.username,
  });
  const attachment = new AttachmentBuilder(pngBuffer, { name: 'dice.png' });

  const finalEmbed = new EmbedBuilder()
    .setTitle(`${EMOJIS.dice}  ROLLED ${result.roll}  ${EMOJIS.dice}`)
    .setDescription(
      result.won
        ? `**+${result.payout.toLocaleString()}** coins (${result.multiplier}x)`
        : `Rolled **${result.roll}** -- needed **${direction} ${target}**`
    )
    .setColor(color)
    .setImage('attachment://dice.png')
    .addFields(
      { name: '🎯 Multiplier', value: `\`${result.multiplier}x\``, inline: true },
      { name: '📊 Win Chance', value: `\`${winChancePercent}%\``, inline: true },
      { name: `${EMOJIS.coin} Balance`, value: `\`${result.newBalance.toLocaleString()}\``, inline: true },
      { name: '🔢 Nonce', value: `\`${result.nonce}\``, inline: true },
      { name: `${EMOJIS.shield} Seed`, value: `\`${result.serverSeedHash.substring(0, 12)}...\``, inline: true }
    )
    .setFooter({ text: `${EMOJIS.shield} Provably Fair | /fairness` })
    .setTimestamp();

  if (result.vipLevelUp) {
    finalEmbed.addFields({
      name: '⭐ VIP Level Up!',
      value: `You reached **${result.vipLevelUp.name}**!`,
      inline: false,
    });
  }

  return msg.edit({ embeds: [finalEmbed], files: [attachment] });
}

module.exports = { data, execute };
