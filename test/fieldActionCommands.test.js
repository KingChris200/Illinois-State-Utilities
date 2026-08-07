const test = require('node:test');
const assert = require('node:assert/strict');

const healCommand = require('../prefixCommands/heal');
const warnCommand = require('../prefixCommands/warn');
const wantedCommand = require('../prefixCommands/wanted');
const unwantedCommand = require('../prefixCommands/unwanted');
const {
    handleModerationButton,
    removeConfirmation,
} = require('../utils/moderationConfirmationManager');

function createMessage() {
    const replies = [];
    const author = {
        id: 'field-staff-id',
        toString: () => '<@field-staff-id>',
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

function getConfirmation(reply) {
    const row = reply.components[0].toJSON();
    const button = row.components.find((component) =>
        component.custom_id.includes(':confirm:')
    );

    return {
        customId: button.custom_id,
        id: button.custom_id.split(':')[2],
        label: button.label,
    };
}

test('heal creates a confirmation without requiring a reason', async () => {
    const previousMockMode = enableMockMode();
    const { message, replies } = createMessage();

    await healCommand.execute({
        message,
        args: ['mock'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    const confirmation = getConfirmation(replies[0]);
    assert.equal(embed.title, 'Heal Confirmation');
    assert.equal(confirmation.label, 'Confirm Heal');
    assert.match(
        embed.fields.find(
            (field) => field.name === 'In-Game Command'
        ).value,
        /:heal MockPlayer/
    );

    removeConfirmation(confirmation.id);
    restoreMockMode(previousMockMode);
});

test('wanted and unwanted require reasons', async () => {
    for (const command of [wantedCommand, unwantedCommand]) {
        const { message, replies } = createMessage();

        await command.execute({
            message,
            args: ['MockPlayer'],
            config: { mockMode: true, dryRun: true },
        });

        assert.match(replies[0], /<reason>/);
    }
});

test('wanted completes through the shared mock confirmation flow', async () => {
    const previousMockMode = enableMockMode();
    const { message, replies } = createMessage();

    await wantedCommand.execute({
        message,
        args: ['MockPlayer', 'Evading', 'police'],
        config: { mockMode: true, dryRun: true },
    });

    const confirmation = getConfirmation(replies[0]);
    let editedReply;
    await handleModerationButton({
        customId: confirmation.customId,
        user: { id: 'field-staff-id' },
        deferUpdate: async () => null,
        editReply: async (payload) => {
            editedReply = payload;
        },
    });

    const embed = editedReply.embeds[0].toJSON();
    assert.equal(
        embed.title,
        'Wanted Mock Confirmation Complete'
    );
    assert.match(
        embed.fields.find((field) => field.name === 'Reason').value,
        /Evading police/
    );

    restoreMockMode(previousMockMode);
});

test('warn includes the reason in the confirmed ER:LC command', async () => {
    const previousMockMode = enableMockMode();
    const { message, replies } = createMessage();

    await warnCommand.execute({
        message,
        args: ['mock', 'Failing', 'roleplay'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    const confirmation = getConfirmation(replies[0]);
    assert.equal(embed.title, 'Warn Confirmation');
    assert.equal(confirmation.label, 'Confirm Warn');
    assert.equal(
        embed.fields.find(
            (field) => field.name === 'In-Game Command'
        ).value,
        '`:warn MockPlayer Failing roleplay`'
    );

    removeConfirmation(confirmation.id);
    restoreMockMode(previousMockMode);
});

test('unwanted builds the exact resolved player command', async () => {
    const previousMockMode = enableMockMode();
    const { message, replies } = createMessage();

    await unwantedCommand.execute({
        message,
        args: ['mock', 'Cleared', 'by', 'staff'],
        config: { mockMode: true, dryRun: true },
    });

    const embed = replies[0].embeds[0].toJSON();
    const confirmation = getConfirmation(replies[0]);
    assert.match(
        embed.fields.find(
            (field) => field.name === 'In-Game Command'
        ).value,
        /:unwanted MockPlayer/
    );

    removeConfirmation(confirmation.id);
    restoreMockMode(previousMockMode);
});

function enableMockMode() {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';
    return previousMockMode;
}

function restoreMockMode(previousMockMode) {
    if (previousMockMode === undefined) {
        delete process.env.ERLC_MOCK_MODE;
    } else {
        process.env.ERLC_MOCK_MODE = previousMockMode;
    }
}
