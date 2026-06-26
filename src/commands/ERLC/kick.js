import { SlashCommandBuilder } from 'discord.js';
import { kickUser } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the ER:LC server')
    .addStringOption(opt =>
      opt
        .setName('username')
        .setDescription('Username to kick')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for kick')
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

      const result = await kickUser(config.apiKey, username, reason);

      if (result.success) {
        const embed = {
          title: '✅ User Kicked',
          color: 0xff6600,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Action', value: 'Kick', inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
            { name: 'Executed By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Kick command: ${username} (${reason}) by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to kick user: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Kick command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

