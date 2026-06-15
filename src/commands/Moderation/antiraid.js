import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import { getColor } from '../../config/bot.js';
import { errorEmbed, successEmbed, warningEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import {
    getAntiRaidConfig,
    saveAntiRaidConfig,
    clearJoinHistory,
    ANTI_RAID_DEFAULTS,
} from '../../services/antiRaid.js';

// ─── Slash command definition ─────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configure the anti-raid protection system for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        // ── /antiraid setup ──────────────────────────────────────────────────
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Configure anti-raid settings.')
                .addBooleanOption(opt =>
                    opt
                        .setName('enabled')
                        .setDescription('Enable or disable the anti-raid system.')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt
                        .setName('action_type')
                        .setDescription('Action to take when a raid is detected.')
                        .setRequired(false)
                        .addChoices(
                            { name: '👢 Kick', value: 'kick' },
                            { name: '🔨 Ban', value: 'ban' },
                            { name: '⏳ Timeout', value: 'timeout' },
                            { name: '🔇 Mute (timeout)', value: 'mute' },
                        )
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('join_threshold')
                        .setDescription('Number of joins within the time window that triggers the alarm (default: 5).')
                        .setMinValue(2)
                        .setMaxValue(50)
                        .setRequired(false)
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('time_window')
                        .setDescription('Time window in seconds to count joins (default: 10).')
                        .setMinValue(3)
                        .setMaxValue(120)
                        .setRequired(false)
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('duration')
                        .setDescription('Duration in minutes for timeout/mute actions (default: 10).')
                        .setMinValue(1)
                        .setMaxValue(40320) // Discord max: 28 days
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt
                        .setName('log_channel')
                        .setDescription('Channel where raid alerts are sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )

        // ── /antiraid dashboard ──────────────────────────────────────────────
        .addSubcommand(sub =>
            sub
                .setName('dashboard')
                .setDescription('Open the anti-raid configuration dashboard.')
        )

        // ── /antiraid whitelist ──────────────────────────────────────────────
        .addSubcommandGroup(group =>
            group
                .setName('whitelist')
                .setDescription('Manage roles and users that bypass anti-raid checks.')
                .addSubcommand(sub =>
                    sub
                        .setName('add')
                        .setDescription('Add a role or user to the anti-raid whitelist.')
                        .addStringOption(opt =>
                            opt
                                .setName('type')
                                .setDescription('Whether to whitelist a role or a user.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Role', value: 'role' },
                                    { name: 'User', value: 'user' },
                                )
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('id')
                                .setDescription('The ID of the role or user to whitelist.')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('remove')
                        .setDescription('Remove a role or user from the anti-raid whitelist.')
                        .addStringOption(opt =>
                            opt
                                .setName('type')
                                .setDescription('Whether this is a role or a user.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Role', value: 'role' },
                                    { name: 'User', value: 'user' },
                                )
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('id')
                                .setDescription('The ID of the role or user to remove from the whitelist.')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('list')
                        .setDescription('List all whitelisted roles and users.')
                )
        ),

    category: 'moderation',

    // ─── Execute ──────────────────────────────────────────────────────────────

    async execute(interaction, config, client) {
        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('Permission Denied', 'You need **Manage Server** permission to configure anti-raid.')],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await handleDashboard(interaction, client);
            }

            await InteractionHelper.safeDefer(interaction);

            if (subcommand === 'setup') {
                return await handleSetup(interaction, client);
            }

            if (subcommandGroup === 'whitelist') {
                return await handleWhitelist(interaction, subcommand, client);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Subcommand', 'This subcommand is not recognised.')],
            });
        } catch (error) {
            logger.error('[AntiRaid] Command error:', error);
            await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Error', 'An unexpected error occurred while processing the command.')],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    },
};

// ─── Subcommand handlers ──────────────────────────────────────────────────────

/**
 * /antiraid setup
 */
async function handleSetup(interaction, client) {
    const guildId = interaction.guildId;
    const current = await getAntiRaidConfig(client, guildId);

    const updates = {};

    const enabled = interaction.options.getBoolean('enabled');
    if (enabled !== null) updates.antiRaidEnabled = enabled;

    const actionType = interaction.options.getString('action_type');
    if (actionType) updates.antiRaidActionType = actionType;

    const joinThreshold = interaction.options.getInteger('join_threshold');
    if (joinThreshold !== null) updates.antiRaidJoinThreshold = joinThreshold;

    const timeWindow = interaction.options.getInteger('time_window');
    if (timeWindow !== null) updates.antiRaidTimeWindow = timeWindow;

    const duration = interaction.options.getInteger('duration');
    if (duration !== null) updates.antiRaidDuration = duration;

    const logChannel = interaction.options.getChannel('log_channel');
    if (logChannel) updates.antiRaidLogChannelId = logChannel.id;

    if (Object.keys(updates).length === 0) {
        // No options provided — show current config
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [buildConfigEmbed(interaction.guild, current)],
        });
    }

    const saved = await saveAntiRaidConfig(client, guildId, updates);

    if (!saved) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Save Failed', 'Could not save the anti-raid configuration. Please try again.')],
        });
    }

    // If the system was just disabled, clear stale join history
    if (updates.antiRaidEnabled === false) {
        clearJoinHistory(guildId);
    }

    const merged = { ...current, ...updates };
    const changedLines = Object.entries(updates).map(([key, val]) => {
        const label = CONFIG_LABELS[key] ?? key;
        return `**${label}:** ${formatValue(key, val)}`;
    });

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            successEmbed(
                `Anti-raid configuration updated.\n\n${changedLines.join('\n')}`,
                '🛡️ Anti-Raid Updated'
            ),
        ],
    });
}

/**
 * /antiraid dashboard
 */
async function handleDashboard(interaction, client) {
    await InteractionHelper.safeDefer(interaction);

    const settings = await getAntiRaidConfig(client, interaction.guildId);
    const embed = buildConfigEmbed(interaction.guild, settings);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('antiraid_toggle')
            .setLabel(settings.antiRaidEnabled ? 'Disable Anti-Raid' : 'Enable Anti-Raid')
            .setStyle(settings.antiRaidEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(settings.antiRaidEnabled ? '🔴' : '🟢'),
        new ButtonBuilder()
            .setCustomId('antiraid_refresh')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
    );

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
        components: [row],
    });
}

/**
 * /antiraid whitelist add|remove|list
 */
async function handleWhitelist(interaction, subcommand, client) {
    const guildId = interaction.guildId;
    const settings = await getAntiRaidConfig(client, guildId);

    if (subcommand === 'list') {
        const roles = (settings.antiRaidWhitelistedRoles ?? []).map(id => `<@&${id}>`).join(', ') || '`None`';
        const users = (settings.antiRaidWhitelistedUsers ?? []).map(id => `<@${id}>`).join(', ') || '`None`';

        const embed = new EmbedBuilder()
            .setColor(getColor('info'))
            .setTitle('🛡️ Anti-Raid Whitelist')
            .addFields(
                { name: '🏷️ Whitelisted Roles', value: roles, inline: false },
                { name: '👤 Whitelisted Users', value: users, inline: false }
            )
            .setTimestamp();

        return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    const type = interaction.options.getString('type');
    const id = interaction.options.getString('id');

    if (!/^\d+$/.test(id)) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Invalid ID', 'Please provide a valid numeric role or user ID.')],
        });
    }

    const listKey = type === 'role' ? 'antiRaidWhitelistedRoles' : 'antiRaidWhitelistedUsers';
    const list = [...(settings[listKey] ?? [])];

    if (subcommand === 'add') {
        if (list.includes(id)) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [warningEmbed(`That ${type} is already on the whitelist.`, '⚠️ Already Whitelisted')],
            });
        }
        list.push(id);
    } else if (subcommand === 'remove') {
        const idx = list.indexOf(id);
        if (idx === -1) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [warningEmbed(`That ${type} is not on the whitelist.`, '⚠️ Not Found')],
            });
        }
        list.splice(idx, 1);
    }

    const saved = await saveAntiRaidConfig(client, guildId, { [listKey]: list });

    if (!saved) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed('Save Failed', 'Could not update the whitelist. Please try again.')],
        });
    }

    const mention = type === 'role' ? `<@&${id}>` : `<@${id}>`;
    const action = subcommand === 'add' ? 'added to' : 'removed from';

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed(`${mention} has been ${action} the anti-raid whitelist.`, '🛡️ Whitelist Updated')],
    });
}

// ─── Embed builder ────────────────────────────────────────────────────────────

function buildConfigEmbed(guild, settings) {
    const isEnabled = settings.antiRaidEnabled ?? false;

    const actionLabel = {
        kick: '👢 Kick',
        ban: '🔨 Ban',
        timeout: '⏳ Timeout',
        mute: '🔇 Mute (timeout)',
    }[settings.antiRaidActionType] ?? settings.antiRaidActionType;

    const logChannel = settings.antiRaidLogChannelId
        ? `<#${settings.antiRaidLogChannelId}>`
        : '`Not configured`';

    const whitelistedRoles = (settings.antiRaidWhitelistedRoles ?? []).length;
    const whitelistedUsers = (settings.antiRaidWhitelistedUsers ?? []).length;

    return new EmbedBuilder()
        .setColor(isEnabled ? getColor('success') : getColor('warning'))
        .setTitle('🛡️ Anti-Raid Dashboard')
        .setDescription(
            `Anti-raid protection for **${guild.name}**.\n` +
            `Use \`/antiraid setup\` to change any setting.`
        )
        .addFields(
            {
                name: '🔒 Status',
                value: isEnabled ? '✅ Enabled' : '❌ Disabled',
                inline: true,
            },
            {
                name: '⚡ Action',
                value: actionLabel,
                inline: true,
            },
            {
                name: '\u200B',
                value: '\u200B',
                inline: true,
            },
            {
                name: '🔢 Join Threshold',
                value: `**${settings.antiRaidJoinThreshold}** joins`,
                inline: true,
            },
            {
                name: '⏱️ Time Window',
                value: `**${settings.antiRaidTimeWindow}** seconds`,
                inline: true,
            },
            {
                name: '⏳ Action Duration',
                value: `**${settings.antiRaidDuration}** minutes`,
                inline: true,
            },
            {
                name: '📢 Log Channel',
                value: logChannel,
                inline: true,
            },
            {
                name: '🏷️ Whitelisted Roles',
                value: `**${whitelistedRoles}** role${whitelistedRoles !== 1 ? 's' : ''}`,
                inline: true,
            },
            {
                name: '👤 Whitelisted Users',
                value: `**${whitelistedUsers}** user${whitelistedUsers !== 1 ? 's' : ''}`,
                inline: true,
            }
        )
        .setFooter({ text: `Guild ID: ${guild.id}  •  Last refreshed` })
        .setTimestamp();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIG_LABELS = {
    antiRaidEnabled: 'Status',
    antiRaidActionType: 'Action Type',
    antiRaidJoinThreshold: 'Join Threshold',
    antiRaidTimeWindow: 'Time Window',
    antiRaidDuration: 'Action Duration',
    antiRaidLogChannelId: 'Log Channel',
};

function formatValue(key, value) {
    if (key === 'antiRaidEnabled') return value ? '✅ Enabled' : '❌ Disabled';
    if (key === 'antiRaidLogChannelId') return `<#${value}>`;
    if (key === 'antiRaidTimeWindow') return `${value}s`;
    if (key === 'antiRaidDuration') return `${value} min`;
    if (key === 'antiRaidJoinThreshold') return `${value} joins`;
    if (key === 'antiRaidActionType') {
        return { kick: '👢 Kick', ban: '🔨 Ban', timeout: '⏳ Timeout', mute: '🔇 Mute' }[value] ?? value;
    }
    return String(value);
}
