/**
 * ticketPanel.js
 *
 * Handles the `ticket_panel_select` StringSelectMenu that is posted in the
 * ticket panel channel.  When a user picks a panel from the dropdown this
 * handler:
 *   1. Reads the panel-specific config (category, staff role, max tickets, etc.)
 *   2. Enforces the per-user ticket limit
 *   3. Shows a modal asking for a reason
 *   4. Creates the ticket channel using the panel's settings
 */

import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { getUserTicketCount } from '../../services/ticket.js';
import { logger } from '../../utils/logger.js';
import { checkRateLimit } from '../../utils/rateLimiter.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the panel number from the select-menu value (e.g. "panel1" → 1).
 */
function parsePanelNumber(value) {
    const match = value.match(/^panel(\d)$/);
    return match ? parseInt(match[1], 10) : 1;
}

/**
 * Resolve the effective config for a given panel number.
 * Falls back to the legacy flat fields for panel 1 so that servers that
 * haven't re-run `/ticket setup` after the upgrade still work.
 */
function resolvePanelConfig(guildConfig, panelNumber) {
    const panelKey = `ticketPanel${panelNumber}Config`;
    if (guildConfig[panelKey]) {
        return guildConfig[panelKey];
    }

    // Legacy fallback for panel 1
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
    name: 'ticket_panel_select',

    async execute(interaction, client) {
        try {
            if (!interaction.inGuild()) {
                await interaction.reply({
                    embeds: [errorEmbed('Guild Only', 'This action can only be used in a server.')],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Rate-limit: max 3 ticket creations per minute per user
            const rateLimitKey = `${interaction.user.id}:create_ticket`;
            const allowed = await checkRateLimit(rateLimitKey, 3, 60_000);
            if (!allowed) {
                await interaction.reply({
                    embeds: [errorEmbed('Rate Limited', 'You are creating tickets too quickly. Please wait a minute and try again.')],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const selectedValue = interaction.values[0]; // e.g. "panel1"
            const panelNumber   = parsePanelNumber(selectedValue);

            const guildConfig = await getGuildConfig(client, interaction.guildId);
            const panelConfig = resolvePanelConfig(guildConfig, panelNumber);

            if (!panelConfig) {
                await interaction.reply({
                    embeds: [errorEmbed('Panel Not Found', `Panel ${panelNumber} is not configured. Please contact a server administrator.`)],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Enforce per-user ticket limit (use panel-specific limit)
            const maxTickets    = panelConfig.maxTicketsPerUser || guildConfig.maxTicketsPerUser || 3;
            const currentCount  = await getUserTicketCount(interaction.guildId, interaction.user.id);

            if (currentCount >= maxTickets) {
                await interaction.reply({
                    embeds: [
                        errorEmbed(
                            '🎫 Ticket Limit Reached',
                            `You have reached the maximum number of open tickets (${maxTickets}).\n\nPlease close your existing tickets before creating a new one.\n\n**Current Tickets:** ${currentCount}/${maxTickets}`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Show a modal to collect the reason
            const modal = new ModalBuilder()
                .setCustomId(`ticket_panel_modal:${panelNumber}`)
                .setTitle(`Open a Ticket — ${panelConfig.label}`);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Why are you creating this ticket?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe your issue or request…')
                .setRequired(true)
                .setMaxLength(1000);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

            // showModal must be called directly — no defer before this
            await interaction.showModal(modal);
        } catch (error) {
            logger.error('Error handling ticket panel select:', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user?.id,
                guildId: interaction.guildId,
            });
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed('Error', 'Could not open the ticket creation form.')],
                    flags: MessageFlags.Ephemeral,
                }).catch(() => {});
            }
        }
    },
};
