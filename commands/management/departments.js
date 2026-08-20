const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const { MAIN_SERVER_ID } = require('../../config/serverConfigs');
const {
    createDepartmentsPanelPayload,
    fetchStoredDepartmentsMessage,
    getStoredDepartmentsPanel,
    removeStoredDepartmentsPanel,
    saveDepartmentsPanel,
} = require('../../utils/departmentsPanelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('departments')
        .setDescription('Manages the permanent ISRP Departments Hub.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Posts the Departments Hub in a channel.')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Where the Departments Hub should be posted.')
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
                .setDescription('Privately previews the Departments Hub.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription('Refreshes the saved Departments Hub.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Removes the saved Departments Hub.')
        ),

    async execute(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== MAIN_SERVER_ID) {
            await interaction.reply({
                content: 'This command is only available in Illinois State Roleplay.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'preview') {
            const payload = createDepartmentsPanelPayload();
            await interaction.reply({
                ...payload,
                flags: MessageFlags.Ephemeral | payload.flags,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const storedPanel = await getStoredDepartmentsPanel(
                interaction.guildId
            );
            const storedMessage = await fetchStoredDepartmentsMessage(
                interaction.client,
                storedPanel
            );

            if (subcommand === 'remove') {
                if (!storedPanel) {
                    await interaction.editReply(
                        'There is no saved Departments Hub to remove.'
                    );
                    return;
                }

                await storedMessage?.delete().catch(() => null);
                await removeStoredDepartmentsPanel(interaction.guildId);
                await interaction.editReply('✅ The Departments Hub was removed.');
                return;
            }

            const payload = createDepartmentsPanelPayload();

            if (subcommand === 'update') {
                if (!storedMessage) {
                    await interaction.editReply(
                        'The saved Departments Hub is unavailable. Run `/departments setup` to post it again.'
                    );
                    return;
                }

                const updatedMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                await saveDepartmentsPanel(interaction.guildId, {
                    channelId: updatedMessage.channelId,
                    messageId: updatedMessage.id,
                    updatedById: interaction.user.id,
                    updatedAt: new Date().toISOString(),
                });
                await interaction.editReply(
                    `✅ The Departments Hub was updated: ${updatedMessage.url}`
                );
                return;
            }

            const destination =
                interaction.options.getChannel('channel') || interaction.channel;

            if (!destination?.isTextBased()) {
                await interaction.editReply(
                    'Choose a text or announcement channel for the Departments Hub.'
                );
                return;
            }

            let departmentMessage;
            let outcome;

            if (storedMessage && storedPanel.channelId === destination.id) {
                departmentMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                outcome = 'updated';
            } else {
                departmentMessage = await destination.send(payload);
                outcome = 'posted';
                await storedMessage?.delete().catch(() => null);
            }

            await saveDepartmentsPanel(interaction.guildId, {
                channelId: destination.id,
                messageId: departmentMessage.id,
                postedById: interaction.user.id,
                updatedAt: new Date().toISOString(),
            });
            await interaction.editReply(
                `✅ The Departments Hub was ${outcome}: ${departmentMessage.url}`
            );
        } catch (error) {
            console.error('[DEPARTMENTS HUB] Command failed:', error);
            await interaction.editReply(
                'Something went wrong while managing the Departments Hub.'
            ).catch(() => null);
        }
    },
};
