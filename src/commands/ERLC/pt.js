import { SlashCommandBuilder } from 'discord.js';
import { setPeaceTimer } from '../../services/erlcApi.js';
import { logger } from '../../utils/logger.js';
import { getErlcConfig } from '../../utils/erlcConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pt')
    .setDescription('Set peace timer on the ER:LC server')
    .addIntegerOption(opt =>
      opt
        .setName('minutes')
        .setDescription('Duration in minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const minutes = interaction.options.getInteger('minutes');
      const config = await getErlcConfig(interaction.guildId);

      if (!config?.apiKey) {
        return interaction.editReply({
          content: '❌ ERLC server not configured. Use `/erlc setup` first.',
          ephemeral: true
        });
      }

      const result = await setPeaceTimer(config.apiKey, minutes);

      if (result.success) {
        const embed = {
          title: '✅ Peace Timer Set',
          color: 0x00ff00,
          fields: [
            { name: 'Duration', value: `${minutes} minute(s)`, inline: true },
            { name: 'Action', value: 'Peace Timer', inline: true },
            { name: 'Set By', value: `<@${interaction.user.id}>`, inline: false }
          ],
          timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
        logger.info(`✅ PT command: ${minutes} minutes by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          content: `❌ Failed to set peace timer: ${result.error}`,
          ephemeral: true
        });
      }
    } catch (err) {
      logger.error('PT command error:', err.message);
      await interaction.editReply({
        content: '❌ An error occurred',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

