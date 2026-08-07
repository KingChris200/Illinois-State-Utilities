const test = require('node:test');
const assert = require('node:assert/strict');

const erlcService = require('../services/erlcService');
const {
    createApiErrorFromResponse,
    getPublicErrorMessage,
} = erlcService;

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

test('records ER:LC rate-limit headers for adaptive polling', async () => {
    const previousKey = process.env.ERLC_SERVER_KEY;
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    const previousFetch = global.fetch;

    process.env.ERLC_SERVER_KEY = 'test-server-key';
    delete process.env.ERLC_MOCK_MODE;
    global.fetch = async () => ({
        ok: true,
        status: 200,
        headers: {
            get: (name) =>
                ({
                    'x-ratelimit-bucket': 'global',
                    'x-ratelimit-limit': '35',
                    'x-ratelimit-remaining': '1',
                    'x-ratelimit-reset': '2000000000',
                })[name.toLowerCase()] ?? null,
        },
        json: async () => ({ Name: 'Test Server' }),
    });

    try {
        await erlcService.getServer();
        const rateLimit = erlcService.getApiRateLimit();

        assert.equal(rateLimit.bucket, 'global');
        assert.equal(rateLimit.limit, 35);
        assert.equal(rateLimit.remaining, 1);
        assert.equal(rateLimit.resetAt, 2_000_000_000_000);
    } finally {
        global.fetch = previousFetch;

        if (previousKey === undefined) {
            delete process.env.ERLC_SERVER_KEY;
        } else {
            process.env.ERLC_SERVER_KEY = previousKey;
        }

        if (previousMockMode === undefined) {
            delete process.env.ERLC_MOCK_MODE;
        } else {
            process.env.ERLC_MOCK_MODE = previousMockMode;
        }
    }
});
