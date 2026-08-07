const { parsePlayerRecord } = require('./playerResolver');
const {
    cleanMarkdownText,
} = require('./erlcActivityUtils');

const RECENT_ACTIVITY_WINDOW_MS = 5 * 60_000;

function parseIdentityRecord(value) {
    const text = String(value || '').trim();
    const separatorIndex = text.lastIndexOf(':');
    const possibleUserId = separatorIndex > 0
        ? text.slice(separatorIndex + 1).trim()
        : '';
    const hasUserId = /^\d+$/.test(possibleUserId);

    return {
        username: (
            hasUserId
                ? text.slice(0, separatorIndex)
                : text
        ).trim(),
        userId: hasUserId ? possibleUserId : null,
    };
}

function identityMatches(value, target) {
    const identity = parseIdentityRecord(value);

    if (target.userId && identity.userId) {
        return identity.userId === target.userId;
    }

    return (
        identity.username.toLowerCase() ===
        target.username.toLowerCase()
    );
}

function findOnlinePlayer(players, target) {
    for (const record of players || []) {
        const player = parsePlayerRecord(record);

        if (
            (target.userId && player.userId === target.userId) ||
            player.username.toLowerCase() ===
                target.username.toLowerCase()
        ) {
            return player;
        }
    }

    return null;
}

function collectPlayerActivity(
    snapshot,
    target,
    now = Date.now()
) {
    const joins = (snapshot.JoinLogs || []).filter((log) =>
        identityMatches(log?.Player, target)
    );
    const kills = (snapshot.KillLogs || []).filter((log) =>
        identityMatches(log?.Killer, target)
    );
    const deaths = (snapshot.KillLogs || []).filter((log) =>
        identityMatches(log?.Killed, target)
    );
    const callsAsCaller = (snapshot.ModCalls || []).filter(
        (call) => identityMatches(call?.Caller, target)
    );
    const callsAsModerator = (snapshot.ModCalls || []).filter(
        (call) => identityMatches(call?.Moderator, target)
    );
    const vehicles = (snapshot.Vehicles || []).filter(
        (vehicle) => identityMatches(vehicle?.Owner, target)
    );
    const recentKills = kills.filter((log) =>
        isRecentTimestamp(log?.Timestamp, now)
    );
    const recentDeaths = deaths.filter((log) =>
        isRecentTimestamp(log?.Timestamp, now)
    );
    const unansweredCalls = callsAsCaller.filter(
        (call) => !hasModerator(call?.Moderator)
    );

    return {
        joins,
        kills,
        deaths,
        callsAsCaller,
        callsAsModerator,
        vehicles,
        recentKills,
        recentDeaths,
        unansweredCalls,
    };
}

function createPlayerIndicators({
    onlinePlayer,
    activity,
}) {
    const indicators = [];

    if (!onlinePlayer) {
        indicators.push(
            '⚪ Player is no longer online in the private server.'
        );
        return indicators;
    }

    const wantedStars = Math.max(
        0,
        Number(onlinePlayer.raw?.WantedStars) || 0
    );

    if (wantedStars > 0) {
        indicators.push(
            `🔴 Currently wanted with **${wantedStars} star${wantedStars === 1 ? '' : 's'}**.`
        );
    }

    if (activity.recentKills.length >= 3) {
        indicators.push(
            `🟠 **${activity.recentKills.length} eliminations** recorded within five minutes.`
        );
    }

    if (activity.recentDeaths.length >= 3) {
        indicators.push(
            `🟡 **${activity.recentDeaths.length} deaths** recorded within five minutes.`
        );
    }

    if (activity.unansweredCalls.length > 0) {
        indicators.push(
            `🚨 **${activity.unansweredCalls.length} unanswered moderator call${activity.unansweredCalls.length === 1 ? '' : 's'}** recorded.`
        );
    }

    if (
        onlinePlayer.permission &&
        onlinePlayer.permission.toLowerCase() !== 'normal'
    ) {
        indicators.push(
            `🛡️ In-game permission: **${cleanMarkdownText(onlinePlayer.permission, 80)}**.`
        );
    }

    if (!indicators.length) {
        indicators.push(
            '🟢 No immediate session indicators were detected.'
        );
    }

    return indicators;
}

function formatSafeLocation(location) {
    if (!location || typeof location !== 'object') {
        return 'Unavailable';
    }

    const street = [
        location.BuildingNumber,
        location.StreetName,
    ]
        .filter(Boolean)
        .map((value) => cleanMarkdownText(value, 80))
        .join(' ');
    const postal = location.PostalCode
        ? `Postal **${cleanMarkdownText(location.PostalCode, 20)}**`
        : null;

    return [street || null, postal]
        .filter(Boolean)
        .join(' · ') || 'Unavailable';
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

function isRecentTimestamp(value, now) {
    const timestamp = Number(value) * 1000;
    return (
        Number.isFinite(timestamp) &&
        timestamp <= now + 5000 &&
        timestamp >= now - RECENT_ACTIVITY_WINDOW_MS
    );
}

module.exports = {
    RECENT_ACTIVITY_WINDOW_MS,
    collectPlayerActivity,
    createPlayerIndicators,
    findOnlinePlayer,
    formatSafeLocation,
    identityMatches,
    parseIdentityRecord,
};
