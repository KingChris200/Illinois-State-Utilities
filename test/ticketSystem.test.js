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
    createTicketPanelPayload,
    getCategorySupportRoleIds,
    memberCanManageTickets,
} = require('../utils/ticketManager');

const mockGuild = {
    id: MAIN_SERVER_ID,
    iconURL: () => null,
};

test('ticket categories use the supplied Assistance destinations', () => {
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
        categoryParents.general,
        '1490870667795763412'
    );
    assert.equal(
        categoryParents.partnership,
        '1490870767632646365'
    );
    assert.equal(
        categoryParents.management,
        '1490870524245577899'
    );
    assert.equal(
        categoryParents.ingame_appeal,
        categoryParents.management
    );
    assert.equal(
        categoryParents.staff_appeal,
        categoryParents.management
    );
    assert.equal(
        categoryParents.internal_affairs,
        categoryParents.management
    );
});

test('Assistance panel exposes seven branded ticket choices', () => {
    const payload = createTicketPanelPayload(mockGuild);
    const menu = payload.components[0].toJSON().components[0];

    assert.equal(menu.custom_id, CREATE_MENU_ID);
    assert.equal(menu.options.length, 7);
    assert.equal(
        new Set(menu.options.map((option) => option.value)).size,
        7
    );
    assert.equal(payload.files.length, 1);
    assert.equal(
        payload.files[0].name,
        'isrp-ticket-wordmark.jpg'
    );
});

test('Internal Affairs tickets exclude the general staff support role', () => {
    const config = getTicketConfig(MAIN_SERVER_ID);
    const serverConfig = getServerConfig(MAIN_SERVER_ID);
    const category = config.categories.find(
        (entry) => entry.id === 'internal_affairs'
    );
    const roleIds = getCategorySupportRoleIds(
        MAIN_SERVER_ID,
        category
    );

    assert.ok(
        roleIds.includes(
            serverConfig.roleGroups.internalAffairsTeam
        )
    );
    assert.ok(
        roleIds.includes(serverConfig.roleGroups.directorTeam)
    );
    assert.equal(
        roleIds.includes(serverConfig.roleGroups.serverStaffTeam),
        false
    );
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
