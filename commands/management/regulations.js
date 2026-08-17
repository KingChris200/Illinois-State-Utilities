const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const { getDashboardContext } = require('../../utils/dashboardManager');
const {
    createRegulationsPanelPayload,
    fetchStoredRegulationsMessage,
    getStoredRegulationsPanel,
    removeStoredRegulationsPanel,
    saveRegulationsPanel,
} = require('../../utils/regulationsPanelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('regulations')
        .setDescription('Manages the permanent ISRP Regulations panel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Posts the Regulations panel in a channel.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Where the Regulations panel should be posted.')
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
                .setDescription('Privately previews the Regulations panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription('Refreshes the saved Regulations panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes the saved Regulations panel.')
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
            const payload = createRegulationsPanelPayload(
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
            const storedPanel = await getStoredRegulationsPanel(
                interaction.guildId
            );
            const storedMessage = await fetchStoredRegulationsMessage(
                interaction.client,
                storedPanel
            );

            if (subcommand === 'remove') {
                if (!storedPanel) {
                    await interaction.editReply(
                        'There is no saved Regulations panel to remove.'
                    );
                    return;
                }

                await storedMessage?.delete().catch(() => null);
                await removeStoredRegulationsPanel(interaction.guildId);
                await interaction.editReply(
                    '✅ The Regulations panel was removed.'
                );
                return;
            }

            const payload = createRegulationsPanelPayload(
                interaction.guild,
                context
            );

            if (subcommand === 'update') {
                if (!storedMessage) {
                    await interaction.editReply(
                        'The saved Regulations message is unavailable. Run `/regulations setup` to post it again.'
                    );
                    return;
                }

                const updatedMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                await saveRegulationsPanel(interaction.guildId, {
                    channelId: updatedMessage.channelId,
                    messageId: updatedMessage.id,
                    updatedById: interaction.user.id,
                    updatedAt: new Date().toISOString(),
                });
                await interaction.editReply(
                    `✅ The Regulations panel was updated: ${updatedMessage.url}`
                );
                return;
            }

            const destination =
                interaction.options.getChannel('channel') ||
                interaction.channel;

            if (!destination?.isTextBased()) {
                await interaction.editReply(
                    'Choose a text or announcement channel for the Regulations panel.'
                );
                return;
            }

            let regulationsMessage;
            let outcome;

            if (storedMessage && storedPanel.channelId === destination.id) {
                regulationsMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                outcome = 'updated';
            } else {
                regulationsMessage = await destination.send(payload);
                outcome = 'posted';

                if (storedMessage) {
                    await storedMessage.delete().catch(() => null);
                }
            }

            await saveRegulationsPanel(interaction.guildId, {
                channelId: destination.id,
                messageId: regulationsMessage.id,
                postedById: interaction.user.id,
                updatedAt: new Date().toISOString(),
            });
            await interaction.editReply(
                `✅ The ISRP Regulations panel was ${outcome}: ${regulationsMessage.url}`
            );
        } catch (error) {
            console.error('[REGULATIONS PANEL] Command failed:', error);
            await interaction
                .editReply(
                    'Something went wrong while managing the Regulations panel.'
                )
                .catch(() => null);
        }
    },
};
