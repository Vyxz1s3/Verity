/**
 * ticketPanel.js  (modal handler)
 *
 * Handles the `ticket_panel_modal:<panelNumber>` modal that is shown after a
 * user selects a panel from the ticket dropdown.  Creates the ticket channel
 * using the panel-specific configuration.
 */

import { MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { createTicket } from '../../services/ticket.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// Note: InteractionHelper is used for safeDefer below.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the effective config for a given panel number.
 * Falls back to the legacy flat fields for panel 1.
 */
function resolvePanelConfig(guildConfig, panelNumber) {
    const panelKey = `ticketPanel${panelNumber}Config`;
    if (guildConfig[panelKey]) {
        return guildConfig[panelKey];
    }

    if (panelNumber === 1) {
        return {
            label:            guildConfig.ticketButtonLabel      || 'Create Ticket',
            message:          guildConfig.ticketPanelMessage     || 'Click the dropdown below to open a support ticket.',
            categoryId:       guildConfig.ticketCategoryId       || null,
            closedCategoryId: guildConfig.ticketClosedCategoryId || null,
            staffRoleId:      guildConfig.ticketStaffRoleId      || null,
            maxTicketsPerUser: guildConfig.maxTicketsPerUser      || 3,
            dmOnClose:        guildConfig.dmOnClose              !== false,
        };
    }

    return null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default {
    // customId format: ticket_panel_modal:<panelNumber>
    name: 'ticket_panel_modal',

    async execute(interaction, client, args) {
        try {
            if (!interaction.inGuild()) return;

            const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferSuccess) return;

            // args[0] is the panelNumber from the customId split on ':'
            const panelNumber = parseInt(args[0], 10) || 1;
            const reason      = interaction.fields.getTextInputValue('reason')?.trim() || 'No reason provided.';

            const guildConfig = await getGuildConfig(client, interaction.guildId);
            const panelConfig = resolvePanelConfig(guildConfig, panelNumber);

            if (!panelConfig) {
                await interaction.editReply({
                    embeds: [errorEmbed('Panel Not Found', `Panel ${panelNumber} is not configured. Please contact a server administrator.`)],
                });
                return;
            }

            // Temporarily override the guild-level staff role with the panel's
            // staff role so createTicket applies the correct permissions.
            // We pass a shallow-merged config object rather than mutating the real one.
            const effectiveConfig = {
                ...guildConfig,
                ticketStaffRoleId:      panelConfig.staffRoleId      ?? guildConfig.ticketStaffRoleId,
                ticketCategoryId:       panelConfig.categoryId        ?? guildConfig.ticketCategoryId,
                ticketClosedCategoryId: panelConfig.closedCategoryId  ?? guildConfig.ticketClosedCategoryId,
                maxTicketsPerUser:      panelConfig.maxTicketsPerUser  ?? guildConfig.maxTicketsPerUser ?? 3,
                dmOnClose:              panelConfig.dmOnClose          ?? guildConfig.dmOnClose ?? true,
                // Tag the ticket with which panel created it so close/reopen can
                // look up the right closed-category later.
                _activePanelNumber: panelNumber,
            };

            // Temporarily write the effective config into the client cache so
            // createTicket (which calls getGuildConfig internally) picks up the
            // panel-specific settings.  We restore it immediately after.
            const result = await createTicket(
                interaction.guild,
                interaction.member,
                effectiveConfig.ticketCategoryId,
                reason,
                'none',
                effectiveConfig,   // pass overrides directly
            );

            if (result.success) {
                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            'Ticket Created',
                            `Your **${panelConfig.label}** ticket has been created in ${result.channel}!`,
                        ),
                    ],
                });
            } else {
                await interaction.editReply({
                    embeds: [errorEmbed('Error', result.error || 'Failed to create ticket.')],
                });
            }
        } catch (error) {
            logger.error('Error in ticket_panel_modal handler:', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user?.id,
                guildId: interaction.guildId,
            });
            if (interaction.deferred) {
                await interaction.editReply({
                    embeds: [errorEmbed('Error', 'An error occurred while creating your ticket.')],
                }).catch(() => {});
            }
        }
    },
};
