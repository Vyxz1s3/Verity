import { SlashCommandBuilder, MessageFlags, PermissionsBitField } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { wipeShiftsByUserIds } from '../../services/shiftService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shiftwipe')
        .setDescription('Delete all shift records for members with a specific role')
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('The role whose shift data should be wiped')
                .setRequired(true)
        ),
    category: 'Staff',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Shiftwipe interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'shiftwipe',
            });
            return;
        }

        try {
            // Admin-only
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            'You need **Manage Server** permissions to wipe shift data.'
                        ),
                    ],
                });
            }

            const role = interaction.options.getRole('role');
            const guildId = interaction.guildId;
            const guild = interaction.guild;

            // Fetch all members with the target role
            // Ensure the member cache is populated
            await guild.members.fetch();
            const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
            const userIds = membersWithRole.map(m => m.id);

            if (userIds.length === 0) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '⚠️ No Members Found',
                            description: `No members with the ${role} role were found in this server. No shift records were deleted.`,
                            color: 'warning',
                            timestamp: true,
                        }),
                    ],
                });
            }

            const deletedCount = await wipeShiftsByUserIds(guildId, userIds);

            const embed = createEmbed({
                title: '🗑️ Shift Data Wiped',
                description: deletedCount > 0
                    ? `Successfully deleted **${deletedCount}** shift record${deletedCount === 1 ? '' : 's'} for members with the ${role} role.`
                    : `No shift records were found for members with the ${role} role. Nothing was deleted.`,
                color: deletedCount > 0 ? 'error' : 'warning',
                fields: [
                    { name: 'Role', value: role.toString(), inline: true },
                    { name: 'Members Checked', value: String(userIds.length), inline: true },
                    { name: 'Records Deleted', value: String(deletedCount), inline: true },
                ],
                timestamp: true,
            });

            return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            logger.error('Shiftwipe command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'shiftwipe_failed' });
        }
    },
};
