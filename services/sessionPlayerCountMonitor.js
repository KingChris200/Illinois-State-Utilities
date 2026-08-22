const { EmbedBuilder } = require('discord.js');

const erlcService = require('./erlcService');
const sessionManager = require('../utils/sessionManager');
const {
    saveSessionState,
} = require('./sessionStateStore');

const DEFAULT_REFRESH_MS = 30_000;
const MINIMUM_REFRESH_MS = 15_000;
const MAXIMUM_REFRESH_MS = 5 * 60_000;
const DASHBOARD_TITLE =
    'Live Player Count';
const DASHBOARD_FOOTER =
    'Live session • Updates automatically';

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

function countStaffMembers(staff) {
    if (Array.isArray(staff)) {
        return staff.length;
    }

    if (!staff || typeof staff !== 'object') {
        return 0;
    }

    const uniqueStaff = new Set();

    for (const group of Object.values(staff)) {
        if (Array.isArray(group)) {
            for (const member of group) {
                uniqueStaff.add(
                    String(member?.Player ?? member?.Id ?? member)
                );
            }
        } else if (group && typeof group === 'object') {
            for (const memberId of Object.keys(group)) {
                uniqueStaff.add(memberId);
            }
        }
    }

    return uniqueStaff.size;
}

function parseSessionDashboardStats(server) {
    const counts = parsePlayerCount(server);
    const queueCount = Array.isArray(server?.Queue)
        ? server.Queue.length
        : Number.isFinite(Number(server?.Queue))
          ? Number(server.Queue)
          : 0;

    return {
        ...counts,
        staffCount: countStaffMembers(server?.Staff),
        queueCount: Math.max(0, queueCount),
    };
}

function createSessionDashboardEmbed({
    guildIcon = null,
    guildName = 'Illinois State Roleplay',
    updatedAt = null,
    currentPlayers = null,
    maxPlayers = 40,
    staffCount = null,
    queueCount = null,
} = {}) {
    const embed = new EmbedBuilder()
        .setColor('#24589B')
        .setTitle(DASHBOARD_TITLE)
        .setDescription(
            updatedAt
                ? `Updated <t:${Math.floor(
                      updatedAt / 1000
                  )}:R>`
                : 'Connecting to ER:LC…'
        )
        .addFields(
            {
                name: 'Player Count',
                value:
                    currentPlayers === null
                        ? '—'
                        : `**${currentPlayers}/${maxPlayers}**`,
                inline: true,
            },
            {
                name: 'Staff Members',
                value:
                    staffCount === null
                        ? '—'
                        : `**${staffCount}**`,
                inline: true,
            },
            {
                name: 'Queue',
                value:
                    queueCount === null
                        ? '—'
                        : `**${queueCount}**`,
                inline: true,
            }
        )
        .setFooter({
            text: DASHBOARD_FOOTER,
            iconURL: guildIcon || undefined,
        });

    return embed;
}

function replacePlayerCountFields(
    embed,
    {
        currentPlayers,
        maxPlayers,
        staffCount = 0,
        queueCount = 0,
        updatedAt,
    }
) {
    const updatedTimestamp = Math.floor(
        updatedAt / 1000
    );

    embed
        .setTitle(DASHBOARD_TITLE)
        .setDescription(
            `Updated <t:${updatedTimestamp}:R>`
        )
        .setFields(
        {
            name: 'Player Count',
            value: `**${currentPlayers}/${maxPlayers}**`,
            inline: true,
        },
        {
            name: 'Staff Members',
            value: `**${staffCount}**`,
            inline: true,
        },
        {
            name: 'Queue',
            value: `**${queueCount}**`,
            inline: true,
        }
        )
        .setFooter({
            text: DASHBOARD_FOOTER,
            iconURL:
                embed.data.footer?.icon_url || undefined,
        });

    return embed;
}

async function refreshPlayerCountMessage({
    client,
    guildId,
    channelId,
    messageId,
    fetchServer = () => erlcService.getSessionStatus(),
    persistState = true,
}) {
    const server = await fetchServer();
    const stats = parseSessionDashboardStats(server);
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

    if (!message) {
        throw new Error(
            'The active session startup message is unavailable.'
        );
    }

    const updatedAt = Date.now();
    const embeds = message.embeds.map(
        (sourceEmbed) =>
            new EmbedBuilder(sourceEmbed.toJSON())
    );
    let dashboardIndex = embeds.findIndex(
        (embed) =>
            embed.data.footer?.text ===
            DASHBOARD_FOOTER
    );

    if (dashboardIndex === -1) {
        dashboardIndex = embeds.length;
        embeds.push(createSessionDashboardEmbed());
    }

    const dashboardEmbed = embeds[dashboardIndex];

    replacePlayerCountFields(dashboardEmbed, {
        ...stats,
        updatedAt,
    });

    await message.edit({
        embeds,
    });

    sessionManager.updateSessionPlayerCount({
        guildId,
        messageId,
        currentPlayers: stats.currentPlayers,
        maxPlayers: stats.maxPlayers,
        staffCount: stats.staffCount,
        queueCount: stats.queueCount,
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
        ...stats,
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
    DASHBOARD_TITLE,
    DASHBOARD_FOOTER,
    getRefreshInterval,
    parsePlayerCount,
    countStaffMembers,
    parseSessionDashboardStats,
    createSessionDashboardEmbed,
    replacePlayerCountFields,
    refreshPlayerCountMessage,
    startSessionPlayerCountMonitor,
    stopSessionPlayerCountMonitor,
};
