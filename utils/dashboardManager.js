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
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
} = require('discord.js');

const { STAFF_GUIDE_DOCUMENT_URL } = require('../config/staffGuideContent');
const { getServerConfig } = require('../config/serverConfigs');
const { getTicketConfig } = require('../config/tickets');
const { readDatabase, updateDatabase } = require('./database');
const {
    addBrandSignature,
    colorToDecimal,
    createPanelHeader,
    createPanelSeparator,
} = require('./componentTheme');

const DASHBOARD_DATABASE = 'dashboard-panels';
const DASHBOARD_PREFIX = 'dashboard:';
const DASHBOARD_SELECT_ID = `${DASHBOARD_PREFIX}explore`;
const DASHBOARD_BANNER_NAME = 'dashboard-banner-v2.png';
const DASHBOARD_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    DASHBOARD_BANNER_NAME
);
const DASHBOARD_BANNER_URL = `attachment://${DASHBOARD_BANNER_NAME}`;
const WHITELISTED_GROUP_URL =
    'https://www.roblox.com/communities/623707637/Illinois-State-Roleplay-Strict-Whitelisted#!/about';
const MELONLY_INVITE_URL = 'https://melon.ly/join/FHMKHP';

const DASHBOARD_PAGES = [
    {
        label: 'About ISRP',
        description: 'Learn what Illinois State Roleplay is about.',
        value: 'about',
        emoji: '🏛️',
    },
    {
        label: 'Getting Started',
        description: 'The best steps for new community members.',
        value: 'getting_started',
        emoji: '👋',
    },
    {
        label: 'Session Information',
        description: 'Find sessions, notifications, and the join code.',
        value: 'sessions',
        emoji: '🎮',
    },
    {
        label: 'Assistance & Appeals',
        description: 'Learn how to contact the correct support team.',
        value: 'assistance',
        emoji: '🎫',
    },
    {
        label: 'Staff Resources',
        description: 'Private handbook and staff utility links.',
        value: 'staff',
        emoji: '📘',
    },
];

function createDashboardAttachment() {
    return new AttachmentBuilder(DASHBOARD_BANNER_PATH, {
        name: DASHBOARD_BANNER_NAME,
    });
}

function channelUrl(guildId, channelId) {
    return channelId
        ? `https://discord.com/channels/${guildId}/${channelId}`
        : null;
}

async function getDashboardContext(guildId) {
    const [guildConfigurations, guidePanels] = await Promise.all([
        readDatabase('guild-configs', {}),
        readDatabase('staff-guide-panels', {}),
    ]);
    const guildConfiguration = guildConfigurations[guildId] || {};
    const ticketConfiguration = getTicketConfig(guildId);
    const officialChannels = getServerConfig(guildId)?.channels || {};

    return {
        assistanceChannelId:
            ticketConfiguration?.assistanceChannelId ||
            officialChannels.assistance ||
            null,
        inGameGuidelinesChannelId:
            officialChannels.inGameGuidelines || null,
        discordGuidelinesChannelId:
            officialChannels.discordGuidelines || null,
        proofChannelId: officialChannels.proof || null,
        primaryChannelId: officialChannels.primary || null,
        inGameChatChannelId: officialChannels.inGameChat || null,
        sessionChannelId: guildConfiguration.sessionChannelId || null,
        sessionRoleId: guildConfiguration.announcementRoleId || null,
        serverCode: guildConfiguration.serverCode || 'ILLINOISrp',
        staffGuideChannelId: guidePanels[guildId]?.channelId || null,
    };
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

function createDashboardPanelPayload(guild, context) {
    const essentialLinks = createLinkRow([
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
    const communityLinks = createLinkRow([
        createLinkButton(
            'Proof',
            '📸',
            channelUrl(guild.id, context.proofChannelId)
        ),
        createLinkButton(
            'Primary',
            '🚀',
            channelUrl(guild.id, context.primaryChannelId)
        ),
        createLinkButton(
            'In-Game Chat',
            '🎮',
            channelUrl(guild.id, context.inGameChatChannelId)
        ),
    ]);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(DASHBOARD_SELECT_ID)
        .setPlaceholder('Explore Illinois State Roleplay…')
        .addOptions(DASHBOARD_PAGES);
    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(DASHBOARD_BANNER_URL)
                    .setDescription('Illinois State Roleplay Dashboard')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                title: 'Illinois State Roleplay Dashboard',
                description:
                    'Everything important is kept in one clear, official place.',
                note: 'Community information • Official links • Private resource pages',
            }),
            new TextDisplayBuilder().setContent(
                [
                    '## Community Standard',
                    'Illinois State Roleplay is built around **organized sessions**, **consistent moderation**, and **realistic roleplay**. Review the official resources below before participating.',
                    '',
                    '## Essential Channels',
                    'Open the guidelines, request assistance, follow active sessions, or visit the Whitelisted Roblox group.',
                ].join('\n')
            )
        );

    if (essentialLinks) {
        container.addActionRowComponents(essentialLinks);
    }

    if (communityLinks) {
        container
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('### Community Channels')
            )
            .addActionRowComponents(communityLinks);
    }

    container
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Explore Illinois State Roleplay\nChoose one section below. The detailed page opens privately for you.'
            )
        )
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

    addBrandSignature(container, {
        detail:
            'Illinois’ Premier Roleplay • Built for Realism. Driven by Community.',
    });

    return {
        files: [createDashboardAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function canAccessStaffResources(interaction) {
    const staffRoleId =
        getServerConfig(interaction.guildId)?.roleGroups?.serverStaffTeam;

    return (
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        Boolean(staffRoleId && interaction.member?.roles?.cache?.has(staffRoleId))
    );
}

function getPageContent(pageId, context) {
    const assistanceMention = context.assistanceChannelId
        ? `<#${context.assistanceChannelId}>`
        : 'the Assistance channel';
    const sessionMention = context.sessionChannelId
        ? `<#${context.sessionChannelId}>`
        : 'the Sessions channel';
    const sessionRoleMention = context.sessionRoleId
        ? `<@&${context.sessionRoleId}>`
        : 'the Session Ping role';
    const inGameGuidelinesMention = context.inGameGuidelinesChannelId
        ? `<#${context.inGameGuidelinesChannelId}>`
        : 'the In-Game Guidelines channel';
    const discordGuidelinesMention = context.discordGuidelinesChannelId
        ? `<#${context.discordGuidelinesChannelId}>`
        : 'the Discord Guidelines channel';
    const proofMention = context.proofChannelId
        ? `<#${context.proofChannelId}>`
        : 'the Proof channel';
    const primaryMention = context.primaryChannelId
        ? `<#${context.primaryChannelId}>`
        : 'the Primary channel';
    const inGameChatMention = context.inGameChatChannelId
        ? `<#${context.inGameChatChannelId}>`
        : 'the In-Game Chat channel';

    const pages = {
        about: {
            title: 'About Illinois State Roleplay',
            body: [
                'Illinois State Roleplay is a strict ER:LC community focused on organized sessions, professional moderation, and enjoyable roleplay.',
                '',
                'Community systems are managed through Illinois State Utilities so members and staff can find support, session information, and official resources without unnecessary clutter.',
            ].join('\n'),
        },
        getting_started: {
            title: 'Getting Started',
            body: [
                `1. Read ${inGameGuidelinesMention} and ${discordGuidelinesMention}.`,
                `2. Visit ${assistanceMention} if you need support or want to submit an appeal.`,
                `3. Use ${proofMention} when staff request evidence or verification.`,
                `4. Follow ${primaryMention} and ${inGameChatMention} to stay involved with the community.`,
                `5. Obtain ${sessionRoleMention} so you receive session notifications.`,
                '6. Join the official Whitelisted Roblox group when you are eligible.',
            ].join('\n'),
        },
        sessions: {
            title: 'Session Information',
            body: [
                `Session announcements, votes, player counts, and shutdown updates are posted in ${sessionMention}.`,
                '',
                `**Session Role:** ${sessionRoleMention}`,
                `**ER:LC Join Code:** \`${context.serverCode}\``,
                '',
                'Wait for an official startup announcement before joining. Session availability and server status may change throughout the day.',
            ].join('\n'),
        },
        assistance: {
            title: 'Assistance & Appeals',
            body: [
                `Open ${assistanceMention} and choose the support category that matches your concern.`,
                '',
                '**General Support** — Questions, member reports, and community assistance.',
                '**Internal Affairs** — Staff reports and moderation or infraction appeals.',
                '**Management Support** — Leadership matters, partnerships, and serious concerns.',
                '',
                'Each ticket is private and visible only to you and the selected support team.',
            ].join('\n'),
        },
        staff: {
            title: 'Staff Resources',
            body: [
                'Use the current handbook and approved staff utilities when completing staff duties.',
                '',
                context.staffGuideChannelId
                    ? `**Staff Guide Channel:** <#${context.staffGuideChannelId}>`
                    : '**Staff Guide Channel:** Use the official staff resource channel.',
                '**Melonly:** Track shifts and staff activity through the approved panel.',
                '',
                'Current leadership direction and the official handbook remain the final source for staff policy.',
            ].join('\n'),
        },
    };

    return pages[pageId] || null;
}

function createDashboardPagePayload(guild, pageId, context) {
    const page = getPageContent(pageId, context);

    if (!page) {
        return null;
    }

    const buttons = [];

    if (pageId === 'assistance' || pageId === 'getting_started') {
        buttons.push(
            createLinkButton(
                'Open Assistance',
                '🎫',
                channelUrl(guild.id, context.assistanceChannelId)
            )
        );
    }
    if (pageId === 'getting_started') {
        buttons.push(
            createLinkButton(
                'In-Game Guidelines',
                '📋',
                channelUrl(guild.id, context.inGameGuidelinesChannelId)
            ),
            createLinkButton(
                'Discord Guidelines',
                '📖',
                channelUrl(guild.id, context.discordGuidelinesChannelId)
            )
        );
    }
    if (pageId === 'sessions' || pageId === 'getting_started') {
        buttons.push(
            createLinkButton(
                'Open Sessions',
                '🎮',
                channelUrl(guild.id, context.sessionChannelId)
            )
        );
    }
    if (pageId === 'getting_started' || pageId === 'about') {
        buttons.push(
            createLinkButton('Whitelisted Group', '🎲', WHITELISTED_GROUP_URL)
        );
    }
    if (pageId === 'staff') {
        buttons.push(
            createLinkButton('Staff Handbook', '📘', STAFF_GUIDE_DOCUMENT_URL),
            createLinkButton(
                'Staff Guide Channel',
                '📚',
                channelUrl(guild.id, context.staffGuideChannelId)
            ),
            createLinkButton('Melonly', '🕒', MELONLY_INVITE_URL)
        );
    }

    const linkRow = createLinkRow(buttons);
    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(DASHBOARD_BANNER_URL)
                    .setDescription('Illinois State Roleplay Dashboard')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                title: page.title,
                description: 'Official Illinois State Roleplay resource',
            }),
            new TextDisplayBuilder().setContent(page.body)
        );

    if (linkRow) {
        container.addSeparatorComponents(createPanelSeparator());
        container.addActionRowComponents(linkRow);
    }

    addBrandSignature(container, {
        detail: 'Dashboard resource • Official community information',
    });

    return {
        files: [createDashboardAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

async function handleDashboardInteraction(interaction) {
    if (
        !interaction.isStringSelectMenu?.() ||
        interaction.customId !== DASHBOARD_SELECT_ID
    ) {
        return;
    }

    const pageId = interaction.values[0];

    if (pageId === 'staff' && !canAccessStaffResources(interaction)) {
        await interaction.reply({
            content: 'Staff Resources are available only to authorized ISRP staff.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const context = await getDashboardContext(interaction.guildId);
    const payload = createDashboardPagePayload(
        interaction.guild,
        pageId,
        context
    );

    if (!payload) {
        await interaction.reply({
            content: 'That dashboard page is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral | payload.flags,
    });
}

async function getStoredDashboardPanel(guildId) {
    const database = await readDatabase(DASHBOARD_DATABASE, {});
    return database[guildId] || null;
}

async function saveDashboardPanel(guildId, panel) {
    await updateDatabase(
        DASHBOARD_DATABASE,
        (database) => {
            database[guildId] = { guildId, ...panel };
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredDashboardPanel(guildId) {
    let removed = null;

    await updateDatabase(
        DASHBOARD_DATABASE,
        (database) => {
            removed = database[guildId] || null;
            delete database[guildId];
            return database;
        },
        {}
    );
    return removed;
}

async function fetchStoredDashboardMessage(client, panel) {
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
    DASHBOARD_DATABASE,
    DASHBOARD_PAGES,
    DASHBOARD_PREFIX,
    DASHBOARD_SELECT_ID,
    canAccessStaffResources,
    createDashboardPagePayload,
    createDashboardPanelPayload,
    fetchStoredDashboardMessage,
    getDashboardContext,
    getStoredDashboardPanel,
    handleDashboardInteraction,
    removeStoredDashboardPanel,
    saveDashboardPanel,
};
