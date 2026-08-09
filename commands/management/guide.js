const {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const {
    MAIN_SERVER_ID,
} = require('../../config/serverConfigs');
const {
    createGuidePanelPayload,
    fetchStoredGuideMessage,
    getStoredGuidePanel,
    removeStoredGuidePanel,
    saveGuidePanel,
} = require('../../utils/staffGuideManager');
const {
    getComplianceState,
    publishGuideVersion,
} = require('../../utils/staffGuideCompliance');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription(
            'Manages the permanent ISRP Staff Guide panel.'
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Posts or moves the permanent Staff Guide panel.'
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription(
                            'Staff channel for the guide (defaults to this channel).'
                        )
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
                .setDescription(
                    'Privately previews the Staff Guide panel.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription(
                    'Refreshes the posted panel with the newest guide.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription(
                    'Removes the permanent Staff Guide panel.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('publish-update')
                .setDescription(
                    'Publishes a new version of the Staff Guide panel.'
                )
                .addStringOption((option) =>
                    option
                        .setName('version')
                        .setDescription(
                            'New version label, such as 1.1 or 2026.08.'
                        )
                        .setRequired(true)
                        .setMaxLength(32)
                )
                .addStringOption((option) =>
                    option
                        .setName('summary')
                        .setDescription(
                            'Short explanation of what changed.'
                        )
                        .setRequired(false)
                        .setMaxLength(500)
                )
        ),

    async execute(interaction) {
        if (
            !interaction.inGuild?.() ||
            interaction.guildId !== MAIN_SERVER_ID
        ) {
            await interaction.reply({
                content:
                    '❌ The Staff Guide panel is available only in the Illinois State Roleplay server.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
            return;
        }

        if (!canManageGuide(interaction)) {
            await interaction.reply({
                content:
                    '❌ You need **Manage Server** permission to manage the Staff Guide panel.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
            return;
        }

        const subcommand =
            interaction.options.getSubcommand();

        try {
            if (subcommand === 'preview') {
                const complianceState =
                    await getComplianceState(
                        interaction.guildId
                    );
                const panelPayload =
                    createGuidePanelPayload(
                        interaction.guild,
                        complianceState
                    );

                await interaction.reply({
                    ...panelPayload,
                    flags:
                        MessageFlags.Ephemeral |
                        panelPayload.flags,
                });
                return;
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            if (subcommand === 'setup') {
                await setupGuide(interaction);
                return;
            }

            if (subcommand === 'update') {
                await updateGuide(interaction);
                return;
            }

            if (subcommand === 'remove') {
                await removeGuide(interaction);
                return;
            }

            if (
                subcommand === 'publish-update'
            ) {
                await publishUpdate(interaction);
            }
        } catch (error) {
            console.error(
                `Error while running /guide ${subcommand}:`,
                error
            );

            await interaction.editReply({
                content:
                    '❌ I could not manage the Staff Guide panel. Please check my channel permissions and try again.',
                embeds: [],
                components: [],
                allowedMentions: { parse: [] },
            });
        }
    },

    canManageGuide,
    canPostGuide,
};

function canManageGuide(interaction) {
    if (
        interaction.guild?.ownerId ===
        interaction.user?.id
    ) {
        return true;
    }

    return Boolean(
        interaction.member?.permissions?.has?.(
            PermissionFlagsBits.Administrator
        ) ||
            interaction.member?.permissions?.has?.(
                PermissionFlagsBits.ManageGuild
            )
    );
}

function canPostGuide(channel, interaction) {
    if (
        !channel?.isTextBased?.() ||
        typeof channel.send !== 'function'
    ) {
        return false;
    }

    const botMember = interaction.guild?.members?.me;

    if (
        !botMember ||
        typeof channel.permissionsFor !== 'function'
    ) {
        return true;
    }

    const permissions = channel.permissionsFor(botMember);

    return Boolean(
        permissions?.has(
            PermissionFlagsBits.ViewChannel
        ) &&
            permissions?.has(
                PermissionFlagsBits.SendMessages
            ) &&
            permissions?.has(
                PermissionFlagsBits.EmbedLinks
            )
    );
}

async function setupGuide(interaction) {
    const channel =
        interaction.options.getChannel('channel') ||
        interaction.channel;

    if (!canPostGuide(channel, interaction)) {
        await interaction.editReply({
            content:
                '❌ I need **View Channel**, **Send Messages**, and **Embed Links** in that channel.',
            allowedMentions: { parse: [] },
        });
        return;
    }

    const existingPanel =
        await getStoredGuidePanel(
            interaction.guildId
        );
    const existingMessage =
        await fetchStoredGuideMessage(
            interaction.client,
            existingPanel
        );
    const panelPayload = createGuidePanelPayload(
        interaction.guild,
        await getComplianceState(
            interaction.guildId
        )
    );
    let guideMessage;
    let outcome;

    if (
        existingMessage &&
        existingPanel.channelId === channel.id
    ) {
        guideMessage = await existingMessage.edit(
            {
                ...panelPayload,
                content: null,
                embeds: [],
                attachments: [],
            }
        );
        outcome = 'updated';
    } else {
        guideMessage = await channel.send(
            panelPayload
        );
        outcome = existingMessage
            ? 'moved'
            : 'posted';

        if (existingMessage) {
            await existingMessage.delete().catch(
                (error) =>
                    console.warn(
                        '[STAFF GUIDE] Could not remove the previous panel:',
                        error.message
                    )
            );
        }
    }

    const now = new Date().toISOString();

    await saveGuidePanel(interaction.guildId, {
        guildId: interaction.guildId,
        channelId: channel.id,
        messageId: guideMessage.id,
        postedById: interaction.user.id,
        createdAt:
            existingPanel?.createdAt || now,
        updatedAt: now,
    });

    await interaction.editReply({
        content:
            `✅ The permanent Staff Guide panel was ${outcome} in ${channel}.`,
        allowedMentions: { parse: [] },
    });
}

async function updateGuide(interaction) {
    const panel = await getStoredGuidePanel(
        interaction.guildId
    );

    if (!panel) {
        await interaction.editReply({
            content:
                '❌ No Staff Guide panel is saved yet. Run `/guide setup` first.',
            allowedMentions: { parse: [] },
        });
        return;
    }

    const message = await fetchStoredGuideMessage(
        interaction.client,
        panel
    );

    if (!message) {
        await interaction.editReply({
            content:
                '❌ The saved Staff Guide message could not be found. Run `/guide setup` to recreate it.',
            allowedMentions: { parse: [] },
        });
        return;
    }

    await message.edit({
        ...createGuidePanelPayload(
            interaction.guild,
            await getComplianceState(
                interaction.guildId
            )
        ),
        content: null,
        embeds: [],
        attachments: [],
    });

    await saveGuidePanel(interaction.guildId, {
        ...panel,
        updatedAt: new Date().toISOString(),
        updatedById: interaction.user.id,
    });

    await interaction.editReply({
        content:
            `✅ The Staff Guide panel was refreshed in <#${panel.channelId}>.`,
        allowedMentions: { parse: [] },
    });
}

async function removeGuide(interaction) {
    const panel = await getStoredGuidePanel(
        interaction.guildId
    );

    if (!panel) {
        await interaction.editReply({
            content:
                'ℹ️ There is no saved Staff Guide panel to remove.',
            allowedMentions: { parse: [] },
        });
        return;
    }

    const message = await fetchStoredGuideMessage(
        interaction.client,
        panel
    );

    if (message) {
        await message.delete().catch((error) => {
            console.warn(
                '[STAFF GUIDE] Could not delete the panel message:',
                error.message
            );
        });
    }

    await removeStoredGuidePanel(
        interaction.guildId
    );

    await interaction.editReply({
        content:
            '✅ The Staff Guide panel and its saved location were removed.',
        allowedMentions: { parse: [] },
    });
}

async function publishUpdate(interaction) {
    const version = interaction.options
        .getString('version', true)
        .trim();
    const summary = interaction.options
        .getString('summary')
        ?.trim();
    const result = await publishGuideVersion({
        guildId: interaction.guildId,
        version,
        summary,
        actorId: interaction.user.id,
    });

    if (!result.changed) {
        await interaction.editReply({
            content:
                `ℹ️ Version **${result.state.currentVersion}** is already the current Staff Guide version.`,
            allowedMentions: { parse: [] },
        });
        return;
    }

    const panel = await getStoredGuidePanel(
        interaction.guildId
    );
    const message = await fetchStoredGuideMessage(
        interaction.client,
        panel
    );

    if (message) {
        await message.edit({
            ...createGuidePanelPayload(
                interaction.guild,
                result.state
            ),
            content: null,
            embeds: [],
            attachments: [],
        });

        await saveGuidePanel(
            interaction.guildId,
            {
                ...panel,
                updatedAt:
                    new Date().toISOString(),
                updatedById:
                    interaction.user.id,
            }
        );
    }

    await interaction.editReply({
        content:
            `✅ Staff Guide version **${result.state.currentVersion}** was published.${message ? ' The permanent panel was refreshed.' : ' Run `/guide setup` when you are ready to post the panel.'}`,
        allowedMentions: { parse: [] },
    });
}
