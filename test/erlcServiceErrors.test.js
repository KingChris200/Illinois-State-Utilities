const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createApiErrorFromResponse,
    getPublicErrorMessage,
} = require('../services/erlcService');

test('decodes invalid or expired server keys', () => {
    const error = createApiErrorFromResponse({
        status: 403,
        body: { code: 2002 },
    });

    assert.equal(error.code, 'API_REQUEST_FAILED');
    assert.equal(error.status, 403);
    assert.equal(error.prcCode, 2002);
    assert.match(error.message, /invalid or expired/i);
});

test('decodes banned server keys safely', () => {
    const error = createApiErrorFromResponse({
        status: 403,
        body: { code: 2004 },
    });

    assert.equal(error.prcCode, 2004);
    assert.match(getPublicErrorMessage(error), /banned/i);
});

test('includes a safe retry estimate for rate limits', () => {
    const error = createApiErrorFromResponse({
        status: 429,
        body: { code: 4001 },
        retryAfterSeconds: 12,
    });

    assert.equal(error.code, 'API_RATE_LIMITED');
    assert.equal(error.retryAfterSeconds, 12);
    assert.match(error.message, /12 seconds/);
});

test('does not expose unknown upstream response messages', () => {
    const error = createApiErrorFromResponse({
        status: 418,
        body: {
            message: 'Potentially sensitive upstream text',
        },
    });

    assert.equal(
        error.message,
        'ER:LC API request failed with HTTP 418.'
    );
    assert.doesNotMatch(error.message, /sensitive/i);
});
