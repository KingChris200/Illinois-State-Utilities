const test = require('node:test');
const assert = require('node:assert/strict');
const {
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const sessionStatsCommand = require(
    '../commands/sessions/sessionstats'
);

const HISTORY = [
    {
        id: 'session-1',
        hostId: 'host-1',
        roleplayZone: 'Statewide',
        startingPlayerCount: 8,
        peakPlayerCount: 24,
        endingPlayerCount: 15,
        averagePlayerCount: 17.5,
        peakQueueCount: 3,
        attendeeCount: 12,
        attendanceDifference: 12,
        durationMilliseconds: 5400000,
        endedAt: '2026-08-04T12:00:00.000Z',
    },
];

test('sessionstats exposes private management report views', () => {
    const command = sessionStatsCommand.data.toJSON();

    assert.equal(command.name, 'sessionstats');
    assert.equal(command.options.length, 1);
    assert.equal(command.options[0].name, 'view');
    assert.deepEqual(
        command.options[0].choices.map(
            (choice) => choice.value
        ),
        ['summary', 'latest', 'records']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

test('sessionstats rejects users without management permission', async () => {
    let reply = null;

    await sessionStatsCommand.execute({
        inGuild: () => true,
        guild: {
            ownerId: 'owner',
        },
        user: {
            id: 'member',
        },
        memberPermissions: {
            has: () => false,
        },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /Manage Server/i);
});

test('sessionstats builds latest, summary, and records embeds', () => {
    const latest =
        sessionStatsCommand.createLatestSessionEmbed(
            HISTORY,
            null
        );
    const summary =
        sessionStatsCommand.createSummaryEmbed(
            HISTORY,
            null
        );
    const records =
        sessionStatsCommand.createRecordsEmbed(
            HISTORY,
            null
        );

    assert.match(latest.data.title, /Latest Session/i);
    assert.match(summary.data.title, /Statistics Summary/i);
    assert.match(records.data.title, /Session Records/i);
    assert.equal(
        latest.data.fields.find(
            (field) => field.name === 'Peak Players'
        ).value,
        '`24`'
    );
    assert.match(
        records.data.fields.find(
            (field) =>
                field.name.includes('Highest Player Peak')
        ).value,
        /24 players/
    );
});
