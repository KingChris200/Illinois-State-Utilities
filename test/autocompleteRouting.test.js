const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const interactionEvent = require('../events/interactionCreate');
const infractionCommand = require('../commands/management/infraction');
const {
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');

test('central interaction handler routes autocomplete events', async () => {
    let routed = false;

    await interactionEvent.execute({
        isAutocomplete: () => true,
        commandName: 'example',
        client: {
            commands: new Map([
                [
                    'example',
                    {
                        autocomplete: async () => {
                            routed = true;
                        },
                    },
                ],
            ]),
        },
    });

    assert.equal(routed, true);
});

test('central interaction handler routes operations buttons', async () => {
    let reply;

    await interactionEvent.execute({
        isAutocomplete: () => false,
        isChatInputCommand: () => false,
        isButton: () => true,
        customId:
            'erlc_ops:overview:00000000-0000-0000-0000-000000000000',
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.ephemeral, true);
    assert.match(reply.content, /expired/);
});

test('central interaction handler routes player profile buttons', async () => {
    let reply;

    await interactionEvent.execute({
        isAutocomplete: () => false,
        isChatInputCommand: () => false,
        isButton: () => true,
        customId:
            'erlc_player:overview:00000000-0000-0000-0000-000000000000',
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.ephemeral, true);
    assert.match(reply.content, /expired/);
});

test('central interaction handler routes watchlist alert buttons', async () => {
    let reply;

    await interactionEvent.execute({
        isAutocomplete: () => false,
        isChatInputCommand: () => false,
        isModalSubmit: () => false,
        isButton: () => true,
        customId:
            'watchlist_alert:view:watch-example',
        guildId: 'unsupported-guild',
        guild: { ownerId: 'owner-id' },
        user: { id: 'member-id' },
        member: {
            permissions: { has: () => false },
            roles: { cache: { some: () => false } },
        },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /restricted/i);
});

test('central interaction handler routes watchlist alert forms', async () => {
    let reply;

    await interactionEvent.execute({
        isAutocomplete: () => false,
        isChatInputCommand: () => false,
        isModalSubmit: () => true,
        isButton: () => false,
        customId:
            'watchlist_alert_modal:resolve:watch-example',
        guildId: 'unsupported-guild',
        guild: { ownerId: 'owner-id' },
        user: { id: 'member-id' },
        member: {
            permissions: { has: () => false },
            roles: { cache: { some: () => false } },
        },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /restricted/i);
});

test('central interaction handler routes watchlist dashboard buttons', async () => {
    let reply;

    await interactionEvent.execute({
        isAutocomplete: () => false,
        isChatInputCommand: () => false,
        isModalSubmit: () => false,
        isButton: () => true,
        customId:
            'watchlist_dashboard:overview:00000000-0000-0000-0000-000000000000',
        user: { id: 'manager-id' },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /expired/i);
});

test('infraction rank option uses live autocomplete', async () => {
    const command = infractionCommand.data.toJSON();
    const rankOption = command.options.find(
        (option) => option.name === 'current-rank'
    );

    assert.equal(rankOption.autocomplete, true);

    let choices = null;

    await infractionCommand.autocomplete({
        inGuild: () => true,
        guildId: MAIN_SERVER_ID,
        options: {
            getFocused: () => ({
                name: 'current-rank',
                value: 'trial',
            }),
        },
        respond: async (response) => {
            choices = response;
        },
    });

    assert.ok(choices.length > 0);
    assert.equal(choices[0].value, 'Trial Moderator');
});
