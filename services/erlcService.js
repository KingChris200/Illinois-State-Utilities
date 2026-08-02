const BASE_URL = 'https://api.policeroleplay.community/v1';

class ErlcServiceError extends Error {
    constructor(message, code, status = null) {
        super(message);
        this.name = 'ErlcServiceError';
        this.code = code;
        this.status = status;
    }
}

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
        throw new ErlcServiceError(
            'ER:LC API key not configured. Add ERLC_SERVER_KEY to enable live remote commands.',
            'API_KEY_NOT_CONFIGURED'
        );
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Server-Key': apiKey,
            ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new ErlcServiceError(
            `ER:LC API request failed (${response.status}).`,
            'API_REQUEST_FAILED',
            response.status
        );
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
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
    isConfigured,
    isMockMode,
    executeCommand,
    getPlayers,
    getServer,
};
