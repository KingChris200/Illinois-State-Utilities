const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');

const shiftCommand = require('../commands/management/shift');
const shiftConfig = require('../config/ispShift');
const { ISP_SERVER_ID } = require('../config/serverConfigs');
const {
    calculateActiveDuration,
    formatDuration,
    getUserWeeklyDuration,
    getWeekKey,
} = require('../utils/ispShiftStore');
const {
    createManagePayload,
    isIspMember,
    isShiftAdministrator,
    updateShiftRoles,
} = require('../utils/ispShiftManager');

function createRoleCache(roleIds) {
    const roles = new Set(roleIds);
    return {
        has: (roleId) => roles.has(roleId),
    };
}

test('ISP shift configuration uses the supplied guild, roles, and channels', () => {
    assert.equal(shiftConfig.guildId, ISP_SERVER_ID);
    assert.equal(shiftConfig.managementRoleId, '1527518424060792872');
    assert.equal(shiftConfig.onDutyRoleId, '1539069939468738590');
    assert.equal(shiftConfig.onBreakRoleId, '1539074734963294238');
    assert.equal(shiftConfig.shiftLogChannelId, '1527524431642104039');
    assert.equal(shiftConfig.shiftManageChannelId, '1527524104209567824');
    assert.equal(
        shiftConfig.shiftAdministrationChannelId,
        '1527524291829174365'
    );
});

test('/shift exposes the requested compact command family', () => {
    const command = shiftCommand.data.toJSON();

    assert.equal(command.name, 'shift');
    assert.deepEqual(
        command.options.map((option) => option.name),
        [
            'manage',
            'leaderboard',
            'admin',
            'cooldowns',
            'excuse',
            'excuse-revoke',
            'lists',
            'logging',
            'online',
            'promotions',
            'quota-reminder',
        ]
    );
    const admin = command.options.find((option) => option.name === 'admin');
    assert.deepEqual(
        admin.options.map((option) => option.name),
        ['global', 'user']
    );
});

test('shift duration excludes completed and active break time', () => {
    const active = {
        startedAt: '2026-08-17T12:00:00.000Z',
        accumulatedBreakMs: 10 * 60 * 1000,
        breakStartedAt: '2026-08-17T13:00:00.000Z',
    };
    const now = new Date('2026-08-17T13:15:00.000Z').getTime();

    assert.equal(calculateActiveDuration(active, now), 50 * 60 * 1000);
    assert.equal(formatDuration(calculateActiveDuration(active, now)), '50m');
});

test('weekly totals combine sessions, adjustments, and an active shift', () => {
    const now = new Date('2026-08-17T14:00:00.000Z').getTime();
    const weekKey = getWeekKey(now);
    const userState = {
        sessions: [
            {
                weekKey,
                startedAt: '2026-08-17T10:00:00.000Z',
                durationMs: 30 * 60 * 1000,
            },
        ],
        adjustments: [{ weekKey, deltaMs: 15 * 60 * 1000 }],
        active: {
            weekKey,
            startedAt: '2026-08-17T13:30:00.000Z',
            accumulatedBreakMs: 0,
            breakStartedAt: null,
        },
    };

    assert.equal(
        getUserWeeklyDuration(userState, weekKey, now),
        75 * 60 * 1000
    );
});

test('shift permissions recognize ISP personnel and Office of Director', () => {
    const managementMember = {
        roles: { cache: createRoleCache([shiftConfig.managementRoleId]) },
    };
    const regularMember = {
        roles: { cache: createRoleCache(['1527514983670349927']) },
    };

    assert.equal(isIspMember(managementMember), true);
    assert.equal(isIspMember(regularMember), true);
    assert.equal(isShiftAdministrator(managementMember, null), true);
    assert.equal(isShiftAdministrator(regularMember, null), false);
    assert.equal(
        isShiftAdministrator(regularMember, {
            has: (permission) => permission === PermissionFlagsBits.Administrator,
        }),
        true
    );
});

test('private shift manager shows start, break, and stop controls', () => {
    const user = {
        id: '123456789012345678',
        username: 'TrooperExample',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
    };
    const member = {
        id: user.id,
        user,
        roles: { cache: createRoleCache(['1527514983670349927']) },
    };
    const payload = createManagePayload(
        { user },
        {
            active: null,
            loggingEnabled: true,
            weeklyDurationMs: 30 * 60 * 1000,
            weeklyQuotaMs: 120 * 60 * 1000,
            leaderboardPlacement: 4,
            leaderboardSize: 20,
        },
        member
    );
    const buttons = payload.components[0].toJSON().components;

    assert.deepEqual(
        buttons.map((button) => button.label),
        ['Start Shift', 'Toggle Break', 'Stop Shift']
    );
    assert.equal(buttons[0].disabled, false);
    assert.equal(buttons[1].disabled, true);
    assert.equal(buttons[2].disabled, true);
});

test('shift-role sync manages On-Duty and On-Break independently', async () => {
    const assignedRoles = new Set();
    const member = {
        id: '123456789012345678',
        roles: {
            cache: { has: (roleId) => assignedRoles.has(roleId) },
            add: async (roleId) => assignedRoles.add(roleId),
            remove: async (roleId) => assignedRoles.delete(roleId),
        },
    };
    const guild = {
        members: {
            cache: new Map([[member.id, member]]),
            fetch: async () => member,
        },
    };

    await updateShiftRoles(guild, member.id, {
        onDuty: true,
        onBreak: true,
    });
    assert.equal(assignedRoles.has(shiftConfig.onDutyRoleId), true);
    assert.equal(assignedRoles.has(shiftConfig.onBreakRoleId), true);

    await updateShiftRoles(guild, member.id, {
        onDuty: true,
        onBreak: false,
    });
    assert.equal(assignedRoles.has(shiftConfig.onDutyRoleId), true);
    assert.equal(assignedRoles.has(shiftConfig.onBreakRoleId), false);

    await updateShiftRoles(guild, member.id, {
        onDuty: false,
        onBreak: false,
    });
    assert.equal(assignedRoles.has(shiftConfig.onDutyRoleId), false);
    assert.equal(assignedRoles.has(shiftConfig.onBreakRoleId), false);
});
