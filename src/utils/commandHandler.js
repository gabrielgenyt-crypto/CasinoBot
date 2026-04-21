const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

const PREFIX = '=';

/**
 * Loads all prefix command modules from the /commands directory.
 *
 * Each command file must export:
 *   - name: the command name (string)
 *   - execute: an async function(message, args)
 *   - aliases: (optional) array of alternative names
 *   - handleButton: (optional) async function(interaction) for button-based games
 *
 * @param {import('discord.js').Client} client - The Discord.js client.
 */
function loadCommands(client) {
  client.commands = new Collection();
  client.aliases = new Collection();

  const commandsDir = path.join(__dirname, '..', 'commands');
  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file));

    if (!command.name || !command.execute) {
      console.warn(`[WARN] Command file ${file} is missing "name" or "execute". Skipping.`);
      continue;
    }

    client.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        client.aliases.set(alias, command);
      }
    }

    console.log(`[CMD] Loaded: ${PREFIX}${command.name}`);
  }

  console.log(`[CMD] ${client.commands.size} command(s) loaded.`);
}

/**
 * Resolves a command by name or alias.
 * @param {import('discord.js').Client} client
 * @param {string} name
 * @returns {object|undefined}
 */
function resolveCommand(client, name) {
  return client.commands.get(name) || client.aliases.get(name);
}

module.exports = { loadCommands, resolveCommand, PREFIX };
