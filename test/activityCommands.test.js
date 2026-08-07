const test = require('node:test');
const assert = require('node:assert/strict');

const joinLogsCommand = require('../prefixCommands/joinlogs');
const killLogsCommand = require('../prefixCommands/kl');
const modCallsCommand = require('../prefixCommands/modcalls');
const queueCommand = require('../prefixCommands/queue');
const vehiclesCommand = require('../prefixCommands/vehicles');
const {
    parseActivityCount,
    parsePlayerIdentity,
    sortNewest,
} = require('../utils/erlcActivityUtils');

test('activity helpers validate counts and parse ER:LC identities', () => {
    assert.equal(parseActivityCount(undefined), 5);
    assert.equal(parseActivityCount('10'), 10);
    assert.equal(parseActivityCount('0'), null);
    assert.equal(parseActivityCount('11'), null);
    assert.deepEqual(parsePlayerIdentity('Player_Name:123'), {
        username: 'Player\\_Name',
        userId: '123',
    });
});

test('activity records are sorted newest first without mutation', () => {
    const records = [
        { Timestamp: 100 },
        { Timestamp: 300 },
        { Timestamp: 200 },
    ];

    assert.deepEqual(
        sortNewest(records).map((record) => record.Timestamp),
        [300, 200, 100]
    );
    assert.deepEqual(
        records.map((record) => record.Timestamp),
        [100, 300, 200]
    );
});

test('mod calls distinguish answered and unanswered records', () => {
    assert.equal(modCallsCommand.hasModerator(null), false);
    assert.equal(modCallsCommand.hasModerator('N/A'), false);
    assert.equal(
        modCallsCommand.hasModerator('Moderator:123'),
        true
    );

    const unanswered = modCallsCommand.formatModCall(
        {
            Caller: 'Caller:1',
            Moderator: null,
            Timestamp: 2_000_000_000,
        },
        0
    );
    assert.match(unanswered, /No responding moderator/);
});

test('join and kill log formatters preserve official record details', () => {
    const join = joinLogsCommand.formatJoinLog({
        Join: true,
        Player: 'JoiningPlayer:11',
        Timestamp: 2_000_000_000,
    });
    const kill = killLogsCommand.formatKillLog(
        {
            Killer: 'Officer:22',
            Killed: 'Suspect:33',
            Timestamp: 2_000_000_000,
        },
        0
    );

    assert.match(join, /Joined/);
    assert.match(join, /JoiningPlayer/);
    assert.match(kill, /Officer/);
    assert.match(kill, /Suspect/);
});

test('all five intelligence commands produce safe mock embeds', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';

    try {
        for (const command of [
            modCallsCommand,
            joinLogsCommand,
            killLogsCommand,
            queueCommand,
            vehiclesCommand,
        ]) {
            const replies = [];
            await command.execute({
                message: {
                    reply: async (payload) => replies.push(payload),
                },
                args: [],
            });

            assert.equal(replies.length, 1);
            assert.equal(replies[0].embeds.length, 1);
            assert.deepEqual(replies[0].allowedMentions, {
                parse: [],
            });
        }
    } finally {
        if (previousMockMode === undefined) {
            delete process.env.ERLC_MOCK_MODE;
        } else {
            process.env.ERLC_MOCK_MODE = previousMockMode;
        }
    }
});

test('vehicle formatting removes unsafe markdown and inline code', () => {
    const field = vehiclesCommand.formatVehicle(
        {
            Name: 'Test_Vehicle',
            Owner: '@everyone',
            Plate: '`PING`',
            Texture: 'State_Police',
            ColorName: 'Dark Blue',
            ColorHex: '#001122',
        },
        0
    );

    assert.match(field.name, /Test\\_Vehicle/);
    assert.doesNotMatch(field.value, /`PING`/);
    assert.match(field.value, /'PING'/);
});
