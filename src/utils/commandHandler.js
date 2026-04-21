const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');

/**
 * Loads all slash command modules from the /commands directory and registers
 * them with the Discord API.
 *
 * Each command file must export:
 *   - data: a SlashCommandBuilder instance
 *   - execute: an async function(interaction)
 *
 * @param {import('discord.js').Client} client - The Discord.js client.
 */
async function loadCommands(client) {
  client.commands = new Collection();

  const commandsDir = path.join(__dirname, '..', 'commands');
  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter((file) => file.endsWith('.js'));

  const commandData = [];

  for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file));

    if (!command.data || !command.execute) {
      console.warn(`[WARN] Command file ${file} is missing "data" or "execute". Skipping.`);
      continue;
    }

    client.commands.set(command.data.name, command);
    commandData.push(command.data.toJSON());
    console.log(`[CMD] Loaded: /${command.data.name}`);
  }

  // Register slash commands with the Discord API.
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`[CMD] Registering ${commandData.length} slash command(s)...`);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commandData,
    });
    console.log('[CMD] Slash commands registered successfully.');
  } catch (error) {
    console.error('[CMD] Failed to register slash commands:', error);
  }
}

module.exports = { loadCommands };
