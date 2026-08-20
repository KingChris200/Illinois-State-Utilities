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

const { readDatabase, updateDatabase } = require('./database');
const {
    addBrandSignature,
    colorToDecimal,
    createPanelHeader,
    createPanelSeparator,
} = require('./componentTheme');

const DEPARTMENTS_DATABASE = 'department-panels';
const DEPARTMENTS_PREFIX = 'departments:';
const DEPARTMENTS_SELECT_ID = `${DEPARTMENTS_PREFIX}explore`;
const DEPARTMENTS_BANNER_NAME = 'departments-banner-v1.png';
const DEPARTMENTS_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    DEPARTMENTS_BANNER_NAME
);
const DEPARTMENTS_BANNER_URL = `attachment://${DEPARTMENTS_BANNER_NAME}`;

const DEPARTMENTS = [
    {
        value: 'isp',
        label: 'Illinois State Police',
        abbreviation: 'ISP',
        emoji: '🚔',
        leaderTitle: 'Commissioner',
        leader: 'CO | LF_V12',
        description:
            'Illinois’ premier statewide law-enforcement agency, responsible for public safety, traffic enforcement, and criminal investigations across the state.',
        invite: 'https://discord.gg/W2ygrZUDBx',
    },
    {
        value: 'ccso',
        label: "Cook County Sheriff’s Office",
        abbreviation: 'CCSO',
        emoji: '⭐',
        leaderTitle: 'Commissioner',
        leader: 'MGMT | elonmuskws',
        description:
            'A statewide law-enforcement department with a primary focus on rural areas and the countryside.',
        invite: 'https://discord.gg/mRncffCeFV',
    },
    {
        value: 'cpd',
        label: 'Chicago Police Department',
        abbreviation: 'CPD',
        emoji: '🚓',
        leaderTitle: 'Commissioner',
        leader: 'O | Scottattack155',
        description:
            'The municipal law-enforcement department serving the city and its connected back roads.',
        invite: 'https://discord.gg/fHQk9x6C5x',
    },
    {
        value: 'cfd',
        label: 'Chicago Fire Department',
        abbreviation: 'CFD',
        emoji: '🚒',
        leaderTitle: 'Commissioner',
        leader: '<@1351721041264644126>',
        description:
            'A statewide fire and medical service that responds to fires, rescues, and injured members throughout the map.',
        invite: 'https://discord.gg/YzeUH94nrX',
    },
    {
        value: 'cdot',
        label: 'Chicago Department of Transportation',
        abbreviation: 'CDOT',
        emoji: '🚧',
        leaderTitle: 'Commissioner',
        leader: 'DeathGuy123476',
        description:
            'A statewide transportation department that keeps roads clear, safe, and operational.',
        invite: 'https://discord.gg/6CPmTKpxge',
    },
    {
        value: 'vsc',
        label: 'Vanguard Strategic Corporation',
        abbreviation: 'VSC',
        emoji: '🛡️',
        leaderTitle: 'Chairman',
        leader: 'SD | FaTe_MikeyK',
        description:
            'A civilian private-security organization supporting protection, rescue, hostage response, and approved law-enforcement operations. Contact the chairman for recruitment information.',
        notice:
            'VSC is a civilian operation that may support law-enforcement purposes when authorized.',
    },
    {
        value: 'usms',
        label: 'United States Marshals Service',
        abbreviation: 'USMS',
        emoji: '🦅',
        leaderTitle: 'Director',
        leader: 'TTVxsaverr_attwicth',
        description:
            'The federal enforcement arm of the courts, focused on fugitive apprehension, judicial protection, witness security, and prisoner transportation.',
        invite: 'https://discord.gg/SGw7yncxf',
    },
];

function createDepartmentsAttachment() {
    return new AttachmentBuilder(DEPARTMENTS_BANNER_PATH, {
        name: DEPARTMENTS_BANNER_NAME,
    });
}

function createDepartmentMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId(DEPARTMENTS_SELECT_ID)
        .setPlaceholder('Choose a department…')
        .addOptions(
            DEPARTMENTS.map((department) => ({
                label: department.label,
                description: `${department.abbreviation} • View information and access`,
                value: department.value,
                emoji: department.emoji,
            }))
        );
}

function createDepartmentsPanelPayload() {
    const directory = DEPARTMENTS.map(
        (department) =>
            `${department.emoji} **${department.abbreviation}** — ${department.label}`
    ).join('\n');
    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(DEPARTMENTS_BANNER_URL)
                    .setDescription('Illinois State Roleplay Departments')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                title: 'Illinois State Roleplay Departments',
                description: 'Find an official ISRP department.',
            }),
            new TextDisplayBuilder().setContent(
                [
                    '## Department Directory',
                    directory,
                    '',
                    '-# Each department sets its own requirements and openings.',
                ].join('\n')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Department Details\nChoose a department below.'
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(createDepartmentMenu())
        );

    addBrandSignature(container, {
        detail: 'Illinois State Roleplay Departments',
    });

    return {
        files: [createDepartmentsAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function createDepartmentPagePayload(departmentId) {
    const department = DEPARTMENTS.find(
        (entry) => entry.value === departmentId
    );

    if (!department) {
        return null;
    }

    const container = new ContainerBuilder()
        .setAccentColor(colorToDecimal())
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(DEPARTMENTS_BANNER_URL)
                    .setDescription('Illinois State Roleplay Departments')
            )
        )
        .addSeparatorComponents(createPanelSeparator())
        .addTextDisplayComponents(
            createPanelHeader({
                eyebrow: `${department.abbreviation} • ILLINOIS STATE ROLEPLAY`,
                title: department.label,
                description: 'Official department information',
            }),
            new TextDisplayBuilder().setContent(
                [
                    `## ${department.leaderTitle}`,
                    department.leader,
                    '',
                    '## Department Overview',
                    department.description,
                    department.notice ? `\n> **Notice:** ${department.notice}` : null,
                ].filter(Boolean).join('\n')
            )
        );

    if (department.invite) {
        container
            .addSeparatorComponents(createPanelSeparator())
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`Join ${department.abbreviation}`)
                        .setEmoji(department.emoji)
                        .setStyle(ButtonStyle.Link)
                        .setURL(department.invite)
                )
            );
    }

    addBrandSignature(container, {
        detail: `${department.abbreviation} • Official department directory`,
    });

    return {
        files: [createDepartmentsAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

async function handleDepartmentsInteraction(interaction) {
    if (
        !interaction.isStringSelectMenu?.() ||
        interaction.customId !== DEPARTMENTS_SELECT_ID
    ) {
        return;
    }

    const payload = createDepartmentPagePayload(interaction.values[0]);

    if (!payload) {
        await interaction.reply({
            content: 'That department is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral | payload.flags,
    });
}

async function getStoredDepartmentsPanel(guildId) {
    const database = await readDatabase(DEPARTMENTS_DATABASE, {});
    return database[guildId] || null;
}

async function saveDepartmentsPanel(guildId, panel) {
    await updateDatabase(
        DEPARTMENTS_DATABASE,
        (database) => {
            database[guildId] = { guildId, ...panel };
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredDepartmentsPanel(guildId) {
    let removed = null;
    await updateDatabase(
        DEPARTMENTS_DATABASE,
        (database) => {
            removed = database[guildId] || null;
            delete database[guildId];
            return database;
        },
        {}
    );
    return removed;
}

async function fetchStoredDepartmentsMessage(client, panel) {
    if (!client || !panel) {
        return null;
    }

    const channel =
        client.channels?.cache?.get(panel.channelId) ||
        await client.channels?.fetch?.(panel.channelId).catch(() => null);

    return channel?.messages?.fetch
        ? channel.messages.fetch(panel.messageId).catch(() => null)
        : null;
}

module.exports = {
    DEPARTMENTS,
    DEPARTMENTS_BANNER_NAME,
    DEPARTMENTS_DATABASE,
    DEPARTMENTS_PREFIX,
    DEPARTMENTS_SELECT_ID,
    createDepartmentPagePayload,
    createDepartmentsPanelPayload,
    fetchStoredDepartmentsMessage,
    getStoredDepartmentsPanel,
    handleDepartmentsInteraction,
    removeStoredDepartmentsPanel,
    saveDepartmentsPanel,
};
