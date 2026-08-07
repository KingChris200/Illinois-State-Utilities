const DEFAULT_INTERVAL_MS = 60_000;
const MINIMUM_INTERVAL_MS = 30_000;
const MAXIMUM_INTERVAL_MS = 10 * 60_000;

function getWatchlistAlertConfig(environment = process.env) {
    return {
        enabled:
            String(
                environment.WATCHLIST_ALERTS_ENABLED || ''
            ).toLowerCase() === 'true',
        channelId: cleanId(
            environment.WATCHLIST_ALERT_CHANNEL_ID
        ),
        intervalMs: clampNumber(
            environment.WATCHLIST_ALERT_INTERVAL_MS,
            DEFAULT_INTERVAL_MS,
            MINIMUM_INTERVAL_MS,
            MAXIMUM_INTERVAL_MS
        ),
    };
}

function cleanId(value) {
    const id = String(value || '').trim();
    return /^\d{16,22}$/.test(id) ? id : null;
}

function clampNumber(value, fallback, minimum, maximum) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.min(
        maximum,
        Math.max(minimum, Math.floor(number))
    );
}

module.exports = {
    DEFAULT_INTERVAL_MS,
    MAXIMUM_INTERVAL_MS,
    MINIMUM_INTERVAL_MS,
    getWatchlistAlertConfig,
};
