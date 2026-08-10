const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const {
    createDashboardPanelPayload,
    fetchStoredDashboardMessage,
    getDashboardContext,
    getStoredDashboardPanel,
    removeStoredDashboardPanel,
    saveDashboardPanel,
} = require('../../utils/dashboardManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Manages the permanent ISRP Dashboard panel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Posts the Dashboard in a selected channel.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Where the permanent Dashboard should be posted.')
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('preview')
                .setDescription('Privately previews the complete Dashboard.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription('Refreshes the currently saved Dashboard.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes the currently saved Dashboard.')
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: 'This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const context = await getDashboardContext(interaction.guildId);

        if (subcommand === 'preview') {
            const payload = createDashboardPanelPayload(
                interaction.guild,
                context
            );
            await interaction.reply({
                ...payload,
                flags: MessageFlags.Ephemeral | payload.flags,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const storedPanel = await getStoredDashboardPanel(
                interaction.guildId
            );
            const storedMessage = await fetchStoredDashboardMessage(
                interaction.client,
                storedPanel
            );

            if (subcommand === 'remove') {
                if (!storedPanel) {
                    await interaction.editReply(
                        'There is no saved Dashboard panel to remove.'
                    );
                    return;
                }

                await storedMessage?.delete().catch(() => null);
                await removeStoredDashboardPanel(interaction.guildId);
                await interaction.editReply('✅ The Dashboard panel was removed.');
                return;
            }

            const payload = createDashboardPanelPayload(
                interaction.guild,
                context
            );

            if (subcommand === 'update') {
                if (!storedMessage) {
                    await interaction.editReply(
                        'The saved Dashboard message is unavailable. Run `/dashboard setup` to post it again.'
                    );
                    return;
                }

                const updatedMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                await saveDashboardPanel(interaction.guildId, {
                    channelId: updatedMessage.channelId,
                    messageId: updatedMessage.id,
                    updatedById: interaction.user.id,
                    updatedAt: new Date().toISOString(),
                });
                await interaction.editReply(
                    `✅ The Dashboard was updated: ${updatedMessage.url}`
                );
                return;
            }

            const destination =
                interaction.options.getChannel('channel') ||
                interaction.channel;

            if (!destination?.isTextBased()) {
                await interaction.editReply(
                    'Choose a text or announcement channel for the Dashboard.'
                );
                return;
            }

            let dashboardMessage;
            let outcome;

            if (storedMessage && storedPanel.channelId === destination.id) {
                dashboardMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                outcome = 'updated';
            } else {
                dashboardMessage = await destination.send(payload);
                outcome = 'posted';

                if (storedMessage) {
                    await storedMessage.delete().catch(() => null);
                }
            }

            await saveDashboardPanel(interaction.guildId, {
                channelId: destination.id,
                messageId: dashboardMessage.id,
                postedById: interaction.user.id,
                updatedAt: new Date().toISOString(),
            });
            await interaction.editReply(
                `✅ The ISRP Dashboard was ${outcome}: ${dashboardMessage.url}`
            );
        } catch (error) {
            console.error('[DASHBOARD] Command failed:', error);
            await interaction
                .editReply(
                    'Something went wrong while managing the Dashboard panel.'
                )
                .catch(() => null);
        }
    },
};
