import { SlashCommandBuilder, MessageFlags, PermissionsBitField } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { setShiftRole } from '../../services/shiftService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shiftconfig')
        .setDescription('Configure the shift management system')
        .addSubcommand(sub =>
            sub
                .setName('setrole')
                .setDescription('Set the role that is allowed to use shift commands')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role that can use /shift commands')
                        .setRequired(true)
                )
        ),
    category: 'Staff',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Shiftconfig interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'shiftconfig',
            });
            return;
        }

        try {
            // Admin-only
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            'You need **Manage Server** permissions to configure the shift system.'
                        ),
                    ],
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'setrole') {
                const role = interaction.options.getRole('role');
                const guildId = interaction.guildId;

                await setShiftRole(guildId, role.id);

                const embed = createEmbed({
                    title: '⚙️ Shift Role Configured',
                    description: `The shift role has been set to ${role}.\n\nMembers with this role can now use \`/shift start\`, \`/shift stop\`, and \`/shift break\`.`,
                    color: 'success',
                    fields: [
                        { name: 'Role', value: role.toString(), inline: true },
                        { name: 'Role ID', value: role.id, inline: true },
                    ],
                    timestamp: true,
                });

                return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }
        } catch (error) {
            logger.error('Shiftconfig command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'shiftconfig_failed' });
        }
    },
};
