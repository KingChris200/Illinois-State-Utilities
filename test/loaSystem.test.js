const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');

const loaCommand = require('../commands/requests/loa');
const {
    calculateEndDate,
    canReviewLoas,
    createManagePayload,
    getReviewRoleIds,
    parseStartDate,
} = require('../utils/loaManager');
const { MAIN_SERVER_ID } = require('../config/serverConfigs');

test('/loa exposes only request and manage workflows', () => {
    const command = loaCommand.data.toJSON();

    assert.equal(command.name, 'loa');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['request', 'manage']
    );
    assert.deepEqual(
        command.options[0].options.map((option) => option.name),
        ['duration', 'reason', 'start']
    );
    assert.equal(command.options[0].options[0].min_value, 1);
    assert.equal(command.options[0].options[0].max_value, 90);
});

test('LOA dates accept valid future dates and calculate duration', () => {
    const now = new Date('2026-08-09T14:00:00.000Z');
    const start = parseStartDate('2026-08-10', now);
    const end = calculateEndDate(start, 5);

    assert.equal(start.toISOString(), '2026-08-10T12:00:00.000Z');
    assert.equal(end.toISOString(), '2026-08-15T12:00:00.000Z');
    assert.equal(parseStartDate('2026-02-30', now), null);
    assert.equal(parseStartDate('2026-08-08', now), null);
});

test('only Ownership, Directive, or administrators review LOAs', () => {
    const [ownershipRoleId, directiveRoleId] =
        getReviewRoleIds(MAIN_SERVER_ID);
    const interaction = (roles = [], administrator = false) => ({
        guildId: MAIN_SERVER_ID,
        memberPermissions: {
            has: (permission) =>
                administrator &&
                permission === PermissionFlagsBits.Administrator,
        },
        member: {
            roles: {
                cache: new Map(roles.map((roleId) => [roleId, {}])),
            },
        },
    });

    assert.equal(canReviewLoas(interaction([ownershipRoleId])), true);
    assert.equal(canReviewLoas(interaction([directiveRoleId])), true);
    assert.equal(canReviewLoas(interaction([], true)), true);
    assert.equal(canReviewLoas(interaction([])), false);
});

test('LOA manage panel shows one-click self-service controls', () => {
    const user = {
        id: '123456789012345678',
        username: 'ExampleStaff',
        displayAvatarURL: () => 'https://cdn.example/avatar.png',
    };
    const guild = {
        name: 'Illinois State Roleplay',
        iconURL: () => 'https://cdn.example/icon.png',
    };
    const payload = createManagePayload(
        [
            {
                id: 'loa-active',
                staffMemberId: user.id,
                status: 'approved',
                startDate: '2026-08-09T12:00:00.000Z',
                endDate: '2026-08-14T12:00:00.000Z',
                reason: 'Family trip',
                createdAt: '2026-08-09T12:00:00.000Z',
            },
            {
                id: 'loa-past',
                staffMemberId: user.id,
                status: 'ended',
                startDate: '2026-07-01T12:00:00.000Z',
                endDate: '2026-07-03T12:00:00.000Z',
                reason: 'Personal matters',
                createdAt: '2026-07-01T12:00:00.000Z',
            },
        ],
        user,
        guild
    );
    const row = payload.components[0].toJSON();

    assert.match(payload.embeds[0].toJSON().description, /currently active/);
    assert.equal(row.components.length, 2);
    assert.match(row.components[0].custom_id, /^loa:end:/);
    assert.equal(row.components[0].label, 'End My LOA');
    assert.equal(row.components[1].label, 'Past LOAs (1)');
});
