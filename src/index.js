require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { loadCommands } = require('./utils/commandHandler');
const { startCronJobs } = require('./jobs/dailyBonus');
const { runChecks } = require('./utils/rateLimit');

// Validate required environment variables.
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required for VIP role assignment.
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[BOT] Logged in as ${readyClient.user.tag}`);
  await loadCommands(client);
  startCronJobs(client);
});

/**
 * Sends an error reply to an interaction, handling already-replied states.
 * @param {import('discord.js').Interaction} interaction
 * @param {string} message
 */
async function safeErrorReply(interaction, message) {
  const reply = { content: message, ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply);
  } else {
    await interaction.reply(reply);
  }
}

// Handle all interactions.
client.on(Events.InteractionCreate, async (interaction) => {
  // --- Slash Commands ---
  if (interaction.isChatInputCommand()) {
    const command = client.commands?.get(interaction.commandName);
    if (!command) return;

    // Run pre-command checks (ban, exclusion, rate limit).
    const blocked = runChecks(interaction.user.id, interaction.commandName);
    if (blocked) {
      return interaction.reply({ content: blocked, ephemeral: true });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[ERR] Command /${interaction.commandName}:`, error);
      await safeErrorReply(interaction, 'An error occurred while running this command.');
    }
    return;
  }

  // --- Button Interactions ---
  if (interaction.isButton()) {
    const [handler] = interaction.customId.split(':');
    const command = client.commands?.get(handler);
    if (command && command.handleButton) {
      try {
        await command.handleButton(interaction);
      } catch (error) {
        console.error(`[ERR] Button ${interaction.customId}:`, error);
        await safeErrorReply(interaction, 'An error occurred while processing this action.');
      }
    }
    return;
  }

  // --- Select Menu Interactions ---
  if (interaction.isStringSelectMenu()) {
    const [handler] = interaction.customId.split(':');
    const command = client.commands?.get(handler);
    if (command && command.handleSelectMenu) {
      try {
        await command.handleSelectMenu(interaction);
      } catch (error) {
        console.error(`[ERR] SelectMenu ${interaction.customId}:`, error);
        await safeErrorReply(interaction, 'An error occurred while processing this selection.');
      }
    }
    return;
  }

  // --- Modal Interactions ---
  if (interaction.isModalSubmit()) {
    const [handler] = interaction.customId.split(':');
    const command = client.commands?.get(handler);
    if (command && command.handleModal) {
      try {
        await command.handleModal(interaction);
      } catch (error) {
        console.error(`[ERR] Modal ${interaction.customId}:`, error);
        await safeErrorReply(interaction, 'An error occurred while processing this form.');
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
