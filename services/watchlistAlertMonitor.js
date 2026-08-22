const { getWatchlistAlertConfig } = require(
    '../config/watchlistAlerts'
);
const createEmbed = require('../utils/createEmbed');
const {
    readDatabase,
    writeDatabase,
} = require('../utils/database');
const {
    getActiveWatchlistEntries,
} = require('../utils/watchlistManager');
const {
    matchWatchlistPlayers,
} = require('../utils/watchlistMatcher');
const {
    createWatchlistAlertComponents,
} = require('../utils/watchlistAlertInteractionManager');
const erlcService = require('./erlcService');

const DATABASE_NAME = 'watchlist-alert-state';
const STATE_VERSION = 1;
const MAX_ACTIVE_MATCHES = 500;
const MATCHES_PER_EMBED = 8;
const MAX_ALERT_EMBEDS = 10;

const SEVERITY = {
    low: { label: 'Low', emoji: '🟢', color: '#57F287' },
    medium: {
        label: 'Medium',
        emoji: '🟡',
        color: '#FEE75C',
    },
    high: { label: 'High', emoji: '🟠', color: '#E67E22' },
    critical: {
        label: 'Critical',
        emoji: '🔴',
        color: '#ED4245',
    },
};

let activeMonitor = null;
let monitorStatus = createMonitorStatus('not_started');

function createDefaultWatchlistAlertState() {
    return {
        version: STATE_VERSION,
        activeMatchKeys: [],
        lastPollAt: 0,
    };
}

function normalizeWatchlistAlertState(value) {
    const activeMatchKeys = Array.isArray(
        value?.activeMatchKeys
    )
        ? [
              ...new Set(
                  value.activeMatchKeys
                      .filter(
                          (key) =>
                              typeof key === 'string' &&
                              key.length >= 3 &&
                              key.length <= 200
                      )
                      .slice(-MAX_ACTIVE_MATCHES)
              ),
          ]
        : [];

    return {
        version: STATE_VERSION,
        activeMatchKeys,
        lastPollAt: safeTimestamp(value?.lastPollAt),
    };
}

function evaluateWatchlistMatches(
    matches,
    previousState,
    now = Date.now()
) {
    const state = normalizeWatchlistAlertState(previousState);
    const previousKeys = new Set(state.activeMatchKeys);
    const currentMatches = new Map();

    for (const match of Array.isArray(matches) ? matches : []) {
        const key = createMatchKey(match);

        if (key && !currentMatches.has(key)) {
            currentMatches.set(key, match);
        }
    }

    return {
        alerts: [...currentMatches.entries()]
            .filter(([key]) => !previousKeys.has(key))
            .map(([, match]) => match),
        state: {
            version: STATE_VERSION,
            activeMatchKeys: [...currentMatches.keys()].slice(
                -MAX_ACTIVE_MATCHES
            ),
            lastPollAt: now,
        },
    };
}

function createMatchKey(match) {
    const recordId = String(match?.record?.id || '').trim();
    const playerIdentity = String(
        match?.player?.userId ||
            match?.player?.username ||
            ''
    )
        .trim()
        .toLowerCase();

    return recordId && playerIdentity
        ? `${recordId}:${playerIdentity}`
        : null;
}

async function startWatchlistAlertMonitor(
    client,
    { config = getWatchlistAlertConfig() } = {}
) {
    stopWatchlistAlertMonitor();

    if (!config.enabled) {
        monitorStatus = createMonitorStatus('disabled', config);
        return getWatchlistAlertStatus();
    }

    if (!config.channelId) {
        monitorStatus = createMonitorStatus(
            'missing_channel',
            config
        );
        return getWatchlistAlertStatus();
    }

    if (
        !erlcService.isMockMode() &&
        !erlcService.isConfigured()
    ) {
        monitorStatus = createMonitorStatus(
            'missing_api_key',
            config
        );
        return getWatchlistAlertStatus();
    }

    const channel = await client.channels
        .fetch(config.channelId)
        .catch(() => null);

    if (!channel?.isTextBased() || !channel.guildId) {
        monitorStatus = createMonitorStatus(
            'channel_unavailable',
            config
        );
        return getWatchlistAlertStatus();
    }

    const state = normalizeWatchlistAlertState(
        await readDatabase(
            DATABASE_NAME,
            createDefaultWatchlistAlertState()
        )
    );
    const monitor = {
        channel,
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
    void runWatchlistAlertMonitor(monitor);

    return getWatchlistAlertStatus();
}

function stopWatchlistAlertMonitor() {
    if (!activeMonitor) {
        return false;
    }

    activeMonitor.stopped = true;
    clearTimeout(activeMonitor.timer);
    activeMonitor = null;
    monitorStatus = createMonitorStatus('stopped');
    return true;
}

async function runWatchlistAlertMonitor(monitor) {
    if (monitor.stopped) {
        return;
    }

    let nextDelay = monitor.config.intervalMs;

    try {
        const records = await getActiveWatchlistEntries(
            monitor.channel.guildId
        );
        const players = records.length
            ? await erlcService.getPlayers()
            : [];
        const matches = matchWatchlistPlayers(
            records,
            players
        );
        const evaluation = evaluateWatchlistMatches(
            matches,
            monitor.state
        );

        if (evaluation.alerts.length) {
            await sendWatchlistAlerts(
                monitor.channel,
                evaluation.alerts
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
            activeMatches: matches.length,
        };
    } catch (error) {
        const errorCode = error.code || 'UNKNOWN_ERROR';

        if (monitor.lastErrorCode !== errorCode) {
            console.error(
                '[WATCHLIST ALERTS] Check failed:',
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
                '[WATCHLIST ALERTS] Monitoring halted to prevent repeated invalid-key requests.'
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
        () => runWatchlistAlertMonitor(monitor),
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

async function sendWatchlistAlerts(channel, matches) {
    if (!channel?.isTextBased()) {
        const error = new Error(
            'The configured private watchlist-alert channel is unavailable.'
        );
        error.code = 'WATCHLIST_CHANNEL_UNAVAILABLE';
        throw error;
    }

    for (const match of matches) {
        await channel.send({
            content: null,
            embeds: createWatchlistAlertEmbeds(
                [match],
                channel.guild
            ),
            components: createWatchlistAlertComponents(
                match.record.id
            ),
            allowedMentions: { parse: [] },
        });
    }

    console.log(
        `[WATCHLIST ALERTS] channel=${channel.id} matches=${matches.length} outcome=sent`
    );
}

function createWatchlistAlertEmbeds(matches, guild = null) {
    const maximumMatches =
        MATCHES_PER_EMBED * MAX_ALERT_EMBEDS;
    const visibleMatches = (Array.isArray(matches)
        ? matches
        : []
    ).slice(0, maximumMatches);
    const embeds = [];

    for (
        let index = 0;
        index < visibleMatches.length;
        index += MATCHES_PER_EMBED
    ) {
        const chunk = visibleMatches.slice(
            index,
            index + MATCHES_PER_EMBED
        );
        const highestSeverity = getHighestSeverity(chunk);
        const embed = createEmbed(
            '🔒 Private Watchlist Alert',
            'isrp'
        )
            .setColor(highestSeverity.color)
            .setDescription(
                'A currently connected ER:LC player exactly matches an active private watchlist record. Review the context before taking action.'
            );

        for (const { record, player, matchedBy } of chunk) {
            const severity =
                SEVERITY[record.severity] || SEVERITY.medium;
            const profileUrl =
                `https://www.roblox.com/users/${record.robloxUserId}/profile`;

            embed.addFields({
                name:
                    `${severity.emoji} ${safeText(record.robloxUsername, 50)} • ${severity.label}`,
                value: [
                    `**[Open Roblox profile](${profileUrl})** • ID \`${safeCode(record.robloxUserId)}\``,
                    `Entry \`${safeCode(record.id)}\` • Permission: **${safeText(player.permission, 80)}**`,
                    `Reason: ${safeText(record.reason, 240)}`,
                    `Verified by exact ${matchedBy === 'user_id' ? 'Roblox ID' : 'username'} match.`,
                ].join('\n'),
            });
        }

        const guildIcon = guild?.iconURL?.({
            extension: 'png',
            size: 256,
        });

        embed.setFooter({
            text:
                'Illinois State Utilities • Management access only • No public ping sent',
        });

        if (
            index + MATCHES_PER_EMBED >=
                visibleMatches.length &&
            matches.length > maximumMatches
        ) {
            embed.addFields({
                name: 'Additional Matches',
                value:
                    `Another **${matches.length - maximumMatches}** matches were detected. Use \`/watchlist scan\` for the complete current comparison.`,
            });
        }

        embeds.push(embed);
    }

    return embeds;
}

function getHighestSeverity(matches) {
    const order = ['low', 'medium', 'high', 'critical'];
    const level = matches.reduce((highest, match) => {
        const current = order.indexOf(match?.record?.severity);
        return Math.max(highest, current);
    }, 0);

    return SEVERITY[order[level]] || SEVERITY.medium;
}

function getWatchlistAlertStatus() {
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
        activeMatches: 0,
    };
}

function shouldHaltForError(error) {
    return (
        error?.code === 'API_KEY_NOT_CONFIGURED' ||
        error?.status === 403 ||
        (Number(error?.prcCode) >= 2000 &&
            Number(error?.prcCode) <= 2004)
    );
}

function safeTimestamp(value) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0
        ? timestamp
        : 0;
}

function safeCode(value) {
    return String(value || 'Unknown').replace(/`/g, "'");
}

function safeText(value, maximumLength) {
    const text = String(value || 'Not provided')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[*_~`|>\\]/g, '\\$&');
    return text.length <= maximumLength
        ? text
        : `${text.slice(0, maximumLength - 3)}...`;
}

module.exports = {
    DATABASE_NAME,
    STATE_VERSION,
    calculateRateLimitDelay,
    createDefaultWatchlistAlertState,
    createMatchKey,
    createWatchlistAlertEmbeds,
    evaluateWatchlistMatches,
    getWatchlistAlertStatus,
    normalizeWatchlistAlertState,
    sendWatchlistAlerts,
    startWatchlistAlertMonitor,
    stopWatchlistAlertMonitor,
};
