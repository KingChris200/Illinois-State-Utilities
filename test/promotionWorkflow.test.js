const test = require('node:test');
const assert = require('node:assert/strict');
const {
    PermissionFlagsBits,
} = require('discord.js');

const promoteCommand = require('../commands/management/promote');
const {
    MAIN_SERVER_ID,
    MAIN_SERVER_RANKS,
} = require('../config/serverConfigs');
const {
    applyRankChange,
    detectMemberRank,
} = require('../utils/rankManager');

test('/promote detects the previous rank instead of asking for it', () => {
    const options = promoteCommand.data.toJSON().options;

    assert.deepEqual(
        options.map((option) => option.name),
        [
            'staff-member',
            'new-rank',
            'reason',
            'notes',
        ]
    );
    assert.equal(
        options.some(
            (option) => option.name === 'previous-rank'
        ),
        false
    );
});

test('live Discord roles select the highest configured member rank', () => {
    const lowerRank = MAIN_SERVER_RANKS[0];
    const higherRank = MAIN_SERVER_RANKS[5];
    const member = {
        roles: {
            cache: new Map([
                [lowerRank.roleId, {}],
                [higherRank.roleId, {}],
            ]),
        },
    };

    assert.deepEqual(
        detectMemberRank(MAIN_SERVER_ID, member),
        {
            ...higherRank,
            index: 5,
        }
    );
});

test('a member with no configured rank can receive an initial appointment', async () => {
    const newRank = MAIN_SERVER_RANKS[0];
    const newRole = {
        id: newRank.roleId,
        managed: false,
        position: 10,
        toString: () => `<@&${newRank.roleId}>`,
    };
    const memberRoleCache = new Map();
    const member = {
        id: 'staff-member',
        user: { bot: false },
        manageable: true,
        roles: {
            cache: memberRoleCache,
            add: async (role) => {
                memberRoleCache.set(role.id, role);
            },
            remove: async (role) => {
                memberRoleCache.delete(role.id);
            },
        },
    };
    const guild = {
        id: MAIN_SERVER_ID,
        ownerId: 'server-owner',
        client: {
            user: { id: 'utilities-bot' },
        },
        members: {
            me: {
                permissions: {
                    has: (permission) =>
                        permission ===
                        PermissionFlagsBits.ManageRoles,
                },
                roles: {
                    highest: { position: 100 },
                },
            },
        },
        roles: {
            cache: new Map([
                [newRole.id, newRole],
            ]),
            fetch: async () => null,
        },
    };

    const result = await applyRankChange({
        guild,
        member,
        previousRank: null,
        newRank: newRank.name,
        actionType: 'promotion',
        reason: 'Passed staff onboarding',
    });

    assert.equal(result.success, true);
    assert.equal(result.initialAssignment, true);
    assert.equal(result.previousRank, null);
    assert.equal(result.removedRole, null);
    assert.equal(result.addedRole, newRole);
    assert.equal(memberRoleCache.has(newRole.id), true);
});
