import { SlashCommandBuilder } from 'discord.js';
import { loadUser } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('load')
    .setDescription('Respawn a user on the ER:LC server')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Username to respawn')
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

      const result = await loadUser(config.apiKey, username);

      if (result.success) {
        const embed = {
          title: '✅ User Respawned',
          color: 0x00ff00,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Action', value: 'Load (Respawn)', inline: true },
            { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Load command: ${username} by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to respawn user: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Load command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

