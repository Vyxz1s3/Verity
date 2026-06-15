import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    getShiftRoleId,
    getActiveShift,
    formatDuration,
} from '../../services/shiftService.js';

/**
 * Build the shift status embed for a given user.
 * @param {import('discord.js').User} user
 * @param {Object|null} shift  Active shift row, or null if none.
 * @returns {import('discord.js').EmbedBuilder}
 */
export function buildShiftEmbed(user, shift) {
    if (!shift) {
        return createEmbed({
            title: '🕐 Shift Management',
            description: `${user} currently has **no active shift**.\n\nClick **Start Shift** below to clock in.`,
            color: 'gray',
            fields: [
                { name: 'Status', value: '⚫ Inactive', inline: true },
            ],
            timestamp: true,
        });
    }

    const startTimestamp = Math.floor(new Date(shift.start_time).getTime() / 1000);
    const elapsedMs = Date.now() - new Date(shift.start_time).getTime();
    const breakMs = Number(shift.break_time);

    // If currently on break, add the in-progress break time to the total break time
    let currentBreakMs = 0;
    if (shift.on_break && shift.break_started_at) {
        currentBreakMs = Date.now() - new Date(shift.break_started_at).getTime();
    }
    const totalBreakMs = breakMs + currentBreakMs;
    const activeMs = Math.max(0, elapsedMs - totalBreakMs);

    if (shift.on_break) {
        return createEmbed({
            title: '⏸️ Shift Management',
            description: `${user} is currently **on break**.\n\nClick **Break** to resume, or **Stop Shift** to clock out.`,
            color: 'warning',
            fields: [
                { name: 'Status', value: '🟡 On Break', inline: true },
                { name: 'Started At', value: `<t:${startTimestamp}:T> (<t:${startTimestamp}:R>)`, inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: 'Elapsed Time', value: formatDuration(elapsedMs), inline: true },
                { name: 'Break Time', value: formatDuration(totalBreakMs), inline: true },
                { name: 'Active Time', value: formatDuration(activeMs), inline: true },
            ],
            timestamp: true,
        });
    }

    return createEmbed({
        title: '🟢 Shift Management',
        description: `${user} has an **active shift** in progress.\n\nClick **Break** to pause, or **Stop Shift** to clock out.`,
        color: 'success',
        fields: [
            { name: 'Status', value: '🟢 Active', inline: true },
            { name: 'Started At', value: `<t:${startTimestamp}:T> (<t:${startTimestamp}:R>)`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Elapsed Time', value: formatDuration(elapsedMs), inline: true },
            { name: 'Break Time', value: formatDuration(totalBreakMs), inline: true },
            { name: 'Active Time', value: formatDuration(activeMs), inline: true },
        ],
        timestamp: true,
    });
}

/**
 * Build the three shift action buttons.
 * @param {Object|null} shift  Active shift row, or null if none.
 * @returns {ActionRowBuilder}
 */
export function buildShiftButtons(shift) {
    const hasActiveShift = !!shift;
    const onBreak = hasActiveShift && shift.on_break;

    const startButton = new ButtonBuilder()
        .setCustomId('shift_start')
        .setLabel('Start Shift')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success)
        .setDisabled(hasActiveShift); // disabled when a shift is already running

    const breakButton = new ButtonBuilder()
        .setCustomId('shift_break')
        .setLabel(onBreak ? 'Resume Shift' : 'Break')
        .setEmoji(onBreak ? '▶️' : '⏸️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasActiveShift); // disabled when no shift is active

    const stopButton = new ButtonBuilder()
        .setCustomId('shift_stop')
        .setLabel('Stop Shift')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasActiveShift); // disabled when no shift is active

    return new ActionRowBuilder().addComponents(startButton, breakButton, stopButton);
}

export default {
    data: new SlashCommandBuilder()
        .setName('shift')
        .setDescription('Manage your staff shift'),
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

            // --- Build and send the management panel ---
            const shift = await getActiveShift(userId, guildId);
            const embed = buildShiftEmbed(interaction.user, shift);
            const row = buildShiftButtons(shift);

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                components: [row],
            });
        } catch (error) {
            logger.error('Shift command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'shift_failed' });
        }
    },
};
