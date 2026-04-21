require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const { loadCommands, resolveCommand, PREFIX } = require('./utils/commandHandler');
const { startCronJobs } = require('./jobs/dailyBonus');
const { runChecks } = require('./utils/rateLimit');
const { initDepositListener } = require('./services/depositListener');

// Validate required environment variables.
const requiredEnvVars = ['DISCORD_TOKEN'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[FATAL] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[BOT] Logged in as ${readyClient.user.tag}`);
  console.log(`[BOT] Prefix: ${PREFIX}`);
  loadCommands(client);
  startCronJobs(client);

  // Start the Express server for webhook endpoints.
  const app = express();
  const port = process.env.WEBHOOK_PORT || 3000;

  app.get('/health', (_req, res) => res.json({ status: 'ok', bot: readyClient.user.tag }));
  initDepositListener(client, app);

  app.listen(port, () => {
    console.log(`[HTTP] Webhook server listening on port ${port}`);
  });
});

// --- Prefix Command Handler ---
client.on(Events.MessageCreate, async (message) => {
  // Ignore bots and messages without the prefix.
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  // Parse command name and arguments.
  const content = message.content.slice(PREFIX.length).trim();
  if (!content) return;

  const args = content.split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = resolveCommand(client, commandName);
  if (!command) return;

  // Run pre-command checks (ban, exclusion, rate limit).
  const blocked = runChecks(message.author.id, command.name);
  if (blocked) {
    return message.reply(blocked);
  }

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`[ERR] Command ${PREFIX}${commandName}:`, error);
    try {
      await message.reply('An error occurred while running this command.');
    } catch (_replyErr) {
      // Message may have been deleted.
    }
  }
});

// --- Button Interactions (still used by games like blackjack, coinflip, exclude) ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const [handler] = interaction.customId.split(':');
    const command = resolveCommand(client, handler);
    if (command && command.handleButton) {
      try {
        await command.handleButton(interaction);
      } catch (error) {
        console.error(`[ERR] Button ${interaction.customId}:`, error);
        const reply = { content: 'An error occurred.', ephemeral: true };
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
