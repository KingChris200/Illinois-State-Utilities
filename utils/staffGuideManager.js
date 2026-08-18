const path = require('node:path');

const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
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
const {
    DEFAULT_STAFF_GUIDE_VERSION,
    getComplianceState,
} = require('./staffGuideCompliance');

const STAFF_GUIDE_DATABASE = 'staff-guide-panels';
const STAFF_GUIDE_PREFIX = 'staff_guide:';
const SECTION_SELECT_ID = `${STAFF_GUIDE_PREFIX}section`;
const RANK_SELECT_ID = `${STAFF_GUIDE_PREFIX}ranks`;
const HELP_SELECT_VALUE = 'how_it_works';
const CHAIN_SELECT_VALUE = 'complete_chain';
const RANK_SELECT_VALUE_PREFIX = 'rank_';
const TEAM_SELECT_VALUE_PREFIX = 'team_';
const CHAIN_BUTTON_ID = `${STAFF_GUIDE_PREFIX}chain`;
const HELP_BUTTON_ID = `${STAFF_GUIDE_PREFIX}help`;
const WHITELISTED_GROUP_URL =
    'https://www.roblox.com/communities/623707637/Illinois-State-Roleplay-Strict-Whitelisted#!/about';
const MELONLY_INVITE_URL =
    'https://melon.ly/join/FHMKHP';
const STAFF_GUIDE_BANNER_NAME =
    'staff-guide-banner-v3.png';
const STAFF_GUIDE_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    STAFF_GUIDE_BANNER_NAME
);
const STAFF_GUIDE_BANNER_URL =
    `attachment://${STAFF_GUIDE_BANNER_NAME}`;

function createStaffGuideBannerAttachment() {
    return new AttachmentBuilder(
        STAFF_GUIDE_BANNER_PATH,
        { name: STAFF_GUIDE_BANNER_NAME }
    );
}

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

const TEAM_GUIDES = [
    {
        id: 'moderation',
        label: 'Moderation Team',
        description:
            'Moderators who provide frontline member support.',
        emoji: '🔷',
        color: 0x2f80ed,
        divisionIds: ['moderation'],
        purpose:
            'Respond to members, manage in-game reports, stabilize scenes, and apply server policy professionally.',
    },
    {
        id: 'administration',
        label: 'Administration Team',
        description:
            'Administrators who handle advanced operations.',
        emoji: '🔻',
        color: 0xe53935,
        divisionIds: ['administration'],
        purpose:
            'Support moderators, manage advanced situations, and ensure important actions are accurate and documented.',
    },
    {
        id: 'high_rank',
        label: 'High Rank Team',
        description:
            'Internal Affairs and confidential staff oversight.',
        emoji: '⚙️',
        color: 0xff5a1f,
        divisionIds: ['internal_affairs'],
        purpose:
            'Review staff concerns, protect confidential evidence, and ensure investigations and appeals remain fair.',
    },
    {
        id: 'senior_high_rank',
        label: 'Senior High Rank Team',
        description:
            'Supervision, management, directors, and ownership.',
        emoji: '🛡️',
        color: 0x58b66b,
        divisionIds: [
            'foundership',
            'directorate',
            'staff_supervision',
            'management',
        ],
        purpose:
            'Lead staff operations, supervise performance, resolve major concerns, and protect the direction and standards of Illinois State Roleplay.',
    },
];

function getTeamRanks(team) {
    const includedRanks = new Set(
        team.divisionIds.flatMap(
            (divisionId) =>
                getRankGuide(divisionId)?.ranks || []
        )
    );

    return CHAIN_OF_COMMAND.filter((rank) =>
        includedRanks.has(rank)
    );
}

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

function createStaffGuidePagePayload({
    guild,
    color = brands.isrp.color,
    title,
    intro,
    sections = [],
    actionRows = [],
    complianceState = null,
}) {
    const version =
        complianceState?.currentVersion ||
        DEFAULT_STAFF_GUIDE_VERSION;
    const container = new ContainerBuilder()
        .setAccentColor(
            resolveGuideAccentColor(color)
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(
                        STAFF_GUIDE_BANNER_URL
                    )
                    .setDescription(
                        'Illinois State Roleplay Staff Guide'
                    )
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(
                    SeparatorSpacingSize.Large
                )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    `## ${title}`,
                    intro,
                    `-# Official Staff Guide • Version ${version} • Private staff resource`,
                ].join('\n\n')
            )
        );

    for (const section of sections) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${section.name}\n${section.value}`
            )
        );
    }

    if (actionRows.length > 0) {
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(
                    SeparatorSpacingSize.Small
                )
        );
        container.addActionRowComponents(
            ...actionRows
        );
    }

    return {
        components: [container],
        files: [createStaffGuideBannerAttachment()],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function resolveGuideAccentColor(color) {
    if (
        typeof color === 'number' &&
        Number.isInteger(color)
    ) {
        return color;
    }

    const normalized = String(color || '')
        .trim()
        .replace(/^#/, '');

    if (/^[0-9a-f]{6}$/i.test(normalized)) {
        return Number.parseInt(normalized, 16);
    }

    return 0x1e90ff;
}

function createGuidePanelPayload(
    guild,
    complianceState = null
) {
    const guideVersion =
        complianceState?.currentVersion ||
        DEFAULT_STAFF_GUIDE_VERSION;
    const rankMenu = new StringSelectMenuBuilder()
        .setCustomId(RANK_SELECT_ID)
        .setPlaceholder('Select a staff team to view its guide…')
        .addOptions(
            TEAM_GUIDES.map((team) => ({
                label: team.label,
                description: team.description,
                value: `${TEAM_SELECT_VALUE_PREFIX}${team.id}`,
                emoji: team.emoji,
            }))
        );
    const container = new ContainerBuilder()
        .setAccentColor(
            resolveGuideAccentColor(
                brands.palette.lightBlue
            )
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(STAFF_GUIDE_BANNER_URL)
                    .setDescription(
                        'Illinois State Roleplay Staff Guide'
                    )
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    '# Illinois State Roleplay Staff Guide',
                    'The official handbook for staff policy, conduct, commands, moderation, and leadership expectations.',
                    '',
                    `-# Current version: ${guideVersion} • Selected pages open privately`,
                ].join('\n')
            )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    '### Official Resources',
                    `[Staff Guide](${STAFF_GUIDE_DOCUMENT_URL}) • [WL Group](${WHITELISTED_GROUP_URL}) • [Melonly Invite](${MELONLY_INVITE_URL})`,
                ].join('\n')
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Staff Handbook')
                    .setEmoji('📖')
                    .setStyle(ButtonStyle.Link)
                    .setURL(STAFF_GUIDE_DOCUMENT_URL)
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Server Staff Team Guide\nSelect a staff team below to view its ranks, responsibilities, and expectations.'
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(rankMenu)
        );

    return {
        files: [createStaffGuideBannerAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
            parse: [],
            users: [],
            roles: [],
        },
    };
}

function createTeamGuidePayload(
    teamValue,
    guild,
    complianceState = null
) {
    const teamId = String(teamValue || '').startsWith(
        TEAM_SELECT_VALUE_PREFIX
    )
        ? String(teamValue).slice(
              TEAM_SELECT_VALUE_PREFIX.length
          )
        : String(teamValue || '');
    const team = TEAM_GUIDES.find(
        (entry) => entry.id === teamId
    );

    if (!team) {
        return null;
    }

    const divisions = team.divisionIds
        .map((divisionId) => getRankGuide(divisionId))
        .filter(Boolean);
    const ranks = getTeamRanks(team);
    const expectations = [
        ...new Set(
            divisions.flatMap(
                (division) => division.expectations
            )
        ),
    ];

    return createStaffGuidePagePayload({
        guild,
        color: resolveRankAccentColor(
            guild,
            team.label,
            team.color
        ),
        title: team.label,
        intro: team.purpose,
        sections: [
            {
                name: 'Ranks — Highest to Lowest',
                value: ranks
                    .map((rank) => {
                        const position =
                            CHAIN_OF_COMMAND.indexOf(rank) + 1;
                        return `**${position}.** ${rank}`;
                    })
                    .join('\n'),
            },
            {
                name: 'Team Responsibilities',
                value: expectations
                    .map((expectation) => `• ${expectation}`)
                    .join('\n'),
            },
            {
                name: 'Official Policy',
                value:
                    'This is a quick team summary. The current Staff Handbook and authorized leadership direction remain final.',
            },
        ],
        actionRows: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Leadership Guide')
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        getStaffGuideTabUrl(
                            't.x01kjx33zvw3'
                        )
                    )
            ),
        ],
        complianceState,
    });
}

function normalizeRankRoleName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function resolveRankAccentColor(guild, rank, fallbackColor) {
    const target = normalizeRankRoleName(rank);
    const cache = guild?.roles?.cache;
    const roles =
        typeof cache?.values === 'function'
            ? [...cache.values()]
            : [];
    const coloredRoles = roles.filter(
        (role) =>
            Number.isInteger(role?.color) &&
            role.color > 0
    );
    const exact = coloredRoles.find(
        (role) =>
            normalizeRankRoleName(role.name) === target
    );
    const prefixed = coloredRoles
        .filter((role) =>
            normalizeRankRoleName(role.name).endsWith(
                ` ${target}`
            )
        )
        .sort(
            (left, right) =>
                normalizeRankRoleName(left.name).length -
                normalizeRankRoleName(right.name).length
        )[0];

    return exact?.color || prefixed?.color || fallbackColor;
}

function createIndividualRankPayload(
    rankValue,
    guild,
    complianceState = null
) {
    const index = Number.parseInt(
        String(rankValue || '').slice(
            RANK_SELECT_VALUE_PREFIX.length
        ),
        10
    );
    const rank = CHAIN_OF_COMMAND[index];

    if (
        !String(rankValue || '').startsWith(
            RANK_SELECT_VALUE_PREFIX
        ) ||
        !Number.isInteger(index) ||
        !rank
    ) {
        return null;
    }

    const division = RANK_GUIDES.find((guide) =>
        guide.ranks.includes(rank)
    );

    return createStaffGuidePagePayload({
        guild,
        color: resolveRankAccentColor(
            guild,
            rank,
            division?.color || brands.palette.lightBlue
        ),
        title: `${rank} Rank Guide`,
        intro:
            division?.purpose ||
            'Review the current handbook and follow the proper chain of command.',
        sections: [
            {
                name: 'Chain Position',
                value:
                    `**${index + 1} of ${CHAIN_OF_COMMAND.length}** • ${division?.label || 'Staff Team'}`,
            },
            {
                name: 'Core Expectations',
                value: (division?.expectations || [])
                    .map((expectation) => `• ${expectation}`)
                    .join('\n'),
            },
            {
                name: 'Official Policy',
                value:
                    'This is a quick rank summary. The current Staff Handbook and authorized leadership direction remain final.',
            },
        ],
        actionRows: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Leadership Guide')
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        getStaffGuideTabUrl(
                            't.x01kjx33zvw3'
                        )
                    )
            ),
        ],
        complianceState,
    });
}

function createGuideSectionPayload(
    sectionId,
    guild,
    complianceState = null
) {
    const section = getGuideSection(sectionId);

    if (!section) {
        return null;
    }

    const buttons = [
        new ButtonBuilder()
            .setLabel('Full Section')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Link)
            .setURL(
                getStaffGuideTabUrl(
                    section.tabId
                )
            ),
    ];

    if (section.id === 'melonly') {
        buttons.push(
            new ButtonBuilder()
                .setLabel('Join Melonly')
                .setEmoji('🕒')
                .setStyle(ButtonStyle.Link)
                .setURL(MELONLY_INVITE_URL)
        );
    }

    if (section.id === 'introduction') {
        buttons.push(
            new ButtonBuilder()
                .setLabel('WL Group')
                .setEmoji('🎮')
                .setStyle(ButtonStyle.Link)
                .setURL(
                    WHITELISTED_GROUP_URL
                )
        );
    }

    return createStaffGuidePagePayload({
        guild,
        color: section.color,
        title: `${section.emoji} ${section.label}`,
        intro: section.intro,
        sections: section.fields,
        actionRows: [
            new ActionRowBuilder().addComponents(
                ...buttons
            ),
        ],
        complianceState,
    });
}

function createRankGuidePayload(
    guideId,
    guild,
    complianceState = null
) {
    const guide = getRankGuide(guideId);

    if (!guide) {
        return null;
    }

    return createStaffGuidePagePayload({
        guild,
        color: guide.color,
        title: `${guide.emoji} ${guide.label} Guide`,
        intro: guide.purpose,
        sections: [
            {
                name: 'Ranks — Highest to Lowest',
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
            },
        ],
        actionRows: [
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
        complianceState,
    });
}

function createChainPayload(
    guild,
    complianceState = null
) {
    return createStaffGuidePagePayload({
        guild,
        color: 0xf1c40f,
        title: '📋 Official Chain of Command',
        intro:
            'Ranks are displayed from **highest to lowest**. Follow the proper chain unless safety, confidentiality, a conflict of interest, or an authorized policy requires a different route.',
        sections: CHAIN_GROUPS.map(
            (group) => ({
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
            })
        ),
        actionRows: [
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
        complianceState,
    });
}

function createHelpPayload(
    guild,
    complianceState = null
) {
    return createStaffGuidePagePayload({
        guild,
        title: '❔ Using the Staff Guide',
        intro:
            'The public panel stays in the staff channel while every guide page opens privately for the staff member who selected it.',
        sections: [
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
            },
        ],
        actionRows: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Full Handbook')
                    .setEmoji('📖')
                    .setStyle(ButtonStyle.Link)
                    .setURL(
                        STAFF_GUIDE_DOCUMENT_URL
                    )
            ),
        ],
        complianceState,
    });
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
    let complianceState = null;

    if (!complianceState) {
        complianceState =
            await getComplianceState(
                interaction.guildId
            );
    }

    if (
        interaction.customId ===
        SECTION_SELECT_ID
    ) {
        const sectionId = interaction.values?.[0];
        payload =
            sectionId === HELP_SELECT_VALUE
                ? createHelpPayload(
                      interaction.guild,
                      complianceState
                  )
                : createGuideSectionPayload(
                      sectionId,
                      interaction.guild,
                      complianceState
                  );
    } else if (
        interaction.customId ===
        RANK_SELECT_ID
    ) {
        const rankGuideId = interaction.values?.[0];
        payload =
            rankGuideId === CHAIN_SELECT_VALUE
                ? createChainPayload(
                      interaction.guild,
                      complianceState
                  )
                : String(rankGuideId || '').startsWith(
                        TEAM_SELECT_VALUE_PREFIX
                    )
                  ? createTeamGuidePayload(
                        rankGuideId,
                        interaction.guild,
                        complianceState
                    )
                : String(rankGuideId || '').startsWith(
                        RANK_SELECT_VALUE_PREFIX
                    )
                  ? createIndividualRankPayload(
                        rankGuideId,
                        interaction.guild,
                        complianceState
                    )
                : createRankGuidePayload(
                      rankGuideId,
                      interaction.guild,
                      complianceState
                  );
    } else if (
        interaction.customId ===
        CHAIN_BUTTON_ID
    ) {
        payload = createChainPayload(
            interaction.guild,
            complianceState
        );
    } else if (
        interaction.customId ===
        HELP_BUTTON_ID
    ) {
        payload = createHelpPayload(
            interaction.guild,
            complianceState
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
        flags:
            MessageFlags.Ephemeral |
            (payload.flags || 0),
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
    CHAIN_SELECT_VALUE,
    CHAIN_BUTTON_ID,
    CHAIN_GROUPS,
    HELP_BUTTON_ID,
    HELP_SELECT_VALUE,
    MELONLY_INVITE_URL,
    RANK_SELECT_ID,
    RANK_SELECT_VALUE_PREFIX,
    SECTION_SELECT_ID,
    STAFF_GUIDE_DATABASE,
    STAFF_GUIDE_PREFIX,
    TEAM_GUIDES,
    TEAM_SELECT_VALUE_PREFIX,
    WHITELISTED_GROUP_URL,
    canAccessStaffGuide,
    createChainPayload,
    createGuidePanelPayload,
    createGuideSectionPayload,
    createHelpPayload,
    createIndividualRankPayload,
    createRankGuidePayload,
    createTeamGuidePayload,
    fetchStoredGuideMessage,
    getStoredGuidePanel,
    getTeamRanks,
    handleStaffGuideInteraction,
    removeStoredGuidePanel,
    saveGuidePanel,
};
