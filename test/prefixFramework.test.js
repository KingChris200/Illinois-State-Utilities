const test = require('node:test');
const assert = require('node:assert/strict');

const loadPrefixCommands = require('../handlers/prefixCommandHandler');
const erlcService = require('../services/erlcService');

test('loads the expected prefix commands', () => {
    const client = {};
    const count = loadPrefixCommands(client);

    assert.equal(count, 15);
    assert.deepEqual(
        [...client.prefixCommands.keys()].sort(),
        [
            'api',
            'apicheck',
            'ban',
            'h',
            'heal',
            'help',
            'id',
            'kick',
            'm',
            'players',
            're',
            'respawn',
            'server',
            'status',
            'unban',
            'unwanted',
            'wanted',
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

    assert.equal(
        await erlcService.getPlayers({ mockData: players }),
        players
    );
    assert.equal(
        await erlcService.getServer({ mockData: server }),
        server
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
