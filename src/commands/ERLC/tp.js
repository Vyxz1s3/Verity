import { SlashCommandBuilder } from 'discord.js';
import { teleportUser } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tp')
    .setDescription('Teleport a user to another user')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Username to teleport')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('target')
        .setDescription('Target username to teleport to')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const username = interaction.options.getString('username');
      const target = interaction.options.getString('target');
      const config = await getErlcConfig(interaction.guildId);

      if (!config?.apiKey) {
        return interaction.editReply({
          content: '❌ ERLC server not configured. Use `/erlc setup` first.',
          ephemeral: true
        });
      }

      const result = await teleportUser(config.apiKey, username, target);

      if (result.success) {
        const embed = {
          title: '✅ User Teleported',
          color: 0x9900ff,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Target', value: target, inline: true },
            { name: 'Action', value: 'Teleport', inline: false },
            { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ TP command: ${username} -> ${target} by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to teleport user: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('TP command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

