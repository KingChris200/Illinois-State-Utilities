const test = require('node:test');
const assert = require('node:assert/strict');
const {
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
    createAppealModal,
    createTicketOpeningMentions,
    createTicketPanelPayload,
    getCategorySupportRoleIds,
    memberCanManageTickets,
} = require('../utils/ticketManager');

const mockGuild = {
    id: MAIN_SERVER_ID,
    iconURL: () => null,
};

test('three ticket categories use the supplied destinations and team roles', () => {
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
    const categoryRoles = Object.fromEntries(
        config.categories.map((category) => [
            category.id,
            category.teamRoleId,
        ])
    );

    assert.equal(config.categories.length, 3);
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
    assert.deepEqual(categoryRoles, {
        general: '1490523797629960392',
        internal_affairs: '1526344302618218656',
        management: '1490523581187231795',
    });
});

test('Assistance panel exposes exactly three branded ticket choices', () => {
    const payload = createTicketPanelPayload(mockGuild);
    const menu = payload.components[0].toJSON().components[0];

    assert.equal(menu.custom_id, CREATE_MENU_ID);
    assert.equal(menu.options.length, 3);
    assert.equal(
        new Set(menu.options.map((option) => option.value)).size,
        3
    );
    assert.deepEqual(
        menu.options.map((option) => option.value),
        ['general', 'internal_affairs', 'management']
    );
    assert.equal(payload.files.length, 1);
    assert.equal(
        payload.files[0].name,
        'isrp-assistance-banner.png'
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

test('both guided appeal types create complete five-question forms', () => {
    for (const type of ['ingame', 'staff']) {
        const modal = createAppealModal(type, 'ticket-example').toJSON();

        assert.match(modal.custom_id, new RegExp(`:${type}:`));
        assert.equal(modal.components.length, 5);
        assert.ok(
            modal.components.every(
                (row) => row.components.length === 1
            )
        );
    }
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
