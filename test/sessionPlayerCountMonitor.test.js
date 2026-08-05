const test = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder } = require('discord.js');

const sessionManager = require('../utils/sessionManager');
const {
    MINIMUM_REFRESH_MS,
    parsePlayerCount,
    refreshPlayerCountMessage,
} = require('../services/sessionPlayerCountMonitor');

test('parses live ER:LC server player totals', () => {
    assert.deepEqual(
        parsePlayerCount({
            CurrentPlayers: 18,
            MaxPlayers: 40,
        }),
        {
            currentPlayers: 18,
            maxPlayers: 40,
        }
    );
});

test('updates the active session startup embed and state', async () => {
    sessionManager.resetAll();
    sessionManager.startSession({
        guildId: 'guild',
        channelId: 'channel',
        hostId: 'host',
        startupMessageId: 'message',
    });

    let editedPayload = null;
    const originalEmbed = new EmbedBuilder()
        .setTitle('Server Startup')
        .addFields({
            name: 'Status',
            value: 'Online',
        });
    const message = {
        embeds: [originalEmbed],
        edit: async (payload) => {
            editedPayload = payload;
        },
    };
    const channel = {
        isTextBased: () => true,
        messages: {
            fetch: async () => message,
        },
    };
    const client = {
        channels: {
            fetch: async () => channel,
        },
    };

    const result = await refreshPlayerCountMessage({
        client,
        guildId: 'guild',
        channelId: 'channel',
        messageId: 'message',
        fetchServer: async () => ({
            CurrentPlayers: 12,
            MaxPlayers: 40,
        }),
        persistState: false,
    });

    assert.equal(result.currentPlayers, 12);
    const fields = editedPayload.embeds[0].data.fields;
    assert.match(
        fields.find(
            (field) =>
                field.name === '🎮 Live Player Count'
        ).value,
        /12 \/ 40/
    );
    assert.equal(
        sessionManager.getSession().livePlayerCount,
        12
    );

    sessionManager.resetAll();
});

test('live refresh interval cannot be configured below the safe minimum', () => {
    const previousValue =
        process.env.SESSION_PLAYERCOUNT_INTERVAL_MS;
    process.env.SESSION_PLAYERCOUNT_INTERVAL_MS = '1000';

    delete require.cache[
        require.resolve(
            '../services/sessionPlayerCountMonitor'
        )
    ];
    const reloadedMonitor = require(
        '../services/sessionPlayerCountMonitor'
    );

    assert.equal(
        reloadedMonitor.getRefreshInterval(),
        MINIMUM_REFRESH_MS
    );

    if (previousValue === undefined) {
        delete process.env
            .SESSION_PLAYERCOUNT_INTERVAL_MS;
    } else {
        process.env.SESSION_PLAYERCOUNT_INTERVAL_MS =
            previousValue;
    }
});
