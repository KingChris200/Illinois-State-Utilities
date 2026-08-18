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

const commands = [
    sessionFullCommand,
    sessionLowCommand,
];

test('legacy session announcements are server-only management commands', () => {
    for (const command of commands) {
        const data = command.data.toJSON();

        assert.equal(data.dm_permission, false);
        assert.equal(
            data.default_member_permissions,
            PermissionFlagsBits.ManageGuild.toString()
        );
    }
});

test('legacy session announcements reject unauthorized members at runtime', async () => {
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

test('legacy session announcements reject channels from another server', async () => {
    for (const command of commands) {
        let reply;

        await command.execute({
            inGuild: () => true,
            guildId: '111111111111111111',
            memberPermissions: {
                has: () => true,
            },
            options: {
                getInteger: () => null,
                getString: () => null,
                getRole: () => null,
                getChannel: () => ({
                    guildId: '222222222222222222',
                    isTextBased: () => true,
                }),
            },
            reply: async (payload) => {
                reply = payload;
            },
        });

        assert.equal(
            reply.flags,
            MessageFlags.Ephemeral
        );
        assert.match(reply.content, /belong to this server/);
    }
});
