import { logger } from '../../utils/logger.js';

export default {
  name: 'erlc_interrogation',
  async execute(interaction) {
    try {
      const suspect = interaction.fields.getTextInputValue('suspect_name');
      const charges = interaction.fields.getTextInputValue('charges');
      const evidence = interaction.fields.getTextInputValue('evidence');
      const notes = interaction.fields.getTextInputValue('notes');

      const embed = {
        title: '📋 Interrogation Report',
        color: 0xff6600,
        fields: [
          { name: 'Suspect', value: suspect, inline: true },
          { name: 'Officer', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Charges', value: charges, inline: false },
          { name: 'Evidence', value: evidence || 'None', inline: false },
          { name: 'Notes', value: notes || 'None', inline: false }
        ],
        footer: { text: `Report ID: ${Date.now()}` },
        timestamp: new Date()
      };

      await interaction.reply({ embeds: [embed] });
      logger.info(`📋 Interrogation report filed for ${suspect}`);
    } catch (err) {
      logger.error('❌ Modal error:', err.message);
      await interaction.reply({
        content: '❌ Failed to process report',
        ephemeral: true
      }).catch(() => {});
    }
  }
};

