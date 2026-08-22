const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getCommandAnalytics,
    normalizeCommandName,
} = require('../services/commandAnalyticsService');
const {
    auditCommandPermissions,
} = require('../services/commandPermissionAudit');
const {
    reportError,
    safeText,
} = require('../services/errorReportingService');
const historyCommand = require('../commands/management/history');
const {
    MAIN_SERVER_ID,
    SERVER_CONFIGS,
} = require('../config/serverConfigs');

test('command analytics summarize aggregate usage without member data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const analytics = await getCommandAnalytics('guild-1', {
        days: 30,
        database: {
            guilds: {
                'guild-1': {
                    days: {
                        [today]: {
                            total: {
                                uses: 3,
                                successes: 2,
                                failures: 1,
                                denied: 0,
                                totalDurationMs: 90,
                                lastUsedAt: new Date().toISOString(),
                            },
                            commands: {
                                '/doctor': {
                                    uses: 3,
                                    successes: 2,
                                    failures: 1,
                                    denied: 0,
                                    totalDurationMs: 90,
                                    lastUsedAt: new Date().toISOString(),
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    assert.equal(analytics.total.uses, 3);
    assert.equal(analytics.total.failures, 1);
    assert.equal(analytics.commands[0].name, '/doctor');
    assert.equal(normalizeCommandName('SERVER', 'prefix'), '?server');
    assert.equal(JSON.stringify(analytics).includes('userId'), false);
});

test('central error reporting creates safe references and redacts secrets', async () => {
    const record = await reportError({
        error: Object.assign(new Error('private'), {
            code: 'TEST_FAILURE',
        }),
        context: 'Unit test',
        command: '/doctor',
        guildId: 'guild-1',
    });

    assert.match(record.id, /^ERR-[A-F0-9]{8}$/);
    assert.equal(record.code, 'TEST_FAILURE');
    assert.equal(
        safeText('token=super-secret authorization: hidden'),
        'token=[REDACTED] authorization=[REDACTED]'
    );
});

test('every command has a reviewed permission classification', () => {
    const report = auditCommandPermissions();

    assert.equal(report.status, 'pass');
    assert.equal(report.findings.length, 0);
    assert.ok(report.checkedCommands >= 30);
    assert.ok(report.runtimeProtected >= 7);
});

test('staff history is restricted to configured management reviewers', () => {
    const reviewerRoleId =
        SERVER_CONFIGS[MAIN_SERVER_ID].reviewerRoleIds[0];
    const createInteraction = (roleIds) => ({
        guildId: MAIN_SERVER_ID,
        user: { id: 'member' },
        guild: { ownerId: 'owner' },
        member: {
            permissions: { has: () => false },
            roles: {
                cache: {
                    some: (callback) =>
                        roleIds.some((id) => callback({ id })),
                },
            },
        },
    });

    assert.equal(
        historyCommand.canViewStaffHistory(createInteraction([])),
        false
    );
    assert.equal(
        historyCommand.canViewStaffHistory(
            createInteraction([reviewerRoleId])
        ),
        true
    );
});
