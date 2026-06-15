import { SlashCommandBuilder, MessageFlags, PermissionsBitField } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    getShiftRoleId,
    getActiveShift,
    startShift,
    stopShift,
    toggleBreak,
    formatDuration,
} from '../../services/shiftService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shift')
        .setDescription('Manage your staff shift')
        .addSubcommand(sub =>
            sub
                .setName('start')
                .setDescription('Clock in and start your shift')
        )
        .addSubcommand(sub =>
            sub
                .setName('stop')
                .setDescription('Clock out and end your shift')
        )
        .addSubcommand(sub =>
            sub
                .setName('break')
                .setDescription('Toggle break status — pause or resume shift time tracking')
        ),
    category: 'Staff',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Shift interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'shift',
            });
            return;
        }

        try {
            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            // --- Role check ---
            const shiftRoleId = await getShiftRoleId(guildId);

            if (!shiftRoleId) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            'Shift system has not been configured yet. An administrator must run `/shiftconfig setrole` first.'
                        ),
                    ],
                });
            }

            const member = interaction.member;
            const hasShiftRole = member.roles.cache.has(shiftRoleId);

            if (!hasShiftRole) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            'You do not have the required role to use shift commands.'
                        ),
                    ],
                });
            }

            // --- Subcommand routing ---
            if (subcommand === 'start') {
                const existing = await getActiveShift(userId, guildId);
                if (existing) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            errorEmbed(
                                'You already have an active shift. Use `/shift stop` to end it first.'
                            ),
                        ],
                    });
                }

                const shift = await startShift(userId, guildId);
                const startTimestamp = Math.floor(new Date(shift.start_time).getTime() / 1000);

                const embed = createEmbed({
                    title: '🟢 Shift Started',
                    description: `Your shift has begun. Good luck, ${interaction.user}!`,
                    color: 'success',
                    fields: [
                        { name: 'Started At', value: `<t:${startTimestamp}:T> (<t:${startTimestamp}:R>)`, inline: true },
                    ],
                    timestamp: true,
                });

                return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            if (subcommand === 'stop') {
                const shift = await getActiveShift(userId, guildId);
                if (!shift) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            errorEmbed(
                                'You do not have an active shift. Use `/shift start` to begin one.'
                            ),
                        ],
                    });
                }

                const ended = await stopShift(shift.id);
                const startTimestamp = Math.floor(new Date(ended.start_time).getTime() / 1000);
                const endTimestamp = Math.floor(new Date(ended.end_time).getTime() / 1000);
                const totalMs = Number(ended.total_duration);
                const breakMs = Number(ended.break_time);

                const embed = createEmbed({
                    title: '🔴 Shift Ended',
                    description: `Your shift has been recorded. Great work, ${interaction.user}!`,
                    color: 'error',
                    fields: [
                        { name: 'Started At', value: `<t:${startTimestamp}:T>`, inline: true },
                        { name: 'Ended At', value: `<t:${endTimestamp}:T>`, inline: true },
                        { name: '\u200B', value: '\u200B', inline: true },
                        { name: 'Total Duration', value: formatDuration(totalMs), inline: true },
                        { name: 'Break Time', value: formatDuration(breakMs), inline: true },
                        { name: 'Active Time', value: formatDuration(Math.max(0, totalMs)), inline: true },
                    ],
                    timestamp: true,
                });

                return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            if (subcommand === 'break') {
                const shift = await getActiveShift(userId, guildId);
                if (!shift) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            errorEmbed(
                                'You do not have an active shift. Use `/shift start` to begin one.'
                            ),
                        ],
                    });
                }

                const { shift: updated, nowOnBreak } = await toggleBreak(shift.id);
                const breakMs = Number(updated.break_time);

                if (nowOnBreak) {
                    const embed = createEmbed({
                        title: '⏸️ Break Started',
                        description: 'You are now on break. Time tracking is paused.',
                        color: 'warning',
                        fields: [
                            { name: 'Break Time So Far', value: formatDuration(breakMs), inline: true },
                        ],
                        timestamp: true,
                    });
                    return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
                } else {
                    const embed = createEmbed({
                        title: '▶️ Break Ended',
                        description: 'Welcome back! Time tracking has resumed.',
                        color: 'success',
                        fields: [
                            { name: 'Total Break Time', value: formatDuration(breakMs), inline: true },
                        ],
                        timestamp: true,
                    });
                    return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
                }
            }
        } catch (error) {
            logger.error('Shift command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'shift_failed' });
        }
    },
};
