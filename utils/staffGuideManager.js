const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
} = require('discord.js');

const brands = require('../config/branding');
const {
    CHAIN_OF_COMMAND,
    GUIDE_SECTIONS,
    RANK_GUIDES,
    STAFF_GUIDE_DOCUMENT_URL,
    getGuideSection,
    getRankGuide,
    getStaffGuideTabUrl,
} = require('../config/staffGuideContent');
const {
    MAIN_SERVER_ID,
    getServerConfig,
} = require('../config/serverConfigs');
const {
    readDatabase,
    updateDatabase,
} = require('./database');

const STAFF_GUIDE_DATABASE = 'staff-guide-panels';
const STAFF_GUIDE_PREFIX = 'staff_guide:';
const SECTION_SELECT_ID = `${STAFF_GUIDE_PREFIX}section`;
const RANK_SELECT_ID = `${STAFF_GUIDE_PREFIX}ranks`;
const CHAIN_BUTTON_ID = `${STAFF_GUIDE_PREFIX}chain`;
const HELP_BUTTON_ID = `${STAFF_GUIDE_PREFIX}help`;

const CHAIN_GROUPS = [
    {
        name: 'Foundership',
        ranks: CHAIN_OF_COMMAND.slice(0, 2),
    },
    {
        name: 'Directorate',
        ranks: CHAIN_OF_COMMAND.slice(2, 5),
    },
    {
        name: 'Staff Supervision',
        ranks: CHAIN_OF_COMMAND.slice(5, 8),
    },
    {
        name: 'Management',
        ranks: CHAIN_OF_COMMAND.slice(8, 11),
    },
    {
        name: 'Internal Affairs',
        ranks: CHAIN_OF_COMMAND.slice(11, 14),
    },
    {
        name: 'Administration',
        ranks: CHAIN_OF_COMMAND.slice(14, 17),
    },
    {
        name: 'Moderation',
        ranks: CHAIN_OF_COMMAND.slice(17, 21),
    },
];

function getGuildIcon(guild) {
    return (
        guild?.iconURL?.({
            extension: 'png',
            size: 256,
        }) || brands.isrp.logo
    );
}

function createBaseEmbed(guild, color = brands.isrp.color) {
    const guildIcon = getGuildIcon(guild);

    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name:
                guild?.name ||
                'Illinois State Roleplay',
            ...(guildIcon
                ? { iconURL: guildIcon }
                : {}),
        })
        .setFooter({
            text:
                'ISRP Staff Guide • Official staff resource',
            ...(guildIcon
                ? { iconURL: guildIcon }
                : {}),
        })
        .setTimestamp();
}

function createGuidePanelPayload(guild) {
    const guildIcon = getGuildIcon(guild);
    const banner = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setImage(brands.assets.wordmark);

    const overview = createBaseEmbed(guild)
        .setTitle('Illinois State Roleplay Staff Guide')
        .setDescription(
            [
                'Welcome to the official interactive staff handbook.',
                '',
                'Use the menus below to privately review policies, workflows, command standards, emergency procedures, and expectations for each staff division.',
                '',
                '**Your selected guide page is visible only to you.** The complete handbook remains the final source for official policy.',
            ].join('\n')
        )
        .addFields(
            {
                name: 'Guide Pages',
                value:
                    `${GUIDE_SECTIONS.length} official handbook sections`,
                inline: true,
            },
            {
                name: 'Rank Divisions',
                value:
                    `${RANK_GUIDES.length} chain-of-command groups`,
                inline: true,
            },
            {
                name: 'How to Use',
                value:
                    'Choose a topic or rank division below. Use **Chain of Command** for the complete official order.',
            }
        );

    if (guildIcon) {
        overview.setThumbnail(guildIcon);
    }

    const linkButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Full Staff Handbook')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Link)
            .setURL(STAFF_GUIDE_DOCUMENT_URL),
        new ButtonBuilder()
            .setCustomId(CHAIN_BUTTON_ID)
            .setLabel('Chain of Command')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(HELP_BUTTON_ID)
            .setLabel('How This Works')
            .setEmoji('❔')
            .setStyle(ButtonStyle.Secondary)
    );

    const permissionLogsChannelId = String(
        process.env.STAFF_PERMISSION_LOGS_CHANNEL_ID || ''
    ).trim();

    if (/^\d{17,20}$/.test(permissionLogsChannelId)) {
        linkButtons.addComponents(
            new ButtonBuilder()
                .setLabel('Permission Logs')
                .setEmoji('🗂️')
                .setStyle(ButtonStyle.Link)
                .setURL(
                    `https://discord.com/channels/${guild?.id || MAIN_SERVER_ID}/${permissionLogsChannelId}`
                )
        );
    }

    const sectionMenu =
        new StringSelectMenuBuilder()
            .setCustomId(SECTION_SELECT_ID)
            .setPlaceholder(
                'Choose an official handbook section…'
            )
            .addOptions(
                GUIDE_SECTIONS.map((section) => ({
                    label: section.label,
                    description: section.description,
                    value: section.id,
                    emoji: section.emoji,
                }))
            );

    const rankMenu =
        new StringSelectMenuBuilder()
            .setCustomId(RANK_SELECT_ID)
            .setPlaceholder(
                'Choose a chain-of-command division…'
            )
            .addOptions(
                RANK_GUIDES.map((guide) => ({
                    label: guide.label,
                    description: guide.description,
                    value: guide.id,
                    emoji: guide.emoji,
                }))
            );

    return {
        embeds: [banner, overview],
        components: [
            linkButtons,
            new ActionRowBuilder().addComponents(
                sectionMenu
            ),
            new ActionRowBuilder().addComponents(
                rankMenu
            ),
        ],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function createGuideSectionPayload(sectionId, guild) {
    const section = getGuideSection(sectionId);

    if (!section) {
        return null;
    }

    const embed = createBaseEmbed(
        guild,
        section.color
    )
        .setTitle(`${section.emoji} ${section.label}`)
        .setDescription(section.intro)
        .addFields(section.fields);

    const sourceButton = new ButtonBuilder()
        .setLabel('Open Full Handbook Section')
        .setEmoji('📖')
        .setStyle(ButtonStyle.Link)
        .setURL(getStaffGuideTabUrl(section.tabId));

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                sourceButton
            ),
        ],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function createRankGuidePayload(guideId, guild) {
    const guide = getRankGuide(guideId);

    if (!guide) {
        return null;
    }

    const embed = createBaseEmbed(
        guild,
        guide.color
    )
        .setTitle(`${guide.emoji} ${guide.label} Guide`)
        .setDescription(guide.purpose)
        .addFields(
            {
                name: 'Ranks • Highest to Lowest',
                value: guide.ranks
                    .map(
                        (rank, index) =>
                            `**${index + 1}.** ${rank}`
                    )
                    .join('\n'),
            },
            {
                name: 'Core Expectations',
                value: guide.expectations
                    .map(
                        (expectation) =>
                            `• ${expectation}`
                    )
                    .join('\n'),
            },
            {
                name: 'Important',
                value:
                    'This page summarizes responsibilities. Current leadership directives and the full Staff Handbook remain authoritative.',
            }
        );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Leadership Guide')
                    .setEmoji('📖')
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        getStaffGuideTabUrl(
                            't.x01kjx33zvw3'
                        )
                    )
            ),
        ],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function createChainPayload(guild) {
    const embed = createBaseEmbed(guild, 0xf1c40f)
        .setTitle('📋 Official Chain of Command')
        .setDescription(
            'Ranks are displayed from **highest to lowest**. Follow the proper chain unless safety, confidentiality, a conflict of interest, or an authorized policy requires a different route.'
        )
        .addFields(
            CHAIN_GROUPS.map((group) => ({
                name: group.name,
                value: group.ranks
                    .map((rank) => {
                        const position =
                            CHAIN_OF_COMMAND.indexOf(
                                rank
                            ) + 1;

                        return `**${position}.** ${rank}`;
                    })
                    .join('\n'),
                inline: true,
            }))
        );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Leadership Guide')
                    .setEmoji('📖')
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        getStaffGuideTabUrl(
                            't.x01kjx33zvw3'
                        )
                    )
            ),
        ],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function createHelpPayload(guild) {
    const embed = createBaseEmbed(guild)
        .setTitle('❔ Using the Staff Guide')
        .setDescription(
            'The public panel stays in the staff channel while every guide page opens privately for the staff member who selected it.'
        )
        .addFields(
            {
                name: 'Handbook Sections',
                value:
                    'Choose a topic for an operational summary and a direct link to its official handbook tab.',
            },
            {
                name: 'Rank Divisions',
                value:
                    'Choose your division for its purpose, exact ranks, and core expectations.',
            },
            {
                name: 'Chain of Command',
                value:
                    'Shows all 21 ranks in the official highest-to-lowest order.',
            },
            {
                name: 'Policy Questions',
                value:
                    'When a summary and the current handbook differ, stop, ask the proper supervisor, and follow the current authorized policy.',
            }
        );

    return {
        embeds: [embed],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function memberHasRole(member, roleId) {
    if (!member || !roleId) {
        return false;
    }

    const roleCache = member.roles?.cache;

    if (typeof roleCache?.has === 'function') {
        return roleCache.has(roleId);
    }

    if (typeof roleCache?.some === 'function') {
        return roleCache.some(
            (role) => role?.id === roleId
        );
    }

    if (Array.isArray(member.roles)) {
        return member.roles.includes(roleId);
    }

    return false;
}

function memberHasPermission(member, permission) {
    return Boolean(
        member?.permissions?.has?.(permission)
    );
}

function canAccessStaffGuide(interaction) {
    if (
        !interaction?.guildId ||
        interaction.guildId !== MAIN_SERVER_ID
    ) {
        return false;
    }

    if (
        interaction.guild?.ownerId ===
        interaction.user?.id
    ) {
        return true;
    }

    const member = interaction.member;

    if (
        memberHasPermission(
            member,
            PermissionFlagsBits.Administrator
        ) ||
        memberHasPermission(
            member,
            PermissionFlagsBits.ManageGuild
        ) ||
        memberHasPermission(
            member,
            PermissionFlagsBits.ManageMessages
        )
    ) {
        return true;
    }

    const serverConfig =
        getServerConfig(interaction.guildId);
    const roleIds = new Set([
        ...Object.values(
            serverConfig?.roleGroups || {}
        ),
        ...(serverConfig?.reviewerRoleIds || []),
    ]);

    return [...roleIds].some((roleId) =>
        memberHasRole(member, roleId)
    );
}

async function handleStaffGuideInteraction(interaction) {
    if (!canAccessStaffGuide(interaction)) {
        await interaction.reply({
            content:
                '❌ This private resource is available only to authorized Illinois State Roleplay staff.',
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        return;
    }

    let payload = null;

    if (
        interaction.customId ===
        SECTION_SELECT_ID
    ) {
        payload = createGuideSectionPayload(
            interaction.values?.[0],
            interaction.guild
        );
    } else if (
        interaction.customId ===
        RANK_SELECT_ID
    ) {
        payload = createRankGuidePayload(
            interaction.values?.[0],
            interaction.guild
        );
    } else if (
        interaction.customId ===
        CHAIN_BUTTON_ID
    ) {
        payload = createChainPayload(
            interaction.guild
        );
    } else if (
        interaction.customId ===
        HELP_BUTTON_ID
    ) {
        payload = createHelpPayload(
            interaction.guild
        );
    }

    if (!payload) {
        await interaction.reply({
            content:
                '❌ That guide page could not be found. Please try the menu again.',
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
    });
}

async function getStoredGuidePanel(guildId) {
    const database = await readDatabase(
        STAFF_GUIDE_DATABASE,
        {}
    );

    return database[guildId] || null;
}

async function saveGuidePanel(guildId, panel) {
    await updateDatabase(
        STAFF_GUIDE_DATABASE,
        (database) => {
            database[guildId] = panel;
            return database;
        },
        {}
    );

    return panel;
}

async function removeStoredGuidePanel(guildId) {
    let removedPanel = null;

    await updateDatabase(
        STAFF_GUIDE_DATABASE,
        (database) => {
            removedPanel = database[guildId] || null;
            delete database[guildId];
            return database;
        },
        {}
    );

    return removedPanel;
}

async function fetchStoredGuideMessage(client, panel) {
    if (!client || !panel) {
        return null;
    }

    const channel =
        client.channels?.cache?.get(
            panel.channelId
        ) ||
        (await client.channels
            ?.fetch?.(panel.channelId)
            .catch(() => null));

    if (!channel?.messages?.fetch) {
        return null;
    }

    return channel.messages
        .fetch(panel.messageId)
        .catch(() => null);
}

module.exports = {
    CHAIN_BUTTON_ID,
    CHAIN_GROUPS,
    HELP_BUTTON_ID,
    RANK_SELECT_ID,
    SECTION_SELECT_ID,
    STAFF_GUIDE_DATABASE,
    STAFF_GUIDE_PREFIX,
    canAccessStaffGuide,
    createChainPayload,
    createGuidePanelPayload,
    createGuideSectionPayload,
    createHelpPayload,
    createRankGuidePayload,
    fetchStoredGuideMessage,
    getStoredGuidePanel,
    handleStaffGuideInteraction,
    removeStoredGuidePanel,
    saveGuidePanel,
};
