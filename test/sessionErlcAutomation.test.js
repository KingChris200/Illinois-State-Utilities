const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config/sessionAutomation');
const {
    EVENT_BUILDERS,
    announceSessionEvent,
} = require('../services/sessionErlcAutomation');

test('builds commands for every supported session event', () => {
    assert.deepEqual(
        Object.keys(EVENT_BUILDERS).sort(),
        [
            'session_full',
            'session_low',
            'session_shutdown',
            'session_started',
            'vote_started',
        ]
    );

    assert.match(
        EVENT_BUILDERS.session_started({
            hostUsername: 'Host',
            attendeeCount: 10,
        }),
        /^:m .*ILLINOISrp/
    );
});

test('refuses automation outside the configured session channel', async () => {
    const result = await announceSessionEvent(
        'session_low',
        { sourceChannelId: 'wrong-channel' }
    );

    assert.deepEqual(result, {
        status: 'skipped',
        reason: 'wrong_channel',
    });
});

test('runs a safe mock session announcement', async () => {
    const previousEnabled = config.enabled;
    const previousMockMode = config.mockMode;
    config.enabled = true;
    config.mockMode = true;

    const result = await announceSessionEvent(
        'session_full',
        {
            sourceChannelId: config.channelId,
            playerCount: 25,
        }
    );

    assert.equal(result.status, 'mock_complete');
    assert.match(result.command, /^:h /);
    assert.match(result.command, /25/);

    config.enabled = previousEnabled;
    config.mockMode = previousMockMode;
});

test('unknown session events are ignored safely', async () => {
    const result = await announceSessionEvent(
        'not_a_real_event',
        { sourceChannelId: config.channelId }
    );

    assert.deepEqual(result, {
        status: 'skipped',
        reason: 'unknown_event',
    });
});
