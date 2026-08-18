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
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { getDashboardContext } = require('./dashboardManager');
const { readDatabase, updateDatabase } = require('./database');
const {
    addBrandSignature,
    colorToDecimal,
    createPanelHeader,
    createPanelSeparator,
} = require('./componentTheme');

const INFORMATION_DATABASE = 'information-panels';
const INFORMATION_PREFIX = 'information:';
const INFORMATION_SELECT_ID = `${INFORMATION_PREFIX}explore`;
const INFORMATION_BANNER_NAME = 'information-banner-v1.png';
const INFORMATION_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    INFORMATION_BANNER_NAME
);
const INFORMATION_BANNER_URL = `attachment://${INFORMATION_BANNER_NAME}`;
const WHITELISTED_GROUP_URL =
    'https://www.roblox.com/communities/623707637/Illinois-State-Roleplay-Strict-Whitelisted#!/about';

const INFORMATION_PAGES = [
    {
        label: 'About ISRP',
        description: 'Learn what the Illinois community offers.',
        value: 'about',
        emoji: '🏛️',
    },
    {
        label: 'Community Guidelines',
        description: 'Find the Discord and in-game guidelines.',
        value: 'guidelines',
        emoji: '📖',
    },
    {
        label: 'Sessions & ER:LC',
        description: 'Review session notifications and joining details.',
        value: 'sessions',
        emoji: '🎮',
    },
    {
        label: 'Support & Appeals',
        description: 'Contact the correct assistance team.',
        value: 'support',
        emoji: '🎫',
    },
    {
        label: 'Official Channels',
        description: 'Open the most useful community channels.',
        value: 'channels',
        emoji: '🧭',
    },
];

function createInformationAttachment() {
    return new AttachmentBuilder(INFORMATION_BANNER_PATH, {
        name: INFORMATION_BANNER_NAME,
    });
}

function channelUrl(guildId, channelId) {
    return channelId
        ? `https://discord.com/channels/${guildId}/${channelId}`
        : null;
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

function createLinkRows(buttons) {
    const usableButtons = buttons.filter(Boolean);
    const rows = [];

    for (let index = 0; index < usableButtons.length; index += 5) {
        rows.push(
            new ActionRowBuilder().addComponents(
                usableButtons.slice(index, index + 5)
            )
        );
    }

    return rows;
}

function createInformationPanelPayload(guild, context) {
    const quickLinks = createLinkRows([
        createLinkButton(
            'In-Game Guidelines',
            '📋',
            channelUrl(guild.id, context.inGameGuidelinesChannelId)
        ),
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
            'Sessions',
            '🎮',
            channelUrl(guild.id, context.sessionChannelId)
        ),
        createLinkButton('Whitelisted Group', '🎲', WHITELISTED_GROUP_URL),
    ]);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(INFORMATION_SELECT_ID)
        .setPlaceholder('Choose an information section…')
        .addOptions(INFORMATION_PAGES);
    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(INFORMATION_BANNER_URL)
                    .setDescription('Illinois State Roleplay Information')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                title: 'Illinois State Roleplay Information',
                description:
                    'A clear introduction to the community, its standards, and its official resources.',
            }),
            new TextDisplayBuilder().setContent(
                [
                    '## About the Community',
                    'Illinois State Roleplay is a strict ER:LC community built around **organized sessions**, **believable scenes**, **fair moderation**, and a welcoming member experience.',
                    '',
                    '## Start Here',
                    'Review both guideline channels before participating. Assistance, session information, and the official Whitelisted Roblox group are available through the links below.',
                ].join('\n')
            )
        );

    for (const row of quickLinks) {
        container.addActionRowComponents(row);
    }

    container
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Community Information\nChoose one section below. The selected page is shown only to you.'
            )
        )
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

    addBrandSignature(container, {
        detail:
            'Official community information • Built for Realism. Driven by Community.',
    });

    return {
        files: [createInformationAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function mention(channelId, fallback) {
    return channelId ? `<#${channelId}>` : fallback;
}

function getInformationPage(pageId, context) {
    const channels = {
        assistance: mention(
            context.assistanceChannelId,
            'the Assistance channel'
        ),
        discordGuidelines: mention(
            context.discordGuidelinesChannelId,
            'the Discord Guidelines channel'
        ),
        inGameGuidelines: mention(
            context.inGameGuidelinesChannelId,
            'the In-Game Guidelines channel'
        ),
        inGameChat: mention(
            context.inGameChatChannelId,
            'the In-Game Chat channel'
        ),
        primary: mention(context.primaryChannelId, 'the Primary channel'),
        proof: mention(context.proofChannelId, 'the Proof channel'),
        sessions: mention(context.sessionChannelId, 'the Sessions channel'),
    };
    const sessionRole = context.sessionRoleId
        ? `<@&${context.sessionRoleId}>`
        : 'the Session Ping role';

    const pages = {
        about: {
            title: 'About Illinois State Roleplay',
            body: [
                'ISRP is a strict roleplay community for Emergency Response: Liberty County. Members can participate as civilians, emergency services, and approved department personnel during organized sessions.',
                '',
                'Professional conduct, believable roleplay, cooperation, and respect are expected throughout the community.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Whitelisted Group',
                    '🎲',
                    WHITELISTED_GROUP_URL
                ),
            ],
        },
        guidelines: {
            title: 'Community Guidelines',
            body: [
                `Read ${channels.discordGuidelines} for community conduct and Discord expectations.`,
                `Read ${channels.inGameGuidelines} for session rules, roleplay standards, and restricted behavior.`,
                '',
                'The latest posted version of each guide remains the official policy.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Discord Guidelines',
                    '📖',
                    channelUrl(
                        context.guildId,
                        context.discordGuidelinesChannelId
                    )
                ),
                createLinkButton(
                    'In-Game Guidelines',
                    '📋',
                    channelUrl(
                        context.guildId,
                        context.inGameGuidelinesChannelId
                    )
                ),
            ],
        },
        sessions: {
            title: 'Sessions & ER:LC',
            body: [
                `Session votes, startup announcements, live player counts, and shutdown notices are posted in ${channels.sessions}.`,
                '',
                `**Notification Role:** ${sessionRole}`,
                `**ER:LC Join Code:** \`${context.serverCode}\``,
                '',
                'Wait for an official startup announcement before joining the game server.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open Sessions',
                    '🎮',
                    channelUrl(context.guildId, context.sessionChannelId)
                ),
            ],
        },
        support: {
            title: 'Support & Appeals',
            body: [
                `Open ${channels.assistance} and select the category that matches your concern.`,
                '',
                '**General Support** — Community questions and member assistance.',
                '**Internal Affairs** — Staff reports and moderation or infraction appeals.',
                '**Management Support** — Leadership matters, partnerships, and serious concerns.',
                '',
                'Tickets are private between the opener and the selected support team.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open Assistance',
                    '🎫',
                    channelUrl(context.guildId, context.assistanceChannelId)
                ),
            ],
        },
        channels: {
            title: 'Official Community Channels',
            body: [
                `**Guidelines:** ${channels.inGameGuidelines} • ${channels.discordGuidelines}`,
                `**Support:** ${channels.assistance} • ${channels.proof}`,
                `**Community:** ${channels.primary} • ${channels.inGameChat}`,
                `**Sessions:** ${channels.sessions}`,
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Proof',
                    '📸',
                    channelUrl(context.guildId, context.proofChannelId)
                ),
                createLinkButton(
                    'Primary',
                    '🚀',
                    channelUrl(context.guildId, context.primaryChannelId)
                ),
                createLinkButton(
                    'In-Game Chat',
                    '🎮',
                    channelUrl(context.guildId, context.inGameChatChannelId)
                ),
                createLinkButton(
                    'Sessions',
                    '📢',
                    channelUrl(context.guildId, context.sessionChannelId)
                ),
                createLinkButton(
                    'Assistance',
                    '🎫',
                    channelUrl(context.guildId, context.assistanceChannelId)
                ),
            ],
        },
    };

    return pages[pageId] || null;
}

function createInformationPagePayload(guild, pageId, context) {
    const pageContext = { ...context, guildId: guild.id };
    const page = getInformationPage(pageId, pageContext);

    if (!page) {
        return null;
    }

    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(INFORMATION_BANNER_URL)
                    .setDescription('Illinois State Roleplay Information')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                title: page.title,
                description: 'Official community information',
            }),
            new TextDisplayBuilder().setContent(page.body)
        );

    const linkRows = createLinkRows(page.buttons || []);
    if (linkRows.length) {
        container.addSeparatorComponents(createPanelSeparator());
        for (const row of linkRows) {
            container.addActionRowComponents(row);
        }
    }

    addBrandSignature(container, {
        detail: 'Official community information • Illinois State Roleplay',
    });

    return {
        files: [createInformationAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

async function handleInformationInteraction(interaction) {
    if (
        !interaction.isStringSelectMenu?.() ||
        interaction.customId !== INFORMATION_SELECT_ID
    ) {
        return;
    }

    const context = await getDashboardContext(interaction.guildId);
    const payload = createInformationPagePayload(
        interaction.guild,
        interaction.values[0],
        context
    );

    if (!payload) {
        await interaction.reply({
            content: 'That information section is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral | payload.flags,
    });
}

async function getStoredInformationPanel(guildId) {
    const database = await readDatabase(INFORMATION_DATABASE, {});
    return database[guildId] || null;
}

async function saveInformationPanel(guildId, panel) {
    await updateDatabase(
        INFORMATION_DATABASE,
        (database) => {
            database[guildId] = { guildId, ...panel };
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredInformationPanel(guildId) {
    let removed = null;

    await updateDatabase(
        INFORMATION_DATABASE,
        (database) => {
            removed = database[guildId] || null;
            delete database[guildId];
            return database;
        },
        {}
    );
    return removed;
}

async function fetchStoredInformationMessage(client, panel) {
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
    INFORMATION_DATABASE,
    INFORMATION_PAGES,
    INFORMATION_PREFIX,
    INFORMATION_SELECT_ID,
    createInformationPagePayload,
    createInformationPanelPayload,
    fetchStoredInformationMessage,
    getStoredInformationPanel,
    handleInformationInteraction,
    removeStoredInformationPanel,
    saveInformationPanel,
};
