const { createHash } = require('crypto');

const { getSmartAlertConfig } = require('../config/smartAlerts');
const createEmbed = require('../utils/createEmbed');
const {
    readDatabase,
    writeDatabase,
} = require('../utils/database');
const {
    formatPlayerIdentity,
    formatRelativeTime,
    parsePlayerIdentity,
} = require('../utils/erlcActivityUtils');
const erlcService = require('./erlcService');

const DATABASE_NAME = 'erlc-smart-alerts';
const STATE_VERSION = 1;
const MAX_TRACKED_MOD_CALLS = 250;

let activeMonitor = null;
let monitorStatus = createMonitorStatus('not_started');

function createDefaultAlertState() {
    return {
        version: STATE_VERSION,
        initialized: false,
        trackedModCalls: [],
        queueAlertActive: false,
        killAlertActive: false,
        lastQueueAlertAt: 0,
        lastKillAlertAt: 0,
        lastPollAt: 0,
    };
}

function normalizeAlertState(value) {
    const fallback = createDefaultAlertState();

    if (!value || typeof value !== 'object') {
        return fallback;
    }

    const trackedModCalls = Array.isArray(
        value.trackedModCalls
    )
        ? value.trackedModCalls
              .filter(
                  (record) =>
                      typeof record?.key === 'string' &&
                      Number.isFinite(record.firstSeenAt)
              )
              .slice(-MAX_TRACKED_MOD_CALLS)
              .map((record) => ({
                  key: record.key,
                  firstSeenAt: record.firstSeenAt,
                  lastSeenAt: Number.isFinite(record.lastSeenAt)
                      ? record.lastSeenAt
                      : record.firstSeenAt,
                  notified: record.notified === true,
              }))
        : [];

    return {
        version: STATE_VERSION,
        initialized: value.initialized === true,
        trackedModCalls,
        queueAlertActive: value.queueAlertActive === true,
        killAlertActive: value.killAlertActive === true,
        lastQueueAlertAt: safeTimestamp(
            value.lastQueueAlertAt
        ),
        lastKillAlertAt: safeTimestamp(
            value.lastKillAlertAt
        ),
        lastPollAt: safeTimestamp(value.lastPollAt),
    };
}

function evaluateSmartAlerts(
    snapshot,
    previousState,
    config,
    now = Date.now()
) {
    const state = normalizeAlertState(previousState);
    const modCalls = Array.isArray(snapshot?.ModCalls)
        ? snapshot.ModCalls
        : [];
    const queue = Array.isArray(snapshot?.Queue)
        ? snapshot.Queue
        : [];
    const killLogs = Array.isArray(snapshot?.KillLogs)
        ? snapshot.KillLogs
        : [];
    const unansweredCalls = modCalls.filter(
        (call) => !hasModerator(call?.Moderator)
    );
    const recentKills = getRecentKills(
        killLogs,
        config.killWindowSeconds,
        now
    );
    const trackedCalls = new Map(
        state.trackedModCalls.map((record) => [
            record.key,
            { ...record },
        ])
    );

    if (!state.initialized) {
        for (const call of unansweredCalls) {
            const key = createModCallKey(call);
            trackedCalls.set(key, {
                key,
                firstSeenAt: now,
                lastSeenAt: now,
                notified: true,
            });
        }

        state.initialized = true;
        state.queueAlertActive =
            queue.length >= config.queueThreshold;
        state.killAlertActive =
            recentKills.length >= config.killThreshold;
        state.trackedModCalls = trimTrackedCalls(
            trackedCalls
        );
        state.lastPollAt = now;
        return { state, alerts: [] };
    }

    const callsToAlert = [];

    for (const call of unansweredCalls) {
        const key = createModCallKey(call);
        const record = trackedCalls.get(key) || {
            key,
            firstSeenAt: now,
            lastSeenAt: now,
            notified: false,
        };
        record.lastSeenAt = now;

        const callStartedAt = getTimestampMs(
            call?.Timestamp,
            record.firstSeenAt
        );
        const waitingMs = Math.max(
            0,
            now - callStartedAt
        );

        if (
            !record.notified &&
            waitingMs >= config.modCallDelaySeconds * 1000
        ) {
            callsToAlert.push(call);
            record.notified = true;
        }

        trackedCalls.set(key, record);
    }

    const alerts = [];

    if (
        config.modCallAlertsEnabled === true &&
        callsToAlert.length
    ) {
        alerts.push({
            type: 'mod_calls',
            calls: callsToAlert.slice(0, 5),
            total: callsToAlert.length,
        });
    }

    evaluateThresholdAlert({
        activeKey: 'queueAlertActive',
        lastAlertKey: 'lastQueueAlertAt',
        thresholdReached:
            queue.length >= config.queueThreshold,
        cooldownSeconds: config.cooldownSeconds,
        now,
        state,
        createAlert: () => ({
            type: 'queue_surge',
            count: queue.length,
            threshold: config.queueThreshold,
        }),
        alerts,
    });

    evaluateThresholdAlert({
        activeKey: 'killAlertActive',
        lastAlertKey: 'lastKillAlertAt',
        thresholdReached:
            recentKills.length >= config.killThreshold,
        cooldownSeconds: config.cooldownSeconds,
        now,
        state,
        createAlert: () => ({
            type: 'kill_spike',
            count: recentKills.length,
            threshold: config.killThreshold,
            windowSeconds: config.killWindowSeconds,
            logs: recentKills.slice(0, 5),
        }),
        alerts,
    });

    state.trackedModCalls = trimTrackedCalls(trackedCalls);
    state.lastPollAt = now;
    return { state, alerts };
}

function evaluateThresholdAlert({
    activeKey,
    lastAlertKey,
    thresholdReached,
    cooldownSeconds,
    now,
    state,
    createAlert,
    alerts,
}) {
    if (!thresholdReached) {
        state[activeKey] = false;
        return;
    }

    const cooldownFinished =
        now - state[lastAlertKey] >=
        cooldownSeconds * 1000;

    if (!state[activeKey] && cooldownFinished) {
        alerts.push(createAlert());
        state[lastAlertKey] = now;
    }

    state[activeKey] = true;
}

async function startSmartAlertMonitor(
    client,
    { config = getSmartAlertConfig() } = {}
) {
    stopSmartAlertMonitor();

    if (!config.enabled) {
        monitorStatus = createMonitorStatus('disabled', config);
        return getSmartAlertStatus();
    }

    if (!config.channelId) {
        monitorStatus = createMonitorStatus(
            'missing_channel',
            config
        );
        return getSmartAlertStatus();
    }

    if (
        !erlcService.isMockMode() &&
        !erlcService.isConfigured()
    ) {
        monitorStatus = createMonitorStatus(
            'missing_api_key',
            config
        );
        return getSmartAlertStatus();
    }

    const state = normalizeAlertState(
        await readDatabase(
            DATABASE_NAME,
            createDefaultAlertState()
        )
    );
    const monitor = {
        client,
        config,
        state,
        stopped: false,
        timer: null,
        lastErrorCode: null,
    };

    activeMonitor = monitor;
    monitorStatus = {
        ...createMonitorStatus('running', config),
        startedAt: Date.now(),
    };
    void runMonitor(monitor);

    return getSmartAlertStatus();
}

function stopSmartAlertMonitor() {
    if (!activeMonitor) {
        return false;
    }

    activeMonitor.stopped = true;
    clearTimeout(activeMonitor.timer);
    activeMonitor = null;
    monitorStatus = createMonitorStatus('stopped');
    return true;
}

async function runMonitor(monitor) {
    if (monitor.stopped) {
        return;
    }

    let nextDelay = monitor.config.intervalMs;

    try {
        const snapshot =
            await erlcService.getSmartAlertSnapshot();
        const evaluation = evaluateSmartAlerts(
            snapshot,
            monitor.state,
            monitor.config
        );

        if (evaluation.alerts.length) {
            await sendSmartAlerts(
                monitor.client,
                evaluation.alerts,
                monitor.config
            );
        }

        monitor.state = evaluation.state;
        await writeDatabase(DATABASE_NAME, monitor.state);
        monitor.lastErrorCode = null;
        monitorStatus = {
            ...monitorStatus,
            state: 'running',
            lastCheckAt: Date.now(),
            lastSuccessAt: Date.now(),
            lastErrorCode: null,
            lastAlertAt: evaluation.alerts.length
                ? Date.now()
                : monitorStatus.lastAlertAt,
            alertsSent:
                monitorStatus.alertsSent +
                evaluation.alerts.length,
        };
    } catch (error) {
        const errorCode = error.code || 'UNKNOWN_ERROR';

        if (monitor.lastErrorCode !== errorCode) {
            console.error(
                '[ER:LC SMART ALERTS] Check failed:',
                errorCode
            );
        }

        monitor.lastErrorCode = errorCode;
        monitorStatus = {
            ...monitorStatus,
            state: shouldHaltForError(error)
                ? 'halted'
                : 'degraded',
            lastCheckAt: Date.now(),
            lastErrorAt: Date.now(),
            lastErrorCode: errorCode,
        };

        if (shouldHaltForError(error)) {
            monitor.stopped = true;
            activeMonitor = null;
            console.error(
                '[ER:LC SMART ALERTS] Monitoring halted to prevent repeated invalid-key requests.'
            );
            return;
        }

        if (error.retryAfterSeconds) {
            nextDelay = Math.max(
                nextDelay,
                error.retryAfterSeconds * 1000
            );
        }
    }

    nextDelay = calculateRateLimitDelay(
        nextDelay,
        erlcService.getApiRateLimit()
    );
    scheduleNextRun(monitor, nextDelay);
}

function scheduleNextRun(monitor, delay) {
    if (monitor.stopped) {
        return;
    }

    monitor.timer = setTimeout(
        () => runMonitor(monitor),
        delay
    );
    monitor.timer.unref?.();
}

function calculateRateLimitDelay(
    baseDelay,
    rateLimit,
    now = Date.now()
) {
    if (
        rateLimit?.remaining !== null &&
        rateLimit?.remaining <= 1 &&
        Number.isFinite(rateLimit?.resetAt) &&
        rateLimit.resetAt > now
    ) {
        return Math.max(
            baseDelay,
            rateLimit.resetAt - now + 1000
        );
    }

    return baseDelay;
}

async function sendSmartAlerts(client, alerts, config) {
    const channel = await client.channels
        .fetch(config.channelId)
        .catch(() => null);

    if (!channel?.isTextBased()) {
        const error = new Error(
            'The configured ER:LC smart-alert channel is unavailable.'
        );
        error.code = 'ALERT_CHANNEL_UNAVAILABLE';
        throw error;
    }

    const embeds = createSmartAlertEmbeds(alerts, {
        guild: channel.guild,
        client,
    });
    const content = config.roleId
        ? `<@&${config.roleId}> New ER:LC activity requires attention.`
        : null;

    await channel.send({
        content,
        embeds,
        allowedMentions: {
            parse: [],
            roles: config.roleId ? [config.roleId] : [],
        },
    });

    console.log(
        `[ER:LC SMART ALERTS] channel=${config.channelId} alerts=${alerts.map((alert) => alert.type).join(',')} outcome=sent`
    );
}

function createSmartAlertEmbeds(alerts, context = {}) {
    return alerts
        .map((alert) => {
            switch (alert.type) {
                case 'mod_calls':
                    return createModCallAlertEmbed(alert, context);
                case 'queue_surge':
                    return createQueueAlertEmbed(alert, context);
                case 'kill_spike':
                    return createKillAlertEmbed(alert, context);
                default:
                    return null;
            }
        })
        .filter(Boolean);
}

function createModCallAlertEmbed(alert, context = {}) {
    const lines = alert.calls.map((call) => {
        const caller = parsePlayerIdentity(call?.Caller);
        return `• ${formatPlayerIdentity(caller)} · ${formatRelativeTime(call?.Timestamp)}`;
    });

    return createEmbed(
        'Smart Alert — Unanswered Moderator Call',
        'isrp',
        {
            ...context,
            tone: 'danger',
        }
    )
        .setColor('#C0392B')
        .setDescription(lines.join('\n'))
        .addFields({
            name: 'Action Recommended',
            value:
                'A staff member should review the in-game moderator calls.',
        });
}

function createQueueAlertEmbed(alert, context = {}) {
    return createEmbed(
        'Smart Alert — Server Queue Surge',
        'isrp',
        {
            ...context,
            tone: 'warning',
        }
    )
        .setColor('#D68910')
        .setDescription(
            `The ER:LC queue has reached **${alert.count} players**.`
        )
        .addFields({
            name: 'Configured Threshold',
            value: `${alert.threshold} players`,
            inline: true,
        });
}

function createKillAlertEmbed(alert, context = {}) {
    const lines = alert.logs.map((log) => {
        const killer = parsePlayerIdentity(log?.Killer);
        const victim = parsePlayerIdentity(log?.Killed);
        return `• ${formatPlayerIdentity(killer)} → ${formatPlayerIdentity(victim)}`;
    });

    return createEmbed(
        'Smart Alert — Unusual Kill Activity',
        'isrp',
        {
            ...context,
            tone: 'danger',
        }
    )
        .setColor('#C0392B')
        .setDescription(lines.join('\n'))
        .addFields(
            {
                name: 'Detected Activity',
                value: `${alert.count} kills within ${alert.windowSeconds} seconds`,
                inline: true,
            },
            {
                name: 'Configured Threshold',
                value: `${alert.threshold} kills`,
                inline: true,
            }
        );
}

function createMockAlertEvents(config = getSmartAlertConfig()) {
    const now = Math.floor(Date.now() / 1000);
    const alerts = [
        {
            type: 'mod_calls',
            total: 1,
            calls: [
                {
                    Caller: 'MockCivilian:135792468',
                    Timestamp: now - 90,
                },
            ],
        },
        {
            type: 'queue_surge',
            count: Math.max(config.queueThreshold, 5),
            threshold: config.queueThreshold,
        },
        {
            type: 'kill_spike',
            count: config.killThreshold,
            threshold: config.killThreshold,
            windowSeconds: config.killWindowSeconds,
            logs: [
                {
                    Killer: 'MockOfficer:112233445',
                    Killed: 'MockSuspect:556677889',
                },
            ],
        },
    ];

    return config.modCallAlertsEnabled === true
        ? alerts
        : alerts.filter(
              (alert) => alert.type !== 'mod_calls'
          );
}

function getSmartAlertStatus() {
    return {
        ...monitorStatus,
        config: monitorStatus.config
            ? { ...monitorStatus.config }
            : null,
    };
}

function createMonitorStatus(state, config = null) {
    return {
        state,
        config,
        startedAt: null,
        lastCheckAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        lastAlertAt: null,
        alertsSent: 0,
    };
}

function getRecentKills(logs, windowSeconds, now) {
    const earliest = now - windowSeconds * 1000;
    const uniqueLogs = new Map();

    for (const log of logs) {
        const timestamp = getTimestampMs(log?.Timestamp, 0);

        if (timestamp < earliest || timestamp > now + 5000) {
            continue;
        }

        uniqueLogs.set(createKillKey(log), log);
    }

    return [...uniqueLogs.values()].sort(
        (first, second) =>
            Number(second.Timestamp || 0) -
            Number(first.Timestamp || 0)
    );
}

function trimTrackedCalls(trackedCalls) {
    return [...trackedCalls.values()]
        .sort((first, second) =>
            second.lastSeenAt - first.lastSeenAt
        )
        .slice(0, MAX_TRACKED_MOD_CALLS);
}

function createModCallKey(call) {
    return hashKey([
        call?.Caller,
        call?.Timestamp,
    ]);
}

function createKillKey(log) {
    return hashKey([
        log?.Killer,
        log?.Killed,
        log?.Timestamp,
    ]);
}

function hashKey(values) {
    return createHash('sha256')
        .update(values.map((value) => String(value || '')).join('|'))
        .digest('hex')
        .slice(0, 32);
}

function hasModerator(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return Boolean(
        normalized &&
        normalized !== 'none' &&
        normalized !== 'n/a' &&
        normalized !== 'unknown'
    );
}

function getTimestampMs(value, fallback) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0
        ? timestamp * 1000
        : fallback;
}

function safeTimestamp(value) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0
        ? timestamp
        : 0;
}

function shouldHaltForError(error) {
    return (
        error?.code === 'API_KEY_NOT_CONFIGURED' ||
        error?.status === 403 ||
        (Number(error?.prcCode) >= 2000 &&
            Number(error?.prcCode) <= 2004)
    );
}

module.exports = {
    DATABASE_NAME,
    STATE_VERSION,
    calculateRateLimitDelay,
    createDefaultAlertState,
    createMockAlertEvents,
    createSmartAlertEmbeds,
    evaluateSmartAlerts,
    getSmartAlertStatus,
    normalizeAlertState,
    sendSmartAlerts,
    startSmartAlertMonitor,
    stopSmartAlertMonitor,
};
