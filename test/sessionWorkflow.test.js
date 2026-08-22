const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ssuCommand = require('../commands/sessions/ssu');
const sessionConfig = require('../config/sessionAutomation');
const sessionManager = require('../utils/sessionManager');

test('ssu starts the automatic vote workflow without command options', () => {
    const command = ssuCommand.data.toJSON();

    assert.equal(command.name, 'ssu');
    assert.deepEqual(command.options || [], []);
    assert.equal(sessionConfig.voteGoal, 10);
    assert.equal(sessionConfig.voteDurationMinutes, 5);
    assert.equal(sessionConfig.pingRoleId, '1377126063926411334');
});

test('legacy svote command has been removed', () => {
    const svotePath = path.join(
        __dirname,
        '../commands/sessions/svote.js'
    );

    assert.equal(fs.existsSync(svotePath), false);
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
