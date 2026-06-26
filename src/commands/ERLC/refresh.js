import { SlashCommandBuilder } from 'discord.js';
import { refreshUser } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Refresh a user on the ER:LC server')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Username to refresh')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const username = interaction.options.getString('username');
      const config = await getErlcConfig(interaction.guildId);

      if (!config?.apiKey) {
        return interaction.editReply({
          content: '❌ ERLC server not configured. Use `/erlc setup` first.',
          ephemeral: true
        });
      }

      const result = await refreshUser(config.apiKey, username);

      if (result.success) {
        const embed = {
          title: '✅ User Refreshed',
          color: 0x00ff00,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Action', value: 'Refresh', inline: true },
            { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Refresh command: ${username} by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to refresh user: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Refresh command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

