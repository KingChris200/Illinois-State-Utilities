const { EmbedBuilder } = require('discord.js');

const erlcService = require('./erlcService');
const sessionManager = require('../utils/sessionManager');
const {
    saveSessionState,
} = require('./sessionStateStore');

const DEFAULT_REFRESH_MS = 30_000;
const MINIMUM_REFRESH_MS = 15_000;
const MAXIMUM_REFRESH_MS = 5 * 60_000;
const LIVE_PLAYER_FIELD = '🎮 Live Player Count';
const PLAYER_UPDATE_FIELD = '🔄 Player Count Updated';

const monitors = new Map();

function getRefreshInterval() {
    const configured = Number(
        process.env.SESSION_PLAYERCOUNT_INTERVAL_MS
    );

    if (!Number.isFinite(configured)) {
        return DEFAULT_REFRESH_MS;
    }

    return Math.min(
        MAXIMUM_REFRESH_MS,
        Math.max(MINIMUM_REFRESH_MS, configured)
    );
}

function parsePlayerCount(server) {
    const currentPlayers = Number(
        server?.CurrentPlayers ??
            (Array.isArray(server?.Players)
                ? server.Players.length
                : NaN)
    );
    const maxPlayers = Number(server?.MaxPlayers);

    if (!Number.isFinite(currentPlayers)) {
        throw new Error(
            'ER:LC did not return a valid current player count.'
        );
    }

    return {
        currentPlayers: Math.max(0, currentPlayers),
        maxPlayers: Number.isFinite(maxPlayers)
            ? Math.max(0, maxPlayers)
            : 40,
    };
}

function replacePlayerCountFields(
    embed,
    { currentPlayers, maxPlayers, updatedAt }
) {
    const otherFields = (
        embed.data.fields || []
    ).filter(
        (field) =>
            field.name !== LIVE_PLAYER_FIELD &&
            field.name !== PLAYER_UPDATE_FIELD
    );
    const updatedTimestamp = Math.floor(
        updatedAt / 1000
    );

    embed.setFields(
        ...otherFields,
        {
            name: LIVE_PLAYER_FIELD,
            value:
                `🟢 **${currentPlayers} / ${maxPlayers}** players in-game`,
            inline: true,
        },
        {
            name: PLAYER_UPDATE_FIELD,
            value: `<t:${updatedTimestamp}:R>`,
            inline: true,
        }
    );

    return embed;
}

async function refreshPlayerCountMessage({
    client,
    guildId,
    channelId,
    messageId,
    fetchServer = () => erlcService.getServer(),
    persistState = true,
}) {
    const server = await fetchServer();
    const counts = parsePlayerCount(server);
    const channel = await client.channels
        .fetch(channelId)
        .catch(() => null);

    if (!channel?.isTextBased()) {
        throw new Error(
            'The active session channel is unavailable.'
        );
    }

    const message = await channel.messages
        .fetch(messageId)
        .catch(() => null);

    if (!message?.embeds?.[0]) {
        throw new Error(
            'The active session startup message is unavailable.'
        );
    }

    const updatedAt = Date.now();
    const embed = new EmbedBuilder(
        message.embeds[0].toJSON()
    );

    replacePlayerCountFields(embed, {
        ...counts,
        updatedAt,
    });

    await message.edit({
        embeds: [embed],
    });

    sessionManager.updateSessionPlayerCount({
        guildId,
        messageId,
        ...counts,
        updatedAt,
    });
    if (persistState) {
        void saveSessionState().catch((error) => {
            console.error(
                '[SESSION PLAYER COUNT] Could not persist the latest count:',
                error
            );
        });
    }

    return {
        ...counts,
        updatedAt,
    };
}

function stopSessionPlayerCountMonitor(guildId) {
    const key = String(guildId || '');
    const monitor = monitors.get(key);

    if (!monitor) {
        return false;
    }

    monitor.stopped = true;

    if (monitor.timer) {
        clearTimeout(monitor.timer);
    }

    monitors.delete(key);
    return true;
}

function scheduleNextRefresh(monitor, delay) {
    if (monitor.stopped) {
        return;
    }

    monitor.timer = setTimeout(
        () => runMonitor(monitor),
        delay
    );
    monitor.timer.unref?.();
}

async function runMonitor(monitor) {
    if (monitor.stopped) {
        return;
    }

    let nextDelay = monitor.refreshInterval;

    try {
        await refreshPlayerCountMessage(monitor);
        monitor.lastErrorCode = null;
    } catch (error) {
        if (monitor.lastErrorCode !== error.code) {
            console.error(
                '[SESSION PLAYER COUNT] Refresh failed:',
                error.code || error.message
            );
        }

        monitor.lastErrorCode =
            error.code || 'UNKNOWN_ERROR';

        if (error.retryAfterSeconds) {
            nextDelay = Math.max(
                nextDelay,
                error.retryAfterSeconds * 1000
            );
        }
    }

    scheduleNextRefresh(monitor, nextDelay);
}

function startSessionPlayerCountMonitor({
    client,
    guildId,
    channelId,
    messageId,
}) {
    stopSessionPlayerCountMonitor(guildId);

    const monitor = {
        client,
        guildId: String(guildId),
        channelId: String(channelId),
        messageId: String(messageId),
        refreshInterval: getRefreshInterval(),
        timer: null,
        stopped: false,
        lastErrorCode: null,
    };

    monitors.set(monitor.guildId, monitor);
    void runMonitor(monitor);

    return {
        guildId: monitor.guildId,
        refreshInterval: monitor.refreshInterval,
    };
}

module.exports = {
    DEFAULT_REFRESH_MS,
    MINIMUM_REFRESH_MS,
    LIVE_PLAYER_FIELD,
    PLAYER_UPDATE_FIELD,
    getRefreshInterval,
    parsePlayerCount,
    replacePlayerCountFields,
    refreshPlayerCountMessage,
    startSessionPlayerCountMonitor,
    stopSessionPlayerCountMonitor,
};
