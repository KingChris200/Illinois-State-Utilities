const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAuditEmbed,
    formatSafeError,
} = require('../utils/moderationAuditLogger');

const pending = {
    id: 'audit-request-id',
    action: 'ban',
    command: ':ban MockPlayer',
    player: {
        username: 'MockPlayer',
        userId: '123456789',
    },
    executorId: '987654321',
    executorMention: '<@987654321>',
    reason: 'Exploiting',
    mockMode: true,
    dryRun: true,
    channelId: '111222333',
};

test('builds a complete moderation audit embed', () => {
    const embed = buildAuditEmbed(
        pending,
        'mock_complete'
    ).toJSON();

    assert.equal(embed.title, 'Ban Audit — Mock Completed');
    assert.match(
        embed.fields.find((field) => field.name === 'Target').value,
        /123456789/
    );
    assert.equal(
        embed.fields.find((field) => field.name === 'Mode').value,
        'Mock'
    );
    assert.equal(
        embed.fields.find((field) => field.name === 'Reason').value,
        'Exploiting'
    );
});

test('formats API failures without exposing response secrets', () => {
    const message = formatSafeError({
        code: 'API_REQUEST_FAILED',
        status: 403,
        message: 'Sensitive upstream response',
    });

    assert.equal(
        message,
        'ER:LC request failed with HTTP 403.'
    );
    assert.doesNotMatch(message, /Sensitive/);
});

test('uses a generic message for unknown failures', () => {
    assert.equal(
        formatSafeError(new Error('Sensitive internal detail')),
        'Internal moderation safety check failed.'
    );
});
