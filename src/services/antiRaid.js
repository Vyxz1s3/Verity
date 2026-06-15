/**
 * Anti-Raid Service
 *
 * Tracks member join patterns per guild, detects raid conditions, executes
 * configured actions (kick / ban / timeout / mute), and sends alerts to the
 * configured log channel.
 *
 * Join data is stored purely in-memory (Map) so it is fast and never persists
 * stale entries across restarts.  A periodic cleanup removes entries older
 * than the configured time-window so memory stays bounded.
 */

import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from './guildConfig.js';
import { logger } from '../utils/logger.js';
import { getColor } from '../config/bot.js';

// ─── In-memory join tracking ────────────────────────────────────────────────

/**
 * guildJoinMap  →  Map<guildId, Array<{ userId, timestamp }>>
 *
 * Each entry records the user ID and the Unix-ms timestamp of the join.
 * Old entries are pruned on every check so the array never grows unbounded.
 */
const guildJoinMap = new Map();

// ─── Defaults ────────────────────────────────────────────────────────────────

export const ANTI_RAID_DEFAULTS = {
    antiRaidEnabled: false,
    antiRaidActionType: 'kick',          // kick | ban | timeout | mute
    antiRaidJoinThreshold: 5,            // joins that trigger the alarm
    antiRaidTimeWindow: 10,              // seconds
    antiRaidDuration: 10,               // minutes (timeout / mute only)
    antiRaidLogChannelId: null,
    antiRaidWhitelistedRoles: [],
    antiRaidWhitelistedUsers: [],
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Record a member join and check whether the raid threshold has been crossed.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').Client}      client
 * @returns {Promise<{ raidDetected: boolean, affectedCount: number }>}
 */
export async function recordJoinAndCheck(member, client) {
    const { guild, user } = member;
    const guildId = guild.id;

    try {
        const config = await getGuildConfig(client, guildId);

        // Merge stored config with defaults so every key is always present
        const settings = { ...ANTI_RAID_DEFAULTS, ...config };

        if (!settings.antiRaidEnabled) {
            return { raidDetected: false, affectedCount: 0 };
        }

        // ── Whitelist check ──────────────────────────────────────────────────
        if (isWhitelisted(member, settings)) {
            logger.debug(`[AntiRaid] Whitelisted member joined: ${user.tag} in ${guild.name}`);
            return { raidDetected: false, affectedCount: 0 };
        }

        // ── Record join ──────────────────────────────────────────────────────
        const now = Date.now();
        const windowMs = settings.antiRaidTimeWindow * 1000;

        if (!guildJoinMap.has(guildId)) {
            guildJoinMap.set(guildId, []);
        }

        const joins = guildJoinMap.get(guildId);

        // Prune entries outside the current window
        const cutoff = now - windowMs;
        const recentJoins = joins.filter(j => j.timestamp > cutoff);
        recentJoins.push({ userId: user.id, timestamp: now });
        guildJoinMap.set(guildId, recentJoins);

        // ── Threshold check ──────────────────────────────────────────────────
        if (recentJoins.length < settings.antiRaidJoinThreshold) {
            return { raidDetected: false, affectedCount: 0 };
        }

        // ── Raid detected ────────────────────────────────────────────────────
        logger.warn(
            `[AntiRaid] Raid detected in ${guild.name} (${guildId}): ` +
            `${recentJoins.length} joins in ${settings.antiRaidTimeWindow}s`
        );

        // Collect the unique user IDs that triggered the alarm
        const raidUserIds = [...new Set(recentJoins.map(j => j.userId))];

        // Clear the window so we don't re-trigger on the same wave
        guildJoinMap.set(guildId, []);

        // Execute the configured action on every member in the wave
        const results = await executeRaidAction(guild, raidUserIds, settings, client);

        // Send alert to the log channel
        await sendRaidAlert(guild, raidUserIds, settings, results, client);

        return { raidDetected: true, affectedCount: results.actioned };
    } catch (error) {
        logger.error(`[AntiRaid] Error in recordJoinAndCheck for guild ${guild.id}:`, error);
        return { raidDetected: false, affectedCount: 0 };
    }
}

/**
 * Get the current anti-raid configuration for a guild, merged with defaults.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @returns {Promise<Object>}
 */
export async function getAntiRaidConfig(client, guildId) {
    const config = await getGuildConfig(client, guildId);
    return { ...ANTI_RAID_DEFAULTS, ...config };
}

/**
 * Persist anti-raid settings for a guild.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {Object} updates  - Partial anti-raid settings to merge
 * @returns {Promise<boolean>}
 */
export async function saveAntiRaidConfig(client, guildId, updates) {
    try {
        await updateGuildConfig(client, guildId, updates);
        return true;
    } catch (error) {
        logger.error(`[AntiRaid] Failed to save config for guild ${guildId}:`, error);
        return false;
    }
}

/**
 * Clear the in-memory join history for a guild (useful after a raid is handled
 * or when the system is disabled).
 *
 * @param {string} guildId
 */
export function clearJoinHistory(guildId) {
    guildJoinMap.delete(guildId);
}

/**
 * Remove join entries older than the configured time-window for all guilds.
 * Call this periodically (e.g. every 30 s) to keep memory usage low.
 */
export function cleanupOldJoinData() {
    const now = Date.now();
    for (const [guildId, joins] of guildJoinMap.entries()) {
        // Use a generous 60-second window for cleanup so we don't accidentally
        // discard data that is still within a custom window.
        const cutoff = now - 60_000;
        const fresh = joins.filter(j => j.timestamp > cutoff);
        if (fresh.length === 0) {
            guildJoinMap.delete(guildId);
        } else {
            guildJoinMap.set(guildId, fresh);
        }
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the member should bypass anti-raid checks.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {Object} settings
 * @returns {boolean}
 */
function isWhitelisted(member, settings) {
    const whitelistedUsers = settings.antiRaidWhitelistedUsers ?? [];
    const whitelistedRoles = settings.antiRaidWhitelistedRoles ?? [];

    if (whitelistedUsers.includes(member.user.id)) return true;

    for (const roleId of whitelistedRoles) {
        if (member.roles.cache.has(roleId)) return true;
    }

    return false;
}

/**
 * Execute the configured action against every user ID in the raid wave.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string[]}                   userIds
 * @param {Object}                     settings
 * @param {import('discord.js').Client} client
 * @returns {Promise<{ actioned: number, failed: number, skipped: number }>}
 */
async function executeRaidAction(guild, userIds, settings, client) {
    const results = { actioned: 0, failed: 0, skipped: 0 };
    const botMember = guild.members.me;
    const reason = `[Anti-Raid] Automatic action — raid detected (${settings.antiRaidJoinThreshold} joins in ${settings.antiRaidTimeWindow}s)`;

    for (const userId of userIds) {
        try {
            // Skip the bot itself
            if (userId === client.user.id) {
                results.skipped++;
                continue;
            }

            let member = guild.members.cache.get(userId);
            if (!member) {
                try {
                    member = await guild.members.fetch(userId);
                } catch {
                    // Member already left — still try to ban if action is ban
                    if (settings.antiRaidActionType === 'ban') {
                        await guild.members.ban(userId, { reason });
                        results.actioned++;
                    } else {
                        results.skipped++;
                    }
                    continue;
                }
            }

            // Skip members whose roles are higher than or equal to the bot's
            if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
                logger.debug(`[AntiRaid] Skipping ${member.user.tag} — role hierarchy`);
                results.skipped++;
                continue;
            }

            switch (settings.antiRaidActionType) {
                case 'ban':
                    await guild.members.ban(userId, { reason });
                    break;

                case 'kick':
                    if (member.kickable) {
                        await member.kick(reason);
                    } else {
                        results.skipped++;
                        continue;
                    }
                    break;

                case 'timeout':
                case 'mute': {
                    const durationMs = (settings.antiRaidDuration ?? 10) * 60 * 1000;
                    if (member.moderatable) {
                        await member.timeout(durationMs, reason);
                    } else {
                        results.skipped++;
                        continue;
                    }
                    break;
                }

                default:
                    logger.warn(`[AntiRaid] Unknown action type: ${settings.antiRaidActionType}`);
                    results.skipped++;
                    continue;
            }

            results.actioned++;
        } catch (error) {
            logger.error(`[AntiRaid] Failed to action user ${userId}:`, error);
            results.failed++;
        }
    }

    return results;
}

/**
 * Send a raid-alert embed to the configured log channel.
 *
 * @param {import('discord.js').Guild}  guild
 * @param {string[]}                    raidUserIds
 * @param {Object}                      settings
 * @param {{ actioned: number, failed: number, skipped: number }} results
 * @param {import('discord.js').Client} client
 */
async function sendRaidAlert(guild, raidUserIds, settings, results, client) {
    try {
        const logChannelId = settings.antiRaidLogChannelId;
        if (!logChannelId) return;

        const channel = guild.channels.cache.get(logChannelId)
            ?? await guild.channels.fetch(logChannelId).catch(() => null);

        if (!channel?.isTextBased()) return;

        const botMember = guild.members.me;
        if (botMember) {
            const perms = channel.permissionsFor(botMember);
            if (!perms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                logger.warn(`[AntiRaid] Missing permissions to send alert in channel ${logChannelId}`);
                return;
            }
        }

        const actionLabel = {
            kick: '👢 Kicked',
            ban: '🔨 Banned',
            timeout: '⏳ Timed Out',
            mute: '🔇 Muted',
        }[settings.antiRaidActionType] ?? '⚡ Actioned';

        const embed = new EmbedBuilder()
            .setColor(getColor('error'))
            .setTitle('🚨 Raid Detected!')
            .setDescription(
                `A raid was detected in **${guild.name}**.\n` +
                `**${raidUserIds.length}** accounts joined within **${settings.antiRaidTimeWindow} seconds**.`
            )
            .addFields(
                {
                    name: '⚙️ Action Taken',
                    value: actionLabel,
                    inline: true,
                },
                {
                    name: '✅ Actioned',
                    value: results.actioned.toString(),
                    inline: true,
                },
                {
                    name: '⚠️ Skipped / Failed',
                    value: `${results.skipped} skipped · ${results.failed} failed`,
                    inline: true,
                },
                {
                    name: '🔢 Threshold',
                    value: `${settings.antiRaidJoinThreshold} joins / ${settings.antiRaidTimeWindow}s`,
                    inline: true,
                },
                {
                    name: '👥 Affected Users',
                    value:
                        raidUserIds.length > 20
                            ? `${raidUserIds.slice(0, 20).map(id => `<@${id}>`).join(', ')} … and ${raidUserIds.length - 20} more`
                            : raidUserIds.map(id => `<@${id}>`).join(', ') || 'None',
                    inline: false,
                }
            )
            .setFooter({ text: `Guild ID: ${guild.id}`, iconURL: guild.iconURL() ?? undefined })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error('[AntiRaid] Failed to send raid alert:', error);
    }
}
