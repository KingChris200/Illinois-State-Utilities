const DEFAULT_INTERVAL_MS = 60_000;
const MINIMUM_INTERVAL_MS = 30_000;
const MAXIMUM_INTERVAL_MS = 10 * 60_000;

function getSmartAlertConfig(environment = process.env) {
    return {
        enabled: parseBoolean(
            environment.ERLC_SMART_ALERTS_ENABLED
        ),
        channelId: cleanId(
            environment.ERLC_SMART_ALERT_CHANNEL_ID
        ),
        roleId: cleanId(
            environment.ERLC_SMART_ALERT_ROLE_ID
        ),
        // Disabled to prevent repeated unanswered-call spam.
        // Staff can still inspect calls manually with ?modcalls.
        modCallAlertsEnabled: false,
        intervalMs: clampNumber(
            environment.ERLC_SMART_ALERT_INTERVAL_MS,
            DEFAULT_INTERVAL_MS,
            MINIMUM_INTERVAL_MS,
            MAXIMUM_INTERVAL_MS
        ),
        modCallDelaySeconds: clampNumber(
            environment.ERLC_MODCALL_ALERT_DELAY_SECONDS,
            60,
            30,
            10 * 60
        ),
        queueThreshold: clampNumber(
            environment.ERLC_QUEUE_ALERT_THRESHOLD,
            5,
            1,
            40
        ),
        killThreshold: clampNumber(
            environment.ERLC_KILL_ALERT_THRESHOLD,
            5,
            2,
            20
        ),
        killWindowSeconds: clampNumber(
            environment.ERLC_KILL_ALERT_WINDOW_SECONDS,
            120,
            30,
            10 * 60
        ),
        cooldownSeconds: clampNumber(
            environment.ERLC_ALERT_COOLDOWN_SECONDS,
            300,
            60,
            60 * 60
        ),
    };
}

function parseBoolean(value) {
    return String(value || '').toLowerCase() === 'true';
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
    getSmartAlertConfig,
};
