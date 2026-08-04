const BASE_URL = 'https://api.policeroleplay.community/v1';

const PRC_ERROR_MESSAGES = {
    2000: 'The ER:LC server key was not provided.',
    2001: 'The ER:LC server key is formatted incorrectly.',
    2002: 'The ER:LC server key is invalid or expired.',
    2003: 'The configured PRC global API key is invalid.',
    2004: 'This ER:LC server key is banned from API access.',
    3001: 'ER:LC rejected the command as invalid.',
    3002: 'The ER:LC private server is currently offline.',
    4001: 'The ER:LC API rate limit has been reached.',
    4002: 'ER:LC restricts this remote command.',
    4003: 'ER:LC prohibited the submitted message.',
    9998: 'This ER:LC API resource is restricted.',
    9999: 'The in-game ER:LC API module is outdated.',
};

class ErlcServiceError extends Error {
    constructor(
        message,
        code,
        status = null,
        prcCode = null,
        retryAfterSeconds = null
    ) {
        super(message);
        this.name = 'ErlcServiceError';
        this.code = code;
        this.status = status;
        this.prcCode = prcCode;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

const apiHealth = {
    state: 'not_checked',
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastStatus: null,
    lastPrcCode: null,
    lastErrorCode: null,
};

function getApiKey() {
    return String(process.env.ERLC_SERVER_KEY || '').trim();
}

function isConfigured() {
    return Boolean(getApiKey());
}

function isMockMode() {
    return (
        String(process.env.ERLC_MOCK_MODE || '').toLowerCase() ===
        'true'
    );
}

async function request(path, options = {}) {
    const apiKey = getApiKey();

    if (!apiKey) {
        const error = new ErlcServiceError(
            'ER:LC API key not configured. Add ERLC_SERVER_KEY to enable live remote commands.',
            'API_KEY_NOT_CONFIGURED'
        );
        recordFailure(error);
        throw error;
    }

    let response;

    try {
        response = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Server-Key': apiKey,
                ...(options.headers || {}),
            },
            signal: AbortSignal.timeout(10_000),
        });
    } catch (cause) {
        const error = new ErlcServiceError(
            cause?.name === 'TimeoutError'
                ? 'The ER:LC API request timed out.'
                : 'The ER:LC API could not be reached.',
            cause?.name === 'TimeoutError'
                ? 'API_TIMEOUT'
                : 'API_UNREACHABLE'
        );
        recordFailure(error);
        throw error;
    }

    if (!response.ok) {
        const body = await readSafeResponseBody(response);
        const retryAfter = parseRetryAfter(
            response.headers.get('retry-after')
        );
        const error = createApiErrorFromResponse({
            status: response.status,
            body,
            retryAfterSeconds: retryAfter,
        });

        recordFailure(error);
        throw error;
    }

    recordSuccess(response.status);

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function createApiErrorFromResponse({
    status,
    body = null,
    retryAfterSeconds = null,
}) {
    const rawPrcCode = body?.code ?? body?.errorCode;
    const prcCode = Number.isInteger(Number(rawPrcCode))
        ? Number(rawPrcCode)
        : null;
    const isRateLimited = status === 429 || prcCode === 4001;
    let message = PRC_ERROR_MESSAGES[prcCode];
    let code = isRateLimited
        ? 'API_RATE_LIMITED'
        : 'API_REQUEST_FAILED';

    if (!message) {
        message = `ER:LC API request failed with HTTP ${status}.`;
    }

    if (isRateLimited && retryAfterSeconds) {
        message += ` Try again in approximately ${retryAfterSeconds} seconds.`;
    }

    return new ErlcServiceError(
        message,
        code,
        status,
        prcCode,
        retryAfterSeconds
    );
}

async function readSafeResponseBody(response) {
    try {
        const text = await response.text();

        if (!text) {
            return null;
        }

        const parsed = JSON.parse(text);

        return {
            code: parsed?.code,
            errorCode: parsed?.errorCode,
        };
    } catch {
        return null;
    }
}

function parseRetryAfter(value) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0
        ? Math.ceil(seconds)
        : null;
}

function recordSuccess(status) {
    const now = Date.now();
    apiHealth.state = 'healthy';
    apiHealth.lastCheckedAt = now;
    apiHealth.lastSuccessAt = now;
    apiHealth.lastStatus = status;
    apiHealth.lastPrcCode = null;
    apiHealth.lastErrorCode = null;
}

function recordFailure(error) {
    const now = Date.now();
    apiHealth.state = 'unhealthy';
    apiHealth.lastCheckedAt = now;
    apiHealth.lastFailureAt = now;
    apiHealth.lastStatus = error.status;
    apiHealth.lastPrcCode = error.prcCode;
    apiHealth.lastErrorCode = error.code;
}

function getApiHealth() {
    return { ...apiHealth };
}

function getPublicErrorMessage(error) {
    if (error instanceof ErlcServiceError) {
        return error.message;
    }

    return 'An unexpected error occurred while contacting ER:LC.';
}

async function checkConnection() {
    if (isMockMode()) {
        return {
            mode: 'mock',
            server: await getServer(),
            health: getApiHealth(),
        };
    }

    const server = await request('/server');
    return {
        mode: 'live',
        server,
        health: getApiHealth(),
    };
}

async function executeCommand(command, { dryRun = false } = {}) {
    if (dryRun || isMockMode()) {
        return {
            dryRun: true,
            command,
        };
    }

    await request('/server/command', {
        method: 'POST',
        body: JSON.stringify({ command }),
    });

    return {
        dryRun: false,
        command,
    };
}

async function getPlayers({ mockData = null } = {}) {
    if (mockData !== null) {
        return mockData;
    }

    if (isMockMode()) {
        return [
            {
                Player: 'MockPlayer:123456789',
                Permission: 'Server Administrator',
            },
        ];
    }

    return request('/server/players');
}

async function getServer({ mockData = null } = {}) {
    if (mockData !== null) {
        return mockData;
    }

    if (isMockMode()) {
        return {
            Name: 'Illinois State Roleplay (Mock)',
            OwnerId: 123456789,
            CurrentPlayers: 1,
            MaxPlayers: 40,
            JoinKey: 'MOCK',
        };
    }

    return request('/server');
}

module.exports = {
    ErlcServiceError,
    PRC_ERROR_MESSAGES,
    checkConnection,
    createApiErrorFromResponse,
    executeCommand,
    getApiHealth,
    getPlayers,
    getPublicErrorMessage,
    getServer,
    isConfigured,
    isMockMode,
};
