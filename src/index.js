require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { loadCommands } = require('./utils/commandHandler');
const { startCronJobs } = require('./jobs/dailyBonus');

// Validate required environment variables.
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[BOT] Logged in as ${readyClient.user.tag}`);
  await loadCommands(client);
  startCronJobs(client);
});

// Handle slash command interactions.
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands?.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[ERR] Command /${interaction.commandName}:`, error);
      const reply = {
        content: 'An error occurred while running this command.',
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
    return;
  }

  // Handle button interactions (used by games).
  if (interaction.isButton()) {
    const [handler] = interaction.customId.split(':');
    const command = client.commands?.get(handler);
    if (command && command.handleButton) {
      try {
        await command.handleButton(interaction);
      } catch (error) {
        console.error(`[ERR] Button ${interaction.customId}:`, error);
        const reply = {
          content: 'An error occurred while processing this action.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
