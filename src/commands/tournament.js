const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../utils/database');
const { updateBalance, ensureWallet, getBalance } = require('../utils/wallet');

const data = new SlashCommandBuilder()
  .setName('tournament')
  .setDescription('Casino tournaments with prize pools.')
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('View active and upcoming tournaments.')
  )
  .addSubcommand((sub) =>
    sub
      .setName('join')
      .setDescription('Join an active tournament.')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Tournament ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('leaderboard')
      .setDescription('View the leaderboard for a tournament.')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Tournament ID').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a new tournament (Admin only).')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Tournament name').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('entry_fee').setDescription('Entry fee in coins (0 for free)').setRequired(true).setMinValue(0)
      )
      .addIntegerOption((opt) =>
        opt.setName('prize').setDescription('Base prize pool from house').setRequired(true).setMinValue(0)
      )
      .addStringOption((opt) =>
        opt.setName('game').setDescription('Restrict to a specific game (or leave empty for all)').setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt.setName('duration_hours').setDescription('Duration in hours (default 24)').setRequired(false).setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('end')
      .setDescription('End a tournament and distribute prizes (Admin only).')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Tournament ID').setRequired(true)
      )
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    const tournaments = db.prepare(
      'SELECT * FROM tournaments WHERE status IN (?, ?) ORDER BY starts_at ASC LIMIT 10'
    ).all('upcoming', 'active');

    if (tournaments.length === 0) {
      return interaction.reply({ content: 'No active or upcoming tournaments.', ephemeral: true });
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

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'join') {
    ensureWallet(userId);
    const tournamentId = interaction.options.getInteger('id');

    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
    if (!tournament) {
      return interaction.reply({ content: 'Tournament not found.', ephemeral: true });
    }

    if (tournament.status !== 'active' && tournament.status !== 'upcoming') {
      return interaction.reply({ content: 'This tournament is not accepting entries.', ephemeral: true });
    }

    const existing = db.prepare(
      'SELECT id FROM tournament_entries WHERE tournament_id = ? AND user_id = ?'
    ).get(tournamentId, userId);
    if (existing) {
      return interaction.reply({ content: 'You are already in this tournament.', ephemeral: true });
    }

    const playerCount = db.prepare(
      'SELECT COUNT(*) as count FROM tournament_entries WHERE tournament_id = ?'
    ).get(tournamentId).count;
    if (playerCount >= tournament.max_players) {
      return interaction.reply({ content: 'This tournament is full.', ephemeral: true });
    }

    // Charge entry fee.
    if (tournament.entry_fee > 0) {
      if (getBalance(userId) < tournament.entry_fee) {
        return interaction.reply({ content: 'Insufficient funds for the entry fee.', ephemeral: true });
      }
      updateBalance(userId, -tournament.entry_fee, `tournament #${tournamentId} entry`);
      // Add entry fee to prize pool.
      db.prepare('UPDATE tournaments SET prize_pool = prize_pool + ? WHERE id = ?')
        .run(tournament.entry_fee, tournamentId);
    }

    db.prepare('INSERT INTO tournament_entries (tournament_id, user_id) VALUES (?, ?)')
      .run(tournamentId, userId);

    // Auto-activate if upcoming.
    if (tournament.status === 'upcoming') {
      const now = new Date();
      if (new Date(tournament.starts_at) <= now) {
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('active', tournamentId);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('Tournament Joined!')
      .setDescription(`You joined **${tournament.name}** (#${tournamentId})`)
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Entry Fee', value: `${tournament.entry_fee}`, inline: true },
        { name: 'Prize Pool', value: `${tournament.prize_pool + (tournament.entry_fee || 0)}`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'leaderboard') {
    const tournamentId = interaction.options.getInteger('id');
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
    if (!tournament) {
      return interaction.reply({ content: 'Tournament not found.', ephemeral: true });
    }

    const entries = db.prepare(
      'SELECT user_id, score, games_played FROM tournament_entries WHERE tournament_id = ? ORDER BY score DESC LIMIT 15'
    ).all(tournamentId);

    if (entries.length === 0) {
      return interaction.reply({ content: 'No entries yet.', ephemeral: true });
    }

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

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'create') {
    // Admin only.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Admin only.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const entryFee = interaction.options.getInteger('entry_fee');
    const prize = interaction.options.getInteger('prize');
    const game = interaction.options.getString('game') || null;
    const durationHours = interaction.options.getInteger('duration_hours') || 24;

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

    const result = db.prepare(
      'INSERT INTO tournaments (name, game, entry_fee, prize_pool, status, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, game, entryFee, prize, 'active', startsAt.toISOString(), endsAt.toISOString(), userId);

    const embed = new EmbedBuilder()
      .setTitle('Tournament Created')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'ID', value: `#${result.lastInsertRowid}`, inline: true },
        { name: 'Name', value: name, inline: true },
        { name: 'Game', value: game || 'All', inline: true },
        { name: 'Entry Fee', value: `${entryFee}`, inline: true },
        { name: 'Prize Pool', value: `${prize}`, inline: true },
        { name: 'Ends', value: endsAt.toISOString().split('T')[0], inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === 'end') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Admin only.', ephemeral: true });
    }

    const tournamentId = interaction.options.getInteger('id');
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
    if (!tournament) {
      return interaction.reply({ content: 'Tournament not found.', ephemeral: true });
    }
    if (tournament.status === 'ended') {
      return interaction.reply({ content: 'Tournament already ended.', ephemeral: true });
    }

    // Get top 3 winners.
    const winners = db.prepare(
      'SELECT user_id, score FROM tournament_entries WHERE tournament_id = ? ORDER BY score DESC LIMIT 3'
    ).all(tournamentId);

    // Prize distribution: 60% / 25% / 15%.
    const splits = [0.6, 0.25, 0.15];
    const payouts = [];

    for (let i = 0; i < winners.length && i < 3; i++) {
      const amount = Math.floor(tournament.prize_pool * splits[i]);
      if (amount > 0) {
        ensureWallet(winners[i].user_id);
        updateBalance(winners[i].user_id, amount, `tournament #${tournamentId} prize (${i + 1}st)`);
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

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
