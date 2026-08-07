const test = require('node:test');
const assert = require('node:assert/strict');
const { Events } = require('discord.js');

const welcomeEvent = require(
    '../events/guildMemberAdd'
);
const {
    DEFAULT_WELCOME_CHANNEL_ID,
    getWelcomeConfig,
} = require('../config/welcome');

function createMember({ bot = false } = {}) {
    const sent = [];
    const channel = {
        isTextBased: () => true,
        send: async (payload) => sent.push(payload),
    };
    const member = {
        id: '123456789012345678',
        user: { bot },
        guild: {
            name: 'Illinois State Roleplay | Strict',
            memberCount: 401,
            iconURL: () =>
                'https://cdn.discordapp.com/icons/1/logo.png',
            channels: {
                fetch: async (channelId) => {
                    assert.equal(
                        channelId,
                        DEFAULT_WELCOME_CHANNEL_ID
                    );
                    return channel;
                },
            },
        },
    };

    return { member, sent };
}

test('welcome channel defaults to the supplied server channel', () => {
    assert.equal(
        getWelcomeConfig({}).channelId,
        '1490733409037975654'
    );
    assert.equal(
        getWelcomeConfig({
            WELCOME_CHANNEL_ID:
                '123456789012345678',
        }).channelId,
        '123456789012345678'
    );
});

test('guild member event posts a safe branded welcome', async () => {
    const { member, sent } = createMember();

    assert.equal(
        welcomeEvent.name,
        Events.GuildMemberAdd
    );

    await welcomeEvent.execute(member);

    assert.equal(sent.length, 1);
    assert.equal(sent[0].embeds.length, 2);
    assert.equal(sent[0].files.length, 1);
    assert.equal(
        sent[0].files[0].name,
        'welcome-banner.png'
    );
    assert.equal(
        sent[0].embeds[0].toJSON().image.url,
        'attachment://welcome-banner.png'
    );

    const details = sent[0].embeds[1].toJSON();
    assert.match(details.title, /Welcome to Illinois State Roleplay/i);
    assert.match(details.description, /#401 member/);
    assert.match(details.description, /<@123456789012345678>/);
    assert.deepEqual(sent[0].allowedMentions, {
        parse: [],
        users: ['123456789012345678'],
        roles: [],
    });
});

test('welcome system ignores bot accounts', async () => {
    const { member, sent } = createMember({
        bot: true,
    });

    await welcomeEvent.execute(member);

    assert.equal(sent.length, 0);
});
