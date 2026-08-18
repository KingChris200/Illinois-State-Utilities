const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const ssuCommand = require('../commands/sessions/ssu');
const sessionConfig = require('../config/sessionAutomation');
const sessionManager = require('../utils/sessionManager');

test('ssu exposes the complete vote and startup workflow', () => {
    const command = ssuCommand.data.toJSON();
    const optionNames = command.options.map(
        (option) => option.name
    );

    assert.equal(command.name, 'ssu');
    assert.deepEqual(optionNames, [
        'goal',
        'roleplay-zone',
        'notes',
        'duration',
    ]);
});

test('legacy svote command has been removed', () => {
    const svotePath = path.join(
        __dirname,
        '../commands/sessions/svote.js'
    );

    assert.equal(fs.existsSync(svotePath), false);
});

test('ssu refuses to start outside the sessions channel', async () => {
    let reply = null;

    await ssuCommand.execute({
        inGuild: () => true,
        channelId: 'wrong-channel',
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(
        reply.flags,
        MessageFlags.Ephemeral
    );
    assert.match(
        reply.content,
        new RegExp(sessionConfig.channelId)
    );
});

test('session details persist from vote through shutdown', () => {
    sessionManager.resetAll();

    const vote = sessionManager.createVote({
        guildId: 'guild',
        channelId: 'channel',
        messageId: 'message',
        hostId: 'host',
        hostUsername: 'Host',
        goal: 10,
        endsAt: Date.now() + 60_000,
        roleplayZone: 'Springfield',
        notes: 'Use realistic liveries.',
    });

    const session = sessionManager.startSession({
        ...vote,
        startupMessageId: 'startup-message',
        attendeeIds: ['member'],
    });
    sessionManager.clearVote();

    sessionManager.updateSessionPlayerCount({
        guildId: 'guild',
        messageId: 'startup-message',
        currentPlayers: 8,
        maxPlayers: 40,
    });
    sessionManager.updateSessionPlayerCount({
        guildId: 'guild',
        messageId: 'startup-message',
        currentPlayers: 15,
        maxPlayers: 40,
    });

    assert.equal(session.roleplayZone, 'Springfield');
    assert.equal(session.notes, 'Use realistic liveries.');

    const endedSession = sessionManager.endSession();
    assert.equal(endedSession.roleplayZone, 'Springfield');
    assert.equal(
        endedSession.notes,
        'Use realistic liveries.'
    );
    assert.equal(
        endedSession.analytics.startingPlayerCount,
        8
    );
    assert.equal(
        endedSession.analytics.peakPlayerCount,
        15
    );

    sessionManager.resetAll();
});
