const test = require('node:test');
const assert = require('node:assert/strict');

const {
    Events,
    MessageFlags,
} = require('discord.js');

const {
    executeEvent,
} = require('../handlers/eventHandler');

test('event failures are contained and interaction users receive a private error', async () => {
    let reply;
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        await executeEvent(
            {
                name: Events.InteractionCreate,
                execute: async () => {
                    throw new Error('test failure');
                },
            },
            'test-event.js',
            [
                {
                    replied: false,
                    deferred: false,
                    reply: async (payload) => {
                        reply = payload;
                    },
                },
            ],
            {}
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(
        reply.flags,
        MessageFlags.Ephemeral
    );
    assert.match(reply.content, /something went wrong/i);
    assert.match(reply.content, /ERR-[A-F0-9]{8}/);
});

test('event failures follow up safely after an interaction was deferred', async () => {
    let followUp;
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        await executeEvent(
            {
                name: Events.InteractionCreate,
                execute: async () => {
                    throw new Error('test failure');
                },
            },
            'test-event.js',
            [
                {
                    replied: false,
                    deferred: true,
                    followUp: async (payload) => {
                        followUp = payload;
                    },
                },
            ],
            {}
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(
        followUp.flags,
        MessageFlags.Ephemeral
    );
});
