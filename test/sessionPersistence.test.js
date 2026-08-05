const test = require('node:test');
const assert = require('node:assert/strict');

const sessionManager = require('../utils/sessionManager');
const {
    STATE_VERSION,
    createSnapshot,
    normalizeSavedState,
} = require('../services/sessionStateStore');

test('serializes and restores active vote choices', () => {
    sessionManager.resetAll();
    sessionManager.createVote({
        guildId: 'guild',
        channelId: 'channel',
        messageId: 'vote-message',
        hostId: 'host',
        hostUsername: 'Host',
        goal: 10,
        endsAt: Date.now() + 60_000,
    });
    sessionManager.setVote('member-1', 'attending');

    const snapshot = createSnapshot();
    assert.equal(snapshot.version, STATE_VERSION);
    assert.deepEqual(snapshot.activeVote.votes, [
        ['member-1', 'attending'],
    ]);

    sessionManager.resetAll();
    sessionManager.restoreState(snapshot);

    assert.equal(sessionManager.getAttendingCount(), 1);
    assert.equal(
        sessionManager.getVote().messageId,
        'vote-message'
    );

    sessionManager.resetAll();
});

test('serializes live session recovery details', () => {
    sessionManager.resetAll();
    sessionManager.startSession({
        guildId: 'guild',
        channelId: 'channel',
        hostId: 'host',
        hostUsername: 'Host',
        startupMessageId: 'startup-message',
        attendeeIds: ['member-1'],
        livePlayerCount: 14,
        maxPlayerCount: 40,
        playerCountUpdatedAt: 123456,
    });

    const snapshot = createSnapshot();
    sessionManager.resetAll();
    sessionManager.restoreState(snapshot);

    const session = sessionManager.getSession();
    assert.deepEqual(session.attendeeIds, ['member-1']);
    assert.equal(session.livePlayerCount, 14);
    assert.equal(session.maxPlayerCount, 40);
    assert.equal(
        session.playerCountUpdatedAt,
        123456
    );

    sessionManager.resetAll();
});

test('rejects malformed saved session state safely', () => {
    const normalized = normalizeSavedState({
        activeVote: {
            guildId: 'guild',
        },
        activeSession: {
            channelId: 'channel',
        },
    });

    assert.deepEqual(normalized, {
        activeVote: null,
        activeSession: null,
    });
});
