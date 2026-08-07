const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getWatchlistAlertConfig,
} = require('../config/watchlistAlerts');
const {
    createDefaultWatchlistAlertState,
    createWatchlistAlertEmbeds,
    evaluateWatchlistMatches,
    normalizeWatchlistAlertState,
    sendWatchlistAlerts,
} = require('../services/watchlistAlertMonitor');

function watchlistMatch(overrides = {}) {
    return {
        record: {
            id: 'watch-example',
            robloxUserId: '123456789',
            robloxUsername: 'MockPlayer',
            severity: 'high',
            status: 'active',
            reason: 'Verified internal review context.',
            ...overrides.record,
        },
        player: {
            username: 'MockPlayer',
            userId: '123456789',
            permission: 'Server Administrator',
            ...overrides.player,
        },
        matchedBy: overrides.matchedBy || 'user_id',
    };
}

test('watchlist alert configuration validates channel IDs and safe intervals', () => {
    const config = getWatchlistAlertConfig({
        WATCHLIST_ALERTS_ENABLED: 'true',
        WATCHLIST_ALERT_CHANNEL_ID: '123456789012345678',
        WATCHLIST_ALERT_INTERVAL_MS: '1000',
    });

    assert.equal(config.enabled, true);
    assert.equal(config.channelId, '123456789012345678');
    assert.equal(config.intervalMs, 30_000);
});

test('watchlist alert state rejects malformed persisted keys', () => {
    const state = normalizeWatchlistAlertState({
        activeMatchKeys: [
            'watch-example:123456789',
            'watch-example:123456789',
            123,
            'x',
        ],
        lastPollAt: 'invalid',
    });

    assert.deepEqual(state.activeMatchKeys, [
        'watch-example:123456789',
    ]);
    assert.equal(state.lastPollAt, 0);
});

test('automatic matching alerts once until a player leaves and rejoins', () => {
    const match = watchlistMatch();
    const first = evaluateWatchlistMatches(
        [match],
        createDefaultWatchlistAlertState(),
        1000
    );
    const duplicate = evaluateWatchlistMatches(
        [match],
        first.state,
        2000
    );
    const left = evaluateWatchlistMatches(
        [],
        duplicate.state,
        3000
    );
    const rejoined = evaluateWatchlistMatches(
        [match],
        left.state,
        4000
    );

    assert.equal(first.alerts.length, 1);
    assert.equal(duplicate.alerts.length, 0);
    assert.equal(left.state.activeMatchKeys.length, 0);
    assert.equal(rejoined.alerts.length, 1);
});

test('automatic watchlist embeds show verified private context', () => {
    const embed = createWatchlistAlertEmbeds([
        watchlistMatch(),
    ])[0].toJSON();

    assert.match(embed.title, /Private Watchlist Alert/);
    assert.match(embed.description, /exactly matches/i);
    assert.match(embed.fields[0].value, /exact Roblox ID/i);
    assert.match(embed.footer.text, /No public ping sent/i);
});

test('automatic watchlist delivery cannot create Discord mentions', async () => {
    let sent;
    const channel = {
        id: '123456789012345678',
        isTextBased: () => true,
        send: async (payload) => {
            sent = payload;
        },
    };

    await sendWatchlistAlerts(channel, [watchlistMatch()]);

    assert.equal(sent.content, null);
    assert.deepEqual(sent.allowedMentions, { parse: [] });
    assert.equal(sent.embeds.length, 1);
    assert.equal(sent.components.length, 2);
});
