const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parsePlayerRecord,
    resolvePlayer,
} = require('../utils/playerResolver');

const players = [
    {
        Player: 'Christopher:1001',
        Permission: 'Server Administrator',
    },
    {
        Player: 'ChrisPatrol:1002',
        Permission: 'Normal',
    },
    {
        Player: 'IllinoisTrooper:1003',
        Permission: 'Normal',
    },
];

test('parses ER:LC username and user ID records', () => {
    assert.deepEqual(parsePlayerRecord(players[0]), {
        username: 'Christopher',
        userId: '1001',
        permission: 'Server Administrator',
        raw: players[0],
    });
});

test('prefers exact case-insensitive username matches', () => {
    const result = resolvePlayer(players, 'CHRISTOPHER');

    assert.equal(result.player.userId, '1001');
    assert.equal(result.matchType, 'exact_username');
});

test('matches only complete numeric user IDs', () => {
    const result = resolvePlayer(players, '1002');

    assert.equal(result.player.username, 'ChrisPatrol');
    assert.equal(result.matchType, 'exact_id');
    assert.throws(
        () => resolvePlayer(players, '100'),
        { code: 'PLAYER_NOT_FOUND' }
    );
});

test('allows a unique username fragment', () => {
    const result = resolvePlayer(players, 'troop');

    assert.equal(result.player.username, 'IllinoisTrooper');
    assert.equal(result.matchType, 'username_contains');
});

test('refuses ambiguous username searches', () => {
    assert.throws(
        () => resolvePlayer(players, 'chris'),
        { code: 'PLAYER_AMBIGUOUS' }
    );
});

test('refuses unsafe short partial searches', () => {
    assert.throws(
        () => resolvePlayer(players, 'il'),
        { code: 'PLAYER_QUERY_TOO_SHORT' }
    );
});

test('returns a clear error when no player matches', () => {
    assert.throws(
        () => resolvePlayer(players, 'NobodyHere'),
        { code: 'PLAYER_NOT_FOUND' }
    );
});
