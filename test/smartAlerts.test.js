const test = require('node:test');
const assert = require('node:assert/strict');

const { getSmartAlertConfig } = require('../config/smartAlerts');
const alertsCommand = require('../prefixCommands/alerts');
const {
    calculateRateLimitDelay,
    createDefaultAlertState,
    createMockAlertEvents,
    createSmartAlertEmbeds,
    evaluateSmartAlerts,
    sendSmartAlerts,
} = require('../services/erlcSmartAlertMonitor');

const config = {
    enabled: true,
    channelId: '123456789012345678',
    roleId: '234567890123456789',
    intervalMs: 60_000,
    modCallDelaySeconds: 60,
    queueThreshold: 3,
    killThreshold: 3,
    killWindowSeconds: 120,
    cooldownSeconds: 300,
};

test('smart-alert configuration validates IDs and safe intervals', () => {
    const parsed = getSmartAlertConfig({
        ERLC_SMART_ALERTS_ENABLED: 'true',
        ERLC_SMART_ALERT_CHANNEL_ID: '123456789012345678',
        ERLC_SMART_ALERT_ROLE_ID: 'invalid',
        ERLC_SMART_ALERT_INTERVAL_MS: '1000',
        ERLC_QUEUE_ALERT_THRESHOLD: '100',
    });

    assert.equal(parsed.enabled, true);
    assert.equal(parsed.channelId, '123456789012345678');
    assert.equal(parsed.roleId, null);
    assert.equal(parsed.intervalMs, 30_000);
    assert.equal(parsed.queueThreshold, 40);
});

test('first smart-alert check establishes a quiet baseline', () => {
    const now = 2_000_000_000_000;
    const result = evaluateSmartAlerts(
        {
            ModCalls: [unansweredCall(now, 'BaselinePlayer:1')],
            Queue: [1, 2, 3],
            KillLogs: killLogs(now, 3),
        },
        createDefaultAlertState(),
        config,
        now
    );

    assert.deepEqual(result.alerts, []);
    assert.equal(result.state.initialized, true);
    assert.equal(result.state.queueAlertActive, true);
    assert.equal(result.state.killAlertActive, true);
    assert.equal(result.state.trackedModCalls[0].notified, true);
});

test('new unanswered moderator calls alert exactly once', () => {
    const now = 2_000_000_000_000;
    const baseline = evaluateSmartAlerts(
        { ModCalls: [], Queue: [], KillLogs: [] },
        createDefaultAlertState(),
        config,
        now
    );
    const snapshot = {
        ModCalls: [unansweredCall(now, 'NewCaller:2')],
        Queue: [],
        KillLogs: [],
    };
    const first = evaluateSmartAlerts(
        snapshot,
        baseline.state,
        config,
        now + 61_000
    );
    const second = evaluateSmartAlerts(
        snapshot,
        first.state,
        config,
        now + 122_000
    );

    assert.equal(first.alerts[0].type, 'mod_calls');
    assert.equal(second.alerts.length, 0);
});

test('queue alerts reset only after the surge has cleared', () => {
    const now = 2_000_000_000_000;
    const baseline = evaluateSmartAlerts(
        { ModCalls: [], Queue: [], KillLogs: [] },
        createDefaultAlertState(),
        config,
        now
    );
    const surge = evaluateSmartAlerts(
        { ModCalls: [], Queue: [1, 2, 3], KillLogs: [] },
        baseline.state,
        config,
        now + 1000
    );
    const duplicate = evaluateSmartAlerts(
        { ModCalls: [], Queue: [1, 2, 3, 4], KillLogs: [] },
        surge.state,
        config,
        now + 10_000
    );
    const cleared = evaluateSmartAlerts(
        { ModCalls: [], Queue: [], KillLogs: [] },
        duplicate.state,
        config,
        now + 20_000
    );
    const repeated = evaluateSmartAlerts(
        { ModCalls: [], Queue: [1, 2, 3], KillLogs: [] },
        cleared.state,
        config,
        now + 301_000
    );

    assert.equal(surge.alerts[0].type, 'queue_surge');
    assert.equal(duplicate.alerts.length, 0);
    assert.equal(repeated.alerts[0].type, 'queue_surge');
});

test('kill spikes count unique recent records and deduplicate alerts', () => {
    const now = 2_000_000_000_000;
    const baseline = evaluateSmartAlerts(
        { ModCalls: [], Queue: [], KillLogs: [] },
        createDefaultAlertState(),
        config,
        now
    );
    const logs = killLogs(now + 1000, 3);
    logs.push({ ...logs[0] });
    const spike = evaluateSmartAlerts(
        { ModCalls: [], Queue: [], KillLogs: logs },
        baseline.state,
        config,
        now + 1000
    );
    const duplicate = evaluateSmartAlerts(
        { ModCalls: [], Queue: [], KillLogs: logs },
        spike.state,
        config,
        now + 2000
    );

    assert.equal(spike.alerts[0].type, 'kill_spike');
    assert.equal(spike.alerts[0].count, 3);
    assert.equal(duplicate.alerts.length, 0);
});

test('rate-limit reset time can extend the next poll delay', () => {
    const now = 2_000_000_000_000;
    assert.equal(
        calculateRateLimitDelay(
            30_000,
            {
                remaining: 1,
                resetAt: now + 45_000,
            },
            now
        ),
        46_000
    );
});

test('smart-alert preview creates all three branded alerts', async () => {
    const embeds = createSmartAlertEmbeds(
        createMockAlertEvents(config)
    );
    const replies = [];

    assert.equal(embeds.length, 3);
    assert.match(embeds[0].toJSON().title, /Moderator Call/);
    assert.match(embeds[1].toJSON().title, /Queue Surge/);
    assert.match(embeds[2].toJSON().title, /Kill Activity/);

    await alertsCommand.execute({
        message: {
            reply: async (payload) => replies.push(payload),
        },
        args: ['test'],
        config: { mockMode: true },
    });
    assert.equal(replies[0].embeds.length, 3);
    assert.deepEqual(replies[0].allowedMentions, { parse: [] });
});

test('real smart-alert delivery restricts the configured role mention', async () => {
    let sent;
    const client = {
        channels: {
            fetch: async () => ({
                isTextBased: () => true,
                send: async (payload) => {
                    sent = payload;
                },
            }),
        },
    };

    await sendSmartAlerts(
        client,
        [createMockAlertEvents(config)[1]],
        config
    );

    assert.deepEqual(sent.allowedMentions, {
        parse: [],
        roles: ['234567890123456789'],
    });
    assert.match(sent.content, /234567890123456789/);
});

function unansweredCall(now, player) {
    return {
        Caller: player,
        Moderator: null,
        Timestamp: Math.floor((now - 70_000) / 1000),
    };
}

function killLogs(now, count) {
    return Array.from({ length: count }, (_, index) => ({
        Killer: `Killer${index}:1${index}`,
        Killed: `Victim${index}:2${index}`,
        Timestamp: Math.floor((now - index * 10_000) / 1000),
    }));
}
