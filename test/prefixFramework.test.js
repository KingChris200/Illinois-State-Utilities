const test = require('node:test');
const assert = require('node:assert/strict');

const loadPrefixCommands = require('../handlers/prefixCommandHandler');
const erlcService = require('../services/erlcService');

test('loads the expected prefix commands', () => {
    const client = {};
    const count = loadPrefixCommands(client);

    assert.equal(count, 26);
    assert.deepEqual(
        [...client.prefixCommands.keys()].sort(),
        [
            'alerts',
            'api',
            'apicheck',
            'ban',
            'h',
            'heal',
            'help',
            'id',
            'joinlogs',
            'kick',
            'kl',
            'logs',
            'm',
            'modcalls',
            'operations',
            'ops',
            'player',
            'players',
            'queue',
            're',
            'respawn',
            'server',
            'staff',
            'status',
            'unban',
            'unwanted',
            'vehicles',
            'wanted',
            'warn',
        ]
    );
});

test('dry-run remote commands never require an API key', async () => {
    const result = await erlcService.executeCommand(':m Test', {
        dryRun: true,
    });

    assert.deepEqual(result, {
        dryRun: true,
        command: ':m Test',
    });
});

test('mock data bypasses live ER:LC requests', async () => {
    const players = [{ Player: 'Tester:1' }];
    const server = { Name: 'Test Server' };
    const staff = { Admins: { 1: 'Tester' } };
    const logs = [{ Player: 'Tester:1', Command: ':h Test' }];
    const modCalls = [{ Caller: 'Tester:1' }];
    const joinLogs = [{ Join: true, Player: 'Tester:1' }];
    const killLogs = [{ Killer: 'Tester:1', Killed: 'Other:2' }];
    const queue = [1, 2];
    const vehicles = [{ Name: 'Test Vehicle' }];
    const operationsOverview = {
        Name: 'Test Server',
        Players: [{ Player: 'Tester:1' }],
        Staff: { Admins: { 1: 'Tester' } },
    };
    const operationsActivity = {
        JoinLogs: joinLogs,
        KillLogs: killLogs,
    };
    const alertSnapshot = {
        ModCalls: modCalls,
        Queue: queue,
        KillLogs: killLogs,
    };
    const playerSnapshot = {
        Players: players,
        JoinLogs: joinLogs,
        KillLogs: killLogs,
        ModCalls: modCalls,
        Vehicles: vehicles,
    };

    assert.equal(
        await erlcService.getPlayers({ mockData: players }),
        players
    );
    assert.equal(
        await erlcService.getServer({ mockData: server }),
        server
    );
    assert.deepEqual(
        await erlcService.getStaff({ mockData: staff }),
        {
            Admins: { 1: 'Tester' },
            Mods: {},
            Helpers: {},
        }
    );
    assert.equal(
        await erlcService.getCommandLogs({ mockData: logs }),
        logs
    );
    assert.equal(
        await erlcService.getModCalls({ mockData: modCalls }),
        modCalls
    );
    assert.equal(
        await erlcService.getJoinLogs({ mockData: joinLogs }),
        joinLogs
    );
    assert.equal(
        await erlcService.getKillLogs({ mockData: killLogs }),
        killLogs
    );
    assert.equal(
        await erlcService.getQueue({ mockData: queue }),
        queue
    );
    assert.equal(
        await erlcService.getVehicles({ mockData: vehicles }),
        vehicles
    );
    assert.deepEqual(
        await erlcService.getOperationsOverview({
            mockData: operationsOverview,
        }),
        {
            ...operationsOverview,
            Staff: {
                Admins: { 1: 'Tester' },
                Mods: {},
                Helpers: {},
            },
            Queue: [],
            Vehicles: [],
        }
    );
    assert.deepEqual(
        await erlcService.getOperationsActivity({
            mockData: operationsActivity,
        }),
        operationsActivity
    );
    assert.deepEqual(
        await erlcService.getSmartAlertSnapshot({
            mockData: alertSnapshot,
        }),
        alertSnapshot
    );
    assert.deepEqual(
        await erlcService.getPlayerIntelligenceSnapshot({
            mockData: playerSnapshot,
        }),
        playerSnapshot
    );
});

test('live requests return a clear error without a key', async () => {
    const previousKey = process.env.ERLC_SERVER_KEY;
    const previousMockMode = process.env.ERLC_MOCK_MODE;

    delete process.env.ERLC_SERVER_KEY;
    delete process.env.ERLC_MOCK_MODE;

    await assert.rejects(erlcService.getServer(), {
        code: 'API_KEY_NOT_CONFIGURED',
    });

    if (previousKey === undefined) {
        delete process.env.ERLC_SERVER_KEY;
    } else {
        process.env.ERLC_SERVER_KEY = previousKey;
    }

    if (previousMockMode === undefined) {
        delete process.env.ERLC_MOCK_MODE;
    } else {
        process.env.ERLC_MOCK_MODE = previousMockMode;
    }
});
