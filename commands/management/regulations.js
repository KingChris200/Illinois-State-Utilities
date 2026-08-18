const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const { getDashboardContext } = require('../../utils/dashboardManager');
const {
    REGULATIONS_PANEL_TYPES,
    createRegulationsPanelPayload,
    fetchStoredRegulationsMessage,
    getPanelConfiguration,
    getStoredRegulationsPanel,
    removeStoredRegulationsPanel,
    saveRegulationsPanel,
} = require('../../utils/regulationsPanelManager');

function addPanelOption(subcommand) {
    return subcommand.addStringOption((option) =>
        option
            .setName('panel')
            .setDescription('Which guidelines panel should be managed.')
            .setRequired(true)
            .addChoices(
                REGULATIONS_PANEL_TYPES.map(({ label, value }) => ({
                    name: label,
                    value,
                }))
            )
    );
}

function getConfiguredChannelId(panelType, context) {
    return panelType === 'discord'
        ? context.discordGuidelinesChannelId
        : context.inGameGuidelinesChannelId;
}

async function fetchConfiguredChannel(interaction, panelType, context) {
    const channelId = getConfiguredChannelId(panelType, context);
    if (!channelId) {
        return null;
    }

    return (
        interaction.client.channels?.cache?.get(channelId) ||
        (await interaction.client.channels?.fetch?.(channelId).catch(() => null))
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('regulations')
        .setDescription('Manages the permanent ISRP guidelines panels.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) => {
            addPanelOption(
                subcommand
                    .setName('setup')
                    .setDescription('Posts a guidelines panel in its channel.')
            );

            return subcommand.addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('Optional channel override for this panel.')
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
                    .setRequired(false)
            );
        })
        .addSubcommand((subcommand) =>
            addPanelOption(
                subcommand
                    .setName('preview')
                    .setDescription('Privately previews a guidelines panel.')
            )
        )
        .addSubcommand((subcommand) =>
            addPanelOption(
                subcommand
                    .setName('update')
                    .setDescription('Refreshes a saved guidelines panel.')
            )
        )
        .addSubcommand((subcommand) =>
            addPanelOption(
                subcommand
                    .setName('remove')
                    .setDescription('Removes a saved guidelines panel.')
            )
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
        const panelType = interaction.options.getString('panel', true);
        const configuration = getPanelConfiguration(panelType);
        const panelLabel = configuration?.shortTitle || 'Guidelines';
        const context = await getDashboardContext(interaction.guildId);

        if (subcommand === 'preview') {
            const payload = createRegulationsPanelPayload(
                interaction.guild,
                panelType,
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
                interaction.guildId,
                panelType
            );
            const storedMessage = await fetchStoredRegulationsMessage(
                interaction.client,
                storedPanel
            );

            if (subcommand === 'remove') {
                if (!storedPanel) {
                    await interaction.editReply(
                        `There is no saved ${panelLabel} panel to remove.`
                    );
                    return;
                }

                await storedMessage?.delete().catch(() => null);
                await removeStoredRegulationsPanel(
                    interaction.guildId,
                    panelType
                );
                await interaction.editReply(
                    `✅ The ${panelLabel} panel was removed.`
                );
                return;
            }

            const payload = createRegulationsPanelPayload(
                interaction.guild,
                panelType,
                context
            );

            if (subcommand === 'update') {
                if (!storedMessage) {
                    await interaction.editReply(
                        `The saved ${panelLabel} message is unavailable. Run \`/regulations setup\` for that panel to post it again.`
                    );
                    return;
                }

                const updatedMessage = await storedMessage.edit({
                    ...payload,
                    content: null,
                    embeds: [],
                    attachments: [],
                });
                await saveRegulationsPanel(interaction.guildId, panelType, {
                    channelId: updatedMessage.channelId,
                    messageId: updatedMessage.id,
                    updatedById: interaction.user.id,
                    updatedAt: new Date().toISOString(),
                });
                await interaction.editReply(
                    `✅ The ${panelLabel} panel was updated: ${updatedMessage.url}`
                );
                return;
            }

            const selectedChannel = interaction.options.getChannel('channel');
            const configuredChannel = selectedChannel
                ? null
                : await fetchConfiguredChannel(interaction, panelType, context);
            const destination =
                selectedChannel || configuredChannel || interaction.channel;

            if (
                !destination?.isTextBased() ||
                destination.guildId !== interaction.guildId
            ) {
                await interaction.editReply(
                    `Choose a text or announcement channel for the ${panelLabel} panel.`
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

            await saveRegulationsPanel(interaction.guildId, panelType, {
                channelId: destination.id,
                messageId: regulationsMessage.id,
                postedById: interaction.user.id,
                updatedAt: new Date().toISOString(),
            });
            await interaction.editReply(
                `✅ The ${panelLabel} panel was ${outcome}: ${regulationsMessage.url}`
            );
        } catch (error) {
            console.error('[REGULATIONS PANEL] Command failed:', error);
            await interaction
                .editReply(
                    `Something went wrong while managing the ${panelLabel} panel.`
                )
                .catch(() => null);
        }
    },
};
