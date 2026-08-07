const BASE_URL = 'https://api.erlc.gg';

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

    const server = await request('/v2/server');
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

    await request('/v1/server/command', {
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

    const server = await request(
        '/v2/server?Players=true'
    );

    return Array.isArray(server?.Players)
        ? server.Players
        : [];
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

    return request('/v2/server');
}

async function getSessionStatus({ mockData = null } = {}) {
    if (mockData !== null) {
        return mockData;
    }

    if (isMockMode()) {
        return {
            Name: 'Illinois State Roleplay (Mock)',
            CurrentPlayers: 1,
            MaxPlayers: 40,
            Queue: [],
            Staff: {
                Admins: {
                    123456789: 'MockPlayer',
                },
                Mods: {},
                Helpers: {},
            },
        };
    }

    return request(
        '/v2/server?Staff=true&Queue=true'
    );
}

async function getStaff({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeStaff(mockData);
    }

    if (isMockMode()) {
        return {
            Admins: {
                123456789: 'MockPlayer',
            },
            Mods: {
                987654321: 'MockModerator',
            },
            Helpers: {
                246813579: 'MockHelper',
            },
        };
    }

    const server = await request('/v2/server?Staff=true');
    return normalizeStaff(server?.Staff);
}

async function getCommandLogs({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeCommandLogs(mockData);
    }

    if (isMockMode()) {
        const now = Math.floor(Date.now() / 1000);
        return [
            {
                Player: 'MockPlayer:123456789',
                Timestamp: now - 30,
                Command: ':h Welcome to the mock server!',
            },
            {
                Player: 'MockModerator:987654321',
                Timestamp: now - 120,
                Command: ':m Mock session starting soon.',
            },
        ];
    }

    const server = await request(
        '/v2/server?CommandLogs=true'
    );
    return normalizeCommandLogs(server?.CommandLogs);
}

async function getModCalls({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeArray(mockData);
    }

    if (isMockMode()) {
        const now = Math.floor(Date.now() / 1000);
        return [
            {
                Caller: 'MockCivilian:135792468',
                Moderator: null,
                Timestamp: now - 45,
            },
            {
                Caller: 'MockPlayer:123456789',
                Moderator: 'MockModerator:987654321',
                Timestamp: now - 180,
            },
        ];
    }

    const server = await request('/v2/server?ModCalls=true');
    return normalizeArray(server?.ModCalls);
}

async function getJoinLogs({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeArray(mockData);
    }

    if (isMockMode()) {
        const now = Math.floor(Date.now() / 1000);
        return [
            {
                Join: true,
                Timestamp: now - 25,
                Player: 'MockCivilian:135792468',
            },
            {
                Join: false,
                Timestamp: now - 150,
                Player: 'MockFormerPlayer:864297531',
            },
        ];
    }

    const server = await request('/v2/server?JoinLogs=true');
    return normalizeArray(server?.JoinLogs);
}

async function getKillLogs({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeArray(mockData);
    }

    if (isMockMode()) {
        const now = Math.floor(Date.now() / 1000);
        return [
            {
                Killer: 'MockOfficer:112233445',
                Killed: 'MockSuspect:556677889',
                Timestamp: now - 40,
            },
            {
                Killer: 'MockPlayer:123456789',
                Killed: 'MockCivilian:135792468',
                Timestamp: now - 210,
            },
        ];
    }

    const server = await request('/v2/server?KillLogs=true');
    return normalizeArray(server?.KillLogs);
}

async function getQueue({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeArray(mockData);
    }

    if (isMockMode()) {
        return [135792468, 864297531];
    }

    const server = await request('/v2/server?Queue=true');
    return normalizeArray(server?.Queue);
}

async function getVehicles({ mockData = null } = {}) {
    if (mockData !== null) {
        return normalizeArray(mockData);
    }

    if (isMockMode()) {
        return [
            {
                Name: 'Falcon Interceptor Utility',
                Owner: 'MockOfficer',
                Plate: 'ISRP-01',
                Texture: 'Illinois State Police',
                ColorName: 'Midnight Blue',
                ColorHex: '#101820',
            },
            {
                Name: 'Bullhorn Prancer',
                Owner: 'MockCivilian',
                Plate: 'MOCK-02',
                Texture: 'Standard',
                ColorName: 'White',
                ColorHex: '#FFFFFF',
            },
        ];
    }

    const server = await request('/v2/server?Vehicles=true');
    return normalizeArray(server?.Vehicles);
}

function normalizeStaff(staff) {
    return {
        Admins: staff?.Admins || {},
        Mods: staff?.Mods || {},
        Helpers: staff?.Helpers || {},
    };
}

function normalizeCommandLogs(logs) {
    return normalizeArray(logs);
}

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

module.exports = {
    ErlcServiceError,
    PRC_ERROR_MESSAGES,
    checkConnection,
    createApiErrorFromResponse,
    executeCommand,
    getApiHealth,
    getCommandLogs,
    getJoinLogs,
    getKillLogs,
    getModCalls,
    getPlayers,
    getPublicErrorMessage,
    getQueue,
    getServer,
    getSessionStatus,
    getStaff,
    getVehicles,
    isConfigured,
    isMockMode,
};
