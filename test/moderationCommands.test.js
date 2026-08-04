const test = require('node:test');
const assert = require('node:assert/strict');

const kickCommand = require('../prefixCommands/kick');
const respawnCommand = require('../prefixCommands/respawn');

function createMessage() {
    const replies = [];

    return {
        message: {
            author: '<@1234>',
            reply: async (payload) => replies.push(payload),
        },
        replies,
    };
}

test('kick creates a safe mock preview with a reason', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await kickCommand.execute({
        message,
        args: ['MockPlayer', 'Fail', 'roleplay'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    assert.equal(embed.title, 'Kick Preview');
    assert.match(embed.description, /nothing was sent/i);
    assert.match(
        embed.fields.find((field) => field.name === 'Reason').value,
        /Fail roleplay/
    );

    restoreMockMode(previousMockMode);
});

test('kick requires a reason', async () => {
    const { message, replies } = createMessage();

    await kickCommand.execute({
        message,
        args: ['MockPlayer'],
        config: { mockMode: true, dryRun: true },
    });

    assert.equal(replies[0], 'Usage: `?kick <player> <reason>`');
});

test('respawn supports safe player resolution', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await respawnCommand.execute({
        message,
        args: ['mock'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    assert.equal(embed.title, 'Respawn Preview');
    assert.match(
        embed.fields.find(
            (field) => field.name === 'In-Game Command'
        ).value,
        /:respawn MockPlayer/
    );

    restoreMockMode(previousMockMode);
});

test('live moderation remains locked before confirmations', async () => {
    const { message, replies } = createMessage();

    await kickCommand.execute({
        message,
        args: ['Someone', 'Test'],
        config: { mockMode: false, dryRun: false },
    });

    const embed = replies[0].embeds[0].toJSON();
    assert.equal(embed.title, 'Live Moderation Locked');
});

function restoreMockMode(previousMockMode) {
    if (previousMockMode === undefined) {
        delete process.env.ERLC_MOCK_MODE;
    } else {
        process.env.ERLC_MOCK_MODE = previousMockMode;
    }
}
