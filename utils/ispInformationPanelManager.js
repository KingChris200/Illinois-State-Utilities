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

const brands = require('../config/branding');
const {
    ISP_CHANNELS,
    ISP_RANKS,
    ISP_SERVER_ID,
    SERVER_CONFIGS,
} = require('../config/serverConfigs');
const { readDatabase, updateDatabase } = require('./database');
const {
    addBrandSignature,
    colorToDecimal,
    createPanelHeader,
    createPanelSeparator,
} = require('./componentTheme');

const ISP_INFORMATION_DATABASE = 'isp-information-panels';
const ISP_INFORMATION_PREFIX = 'isp_information:';
const ISP_INFORMATION_SELECT_ID =
    `${ISP_INFORMATION_PREFIX}explore`;
const ISP_INFORMATION_BANNER_NAME =
    'isp-information-banner-v1.png';
const ISP_INFORMATION_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    ISP_INFORMATION_BANNER_NAME
);
const ISP_INFORMATION_BANNER_URL =
    `attachment://${ISP_INFORMATION_BANNER_NAME}`;
const ISP_HANDBOOK_URL =
    'https://docs.google.com/document/d/1JwXVKCT-7rAUDrXiLM_OA5XQrUqVzoUp-YIgbT1bKmc/edit?usp=sharing';
const ISP_MELONLY_URL =
    'https://melonly.xyz/dashboard?join=NYHGUY';

const ISP_INFORMATION_PAGES = [
    {
        label: 'About ISP',
        description: 'Purpose, standards, and department identity.',
        value: 'about',
        emoji: '🏛️',
    },
    {
        label: 'Ranks & Structure',
        description: 'View the department chain of command.',
        value: 'structure',
        emoji: '📋',
    },
    {
        label: 'Shifts & Callsigns',
        description: 'Open the two primary personnel systems.',
        value: 'operations',
        emoji: '🕒',
    },
    {
        label: 'Units & Opportunities',
        description: 'Learn about ISP assignments and units.',
        value: 'units',
        emoji: '🚔',
    },
    {
        label: 'Official Resources',
        description: 'Open the configured ISP channels.',
        value: 'resources',
        emoji: '🧭',
    },
];

function createIspInformationAttachment() {
    return new AttachmentBuilder(ISP_INFORMATION_BANNER_PATH, {
        name: ISP_INFORMATION_BANNER_NAME,
    });
}

function channelUrl(channelId) {
    return channelId
        ? `https://discord.com/channels/${ISP_SERVER_ID}/${channelId}`
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

function createLinkRow(buttons) {
    const usableButtons = buttons.filter(Boolean);

    return usableButtons.length
        ? new ActionRowBuilder().addComponents(usableButtons)
        : null;
}

function mentionChannel(channelId, fallback) {
    return channelId ? `<#${channelId}>` : fallback;
}

function mentionRole(roleId, fallback) {
    return roleId ? `<@&${roleId}>` : fallback;
}

function findRank(name) {
    return ISP_RANKS.find((rank) => rank.name === name) || null;
}

function rankMention(name) {
    const rank = findRank(name);
    return rank ? `<@&${rank.roleId}>` : name.replace(/^ISP \| /, '');
}

function createIspInformationPanelPayload() {
    const quickLinks = createLinkRow([
        createLinkButton(
            'Shift Manager',
            '🕒',
            channelUrl(ISP_CHANNELS.shiftManage)
        ),
        createLinkButton(
            'Deputy Command',
            '📡',
            channelUrl(ISP_CHANNELS.deputyCommand)
        ),
        createLinkButton(
            'ISP Handbook',
            '📘',
            ISP_HANDBOOK_URL
        ),
        createLinkButton(
            'Melonly',
            '🕒',
            ISP_MELONLY_URL
        ),
    ]);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(ISP_INFORMATION_SELECT_ID)
        .setPlaceholder('Explore Illinois State Police…')
        .addOptions(ISP_INFORMATION_PAGES);
    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal(brands.isp.color))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(ISP_INFORMATION_BANNER_URL)
                    .setDescription('Illinois State Police Information')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                eyebrow: 'ILLINOIS STATE POLICE',
                title: 'Department Information',
                description:
                    'One official place for ISP structure, systems, and resources.',
            }),
            new TextDisplayBuilder().setContent(
                [
                    '## Department Standard',
                    'Illinois State Police personnel are expected to serve with **integrity**, communicate professionally, follow the chain of command, and represent the department responsibly.',
                    '',
                    '## Personnel Systems',
                    `Manage duty time in ${mentionChannel(ISP_CHANNELS.shiftManage, 'the Shift Manager channel')} and manage your \`SP-XXX\` identifier in ${mentionChannel(ISP_CHANNELS.deputyCommand, 'the Deputy Command channel')}.`,
                ].join('\n')
            )
        );

    if (quickLinks) {
        container.addActionRowComponents(quickLinks);
    }

    container
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Explore ISP\nChoose one section below. The detailed page is shown only to you.'
            )
        )
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

    addBrandSignature(container, {
        label: 'Illinois State Police',
        detail: 'Integrity • Service • Pride',
    });

    return {
        files: [createIspInformationAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function getIspInformationPage(pageId) {
    const roleGroups = SERVER_CONFIGS[ISP_SERVER_ID].roleGroups;
    const pages = {
        about: {
            title: 'About Illinois State Police',
            body: [
                'Illinois State Police is the statewide law-enforcement department serving the Illinois State Roleplay community.',
                '',
                'Personnel are expected to use sound judgment, maintain realistic roleplay, communicate clearly, and follow lawful department direction. Rank and access do not replace professionalism or accountability.',
                '',
                `**Department Role:** ${mentionRole(roleGroups.illinoisStatePolice, 'Illinois State Police')}`,
                `**Patrol Personnel:** ${mentionRole(roleGroups.patrolUnits, 'Patrol Units')}`,
                `**Personnel in Training:** ${mentionRole(roleGroups.inTraining, 'In Training')}`,
            ].join('\n'),
        },
        structure: {
            title: 'Ranks & Department Structure',
            body: [
                'Ranks are listed from highest to lowest within each section.',
                '',
                '**Office of the Director**',
                rankMention('ISP | Director'),
                rankMention('ISP | First Deputy Director'),
                rankMention('ISP | Deputy Director'),
                '',
                '**Command Staff**',
                rankMention('ISP | Colonel'),
                rankMention('ISP | Lieutenant Colonel'),
                '',
                '**High-Ranking Officials**',
                rankMention('ISP | Major'),
                rankMention('ISP | Captain'),
                rankMention('ISP | Lieutenant'),
                '',
                '**Field Supervisors**',
                rankMention('ISP | Master Sergeant'),
                rankMention('ISP | Sergeant'),
                '',
                '**Patrol Personnel**',
                rankMention('ISP | Senior Trooper'),
                rankMention('ISP | Trooper'),
                rankMention('ISP | Cadet'),
            ].join('\n'),
        },
        operations: {
            title: 'Shifts & Callsigns',
            body: [
                '**Shift Management**',
                `Use \`/shift manage\` in ${mentionChannel(ISP_CHANNELS.shiftManage, 'the Shift Manager channel')} to start duty, toggle a break, or end duty. The system maintains the configured on-duty and on-break roles automatically.`,
                '',
                '**Callsign Management**',
                `Use \`/callsign\` in ${mentionChannel(ISP_CHANNELS.deputyCommand, 'the Deputy Command channel')} to view, request, find, or browse callsigns. Callsigns use the \`SP-XXX\` format.`,
                '',
                '**Callsign Sections**',
                '`SP-001–010` Directorate',
                '`SP-011–019` Command',
                '`SP-020–035` High Rank',
                '`SP-036–060` Sergeants',
                '`SP-061–250` Patrol',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Open Shift Manager',
                    '🕒',
                    channelUrl(ISP_CHANNELS.shiftManage)
                ),
                createLinkButton(
                    'Open Callsign Panel',
                    '📡',
                    channelUrl(ISP_CHANNELS.deputyCommand)
                ),
            ],
        },
        units: {
            title: 'Units & Opportunities',
            body: [
                `**Patrol Units** — ${mentionRole(roleGroups.patrolUnits, 'Patrol Units')}`,
                'The department’s primary field personnel and normal path for active troopers.',
                '',
                `**High Speed Unit** — ${mentionRole(roleGroups.highSpeedUnit, 'High Speed Unit')}`,
                'A configured ISP unit with its own leadership and personnel roles.',
                '',
                'Assignments, eligibility, training requirements, and openings are determined by authorized department leadership. Do not assume access based only on rank.',
            ].join('\n'),
        },
        resources: {
            title: 'Official ISP Resources',
            body: [
                `**Deputy Command:** ${mentionChannel(ISP_CHANNELS.deputyCommand, 'Not configured')}`,
                `**Shift Manager:** ${mentionChannel(ISP_CHANNELS.shiftManage, 'Not configured')}`,
                `**Shift Administration:** ${mentionChannel(ISP_CHANNELS.shiftAdministration, 'Not configured')}`,
                `**Shift Logs:** ${mentionChannel(ISP_CHANNELS.shiftLogs, 'Not configured')}`,
                `**Callsign Logs:** ${mentionChannel(ISP_CHANNELS.callsignLogs, 'Not configured')}`,
                '',
                `**Department Handbook:** [Open the Standard Operating Procedures](${ISP_HANDBOOK_URL})`,
                `**Melonly:** [Open the department activity dashboard](${ISP_MELONLY_URL})`,
                '',
                'Discord channel permissions still control which resources each member can open.',
            ].join('\n'),
            buttons: [
                createLinkButton(
                    'Deputy Command',
                    '📡',
                    channelUrl(ISP_CHANNELS.deputyCommand)
                ),
                createLinkButton(
                    'Shift Manager',
                    '🕒',
                    channelUrl(ISP_CHANNELS.shiftManage)
                ),
                createLinkButton(
                    'Shift Administration',
                    '🛡️',
                    channelUrl(ISP_CHANNELS.shiftAdministration)
                ),
                createLinkButton(
                    'ISP Handbook',
                    '📘',
                    ISP_HANDBOOK_URL
                ),
                createLinkButton(
                    'Melonly',
                    '🕒',
                    ISP_MELONLY_URL
                ),
            ],
        },
    };

    return pages[pageId] || null;
}

function createIspInformationPagePayload(pageId) {
    const page = getIspInformationPage(pageId);

    if (!page) {
        return null;
    }

    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal(brands.isp.color))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(ISP_INFORMATION_BANNER_URL)
                    .setDescription('Illinois State Police Information')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                eyebrow: 'ILLINOIS STATE POLICE',
                title: page.title,
                description: 'Official department information',
            }),
            new TextDisplayBuilder().setContent(page.body)
        );
    const linkRow = createLinkRow(page.buttons || []);

    if (linkRow) {
        container
            .addSeparatorComponents(createPanelSeparator())
            .addActionRowComponents(linkRow);
    }

    addBrandSignature(container, {
        label: 'Illinois State Police',
        detail: 'Integrity • Service • Pride',
    });

    return {
        files: [createIspInformationAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

async function handleIspInformationInteraction(interaction) {
    if (
        !interaction.isStringSelectMenu?.() ||
        interaction.customId !== ISP_INFORMATION_SELECT_ID
    ) {
        return;
    }

    const payload = createIspInformationPagePayload(
        interaction.values[0]
    );

    if (!payload) {
        await interaction.reply({
            content: 'That ISP information section is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral | payload.flags,
    });
}

async function getStoredIspInformationPanel(guildId) {
    const database = await readDatabase(ISP_INFORMATION_DATABASE, {});
    return database[guildId] || null;
}

async function saveIspInformationPanel(guildId, panel) {
    await updateDatabase(
        ISP_INFORMATION_DATABASE,
        (database) => {
            database[guildId] = { guildId, ...panel };
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredIspInformationPanel(guildId) {
    let removed = null;

    await updateDatabase(
        ISP_INFORMATION_DATABASE,
        (database) => {
            removed = database[guildId] || null;
            delete database[guildId];
            return database;
        },
        {}
    );
    return removed;
}

async function fetchStoredIspInformationMessage(client, panel) {
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
    ISP_INFORMATION_DATABASE,
    ISP_HANDBOOK_URL,
    ISP_INFORMATION_PAGES,
    ISP_INFORMATION_PREFIX,
    ISP_INFORMATION_SELECT_ID,
    ISP_MELONLY_URL,
    createIspInformationPagePayload,
    createIspInformationPanelPayload,
    fetchStoredIspInformationMessage,
    getStoredIspInformationPanel,
    handleIspInformationInteraction,
    removeStoredIspInformationPanel,
    saveIspInformationPanel,
};
