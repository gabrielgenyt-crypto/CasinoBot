const { VIP_LEVELS } = require('../utils/vip');

/**
 * Manages Discord role assignment for VIP levels.
 * When a user levels up, removes old VIP roles and assigns the new one.
 *
 * Requires the bot to have the "Manage Roles" permission and the bot's
 * role must be higher than the VIP roles in the server hierarchy.
 */

/**
 * Assigns the appropriate VIP Discord role to a user after a level-up.
 * Removes any previous VIP roles first.
 *
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string} guildId - The guild (server) ID.
 * @param {string} userId - The Discord user ID.
 * @param {object} newLevel - The new VIP level object from VIP_LEVELS.
 */
const assignVipRole = async (client, guildId, userId, newLevel) => {
  if (!newLevel || !newLevel.roleName) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    // Collect all VIP role names.
    const vipRoleNames = VIP_LEVELS
      .filter((l) => l.roleName)
      .map((l) => l.roleName);

    // Remove any existing VIP roles.
    const rolesToRemove = member.roles.cache.filter((r) =>
      vipRoleNames.includes(r.name)
    );
    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove);
    }

    // Find or create the new VIP role.
    let role = guild.roles.cache.find((r) => r.name === newLevel.roleName);
    if (!role) {
      // Auto-create the role with a color based on tier.
      const colors = {
        1: 0xcd7f32, // Bronze
        2: 0xc0c0c0, // Silver
        3: 0xffd700, // Gold
        4: 0xe5e4e2, // Platinum
        5: 0xb9f2ff, // Diamond
      };
      role = await guild.roles.create({
        name: newLevel.roleName,
        color: colors[newLevel.level] || 0x95a5a6,
        reason: 'Auto-created VIP role',
      });
    }

    await member.roles.add(role);
    console.log(`[VIP] Assigned ${newLevel.roleName} to user ${userId}`);
  } catch (error) {
    console.warn(`[VIP] Failed to assign role for ${userId}:`, error.message);
  }
};

/**
 * Sends a VIP level-up notification in the channel where the game was played.
 *
 * @param {import('discord.js').Interaction} interaction - The game interaction.
 * @param {object} newLevel - The new VIP level object.
 */
const notifyLevelUp = async (interaction, newLevel) => {
  if (!newLevel || !newLevel.name) return;

  try {
    await interaction.followUp({
      content:
        `**VIP Level Up!** You are now **${newLevel.name}** (Tier ${newLevel.level})! ` +
        `Cashback rate: ${(newLevel.cashbackRate * 100).toFixed(1)}%`,
      ephemeral: true,
    });
  } catch (_error) {
    // Interaction may have expired.
  }
};

module.exports = { assignVipRole, notifyLevelUp };
