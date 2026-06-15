import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Log a member promotion")
        .addUserOption(option =>
            option
                .setName("target")
                .setDescription("The member being promoted")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("old_rank")
                .setDescription("Previous rank")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("new_rank")
                .setDescription("New rank")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for promotion")
                .setRequired(true)
        ),

    category: "moderation",

    async execute(interaction, config, client) {
        try {
            const target = interaction.options.getUser("target");
            const oldRank = interaction.options.getString("old_rank");
            const newRank = interaction.options.getString("new_rank");
            const reason = interaction.options.getString("reason");

            await interaction.reply({
                embeds: [
                    successEmbed(
                        "📈 Promotion Logged",
                        `**Member:** ${target}\n` +
                        `**Previous Rank:** ${oldRank}\n` +
                        `**New Rank:** ${newRank}\n` +
                        `**Reason:** ${reason}\n` +
                        `**Promoted By:** ${interaction.user}`
                    )
                ]
            });

        } catch (error) {
            logger.error('Promote command error:', error);
            await handleInteractionError(interaction, error, {
                subtype: 'promotion_failed'
            });
        }
    },
};
