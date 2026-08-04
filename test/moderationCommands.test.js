const test = require('node:test');
const assert = require('node:assert/strict');

const kickCommand = require('../prefixCommands/kick');
const respawnCommand = require('../prefixCommands/respawn');
const banCommand = require('../prefixCommands/ban');
const unbanCommand = require('../prefixCommands/unban');
const {
    handleModerationButton,
    removeConfirmation,
} = require('../utils/moderationConfirmationManager');

function createMessage() {
    const replies = [];
    const author = {
        id: '1234',
        toString: () => '<@1234>',
    };

    return {
        message: {
            author,
            reply: async (payload) => {
                replies.push(payload);
                return {
                    edit: async () => null,
                };
            },
        },
        replies,
    };
}

function getButtonData(reply, choice = 'confirm') {
    const row = reply.components[0].toJSON();
    const button = row.components.find((component) =>
        component.custom_id.includes(`:${choice}:`)
    );
    const id = button.custom_id.split(':')[2];

    return {
        customId: button.custom_id,
        id,
    };
}

test('kick creates an executor confirmation with a reason', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await kickCommand.execute({
        message,
        args: ['MockPlayer', 'Fail', 'roleplay'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    const buttonData = getButtonData(replies[0]);
    assert.equal(embed.title, 'Kick Confirmation');
    assert.match(embed.description, /mock confirmation/i);
    assert.match(
        embed.fields.find((field) => field.name === 'Reason').value,
        /Fail roleplay/
    );
    assert.equal(replies[0].components[0].components.length, 2);

    removeConfirmation(buttonData.id);
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

test('confirmation buttons reject other users', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await respawnCommand.execute({
        message,
        args: ['mock'],
        config: { mockMode: true, dryRun: true },
    });

    const buttonData = getButtonData(replies[0]);
    let response;
    await handleModerationButton({
        customId: buttonData.customId,
        user: { id: 'someone-else' },
        reply: async (payload) => {
            response = payload;
        },
    });

    assert.equal(response.ephemeral, true);
    assert.match(response.content, /only the staff member/i);

    removeConfirmation(buttonData.id);
    restoreMockMode(previousMockMode);
});

test('confirm rechecks the player and completes in mock mode', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await respawnCommand.execute({
        message,
        args: ['mock'],
        config: { mockMode: true, dryRun: true },
    });

    const buttonData = getButtonData(replies[0]);
    let editedReply;
    await handleModerationButton({
        customId: buttonData.customId,
        user: { id: '1234' },
        deferUpdate: async () => null,
        editReply: async (payload) => {
            editedReply = payload;
        },
    });

    const embed = editedReply.embeds[0].toJSON();
    assert.equal(
        embed.title,
        'Respawn Mock Confirmation Complete'
    );
    assert.equal(editedReply.components.length, 0);

    restoreMockMode(previousMockMode);
});

test('cancel completes without executing a command', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await kickCommand.execute({
        message,
        args: ['MockPlayer', 'Testing'],
        config: { mockMode: true, dryRun: true },
    });

    const buttonData = getButtonData(replies[0], 'cancel');
    let update;
    await handleModerationButton({
        customId: buttonData.customId,
        user: { id: '1234' },
        update: async (payload) => {
            update = payload;
        },
    });

    assert.equal(
        update.embeds[0].toJSON().title,
        'Kick Cancelled'
    );
    assert.equal(update.components.length, 0);

    restoreMockMode(previousMockMode);
});

test('ban requires a reason and creates a confirmation', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await banCommand.execute({
        message,
        args: ['MockPlayer', 'Exploiting'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    const buttonData = getButtonData(replies[0]);
    assert.equal(embed.title, 'Ban Confirmation');
    assert.match(
        embed.fields.find((field) => field.name === 'Reason').value,
        /Exploiting/
    );

    removeConfirmation(buttonData.id);
    restoreMockMode(previousMockMode);
});

test('unban validates complete numeric Roblox IDs', async () => {
    const { message, replies } = createMessage();

    await unbanCommand.execute({
        message,
        args: ['not-an-id', 'Appeal', 'accepted'],
        config: { mockMode: true, dryRun: true },
    });

    assert.equal(
        replies[0],
        'Provide a complete numeric Roblox user ID.'
    );
});

test('unban confirms without requiring an online player', async () => {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    const { message, replies } = createMessage();

    await unbanCommand.execute({
        message,
        args: ['987654321', 'Appeal', 'accepted'],
        config: { mockMode: true, dryRun: true },
    });

    const buttonData = getButtonData(replies[0]);
    let editedReply;
    await handleModerationButton({
        customId: buttonData.customId,
        user: { id: '1234' },
        deferUpdate: async () => null,
        editReply: async (payload) => {
            editedReply = payload;
        },
    });

    const embed = editedReply.embeds[0].toJSON();
    assert.equal(
        embed.title,
        'Unban Mock Confirmation Complete'
    );
    assert.match(
        embed.fields.find((field) => field.name === 'Target').value,
        /987654321/
    );

    restoreMockMode(previousMockMode);
});

function restoreMockMode(previousMockMode) {
    if (previousMockMode === undefined) {
        delete process.env.ERLC_MOCK_MODE;
    } else {
        process.env.ERLC_MOCK_MODE = previousMockMode;
    }
}
