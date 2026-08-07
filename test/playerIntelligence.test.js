const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PLAYER_PANEL_TTL_MS,
    buildPlayerView,
    createPlayerButtons,
    createPlayerIntelligencePanel,
    handlePlayerIntelligenceButton,
    removePlayerPanel,
} = require('../utils/playerIntelligenceManager');
const {
    collectPlayerActivity,
    createPlayerIndicators,
    findOnlinePlayer,
    formatSafeLocation,
    identityMatches,
} = require('../utils/playerIntelligenceUtils');

const config = {
    mockMode: true,
    dryRun: true,
};

test('player intelligence helpers match exact ER:LC identities', () => {
    const target = {
        username: 'MockPlayer',
        userId: '123456789',
    };

    assert.equal(
        identityMatches('DifferentName:123456789', target),
        true
    );
    assert.equal(
        identityMatches('MockPlayer:999999999', target),
        false
    );
    assert.equal(
        findOnlinePlayer(
            [
                {
                    Player: 'MockPlayer:123456789',
                    Permission: 'Normal',
                },
            ],
            target
        ).username,
        'MockPlayer'
    );
});

test('safe player locations never expose raw map coordinates', () => {
    const location = formatSafeLocation({
        BuildingNumber: '104',
        StreetName: 'Freedom Avenue',
        PostalCode: '205',
        LocationX: 123.45,
        LocationZ: 678.9,
    });

    assert.match(location, /104 Freedom Avenue/);
    assert.match(location, /205/);
    assert.doesNotMatch(location, /123\.45|678\.9/);
});

test('player observations remain factual and session-based', () => {
    const now = 2_000_000_000_000;
    const target = {
        username: 'MockPlayer',
        userId: '123456789',
    };
    const onlinePlayer = {
        username: target.username,
        userId: target.userId,
        permission: 'Server Administrator',
        raw: {
            WantedStars: 2,
        },
    };
    const snapshot = {
        JoinLogs: [],
        KillLogs: Array.from({ length: 3 }, (_, index) => ({
            Killer: 'MockPlayer:123456789',
            Killed: `Other${index}:${index + 1}`,
            Timestamp: Math.floor(
                (now - index * 10_000) / 1000
            ),
        })),
        ModCalls: [
            {
                Caller: 'MockPlayer:123456789',
                Moderator: null,
            },
        ],
        Vehicles: [],
    };
    const activity = collectPlayerActivity(
        snapshot,
        target,
        now
    );
    const indicators = createPlayerIndicators({
        onlinePlayer,
        activity,
    }).join('\n');

    assert.match(indicators, /Currently wanted/);
    assert.match(indicators, /3 eliminations/);
    assert.match(indicators, /unanswered moderator call/);
    assert.match(indicators, /Server Administrator/);
    assert.doesNotMatch(indicators, /guilty|punish|risk score/i);
});

test('player profile opens with five protected controls', async () => {
    await withMockMode(async () => {
        const panel = await createPlayerIntelligencePanel({
            query: 'MockPlayer',
            executorId: 'staff-id',
            executorMention: '<@staff-id>',
            config,
        });
        const embed = panel.embed.toJSON();
        const buttons = panel.components.toJSON().components;

        assert.match(embed.title, /MockPlayer/);
        assert.equal(buttons.length, 5);
        assert.equal(
            embed.fields.find(
                (field) => field.name === 'Status'
            ).value,
            '🟢 Online'
        );
        assert.doesNotMatch(
            JSON.stringify(embed),
            /LocationX|LocationZ|123\.45|678\.9/
        );

        removePlayerPanel(panel.id);
    });
});

test('player controls reject users other than the requester', async () => {
    await withMockMode(async () => {
        const panel = await createPlayerIntelligencePanel({
            query: '123456789',
            executorId: 'staff-id',
            executorMention: '<@staff-id>',
            config,
        });
        const activityButton = findButton(
            panel.components,
            ':activity:'
        );
        let reply;

        await handlePlayerIntelligenceButton({
            customId: activityButton.custom_id,
            user: { id: 'other-user' },
            reply: async (payload) => {
                reply = payload;
            },
        });

        assert.equal(reply.ephemeral, true);
        assert.match(reply.content, /Only the staff member/);
        removePlayerPanel(panel.id);
    });
});

test('player controls switch between every intelligence view', async () => {
    await withMockMode(async () => {
        const panel = await createPlayerIntelligencePanel({
            query: 'MockPlayer',
            executorId: 'staff-id',
            executorMention: '<@staff-id>',
            config,
        });

        for (const [view, title] of [
            ['activity', 'Activity'],
            ['vehicles', 'Vehicles'],
            ['calls', 'Mod Calls'],
        ]) {
            const button = findButton(
                createPlayerButtons(panel.id, 'overview'),
                `:${view}:`
            );
            let edited;

            await handlePlayerIntelligenceButton({
                customId: button.custom_id,
                user: { id: 'staff-id' },
                deferUpdate: async () => null,
                editReply: async (payload) => {
                    edited = payload;
                },
            });

            assert.match(
                edited.embeds[0].toJSON().title,
                new RegExp(title)
            );
        }

        removePlayerPanel(panel.id);
    });
});

test('refreshed player profiles preserve context after disconnect', async () => {
    const panel = {
        target: {
            username: 'MockPlayer',
            userId: '123456789',
        },
        executorMention: '<@staff-id>',
        expiresAt: Date.now() + PLAYER_PANEL_TTL_MS,
    };
    const embed = await buildPlayerView(
        panel,
        'overview',
        {
            Players: [],
            JoinLogs: [
                {
                    Join: false,
                    Player: 'MockPlayer:123456789',
                    Timestamp: 2_000_000_000,
                },
            ],
            KillLogs: [],
            ModCalls: [],
            Vehicles: [],
        }
    );

    assert.equal(
        embed
            .toJSON()
            .fields.find((field) => field.name === 'Status')
            .value,
        '⚪ Offline'
    );
    assert.match(embed.toJSON().description, /no longer visible/);
});

test('expired player controls can all be disabled', () => {
    const row = createPlayerButtons(
        '00000000-0000-0000-0000-000000000000',
        'overview',
        true
    ).toJSON();

    assert.equal(
        row.components.every((button) => button.disabled),
        true
    );
});

function findButton(row, pattern) {
    return row
        .toJSON()
        .components.find((button) =>
            button.custom_id.includes(pattern)
        );
}

async function withMockMode(callback) {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';

    try {
        await callback();
    } finally {
        if (previousMockMode === undefined) {
            delete process.env.ERLC_MOCK_MODE;
        } else {
            process.env.ERLC_MOCK_MODE = previousMockMode;
        }
    }
}
