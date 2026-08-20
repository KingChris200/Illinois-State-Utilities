const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const {
    ISP_CHANNELS,
    ISP_SERVER_ID,
} = require('../../config/serverConfigs');
const {
    createIspInformationPanelPayload,
    fetchStoredIspInformationMessage,
    getStoredIspInformationPanel,
    removeStoredIspInformationPanel,
    saveIspInformationPanel,
} = require('../../utils/ispInformationPanelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('isp-information')
        .setDescription('Manage the permanent Illinois State Police information panel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Post the ISP information panel in a channel.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Where the ISP information panel should be posted.')
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
                .setDescription('Privately preview the ISP information panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription('Refresh the saved ISP information panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Remove the saved ISP information panel.')
        ),

    async execute(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== ISP_SERVER_ID) {
            await interaction.reply({
                content: 'This command is only available in the Illinois State Police server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.channelId !== ISP_CHANNELS.deputyCommand) {
            await interaction.reply({
                content: `Use \`/isp-information\` in <#${ISP_CHANNELS.deputyCommand}>.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'preview') {
            const payload = createIspInformationPanelPayload();
            await interaction.reply({
                ...payload,
                flags: MessageFlags.Ephemeral | payload.flags,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const storedPanel = await getStoredIspInformationPanel(
                interaction.guildId
            );
            const storedMessage = await fetchStoredIspInformationMessage(
                interaction.client,
                storedPanel
            );

            if (subcommand === 'remove') {
                if (!storedPanel) {
                    await interaction.editReply(
                        'There is no saved ISP information panel to remove.'
                    );
                    return;
                }

                await storedMessage?.delete().catch(() => null);
                await removeStoredIspInformationPanel(interaction.guildId);
                await interaction.editReply(
                    '✅ The ISP information panel was removed.'
                );
                return;
            }

            const payload = createIspInformationPanelPayload();

            if (subcommand === 'update') {
                if (!storedMessage) {
                    await interaction.editReply(
                        'The saved ISP information message is unavailable. Run `/isp-information setup` to post it again.'
                    );
                    return;
                }

                const updatedMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                await saveIspInformationPanel(interaction.guildId, {
                    channelId: updatedMessage.channelId,
                    messageId: updatedMessage.id,
                    updatedById: interaction.user.id,
                    updatedAt: new Date().toISOString(),
                });
                await interaction.editReply(
                    `✅ The ISP information panel was updated: ${updatedMessage.url}`
                );
                return;
            }

            const destination =
                interaction.options.getChannel('channel') ||
                interaction.channel;

            if (!destination?.isTextBased()) {
                await interaction.editReply(
                    'Choose a text or announcement channel for the ISP information panel.'
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

            await saveIspInformationPanel(interaction.guildId, {
                channelId: destination.id,
                messageId: informationMessage.id,
                postedById: interaction.user.id,
                updatedAt: new Date().toISOString(),
            });
            await interaction.editReply(
                `✅ The ISP information panel was ${outcome}: ${informationMessage.url}`
            );
        } catch (error) {
            console.error('[ISP INFORMATION PANEL] Command failed:', error);
            await interaction
                .editReply(
                    'Something went wrong while managing the ISP information panel.'
                )
                .catch(() => null);
        }
    },
};
