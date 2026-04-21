const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getBalance, ensureWallet } = require('../utils/wallet');
const { playCoinflip } = require('../games/coinflip');

const name = 'coinflip';
const aliases = ['cf', 'flip'];
const description = 'Flip a coin! Usage: =coinflip <bet> [heads|tails]';

// Pending bets for button-based selection.
const pendingBets = new Map();

async function execute(message, args) {
  const userId = message.author.id;
  ensureWallet(userId);

  if (args.length < 1) {
    return message.reply('Usage: `=coinflip <bet> [heads|tails]`\nExample: `=coinflip 100 heads` or `=coinflip 100` (pick via buttons)');
  }

  const bet = parseInt(args[0], 10);
  if (isNaN(bet) || bet < 1) {
    return message.reply('Bet must be a positive number.');
  }

  const balance = getBalance(userId);
  if (bet > balance) {
    return message.reply(`Insufficient funds. Your balance: **${balance}**`);
  }

  // If the user provided a choice directly, resolve immediately.
  if (args[1]) {
    const choice = args[1].toLowerCase();
    if (!['heads', 'tails', 'h', 't'].includes(choice)) {
      return message.reply('Choice must be `heads` or `tails`.');
    }
    const normalizedChoice = choice.startsWith('h') ? 'heads' : 'tails';

    let result;
    try {
      result = playCoinflip(userId, bet, normalizedChoice);
    } catch (error) {
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return message.reply('Insufficient funds.');
      }
      throw error;
    }

    const color = result.won ? 0x2ecc71 : 0xe74c3c;
    const outcomeText = result.won
      ? `You won **${result.payout}** coins!`
      : `You lost **${bet}** coins.`;

    const embed = new EmbedBuilder()
      .setTitle(`Coinflip - ${result.side.toUpperCase()}`)
      .setDescription(
        `${message.author.username} picked **${normalizedChoice}**.\n` +
        `The coin landed on **${result.side}**.\n\n` +
        outcomeText
      )
      .setColor(color)
      .addFields(
        { name: 'Balance', value: `${result.newBalance}`, inline: true },
        { name: 'Nonce', value: `${result.nonce}`, inline: true }
      )
      .setFooter({ text: 'Provably Fair | =fairness to verify' });

    return message.reply({ embeds: [embed] });
  }

  // No choice provided -- show buttons.
  pendingBets.set(userId, bet);

  const embed = new EmbedBuilder()
    .setTitle('Coinflip')
    .setDescription(`**${message.author.username}** wagered **${bet}** coins.\nPick a side!`)
    .setColor(0xf1c40f)
    .setFooter({ text: `Balance: ${balance}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coinflip:heads:${userId}`)
      .setLabel('Heads')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`coinflip:tails:${userId}`)
      .setLabel('Tails')
      .setStyle(ButtonStyle.Secondary)
  );

  return message.reply({ embeds: [embed], components: [row] });
}

async function handleButton(interaction) {
  const [, choice, ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'This is not your game!', ephemeral: true });
  }

  const bet = pendingBets.get(ownerId);
  if (!bet) {
    return interaction.reply({ content: 'This game has expired.', ephemeral: true });
  }

  pendingBets.delete(ownerId);

  let result;
  try {
    result = playCoinflip(ownerId, bet, choice);
  } catch (error) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return interaction.update({ content: 'Insufficient funds.', embeds: [], components: [] });
    }
    throw error;
  }

  const color = result.won ? 0x2ecc71 : 0xe74c3c;
  const outcomeText = result.won
    ? `You won **${result.payout}** coins!`
    : `You lost **${bet}** coins.`;

  const embed = new EmbedBuilder()
    .setTitle(`Coinflip - ${result.side.toUpperCase()}`)
    .setDescription(
      `${interaction.user.username} picked **${choice}**.\n` +
      `The coin landed on **${result.side}**.\n\n` +
      outcomeText
    )
    .setColor(color)
    .addFields(
      { name: 'Balance', value: `${result.newBalance}`, inline: true },
      { name: 'Nonce', value: `${result.nonce}`, inline: true }
    )
    .setFooter({ text: 'Provably Fair | =fairness to verify' });

  return interaction.update({ embeds: [embed], components: [] });
}

module.exports = { name, aliases, description, execute, handleButton };
