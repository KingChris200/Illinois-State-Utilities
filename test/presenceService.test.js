const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ActivityType,
} = require('discord.js');

const {
    PRESENCE_INTERVAL_MS,
    PRESENCE_STATUSES,
} = require('../config/presence');
const {
    startPresenceRotation,
} = require('../services/presenceService');

test('presence configuration contains safe rotating activities', () => {
    assert.ok(PRESENCE_INTERVAL_MS >= 30_000);
    assert.ok(PRESENCE_STATUSES.length >= 3);

    for (const status of PRESENCE_STATUSES) {
        assert.ok(status.name.trim().length > 0);
        assert.ok(
            [
                ActivityType.Playing,
                ActivityType.Watching,
            ].includes(status.type)
        );
    }
});

test('presence rotation starts immediately and cycles predictably', () => {
    const updates = [];
    const statuses = [
        {
            name: 'First status',
            type: ActivityType.Playing,
        },
        {
            name: 'Second status',
            type: ActivityType.Watching,
        },
    ];
    const controller = startPresenceRotation(
        {
            user: {
                setPresence: (payload) => {
                    updates.push(payload);
                },
            },
        },
        {
            statuses,
            intervalMs: 60_000,
        }
    );

    controller.updatePresence();
    controller.updatePresence();
    controller.stop();

    assert.deepEqual(
        updates.map(
            (update) => update.activities[0].name
        ),
        [
            'First status',
            'Second status',
            'First status',
        ]
    );
    assert.ok(
        updates.every(
            (update) => update.status === 'online'
        )
    );
});

test('presence rotation rejects invalid clients and empty status lists', () => {
    assert.throws(
        () => startPresenceRotation({}),
        /connected Discord client/
    );
    assert.throws(
        () =>
            startPresenceRotation(
                { user: { setPresence() {} } },
                { statuses: [] }
            ),
        /At least one presence status/
    );
});
