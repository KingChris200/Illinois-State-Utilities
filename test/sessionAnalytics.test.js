const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createSessionAnalytics,
    recordSessionSample,
    calculateAttendanceComparison,
    summarizeSessionAnalytics,
} = require('../utils/sessionAnalytics');
const {
    createSessionRecapEmbed,
} = require('../services/sessionAnalyticsService');

test('tracks rolling session player statistics without raw sample growth', () => {
    let analytics = createSessionAnalytics();

    analytics = recordSessionSample(analytics, {
        currentPlayers: 10,
        staffCount: 1,
        queueCount: 0,
        sampledAt: 1000,
    });
    analytics = recordSessionSample(analytics, {
        currentPlayers: 18,
        staffCount: 3,
        queueCount: 4,
        sampledAt: 2000,
    });
    analytics = recordSessionSample(analytics, {
        currentPlayers: 14,
        staffCount: 2,
        queueCount: 1,
        sampledAt: 3000,
    });

    assert.equal(analytics.startingPlayerCount, 10);
    assert.equal(analytics.peakPlayerCount, 18);
    assert.equal(analytics.endingPlayerCount, 14);
    assert.equal(analytics.minimumPlayerCount, 10);
    assert.equal(analytics.playerCountTotal, 42);
    assert.equal(analytics.sampleCount, 3);
    assert.equal(analytics.peakStaffCount, 3);
    assert.equal(analytics.peakQueueCount, 4);
});

test('calculates average population and attendance comparison', () => {
    let analytics = createSessionAnalytics();

    for (const playerCount of [10, 18, 14]) {
        analytics = recordSessionSample(analytics, {
            currentPlayers: playerCount,
        });
    }

    const summary = summarizeSessionAnalytics({
        startedAt: 1000,
        endedAt: 61000,
        attendeeIds: new Array(12).fill('member'),
        analytics,
    });

    assert.equal(summary.averagePlayerCountDisplay, 14);
    assert.equal(summary.durationMilliseconds, 60000);
    assert.deepEqual(
        summary.attendanceComparison,
        {
            confirmed: 12,
            peak: 18,
            difference: 6,
            label: 'Exceeded confirmations',
            summary:
                '**18** peak players vs **12** confirmed attendees (+6)',
        }
    );
});

test('reports unavailable attendance comparison without live samples', () => {
    const comparison =
        calculateAttendanceComparison(8, null);

    assert.equal(comparison.label, 'Unavailable');
    assert.equal(comparison.difference, null);
});

test('builds a branded completed-session recap embed', () => {
    let analytics = createSessionAnalytics();

    for (const playerCount of [8, 16, 12]) {
        analytics = recordSessionSample(analytics, {
            currentPlayers: playerCount,
            staffCount: 2,
            queueCount: 1,
        });
    }

    const embed = createSessionRecapEmbed({
        session: {
            startedAt: 1000,
            endedAt: 61000,
            attendeeIds: new Array(10).fill('member'),
            analytics,
        },
        endedAt: 61000,
        durationDisplay: '1 minute',
    });
    const fields = embed.data.fields;

    assert.equal(
        fields.find(
            (field) => field.name === 'Starting Players'
        ).value,
        '`8`'
    );
    assert.equal(
        fields.find(
            (field) => field.name === 'Peak Players'
        ).value,
        '`16`'
    );
    assert.equal(
        fields.find(
            (field) => field.name === 'Ending Players'
        ).value,
        '`12`'
    );
    assert.equal(
        fields.find(
            (field) => field.name === 'Average Players'
        ).value,
        '`12`'
    );
});
