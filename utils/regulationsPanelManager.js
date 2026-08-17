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
const REGULATIONS_SELECT_ID = `${REGULATIONS_PREFIX}explore`;
const REGULATIONS_BANNER_NAME = 'regulations-banner-v1.png';
const REGULATIONS_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    REGULATIONS_BANNER_NAME
);
const REGULATIONS_BANNER_URL = `attachment://${REGULATIONS_BANNER_NAME}`;

const REGULATIONS_PAGES = [
    {
        label: 'Discord Guidelines',
        description: 'Community conduct and platform expectations.',
        value: 'discord',
        emoji: '📖',
    },
    {
        label: 'In-Game Guidelines',
        description: 'Official session and roleplay regulations.',
        value: 'in_game',
        emoji: '🎮',
    },
    {
        label: 'Roleplay Standards',
        description: 'The conduct expected during every session.',
        value: 'roleplay',
        emoji: '🚓',
    },
    {
        label: 'Banned & Restricted Items',
        description: 'Where to find the current official restrictions.',
        value: 'restricted',
        emoji: '⛔',
    },
    {
        label: 'Enforcement & Appeals',
        description: 'Evidence, staff action, and appeal information.',
        value: 'enforcement',
        emoji: '⚖️',
    },
];

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

function createRegulationsPanelPayload(guild, context) {
    const quickLinks = createLinkRow([
        createLinkButton(
            'Discord Guidelines',
            '📖',
            channelUrl(guild.id, context.discordGuidelinesChannelId)
        ),
        createLinkButton(
            'In-Game Guidelines',
            '🎮',
            channelUrl(guild.id, context.inGameGuidelinesChannelId)
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
    ]);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(REGULATIONS_SELECT_ID)
        .setPlaceholder('Choose a regulations section…')
        .addOptions(REGULATIONS_PAGES);
    const container = new ContainerBuilder()
        .setAccentColor(Number.parseInt(brands.palette.lightBlue.slice(1), 16))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(REGULATIONS_BANNER_URL)
                    .setDescription('Illinois State Roleplay Regulations')
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
                    '# Illinois State Roleplay Regulations',
                    'Review the official Discord and in-game guidelines before participating in the community or joining a session.',
                    '',
                    '### Official Policy',
                    'The latest posts in the guideline channels remain the final source for rules and restricted items. Private dropdown pages provide a simple overview and direct navigation.',
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
                '## Browse Regulations\nSelect one section below. Your selected page is visible only to you.'
            )
        )
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '-# Read first • Ask when uncertain • Illinois State Roleplay'
            )
        );

    return {
        files: [createRegulationsAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function getRegulationsPage(pageId, guild, context) {
    const discordGuidelines = channelMention(
        context.discordGuidelinesChannelId,
        'the Discord Guidelines channel'
    );
    const inGameGuidelines = channelMention(
        context.inGameGuidelinesChannelId,
        'the In-Game Guidelines channel'
    );
    const assistance = channelMention(
        context.assistanceChannelId,
        'the Assistance channel'
    );
    const proof = channelMention(
        context.proofChannelId,
        'the Proof channel'
    );

    const pages = {
        discord: {
            title: 'Discord Guidelines',
            body: [
                `The complete community rules are maintained in ${discordGuidelines}.`,
                '',
                'They cover member conduct, appropriate content, channel use, moderation expectations, and account or platform safety. Read the current channel before participating; a summary elsewhere does not replace it.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open Discord Guidelines',
                    '📖',
                    channelUrl(guild.id, context.discordGuidelinesChannelId)
                ),
            ],
        },
        in_game: {
            title: 'In-Game Guidelines',
            body: [
                `The official ER:LC and session regulations are maintained in ${inGameGuidelines}.`,
                '',
                'They cover roleplay conduct, session procedures, vehicle and weapon restrictions, staff directions, and behavior that may result in moderation. Check the current version before every session.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open In-Game Guidelines',
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
                `When a situation is unclear, pause the scene safely and review ${inGameGuidelines} or request staff assistance instead of escalating the disagreement in-game.`,
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
                `Restricted vehicles, weapons, commands, and special items can change as ER:LC and ISRP policy are updated. The current list in ${inGameGuidelines} is authoritative.`,
                '',
                'If an item is not clearly approved, ask staff before using it. Rules or screenshots from another roleplay server are not ISRP policy.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'View Current Restrictions',
                    '⛔',
                    channelUrl(guild.id, context.inGameGuidelinesChannelId)
                ),
            ],
        },
        enforcement: {
            title: 'Enforcement & Appeals',
            body: [
                'Staff actions are reviewed against the current guidelines and the available evidence. Cooperate during the scene and use the official support process afterward if you believe an action was incorrect.',
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

function createRegulationsPagePayload(guild, pageId, context) {
    const page = getRegulationsPage(pageId, guild, context);

    if (!page) {
        return null;
    }

    const container = new ContainerBuilder()
        .setAccentColor(Number.parseInt(brands.palette.lightBlue.slice(1), 16))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(REGULATIONS_BANNER_URL)
                    .setDescription('Illinois State Roleplay Regulations')
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
            '-# Official guideline channels remain the final source for policy.'
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
    if (
        !interaction.isStringSelectMenu?.() ||
        interaction.customId !== REGULATIONS_SELECT_ID
    ) {
        return;
    }

    const context = await getDashboardContext(interaction.guildId);
    const payload = createRegulationsPagePayload(
        interaction.guild,
        interaction.values[0],
        context
    );

    if (!payload) {
        await interaction.reply({
            content: 'That regulations section is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral | payload.flags,
    });
}

async function getStoredRegulationsPanel(guildId) {
    const database = await readDatabase(REGULATIONS_DATABASE, {});
    return database[guildId] || null;
}

async function saveRegulationsPanel(guildId, panel) {
    await updateDatabase(
        REGULATIONS_DATABASE,
        (database) => {
            database[guildId] = { guildId, ...panel };
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredRegulationsPanel(guildId) {
    let removed = null;

    await updateDatabase(
        REGULATIONS_DATABASE,
        (database) => {
            removed = database[guildId] || null;
            delete database[guildId];
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
    REGULATIONS_PREFIX,
    REGULATIONS_SELECT_ID,
    createRegulationsPagePayload,
    createRegulationsPanelPayload,
    fetchStoredRegulationsMessage,
    getStoredRegulationsPanel,
    handleRegulationsInteraction,
    removeStoredRegulationsPanel,
    saveRegulationsPanel,
};
