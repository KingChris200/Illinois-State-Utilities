const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const sessionCommand = require('../commands/sessions/session');
const sessionManager = require('../utils/sessionManager');
const {
    createSessionControlPayload,
    handleSessionControlInteraction,
    parseSessionControlId,
} = require('../utils/sessionControlManager');

const USER_ID = '111111111111111111';

test('/session manage is one private management panel', () => {
    const command = sessionCommand.data.toJSON();

    assert.equal(command.name, 'session');
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
    assert.equal(command.dm_permission, false);
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['manage']
    );
});

test('session panel keeps five simple controls in sync with session state', () => {
    sessionManager.resetAll();

    const idle = createSessionControlPayload(USER_ID);
    const idleButtons = idle.components[0].toJSON().components;

    assert.equal(idle.flags, MessageFlags.Ephemeral);
    assert.deepEqual(
        idleButtons.map((button) => button.label),
        [
            'Start Vote',
            'Players Needed',
            'Session Full',
            'End Session',
            'Refresh',
        ]
    );
    assert.equal(idleButtons[0].disabled, false);
    assert.equal(idleButtons[1].disabled, true);
    assert.equal(idleButtons[3].disabled, true);

    sessionManager.startSession({
        guildId: 'guild',
        channelId: 'channel',
        hostId: USER_ID,
        hostUsername: 'Host',
        startupMessageId: 'message',
        livePlayerCount: 14,
        maxPlayerCount: 40,
    });

    const liveButtons = createSessionControlPayload(USER_ID)
        .components[0]
        .toJSON().components;

    assert.equal(liveButtons[0].disabled, true);
    assert.equal(liveButtons[1].disabled, false);
    assert.equal(liveButtons[2].disabled, false);
    assert.equal(liveButtons[3].disabled, false);
    sessionManager.resetAll();
});

test('session controls are locked to the panel creator', async () => {
    let reply;

    await handleSessionControlInteraction({
        customId: `session_control:refresh:${USER_ID}`,
        user: { id: '222222222222222222' },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /another user/i);
    assert.deepEqual(
        parseSessionControlId(`session_control:start:${USER_ID}`),
        { action: 'start', userId: USER_ID }
    );
    assert.equal(parseSessionControlId('session_control:bad'), null);
});
