const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const ticketsCommand = require('../commands/management/tickets');
const {
    getTicketConfig,
} = require('../config/tickets');
const {
    MAIN_SERVER_ID,
    getServerConfig,
} = require('../config/serverConfigs');
const {
    CREATE_MENU_ID,
    IN_GAME_REPORT_MODAL_ID,
    createAppealQuestionnaire,
    createInGameReportModal,
    createPartnershipRequirementsPayload,
    createTicketOpeningMentions,
    createTicketPanelPayload,
    createTicketTranscript,
    getCategorySupportRoleIds,
    memberCanManageTickets,
} = require('../utils/ticketManager');

const mockGuild = {
    id: MAIN_SERVER_ID,
    iconURL: () => null,
};

function collectComponents(component) {
    const collected = [component];

    if (Array.isArray(component.components)) {
        for (const child of component.components) {
            collected.push(...collectComponents(child));
        }
    }

    if (Array.isArray(component.items)) {
        collected.push(...component.items);
    }

    return collected;
}

test('five ticket categories use the supplied destinations and team roles', () => {
    const config = getTicketConfig(MAIN_SERVER_ID);
    const categoryParents = Object.fromEntries(
        config.categories.map((category) => [
            category.id,
            category.parentCategoryId,
        ])
    );

    assert.equal(
        config.assistanceChannelId,
        '1490730143508070540'
    );
    assert.equal(
        config.transcriptChannelId,
        '1490813707289362533'
    );
    const categoryRoles = Object.fromEntries(
        config.categories.map((category) => [
            category.id,
            category.teamRoleId,
        ])
    );

    assert.equal(config.categories.length, 5);
    assert.equal(
        categoryParents.general,
        '1490870667795763412'
    );
    assert.equal(
        categoryParents.management,
        '1490870524245577899'
    );
    assert.equal(
        categoryParents.internal_affairs,
        categoryParents.management
    );
    assert.equal(
        categoryParents.partnership,
        '1490870767632646365'
    );
    assert.equal(
        categoryParents.in_game_report,
        categoryParents.general
    );
    assert.deepEqual(categoryRoles, {
        management: '1490523581187231795',
        internal_affairs: '1526344302618218656',
        partnership: '1490523581187231795',
        general: '1490523797629960392',
        in_game_report: '1490523797629960392',
    });
});

test('Assistance panel exposes exactly five branded ticket choices', () => {
    const payload = createTicketPanelPayload(mockGuild);
    const components = collectComponents(
        payload.components[0].toJSON()
    );
    const menu = components.find(
        (component) =>
            component.custom_id === CREATE_MENU_ID
    );

    assert.equal(
        payload.flags,
        MessageFlags.IsComponentsV2
    );
    assert.equal(payload.embeds, undefined);
    assert.equal(payload.components.length, 1);
    assert.equal(menu.custom_id, CREATE_MENU_ID);
    assert.equal(menu.options.length, 5);
    assert.equal(
        new Set(menu.options.map((option) => option.value)).size,
        5
    );
    assert.deepEqual(
        menu.options.map((option) => option.value),
        [
            'management',
            'internal_affairs',
            'partnership',
            'general',
            'in_game_report',
        ]
    );
    assert.equal(payload.files.length, 1);
    assert.equal(
        payload.files[0].name,
        'assistance-banner-v3.png'
    );
    assert.ok(
        components.some(
            (component) =>
                component.media?.url ===
                'attachment://assistance-banner-v3.png'
        )
    );
});

test('In-Game Report opens a focused three-question intake form', () => {
    const modal = createInGameReportModal().toJSON();

    assert.equal(modal.custom_id, IN_GAME_REPORT_MODAL_ID);
    assert.equal(modal.title, 'In-Game Report Ticket');
    assert.equal(modal.components.length, 3);
    assert.deepEqual(
        modal.components.map(
            (row) => row.components[0].custom_id
        ),
        ['assisted_by', 'reported_username', 'report_reason']
    );
    assert.ok(
        modal.components.every(
            (row) => row.components[0].required
        )
    );
});

test('each ticket is restricted to only its selected support team', () => {
    const config = getTicketConfig(MAIN_SERVER_ID);
    for (const category of config.categories) {
        assert.deepEqual(
            getCategorySupportRoleIds(MAIN_SERVER_ID, category),
            [category.teamRoleId]
        );
    }
});

test('a new ticket pings its creator and selected support team only', () => {
    const category = getTicketConfig(MAIN_SERVER_ID).categories.find(
        (entry) => entry.id === 'internal_affairs'
    );
    const mentions = createTicketOpeningMentions(
        '123456789012345678',
        category
    );

    assert.equal(
        mentions.content,
        '<@123456789012345678> <@&1526344302618218656>'
    );
    assert.deepEqual(mentions.allowedMentions, {
        users: ['123456789012345678'],
        roles: ['1526344302618218656'],
        parse: [],
    });
});

test('ticket transcripts preserve messages, embeds, and attachment links', () => {
    const transcript = createTicketTranscript(
        {
            id: 'ticket-example',
            categoryLabel: 'General Support',
            openerUsername: 'ExampleUser',
            openerId: '123456789012345678',
            createdAt: '2026-08-08T12:00:00.000Z',
            closedAt: '2026-08-08T12:10:00.000Z',
            closedById: '987654321098765432',
        },
        [
            {
                id: '2',
                createdTimestamp: Date.parse(
                    '2026-08-08T12:02:00.000Z'
                ),
                author: { id: '2', username: 'StaffMember' },
                content: '',
                attachments: new Map([
                    [
                        'file',
                        {
                            name: 'evidence.png',
                            url: 'https://cdn.example/evidence.png',
                        },
                    ],
                ]),
                embeds: [
                    {
                        title: 'Appeal Submitted',
                        description: 'Private appeal details',
                        fields: [
                            {
                                name: 'Reason',
                                value: 'Example reason',
                            },
                        ],
                    },
                ],
            },
            {
                id: '1',
                createdTimestamp: Date.parse(
                    '2026-08-08T12:01:00.000Z'
                ),
                author: { id: '1', username: 'ExampleUser' },
                content: 'I need assistance.',
                attachments: new Map(),
                embeds: [],
            },
        ]
    );

    assert.match(transcript, /Ticket ID: ticket-example/);
    assert.match(transcript, /I need assistance\./);
    assert.match(
        transcript,
        /\[Attachment\] evidence\.png: https:\/\/cdn\.example\/evidence\.png/
    );
    assert.match(
        transcript,
        /\[Embed\] Appeal Submitted \| Private appeal details \| Reason: Example reason/
    );
    assert.ok(
        transcript.indexOf('I need assistance.') <
            transcript.indexOf('[Attachment]')
    );
});

test('appeal questionnaire is copyable and mentions only the ticket opener', () => {
    const openerId = '123456789012345678';
    const payload = createAppealQuestionnaire({ openerId });

    assert.match(payload.content, /Appeal Questionnaire/);
    assert.match(
        payload.content,
        /Appeal Type: In-Game Punishment \/ Staff Infraction/
    );
    assert.match(payload.content, /Roblox Username:/);
    assert.match(
        payload.content,
        /Why Should This Action Be Reconsidered\?/
    );
    assert.match(payload.content, /```text/);
    assert.equal(payload.components, undefined);
    assert.deepEqual(payload.allowedMentions, {
        users: [openerId],
        roles: [],
        parse: [],
    });
});

test('partnership requirements are clear, branded, and mention-safe', () => {
    const payload = createPartnershipRequirementsPayload(mockGuild);
    const embed = payload.embeds[0].toJSON();

    assert.match(embed.title, /Partnership Requirements/);
    assert.match(embed.description, /200 or more members/);
    assert.match(embed.description, /fewer than 200 members/);
    assert.match(embed.description, /Discord Terms of Service/);
    assert.match(embed.description, /Roblox Terms of Use/);
    assert.match(embed.description, /does not guarantee approval/i);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('/tickets provides setup, preview, and status management actions', () => {
    const command = ticketsCommand.data.toJSON();

    assert.equal(command.name, 'tickets');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['setup', 'preview', 'status']
    );
});

test('configured support staff and administrators can manage tickets', () => {
    const supportRoleId =
        getServerConfig(MAIN_SERVER_ID).roleGroups.serverStaffTeam;
    const createMember = ({ administrator = false, roles = [] }) => ({
        guild: { id: MAIN_SERVER_ID },
        permissions: {
            has: (permission) =>
                administrator &&
                permission === PermissionFlagsBits.Administrator,
        },
        roles: {
            cache: new Map(
                roles.map((roleId) => [roleId, { id: roleId }])
            ),
        },
    });

    assert.equal(
        memberCanManageTickets(
            createMember({ roles: [supportRoleId] })
        ),
        true
    );
    assert.equal(
        memberCanManageTickets(
            createMember({ administrator: true })
        ),
        true
    );
    assert.equal(
        memberCanManageTickets(createMember({})),
        false
    );
});
