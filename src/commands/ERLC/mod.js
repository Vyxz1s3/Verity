import { SlashCommandBuilder } from 'discord.js';
import { giveMod } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Give moderator permissions to a user')
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

      const result = await giveMod(config.apiKey, username);

      if (result.success) {
        const embed = {
          title: '✅ Moderator Permissions Granted',
          color: 0x00ff99,
          fields: [
            { name: 'Username', value: username, inline: true },
            { name: 'Role', value: 'Moderator', inline: true },
            { name: 'Promoted By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ Mod command: ${username} by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to grant moderator: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('Mod command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

