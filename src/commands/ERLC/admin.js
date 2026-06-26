import { SlashCommandBuilder } from 'discord.js';
import { giveAdmin } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Give admin permissions to a user')
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

      const result = await giveAdmin(config.apiKey, username);

      if (result.success) {
        const embed = {
          title: '✅ Admin Permissions Granted',
          color: 0x0099ff,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Role', value: 'Admin', inline: true },
            { name: 'Promoted By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Admin command: ${username} by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to grant admin: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Admin command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

