import {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('retirement')
        .setDescription('Issue a staff retirement notice')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(option =>
            option
                .setName('staff_member')
                .setDescription('The staff member retiring')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('final_rank')
                .setDescription('Their final rank/position')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for retirement')
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName('supervisor')
                .setDescription('Who approved the retirement')
                .setRequired(true)
        ),
    category: 'Staff',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Retirement interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'retirement'
            });
            return;
        }

        try {
            const staffMember = interaction.options.getUser('staff_member');
            const finalRank = interaction.options.getRole('final_rank');
            const reason = interaction.options.getString('reason');
            const supervisor = interaction.options.getUser('supervisor');

            const issuedAt = new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).replace(',', '').replace(/(\d{4}),/, '$1 at');

            const container = new ContainerBuilder()
                .setAccentColor(0x1a1a1a)
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(
                            'https://cdn.discordapp.com/attachments/1493023004802679007/1516162282663710730/Copy_of_Copy_of_Copy_of_Free_Release_Banner.png?ex=6a31a3a9&is=6a305229&hm=80d58b0354ff30b5d39c47d68b2cb2c8f965546929a9797b3de92cc7666a622b'
                        )
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### 〔 🎗️ 〕 Staff Retirement Announcement`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `On behalf of the Califirnia State Roleplay Staff Division, we would like to thank ${staffMember} for their dedicated service and contributions. We wish them all the best in their future endeavours.`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        [
                            `**— Retirement Details —**`,
                            ``,
                            `<:arrow:1516172552592949350> **Staff Member** ・ ${staffMember}`,
                            `<:arrow:1516172552592949350> **Final Rank** ・ ${finalRank}`,
                            `<:arrow:1516172552592949350> **Reason** ・ ${reason}`,
                            `<:arrow:1516172552592949350> **Approved By** ・ ${supervisor}`,
                            `<:arrow:1516172552592949350> **Issued At** ・ ${issuedAt}`,
                        ].join('\n')
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# ⭐ Califirnia State Roleplay  •  Staff Division`
                    )
                );

            await interaction.channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });

            await InteractionHelper.safeEditReply(interaction, {
                content: '✅ Retirement notice posted successfully!'
            });
        } catch (error) {
            logger.error('Retirement command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'retirement_failed' });
        }
    }
};
