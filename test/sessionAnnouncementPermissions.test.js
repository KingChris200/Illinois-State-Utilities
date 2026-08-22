const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const sessionFullCommand = require(
    '../commands/sessions/sessionfull'
);
const sessionLowCommand = require(
    '../commands/sessions/sessionlow'
);
const sessionConfig = require('../config/sessionAutomation');
const sessionManager = require('../utils/sessionManager');
const {
    executeSessionAnnouncement,
} = require('../utils/sessionAnnouncementManager');

const commands = [
    sessionFullCommand,
    sessionLowCommand,
];

test('automatic session announcements are option-free management commands', () => {
    for (const command of commands) {
        const data = command.data.toJSON();

        assert.equal(data.dm_permission, false);
        assert.equal(
            data.default_member_permissions,
            PermissionFlagsBits.ManageGuild.toString()
        );
        assert.deepEqual(data.options || [], []);
    }
});

test('automatic session announcements reject unauthorized members at runtime', async () => {
    for (const command of commands) {
        let reply;

        await command.execute({
            inGuild: () => true,
            memberPermissions: {
                has: () => false,
            },
            reply: async (payload) => {
                reply = payload;
            },
        });

        assert.equal(
            reply.flags,
            MessageFlags.Ephemeral
        );
        assert.match(reply.content, /Manage Server/);
    }
});

test('session updates detect player count, channel, and ping automatically', async () => {
    sessionManager.resetAll();
    sessionManager.startSession({
        guildId: '111111111111111111',
        channelId: sessionConfig.channelId,
        hostId: '111111111111111112',
        hostUsername: 'Host',
        startupMessageId: '111111111111111113',
    });

    let sentPayload;
    let reply;
    const destination = {
        id: sessionConfig.channelId,
        toString: () => `<#${sessionConfig.channelId}>`,
        send: async (payload) => {
            sentPayload = payload;
            return { url: 'https://discord.test/session-update' };
        },
    };

    await executeSessionAnnouncement(
        {
            inGuild: () => true,
            guildId: '111111111111111111',
            memberPermissions: { has: () => true },
            user: { username: 'Manager' },
            deferReply: async () => {},
            editReply: async (payload) => {
                reply = payload;
            },
        },
        'low',
        {
            fetchChannel: async () => destination,
            fetchStatus: async () => ({
                CurrentPlayers: 12,
                MaxPlayers: 40,
                Staff: {},
                Queue: [],
            }),
        }
    );

    assert.equal(sentPayload.content, `<@&${sessionConfig.pingRoleId}>`);
    assert.deepEqual(sentPayload.allowedMentions.roles, [
        sessionConfig.pingRoleId,
    ]);
    assert.match(
        sentPayload.embeds[0].data.description,
        /12\/40/
    );
    assert.match(reply, /Player notice posted/);
    sessionManager.resetAll();
});
