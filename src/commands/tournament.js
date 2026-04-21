const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');
const { updateBalance, ensureWallet, getBalance } = require('../utils/wallet');

const name = 'tournament';
const aliases = ['tourney', 'event'];
const description = 'Tournaments. Usage: =tournament <list|join|leaderboard|create|end> [args]';

async function execute(message, args) {
  const userId = message.author.id;
  const sub = (args[0] || 'list').toLowerCase();

  if (sub === 'list') {
    const tournaments = db.prepare(
      'SELECT * FROM tournaments WHERE status IN (?, ?) ORDER BY starts_at ASC LIMIT 10'
    ).all('upcoming', 'active');

    if (tournaments.length === 0) {
      return message.reply('No active or upcoming tournaments.');
    }

    const lines = tournaments.map((t) => {
      const playerCount = db.prepare(
        'SELECT COUNT(*) as count FROM tournament_entries WHERE tournament_id = ?'
      ).get(t.id).count;
      const statusEmoji = t.status === 'active' ? '🟢' : '🟡';
      return (
        `${statusEmoji} **#${t.id} — ${t.name}**\n` +
        `Game: ${t.game || 'All'} | Fee: ${t.entry_fee} | Prize: ${t.prize_pool} | Players: ${playerCount}/${t.max_players}\n` +
        `Ends: ${t.ends_at}`
      );
    });

    const embed = new EmbedBuilder()
      .setTitle('Tournaments')
      .setDescription(lines.join('\n\n'))
      .setColor(0xf1c40f);

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'join') {
    ensureWallet(userId);
    const tournamentId = parseInt(args[1], 10);
    if (isNaN(tournamentId)) return message.reply('Usage: `=tournament join <id>`');

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
    if (!tournament) return message.reply('Tournament not found.');
    if (tournament.status !== 'active' && tournament.status !== 'upcoming') {
      return message.reply('This tournament is not accepting entries.');
    }

    const existing = db.prepare(
      'SELECT id FROM tournament_entries WHERE tournament_id = ? AND user_id = ?'
    ).get(tournamentId, userId);
    if (existing) return message.reply('You are already in this tournament.');

    const playerCount = db.prepare(
      'SELECT COUNT(*) as count FROM tournament_entries WHERE tournament_id = ?'
    ).get(tournamentId).count;
    if (playerCount >= tournament.max_players) return message.reply('Tournament is full.');

    if (tournament.entry_fee > 0) {
      if (getBalance(userId) < tournament.entry_fee) {
        return message.reply('Insufficient funds for the entry fee.');
      }
      updateBalance(userId, -tournament.entry_fee, `tournament #${tournamentId} entry`);
      db.prepare('UPDATE tournaments SET prize_pool = prize_pool + ? WHERE id = ?')
        .run(tournament.entry_fee, tournamentId);
    }

    db.prepare('INSERT INTO tournament_entries (tournament_id, user_id) VALUES (?, ?)')
      .run(tournamentId, userId);

    if (tournament.status === 'upcoming' && new Date(tournament.starts_at) <= new Date()) {
      db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('active', tournamentId);
    }

    const embed = new EmbedBuilder()
      .setTitle('Tournament Joined!')
      .setDescription(`You joined **${tournament.name}** (#${tournamentId})`)
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Entry Fee', value: `${tournament.entry_fee}`, inline: true },
        { name: 'Prize Pool', value: `${tournament.prize_pool + (tournament.entry_fee || 0)}`, inline: true }
      );

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'leaderboard' || sub === 'lb') {
    const tournamentId = parseInt(args[1], 10);
    if (isNaN(tournamentId)) return message.reply('Usage: `=tournament leaderboard <id>`');

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
    if (!tournament) return message.reply('Tournament not found.');

    const entries = db.prepare(
      'SELECT user_id, score, games_played FROM tournament_entries WHERE tournament_id = ? ORDER BY score DESC LIMIT 15'
    ).all(tournamentId);

    if (entries.length === 0) return message.reply('No entries yet.');

    const lines = entries.map((e, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
      return `${medal} <@${e.user_id}> — **${e.score}** pts (${e.games_played} games)`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Tournament #${tournamentId} — ${tournament.name}`)
      .setDescription(lines.join('\n'))
      .setColor(0xf1c40f)
      .addFields({ name: 'Prize Pool', value: `${tournament.prize_pool} coins`, inline: true })
      .setFooter({ text: `Status: ${tournament.status} | Ends: ${tournament.ends_at}` });

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'create') {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Admin only.');
    }
    // =tournament create "Name" <entry_fee> <prize> [duration_hours] [game]
    if (args.length < 4) {
      return message.reply('Usage: `=tournament create <name> <entry_fee> <prize> [hours] [game]`');
    }

    const tournamentName = args[1];
    const entryFee = parseInt(args[2], 10);
    const prize = parseInt(args[3], 10);
    const durationHours = parseInt(args[4], 10) || 24;
    const game = args[5] || null;

    if (isNaN(entryFee) || isNaN(prize)) {
      return message.reply('Entry fee and prize must be numbers.');
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

    const result = db.prepare(
      'INSERT INTO tournaments (name, game, entry_fee, prize_pool, status, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(tournamentName, game, entryFee, prize, 'active', startsAt.toISOString(), endsAt.toISOString(), userId);

    const embed = new EmbedBuilder()
      .setTitle('Tournament Created')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'ID', value: `#${result.lastInsertRowid}`, inline: true },
        { name: 'Name', value: tournamentName, inline: true },
        { name: 'Entry Fee', value: `${entryFee}`, inline: true },
        { name: 'Prize Pool', value: `${prize}`, inline: true },
        { name: 'Duration', value: `${durationHours}h`, inline: true }
      );

    return message.reply({ embeds: [embed] });
  }

  if (sub === 'end') {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Admin only.');
    }

    const tournamentId = parseInt(args[1], 10);
    if (isNaN(tournamentId)) return message.reply('Usage: `=tournament end <id>`');

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
    if (!tournament) return message.reply('Tournament not found.');
    if (tournament.status === 'ended') return message.reply('Already ended.');

    const winners = db.prepare(
      'SELECT user_id, score FROM tournament_entries WHERE tournament_id = ? ORDER BY score DESC LIMIT 3'
    ).all(tournamentId);

    const splits = [0.6, 0.25, 0.15];
    const payouts = [];

    for (let i = 0; i < winners.length && i < 3; i++) {
      const amount = Math.floor(tournament.prize_pool * splits[i]);
      if (amount > 0) {
        ensureWallet(winners[i].user_id);
        updateBalance(winners[i].user_id, amount, `tournament #${tournamentId} prize`);
        payouts.push({ userId: winners[i].user_id, amount, place: i + 1 });
      }
    }

    db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('ended', tournamentId);

    const payoutLines = payouts.map((p) => {
      const medal = p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : '🥉';
      return `${medal} <@${p.userId}> — **${p.amount}** coins`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Tournament #${tournamentId} Ended — ${tournament.name}`)
      .setDescription(payoutLines.length > 0 ? payoutLines.join('\n') : 'No participants.')
      .setColor(0xe74c3c)
      .addFields({ name: 'Total Prize Pool', value: `${tournament.prize_pool}`, inline: true });

    return message.reply({ embeds: [embed] });
  }

  return message.reply('Usage: `=tournament <list|join|leaderboard|create|end> [args]`');
}

module.exports = { name, aliases, description, execute };
