import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the StringSelectMenu component row from all configured panels.
 * @param {object} guildConfig
 * @returns {ActionRowBuilder}
 */
function buildPanelDropdown(guildConfig) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_panel_select')
        .setPlaceholder('Select a ticket type to open…');

    for (let i = 1; i <= 3; i++) {
        const panel = guildConfig[`ticketPanel${i}Config`];
        if (!panel) continue;
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(panel.label || `Panel ${i}`)
                .setDescription((panel.message || '').substring(0, 100) || `Open a ${panel.label || `Panel ${i}`} ticket`)
                .setValue(`panel${i}`)
                .setEmoji('🎫'),
        );
    }

    return new ActionRowBuilder().addComponents(menu);
}

/**
 * Attempt to find and update the live panel message in the panel channel.
 * Returns true if the panel was found and updated.
 */
async function updateLivePanelDropdown(client, guild, guildConfig) {
    if (!guildConfig.ticketPanelChannelId) return false;
    try {
        const channel = await guild.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
        if (!channel) return false;

        const messages = await channel.messages.fetch({ limit: 50 });
        const panelMsg = messages.find(
            m =>
                m.author.id === client.user.id &&
                m.components?.length > 0 &&
                (m.components[0]?.components?.[0]?.customId === 'ticket_panel_select' ||
                    m.components[0]?.components?.[0]?.customId === 'create_ticket'),
        );
        if (!panelMsg) return false;

        // Rebuild embed description from panel 1 (primary panel) or a generic message
        const panel1 = guildConfig.ticketPanel1Config;
        const description = panel1?.message || 'Select a ticket type below to open a support ticket.';

        const updatedEmbed = createEmbed({
            title: '🎫 Support Tickets',
            description,
            color: getColor('info'),
        });

        const dropdownRow = buildPanelDropdown(guildConfig);
        await panelMsg.edit({ embeds: [updatedEmbed], components: [dropdownRow] });
        return true;
    } catch (error) {
        logger.warn('Failed to update live ticket panel dropdown:', error.message);
        return false;
    }
}

// ─── Command Definition ───────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Configures a ticket panel (up to 3) and posts/updates the dropdown in the panel channel.')
                .addChannelOption((option) =>
                    option
                        .setName('panel_channel')
                        .setDescription('The channel where the ticket panel will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('panel_number')
                        .setDescription('Which panel slot to configure (1, 2, or 3). Defaults to 1.')
                        .setMinValue(1)
                        .setMaxValue(3)
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('panel_message')
                        .setDescription('The message/description shown on the ticket panel embed.')
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName('button_label')
                        .setDescription('The label for this panel in the dropdown menu (default: Create Ticket).')
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('category')
                        .setDescription('The category where new tickets for this panel will be created (optional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName('closed_category')
                        .setDescription('The category where closed tickets for this panel will be moved (optional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName('staff_role')
                        .setDescription('The role that can access tickets for this panel (optional).')
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('max_tickets_per_user')
                        .setDescription('Maximum number of tickets a user can have open at once (default: 3).')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('dm_on_close')
                        .setDescription('Send a DM to the user when their ticket is closed (default: true).')
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the interactive ticket system dashboard'),
        ),
    category: 'ticket',

    async execute(interaction, config, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                logger.warn('Ticket command permission denied', {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket',
                });
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Permission Denied', 'You need the `Manage Channels` permission for this action.')],
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return ticketConfig.execute(interaction, config, client);
            }

            if (subcommand === 'setup') {
                const existingConfig = await getGuildConfig(client, interaction.guildId);

                const panelNumber      = interaction.options.getInteger('panel_number') || 1;
                const panelChannel     = interaction.options.getChannel('panel_channel');
                const categoryChannel  = interaction.options.getChannel('category');
                const closedCategory   = interaction.options.getChannel('closed_category');
                const staffRole        = interaction.options.getRole('staff_role');
                const panelMessage     = interaction.options.getString('panel_message') || 'Click the dropdown below to open a support ticket.';
                const buttonLabel      = interaction.options.getString('button_label') || 'Create Ticket';
                const maxTicketsPerUser = interaction.options.getInteger('max_tickets_per_user') || 3;
                const dmOnClose        = interaction.options.getBoolean('dm_on_close') !== false;

                // ── Persist per-panel config ──────────────────────────────────
                const panelKey = `ticketPanel${panelNumber}Config`;
                existingConfig[panelKey] = {
                    label:            buttonLabel,
                    message:          panelMessage,
                    categoryId:       categoryChannel ? categoryChannel.id : null,
                    closedCategoryId: closedCategory  ? closedCategory.id  : null,
                    staffRoleId:      staffRole        ? staffRole.id       : null,
                    maxTicketsPerUser,
                    dmOnClose,
                };

                // Keep the shared panel channel pointer on the root config so
                // the dashboard and other helpers can find it.
                existingConfig.ticketPanelChannelId = panelChannel.id;

                // Also mirror panel-1 settings to the legacy flat fields so
                // existing code paths (close, reopen, etc.) keep working.
                if (panelNumber === 1) {
                    existingConfig.ticketCategoryId       = categoryChannel ? categoryChannel.id : null;
                    existingConfig.ticketClosedCategoryId = closedCategory  ? closedCategory.id  : null;
                    existingConfig.ticketStaffRoleId      = staffRole        ? staffRole.id       : null;
                    existingConfig.ticketPanelMessage     = panelMessage;
                    existingConfig.ticketButtonLabel      = buttonLabel;
                    existingConfig.maxTicketsPerUser      = maxTicketsPerUser;
                    existingConfig.dmOnClose              = dmOnClose;
                }

                try {
                    const { getGuildConfigKey } = await import('../../utils/database.js');
                    await client.db.set(getGuildConfigKey(interaction.guildId), existingConfig);

                    logger.info('Ticket panel config saved', {
                        guildId: interaction.guildId,
                        panelNumber,
                        panelKey,
                        categoryId: categoryChannel?.id,
                        closedCategoryId: closedCategory?.id,
                        staffRoleId: staffRole?.id,
                        maxTickets: maxTicketsPerUser,
                        dmOnClose,
                    });

                    // ── Build the dropdown from all configured panels ─────────
                    const dropdownRow = buildPanelDropdown(existingConfig);

                    // Embed description comes from panel 1 if set, otherwise generic
                    const embedDescription =
                        existingConfig.ticketPanel1Config?.message ||
                        'Select a ticket type below to open a support ticket.';

                    const setupEmbed = createEmbed({
                        title: '🎫 Support Tickets',
                        description: embedDescription,
                        color: getColor('info'),
                    });

                    // ── Try to update an existing panel message first ─────────
                    let panelUpdated = false;
                    try {
                        const ch = await interaction.guild.channels.fetch(panelChannel.id).catch(() => null);
                        if (ch) {
                            const msgs = await ch.messages.fetch({ limit: 50 });
                            const existing = msgs.find(
                                m =>
                                    m.author.id === client.user.id &&
                                    m.components?.length > 0 &&
                                    (m.components[0]?.components?.[0]?.customId === 'ticket_panel_select' ||
                                        m.components[0]?.components?.[0]?.customId === 'create_ticket'),
                            );
                            if (existing) {
                                await existing.edit({ embeds: [setupEmbed], components: [dropdownRow] });
                                panelUpdated = true;
                            }
                        }
                    } catch (_) { /* fall through to send */ }

                    if (!panelUpdated) {
                        await panelChannel.send({ embeds: [setupEmbed], components: [dropdownRow] });
                    }

                    // ── Build success reply ───────────────────────────────────
                    let successMessage =
                        `Panel **${panelNumber}** ("${buttonLabel}") has been ${panelUpdated ? 'updated' : 'created'} in ${panelChannel}.\n\n` +
                        `**Category:** ${categoryChannel ? categoryChannel.name : 'Auto-created "Tickets"'}\n` +
                        `**Closed Category:** ${closedCategory ? closedCategory.name : 'None'}\n` +
                        `**Staff Role:** ${staffRole ? staffRole.name : 'None'}\n` +
                        `**Max Tickets Per User:** ${maxTicketsPerUser}\n` +
                        `**DM on Close:** ${dmOnClose ? 'Enabled' : 'Disabled'}`;

                    const configuredPanels = [1, 2, 3]
                        .filter(n => existingConfig[`ticketPanel${n}Config`])
                        .map(n => `Panel ${n}: ${existingConfig[`ticketPanel${n}Config`].label}`)
                        .join('\n');

                    if (configuredPanels) {
                        successMessage += `\n\n**All configured panels:**\n${configuredPanels}`;
                    }

                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [successEmbed('Ticket Panel Configured', successMessage)],
                    });

                    logger.info('Ticket panel setup completed', {
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        guildId: interaction.guildId,
                        panelNumber,
                        panelChannelId: panelChannel.id,
                        categoryId: categoryChannel?.id,
                        closedCategoryId: closedCategory?.id,
                        staffRoleId: staffRole?.id,
                        maxTickets: maxTicketsPerUser,
                        dmOnClose,
                        commandName: 'ticket_setup',
                    });
                } catch (error) {
                    logger.error('Ticket setup error', {
                        error: error.message,
                        stack: error.stack,
                        userId: interaction.user.id,
                        guildId: interaction.guildId,
                        commandName: 'ticket_setup',
                    });
                    if (interaction.deferred || interaction.replied) {
                        await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                errorEmbed(
                                    'Setup Failed',
                                    "Could not send the ticket panel or save configuration. Check the bot's permissions and database connection.",
                                ),
                            ],
                        }).catch(err => {
                            logger.error('Failed to send error reply', { error: err.message, guildId: interaction.guildId });
                        });
                    } else {
                        await handleInteractionError(interaction, error, {
                            commandName: 'ticket_setup',
                            source: 'ticket_setup_command',
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error executing ticket command', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket',
            });
            await handleInteractionError(interaction, error, {
                commandName: 'ticket',
                source: 'ticket_command_main',
            });
        }
    },
};



