const path = require('node:path');
const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const brands = require('../config/branding');
const { getDashboardContext } = require('./dashboardManager');
const { readDatabase, updateDatabase } = require('./database');

const REGULATIONS_DATABASE = 'regulations-panels';
const REGULATIONS_PREFIX = 'regulations:';
const REGULATIONS_BANNER_NAME = 'regulations-banner-v1.png';
const REGULATIONS_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    REGULATIONS_BANNER_NAME
);
const REGULATIONS_BANNER_URL = `attachment://${REGULATIONS_BANNER_NAME}`;

const REGULATIONS_PANEL_TYPES = [
    {
        label: 'Discord Guidelines',
        value: 'discord',
        description: 'Community conduct and Discord platform expectations.',
    },
    {
        label: 'In-Game Guidelines',
        value: 'in_game',
        description: 'ER:LC sessions, roleplay, and restricted items.',
    },
];

const REGULATIONS_PAGES = {
    discord: [
        {
            label: 'Community Conduct',
            description: 'Member behavior and community expectations.',
            value: 'conduct',
            emoji: '🤝',
        },
        {
            label: 'Channels & Content',
            description: 'Safe and appropriate use of Discord channels.',
            value: 'content',
            emoji: '💬',
        },
        {
            label: 'Moderation & Appeals',
            description: 'Evidence, enforcement, and appeal information.',
            value: 'appeals',
            emoji: '⚖️',
        },
    ],
    in_game: [
        {
            label: 'Session Conduct',
            description: 'Expectations while an official session is active.',
            value: 'session',
            emoji: '📢',
        },
        {
            label: 'Roleplay Standards',
            description: 'The conduct expected during every scene.',
            value: 'roleplay',
            emoji: '🚓',
        },
        {
            label: 'Banned & Restricted Items',
            description: 'Booster-only perks and fully banned items.',
            value: 'restricted',
            emoji: '⛔',
        },
        {
            label: 'Enforcement & Appeals',
            description: 'Staff action, proof, and appeal information.',
            value: 'enforcement',
            emoji: '⚖️',
        },
    ],
};

function getPanelConfiguration(panelType) {
    if (panelType === 'discord') {
        return {
            title: 'Illinois State Roleplay Discord Guidelines',
            shortTitle: 'Discord Guidelines',
            description:
                'Review the official community rules before messaging, interacting, or participating in Illinois State Roleplay.',
            policy:
                'The latest post in the Discord Guidelines channel remains the final source for community conduct and platform rules.',
            footer: 'Community conduct • Platform safety • Illinois State Roleplay',
        };
    }

    if (panelType === 'in_game') {
        return {
            title: 'Illinois State Roleplay In-Game Guidelines',
            shortTitle: 'In-Game Guidelines',
            description:
                'Review the official ER:LC rules before joining a session or participating in a roleplay scene.',
            policy:
                'The latest post in the In-Game Guidelines channel remains the final source for session rules and restricted items.',
            footer: 'Realistic roleplay • Fair sessions • Illinois State Roleplay',
        };
    }

    return null;
}

function getRegulationsSelectId(panelType) {
    return `${REGULATIONS_PREFIX}${panelType}:explore`;
}

function createRegulationsAttachment() {
    return new AttachmentBuilder(REGULATIONS_BANNER_PATH, {
        name: REGULATIONS_BANNER_NAME,
    });
}

function channelUrl(guildId, channelId) {
    return channelId
        ? `https://discord.com/channels/${guildId}/${channelId}`
        : null;
}

function channelMention(channelId, fallback) {
    return channelId ? `<#${channelId}>` : fallback;
}

function createLinkButton(label, emoji, url) {
    if (!url) {
        return null;
    }

    return new ButtonBuilder()
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Link)
        .setURL(url);
}

function createLinkRow(buttons) {
    const usableButtons = buttons.filter(Boolean).slice(0, 5);

    return usableButtons.length
        ? new ActionRowBuilder().addComponents(usableButtons)
        : null;
}

function getPanelQuickLinks(guild, panelType, context) {
    if (panelType === 'discord') {
        return [
            createLinkButton(
                'Discord Guidelines',
                '📖',
                channelUrl(guild.id, context.discordGuidelinesChannelId)
            ),
            createLinkButton(
                'Assistance',
                '🎫',
                channelUrl(guild.id, context.assistanceChannelId)
            ),
            createLinkButton(
                'Submit Proof',
                '📸',
                channelUrl(guild.id, context.proofChannelId)
            ),
        ];
    }

    return [
        createLinkButton(
            'In-Game Guidelines',
            '🎮',
            channelUrl(guild.id, context.inGameGuidelinesChannelId)
        ),
        createLinkButton(
            'Sessions',
            '📢',
            channelUrl(guild.id, context.sessionChannelId)
        ),
        createLinkButton(
            'Assistance',
            '🎫',
            channelUrl(guild.id, context.assistanceChannelId)
        ),
        createLinkButton(
            'Submit Proof',
            '📸',
            channelUrl(guild.id, context.proofChannelId)
        ),
    ];
}

function createRegulationsPanelPayload(guild, panelType, context) {
    const configuration = getPanelConfiguration(panelType);
    const pages = REGULATIONS_PAGES[panelType];

    if (!configuration || !pages) {
        return null;
    }

    const quickLinks = createLinkRow(
        getPanelQuickLinks(guild, panelType, context)
    );
    const menu = new StringSelectMenuBuilder()
        .setCustomId(getRegulationsSelectId(panelType))
        .setPlaceholder(`Explore ${configuration.shortTitle}…`)
        .addOptions(pages);
    const container = new ContainerBuilder()
        .setAccentColor(Number.parseInt(brands.palette.lightBlue.slice(1), 16))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(REGULATIONS_BANNER_URL)
                    .setDescription(configuration.title)
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
                    `# ${configuration.title}`,
                    configuration.description,
                    '',
                    '### Official Policy',
                    configuration.policy,
                ].join('\n')
            )
        );

    if (quickLinks) {
        container.addActionRowComponents(quickLinks);
    }

    container
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Browse ${configuration.shortTitle}\nSelect one section below. Your selected page is visible only to you.`
            )
        )
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${configuration.footer}`)
        );

    return {
        files: [createRegulationsAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function getDiscordPage(pageId, guild, context) {
    const discordGuidelines = channelMention(
        context.discordGuidelinesChannelId,
        'the Discord Guidelines channel'
    );
    const assistance = channelMention(
        context.assistanceChannelId,
        'the Assistance channel'
    );
    const proof = channelMention(context.proofChannelId, 'the Proof channel');
    const pages = {
        conduct: {
            title: 'Community Conduct',
            body: [
                `The complete community rules are maintained in ${discordGuidelines}.`,
                '',
                'Treat members respectfully, follow staff direction, and use community spaces for their intended purpose. The latest official rule post takes priority over summaries or older screenshots.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open Discord Guidelines',
                    '📖',
                    channelUrl(guild.id, context.discordGuidelinesChannelId)
                ),
            ],
        },
        content: {
            title: 'Channels & Content',
            body: [
                'Use each channel for its stated purpose and keep messages, media, profiles, and links appropriate for the community.',
                '',
                `Review ${discordGuidelines} before posting. When content may violate policy, preserve relevant evidence in ${proof} and contact staff instead of escalating publicly.`,
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Review Discord Rules',
                    '📖',
                    channelUrl(guild.id, context.discordGuidelinesChannelId)
                ),
                createLinkButton(
                    'Submit Proof',
                    '📸',
                    channelUrl(guild.id, context.proofChannelId)
                ),
            ],
        },
        appeals: {
            title: 'Moderation & Appeals',
            body: [
                'Staff actions are reviewed against the current guidelines and available evidence. Do not argue about private moderation cases in public channels.',
                '',
                `Use ${proof} for requested evidence and open ${assistance} for an appeal. Select **Internal Affairs Support** for staff reports or moderation and infraction appeals.`,
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Submit Proof',
                    '📸',
                    channelUrl(guild.id, context.proofChannelId)
                ),
                createLinkButton(
                    'Open an Appeal',
                    '⚖️',
                    channelUrl(guild.id, context.assistanceChannelId)
                ),
            ],
        },
    };

    return pages[pageId] || null;
}

function getInGamePage(pageId, guild, context) {
    const inGameGuidelines = channelMention(
        context.inGameGuidelinesChannelId,
        'the In-Game Guidelines channel'
    );
    const sessions = channelMention(
        context.sessionChannelId,
        'the Sessions channel'
    );
    const assistance = channelMention(
        context.assistanceChannelId,
        'the Assistance channel'
    );
    const proof = channelMention(context.proofChannelId, 'the Proof channel');
    const pages = {
        session: {
            title: 'Session Conduct',
            body: [
                `Wait for an official announcement in ${sessions} before joining. Follow the current startup instructions, server status, and staff direction throughout the session.`,
                '',
                `The complete session regulations are maintained in ${inGameGuidelines}.`,
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open Sessions',
                    '📢',
                    channelUrl(guild.id, context.sessionChannelId)
                ),
                createLinkButton(
                    'Review In-Game Rules',
                    '🎮',
                    channelUrl(guild.id, context.inGameGuidelinesChannelId)
                ),
            ],
        },
        roleplay: {
            title: 'Roleplay Standards',
            body: [
                'Keep scenes believable, communicate respectfully, and follow reasonable staff directions. Do not use game mechanics, commands, or outside information to gain an unfair advantage.',
                '',
                `When a situation is unclear, pause the scene safely and review ${inGameGuidelines} or request staff assistance instead of escalating in-game.`,
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Review In-Game Rules',
                    '📋',
                    channelUrl(guild.id, context.inGameGuidelinesChannelId)
                ),
                createLinkButton(
                    'Get Assistance',
                    '🎫',
                    channelUrl(guild.id, context.assistanceChannelId)
                ),
            ],
        },
        restricted: {
            title: 'Banned & Restricted Items',
            body: [
                '### Booster-Only Items',
                '• Large and heavy weapons, except sniper rifles',
                '• Exotic and prestige vehicles',
                '',
                '### Banned Items',
                '• All Tesla vehicles',
                '• All sniper rifles',
                '',
                'These restrictions are shown here for quick reference. If an item is not clearly covered, ask staff before using it.',
            ].join('\n'),
            buttons: [],
        },
        enforcement: {
            title: 'Enforcement & Appeals',
            body: [
                'Cooperate during the scene and use the official support process afterward if you believe an action was incorrect.',
                '',
                `Use ${proof} for requested evidence and open ${assistance} for an appeal. Select **Internal Affairs Support** for staff reports or moderation and infraction appeals.`,
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Submit Proof',
                    '📸',
                    channelUrl(guild.id, context.proofChannelId)
                ),
                createLinkButton(
                    'Open an Appeal',
                    '⚖️',
                    channelUrl(guild.id, context.assistanceChannelId)
                ),
            ],
        },
    };

    return pages[pageId] || null;
}

function createRegulationsPagePayload(guild, panelType, pageId, context) {
    const configuration = getPanelConfiguration(panelType);
    const page =
        panelType === 'discord'
            ? getDiscordPage(pageId, guild, context)
            : getInGamePage(pageId, guild, context);

    if (!configuration || !page) {
        return null;
    }

    const container = new ContainerBuilder()
        .setAccentColor(Number.parseInt(brands.palette.lightBlue.slice(1), 16))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(REGULATIONS_BANNER_URL)
                    .setDescription(configuration.title)
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${page.title}\n${page.body}`
            )
        );
    const linkRow = createLinkRow(page.buttons || []);

    if (linkRow) {
        container
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Large)
            )
            .addActionRowComponents(linkRow);
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            '-# Official guideline-channel posts remain the final source for policy.'
        )
    );

    return {
        files: [createRegulationsAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

async function handleRegulationsInteraction(interaction) {
    if (!interaction.isStringSelectMenu?.()) {
        return;
    }

    const match = interaction.customId?.match(
        /^regulations:(discord|in_game):explore$/
    );
    if (!match) {
        return;
    }

    const panelType = match[1];
    const context = await getDashboardContext(interaction.guildId);
    const payload = createRegulationsPagePayload(
        interaction.guild,
        panelType,
        interaction.values[0],
        context
    );

    if (!payload) {
        await interaction.reply({
            content: 'That guidelines section is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral | payload.flags,
    });
}

function normalizeGuildPanels(record) {
    if (!record || record.channelId) {
        return {};
    }
    return record;
}

async function getStoredRegulationsPanel(guildId, panelType) {
    const database = await readDatabase(REGULATIONS_DATABASE, {});
    const panels = normalizeGuildPanels(database[guildId]);
    return panels[panelType] || null;
}

async function saveRegulationsPanel(guildId, panelType, panel) {
    await updateDatabase(
        REGULATIONS_DATABASE,
        (database) => {
            const panels = normalizeGuildPanels(database[guildId]);
            panels[panelType] = { guildId, panelType, ...panel };
            database[guildId] = panels;
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredRegulationsPanel(guildId, panelType) {
    let removed = null;

    await updateDatabase(
        REGULATIONS_DATABASE,
        (database) => {
            const panels = normalizeGuildPanels(database[guildId]);
            removed = panels[panelType] || null;
            delete panels[panelType];

            if (Object.keys(panels).length) {
                database[guildId] = panels;
            } else {
                delete database[guildId];
            }
            return database;
        },
        {}
    );
    return removed;
}

async function fetchStoredRegulationsMessage(client, panel) {
    if (!client || !panel) {
        return null;
    }

    const channel =
        client.channels?.cache?.get(panel.channelId) ||
        (await client.channels?.fetch?.(panel.channelId).catch(() => null));

    if (!channel?.messages?.fetch) {
        return null;
    }

    return channel.messages.fetch(panel.messageId).catch(() => null);
}

module.exports = {
    REGULATIONS_DATABASE,
    REGULATIONS_PAGES,
    REGULATIONS_PANEL_TYPES,
    REGULATIONS_PREFIX,
    createRegulationsPagePayload,
    createRegulationsPanelPayload,
    fetchStoredRegulationsMessage,
    getPanelConfiguration,
    getRegulationsSelectId,
    getStoredRegulationsPanel,
    handleRegulationsInteraction,
    removeStoredRegulationsPanel,
    saveRegulationsPanel,
};
