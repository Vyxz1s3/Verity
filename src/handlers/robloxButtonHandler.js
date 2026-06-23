import { roblox } from '../services/robloxService.js';
import { logger } from '../utils/logger.js';

export const robloxAccept = {
  customId: /^roblox_accept_\d+_\d+$/,
  async execute(interaction) {
    try {
      const [, groupId, userId] = interaction.customId.match(/roblox_accept_(\d+)_(\d+)/);
      
      await interaction.deferReply({ ephemeral: true });

      const success = await roblox.acceptRequest(groupId, userId);

      if (success) {
        await interaction.editReply('✅ Request accepted');
        
        try {
          const msg = interaction.message;
          const embed = msg.embeds[0].toJSON();
          embed.color = 0x00ff00;
          embed.footer = { text: `✅ Accepted by ${interaction.user.tag}` };
          await msg.edit({ embeds: [embed], components: [] });
        } catch (e) {
          logger.warn('Could not update message:', e.message);
        }
      } else {
        await interaction.editReply('❌ Failed to accept');
      }
    } catch (err) {
      logger.error('❌ Accept button error:', err.message);
      await interaction.editReply('❌ Error').catch(() => {});
    }
  }
};

export const robloxDeny = {
  customId: /^roblox_deny_\d+_\d+$/,
  async execute(interaction) {
    try {
      const [, groupId, userId] = interaction.customId.match(/roblox_deny_(\d+)_(\d+)/);
      
      await interaction.deferReply({ ephemeral: true });

      const success = await roblox.denyRequest(groupId, userId);

      if (success) {
        await interaction.editReply('✅ Request denied');
        
        try {
          const msg = interaction.message;
          const embed = msg.embeds[0].toJSON();
          embed.color = 0xff0000;
          embed.footer = { text: `❌ Denied by ${interaction.user.tag}` };
          await msg.edit({ embeds: [embed], components: [] });
        } catch (e) {
          logger.warn('Could not update message:', e.message);
        }
      } else {
        await interaction.editReply('❌ Failed to deny');
      }
    } catch (err) {
      logger.error('❌ Deny button error:', err.message);
      await interaction.editReply('❌ Error').catch(() => {});
    }
  }
};

