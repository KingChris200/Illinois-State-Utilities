const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const { getDashboardContext } = require('../../utils/dashboardManager');
const {
    createInformationPanelPayload,
    fetchStoredInformationMessage,
    getStoredInformationPanel,
    removeStoredInformationPanel,
    saveInformationPanel,
} = require('../../utils/informationPanelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('information')
        .setDescription('Manages the permanent ISRP Information panel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Posts the Information panel in a channel.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Where the Information panel should be posted.')
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
                .setDescription('Privately previews the Information panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription('Refreshes the saved Information panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes the saved Information panel.')
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
            const payload = createInformationPanelPayload(
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
            const storedPanel = await getStoredInformationPanel(
                interaction.guildId
            );
            const storedMessage = await fetchStoredInformationMessage(
                interaction.client,
                storedPanel
            );

            if (subcommand === 'remove') {
                if (!storedPanel) {
                    await interaction.editReply(
                        'There is no saved Information panel to remove.'
                    );
                    return;
                }

                await storedMessage?.delete().catch(() => null);
                await removeStoredInformationPanel(interaction.guildId);
                await interaction.editReply(
                    '✅ The Information panel was removed.'
                );
                return;
            }

            const payload = createInformationPanelPayload(
                interaction.guild,
                context
            );

            if (subcommand === 'update') {
                if (!storedMessage) {
                    await interaction.editReply(
                        'The saved Information message is unavailable. Run `/information setup` to post it again.'
                    );
                    return;
                }

                const updatedMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                await saveInformationPanel(interaction.guildId, {
                    channelId: updatedMessage.channelId,
                    messageId: updatedMessage.id,
                    updatedById: interaction.user.id,
                    updatedAt: new Date().toISOString(),
                });
                await interaction.editReply(
                    `✅ The Information panel was updated: ${updatedMessage.url}`
                );
                return;
            }

            const destination =
                interaction.options.getChannel('channel') ||
                interaction.channel;

            if (!destination?.isTextBased()) {
                await interaction.editReply(
                    'Choose a text or announcement channel for the Information panel.'
                );
                return;
            }

            let informationMessage;
            let outcome;

            if (storedMessage && storedPanel.channelId === destination.id) {
                informationMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                outcome = 'updated';
            } else {
                informationMessage = await destination.send(payload);
                outcome = 'posted';

                if (storedMessage) {
                    await storedMessage.delete().catch(() => null);
                }
            }

            await saveInformationPanel(interaction.guildId, {
                channelId: destination.id,
                messageId: informationMessage.id,
                postedById: interaction.user.id,
                updatedAt: new Date().toISOString(),
            });
            await interaction.editReply(
                `✅ The ISRP Information panel was ${outcome}: ${informationMessage.url}`
            );
        } catch (error) {
            console.error('[INFORMATION PANEL] Command failed:', error);
            await interaction
                .editReply(
                    'Something went wrong while managing the Information panel.'
                )
                .catch(() => null);
        }
    },
};
