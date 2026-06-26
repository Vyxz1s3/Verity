import { SlashCommandBuilder } from 'discord.js';
import { giveHelper } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('helper')
    .setDescription('Give helper permissions to a user')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Username to promote')
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

      const result = await giveHelper(config.apiKey, username);

      if (result.success) {
        const embed = {
          title: '✅ Helper Permissions Granted',
          color: 0xffff00,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Role', value: 'Helper', inline: true },
            { name: 'Promoted By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Helper command: ${username} by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to grant helper: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Helper command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

