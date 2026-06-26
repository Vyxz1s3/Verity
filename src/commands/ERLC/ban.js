import { SlashCommandBuilder } from 'discord.js';
import { banUser } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the ER:LC server')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Username to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for ban')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const username = interaction.options.getString('username');
      const reason = interaction.options.getString('reason') || '';
      const config = await getErlcConfig(interaction.guildId);

      if (!config?.apiKey) {
        return interaction.editReply({
          content: '❌ ERLC server not configured. Use `/erlc setup` first.',
          ephemeral: true
        });
      }

      const result = await banUser(config.apiKey, username, reason);

      if (result.success) {
        const embed = {
          title: '✅ User Banned',
          color: 0xff0000,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Action', value: 'Ban', inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
            { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Ban command: ${username} (${reason}) by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to ban user: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Ban command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

