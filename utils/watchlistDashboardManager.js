const { randomUUID } = require('crypto');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const createEmbed = require('./createEmbed');
const {
    getAllWatchlistEntries,
} = require('./watchlistManager');
const {
    canManageWatchlist,
} = require('./watchlistPermissions');

const DASHBOARD_TTL_MS = 180_000;
const dashboards = new Map();
const SEVERITY = {
    low: { label: 'Low', emoji: '🟢' },
    medium: { label: 'Medium', emoji: '🟡' },
    high: { label: 'High', emoji: '🟠' },
    critical: { label: 'Critical', emoji: '🔴' },
};

async function createWatchlistDashboard({
    guildId,
    executorId,
    executorMention,
    guild = null,
    client = null,
    records = null,
}) {
    const dashboard = {
        id: randomUUID(),
        guildId,
        executorId,
        executorMention,
        guild,
        client,
        providedRecords: Array.isArray(records)
            ? structuredClone(records)
            : null,
        view: 'overview',
        processing: false,
        message: null,
        expiresAt: Date.now() + DASHBOARD_TTL_MS,
        timer: null,
    };
    const embed = await buildWatchlistDashboardView(
        dashboard,
        dashboard.view
    );

    dashboard.timer = setTimeout(
        () => expireWatchlistDashboard(dashboard.id),
        DASHBOARD_TTL_MS
    );
    dashboard.timer.unref?.();
    dashboards.set(dashboard.id, dashboard);

    return {
        id: dashboard.id,
        embed,
        components: createWatchlistDashboardButtons(
            dashboard.id,
            dashboard.view
        ),
    };
}

function attachWatchlistDashboardMessage(id, message) {
    const dashboard = dashboards.get(id);

    if (dashboard) {
        dashboard.message = message;
    }
}

function removeWatchlistDashboard(id) {
    const dashboard = dashboards.get(id);

    if (dashboard) {
        clearTimeout(dashboard.timer);
        dashboards.delete(id);
    }
}

async function handleWatchlistDashboardButton(interaction) {
    const match = interaction.customId.match(
        /^watchlist_dashboard:(overview|active|activity|review|refresh):([a-f0-9-]+)$/
    );

    if (!match) {
        return false;
    }

    const [, action, id] = match;
    const dashboard = dashboards.get(id);

    if (!dashboard || Date.now() >= dashboard.expiresAt) {
        removeWatchlistDashboard(id);
        await interaction.reply({
            content:
                'This private watchlist dashboard has expired. Run `/watchlist dashboard` to open a new one.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (
        interaction.user.id !== dashboard.executorId ||
        !canManageWatchlist(interaction)
    ) {
        await interaction.reply({
            content:
                'Only the authorized manager who opened this dashboard can use its controls.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (dashboard.processing) {
        await interaction.reply({
            content:
                'This watchlist dashboard is already refreshing. Please wait a moment.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    dashboard.processing = true;
    const nextView =
        action === 'refresh' ? dashboard.view : action;
    await interaction.deferUpdate();

    try {
        const embed = await buildWatchlistDashboardView(
            dashboard,
            nextView
        );
        dashboard.view = nextView;
        await interaction.editReply({
            embeds: [embed],
            components: [
                createWatchlistDashboardButtons(
                    id,
                    nextView
                ),
            ],
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        console.error(
            '[WATCHLIST DASHBOARD] Refresh failed:',
            error
        );
        await interaction.editReply({
            embeds: [createDashboardErrorEmbed(dashboard)],
            components: [
                createWatchlistDashboardButtons(
                    id,
                    dashboard.view
                ),
            ],
        });
    } finally {
        dashboard.processing = false;
    }

    return true;
}

function createWatchlistDashboardButtons(
    id,
    activeView,
    disabled = false
) {
    const buttons = [
        ['overview', 'Overview', '📊'],
        ['active', 'Active Records', '🔎'],
        ['activity', 'Activity', '📋'],
        ['review', 'Review Queue', '⚠️'],
    ].map(([view, label, emoji]) =>
        new ButtonBuilder()
            .setCustomId(`watchlist_dashboard:${view}:${id}`)
            .setLabel(label)
            .setEmoji(emoji)
            .setStyle(
                view === activeView
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary
            )
            .setDisabled(disabled || view === activeView)
    );

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`watchlist_dashboard:refresh:${id}`)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );

    return new ActionRowBuilder().addComponents(buttons);
}

async function expireWatchlistDashboard(id) {
    const dashboard = dashboards.get(id);

    if (!dashboard) {
        return;
    }

    dashboards.delete(id);

    if (dashboard.message) {
        await dashboard.message
            .edit({
                components: [
                    createWatchlistDashboardButtons(
                        id,
                        dashboard.view,
                        true
                    ),
                ],
            })
            .catch(() => null);
    }
}

async function buildWatchlistDashboardView(
    dashboard,
    view
) {
    const records = dashboard.providedRecords ||
        (await getAllWatchlistEntries(dashboard.guildId));
    const summary = summarizeWatchlistRecords(records);

    switch (view) {
        case 'active':
            return buildActiveView(dashboard, summary);
        case 'activity':
            return buildActivityView(dashboard, summary);
        case 'review':
            return buildReviewView(dashboard, summary);
        default:
            return buildOverviewView(dashboard, summary);
    }
}

function summarizeWatchlistRecords(records, now = Date.now()) {
    const safeRecords = Array.isArray(records) ? records : [];
    const active = safeRecords.filter(
        (record) => record.status === 'active'
    );
    const resolved = safeRecords.filter(
        (record) => record.status === 'resolved'
    );
    const removed = safeRecords.filter(
        (record) => record.status === 'removed'
    );
    const severityCounts = Object.fromEntries(
        Object.keys(SEVERITY).map((severity) => [
            severity,
            active.filter(
                (record) => record.severity === severity
            ).length,
        ])
    );
    const auditEvents = safeRecords
        .flatMap((record) =>
            (record.auditLog || []).map((event) => ({
                ...event,
                recordId: record.id,
                robloxUsername: record.robloxUsername,
            }))
        )
        .sort(
            (first, second) =>
                new Date(second.createdAt || 0) -
                new Date(first.createdAt || 0)
        );
    const staleBefore = now - 30 * 24 * 60 * 60 * 1000;

    return {
        records: safeRecords,
        active: sortActiveRecords(active),
        resolved,
        removed,
        severityCounts,
        auditEvents,
        unacknowledged: active.filter(
            (record) => !record.lastAcknowledgedAt
        ),
        missingEvidence: active.filter(
            (record) => !String(record.evidence || '').trim()
        ),
        stale: active.filter(
            (record) =>
                new Date(record.updatedAt || record.createdAt || 0)
                    .getTime() < staleBefore
        ),
        falseMatchReviews: auditEvents.filter(
            (event) => event.action === 'match_dismissed'
        ).length,
    };
}

function buildOverviewView(dashboard, summary) {
    const closedCount =
        summary.resolved.length + summary.removed.length;
    const resolutionRate = closedCount
        ? Math.round(
              (summary.resolved.length / closedCount) * 100
          )
        : 0;
    const recent = summary.records
        .slice()
        .sort(sortNewest)
        .slice(0, 5)
        .map(formatRecordLine);

    return addDashboardSession(
        createEmbed('🔒 Private Watchlist Command Center', 'isrp', {
            guild: dashboard.guild,
            client: dashboard.client,
            tone: 'neutral',
        })
            .setDescription(
                'Private, read-only watchlist records for this server.'
            )
            .addFields(
                {
                    name: 'Record Status',
                    value: [
                        `🟠 Active: **${summary.active.length}**`,
                        `✅ Resolved: **${summary.resolved.length}**`,
                        `⚫ Archived: **${summary.removed.length}**`,
                        `Total: **${summary.records.length}**`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: 'Active Severity',
                    value: [
                        `🔴 Critical: **${summary.severityCounts.critical}**`,
                        `🟠 High: **${summary.severityCounts.high}**`,
                        `🟡 Medium: **${summary.severityCounts.medium}**`,
                        `🟢 Low: **${summary.severityCounts.low}**`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: 'Response Coverage',
                    value: [
                        `Acknowledged: **${summary.active.length - summary.unacknowledged.length}/${summary.active.length}**`,
                        `Needs acknowledgement: **${summary.unacknowledged.length}**`,
                        `Resolution rate: **${resolutionRate}%**`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: 'Recently Updated',
                    value:
                        recent.join('\n') ||
                        '*No private watchlist records yet.*',
                }
            ),
        dashboard
    );
}

function buildActiveView(dashboard, summary) {
    const embed = createEmbed(
        `🔎 Active Watchlist Records — ${summary.active.length}`,
        'isrp',
        {
            guild: dashboard.guild,
            client: dashboard.client,
            tone: summary.active.length > 0 ? 'warning' : 'success',
        }
    ).setDescription(
        summary.active.length
            ? 'Ordered by severity and age so urgent or long-running records remain visible.'
            : '✅ There are no active private watchlist records.'
    );

    for (const record of summary.active.slice(0, 10)) {
        const severity =
            SEVERITY[record.severity] || SEVERITY.medium;
        embed.addFields({
            name:
                `${severity.emoji} ${safeText(record.robloxUsername, 50)} • ${severity.label}`,
            value: [
                `Entry \`${safeCode(record.id)}\` • Roblox ID \`${safeCode(record.robloxUserId)}\``,
                `Response: ${record.lastAcknowledgedAt ? `✅ Acknowledged ${discordTimestamp(record.lastAcknowledgedAt, 'R')}` : '⚠️ Not acknowledged'}`,
                `Reason: ${safeText(record.reason, 180)}`,
                `Updated ${discordTimestamp(record.updatedAt, 'R')}`,
            ].join('\n'),
        });
    }

    if (summary.active.length > 10) {
        embed.addFields({
            name: 'Additional Records',
            value:
                `Another **${summary.active.length - 10}** active records are available through \`/watchlist search\`.`,
        });
    }

    return addDashboardSession(embed, dashboard);
}

function buildActivityView(dashboard, summary) {
    const events = summary.auditEvents
        .slice(0, 12)
        .map(
            (event) =>
                `• **${formatAuditAction(event.action)}** • ${safeText(event.robloxUsername, 40)} • ${event.actorId ? `<@${event.actorId}>` : safeText(event.actorUsername, 40)} • ${discordTimestamp(event.createdAt, 'R')}`
        );

    return addDashboardSession(
        createEmbed('📋 Recent Watchlist Activity', 'isrp', {
            guild: dashboard.guild,
            client: dashboard.client,
            tone: 'neutral',
        })
            .setDescription(
                events.join('\n') ||
                    '*No watchlist audit activity has been recorded.*'
            )
            .addFields(
                {
                    name: 'Audit Events',
                    value: String(summary.auditEvents.length),
                    inline: true,
                },
                {
                    name: 'False-Match Reviews',
                    value: String(summary.falseMatchReviews),
                    inline: true,
                },
                {
                    name: 'Resolved Records',
                    value: String(summary.resolved.length),
                    inline: true,
                }
            ),
        dashboard
    );
}

function buildReviewView(dashboard, summary) {
    const urgent = summary.active.filter(
        (record) =>
            ['critical', 'high'].includes(record.severity) &&
            !record.lastAcknowledgedAt
    );

    return addDashboardSession(
        createEmbed('⚠️ Watchlist Review Queue', 'isrp', {
            guild: dashboard.guild,
            client: dashboard.client,
            tone:
                urgent.length > 0 || stale.length > 0
                    ? 'warning'
                    : 'success',
        })
            .setDescription(
                'Records requiring management housekeeping. These are review prompts—not automatic findings of wrongdoing.'
            )
            .addFields(
                {
                    name: 'Urgent & Unacknowledged',
                    value: formatReviewList(urgent),
                },
                {
                    name: 'Missing Evidence / Reference',
                    value: formatReviewList(summary.missingEvidence),
                },
                {
                    name: 'No Update in 30+ Days',
                    value: formatReviewList(summary.stale),
                }
            ),
        dashboard
    );
}

function formatReviewList(records) {
    const lines = records
        .slice(0, 8)
        .map(formatRecordLine);
    return lines.length
        ? [
              ...lines,
              records.length > 8
                  ? `• And **${records.length - 8}** more`
                  : null,
          ]
              .filter(Boolean)
              .join('\n')
        : '✅ None';
}

function formatRecordLine(record) {
    const severity =
        SEVERITY[record.severity] || SEVERITY.medium;
    return `${severity.emoji} **${safeText(record.robloxUsername, 40)}** • \`${safeCode(record.id)}\``;
}

function sortActiveRecords(records) {
    const order = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
    };

    return [...records].sort((first, second) => {
        const severityDifference =
            (order[second.severity] || 0) -
            (order[first.severity] || 0);
        return severityDifference ||
            new Date(first.createdAt || 0) -
                new Date(second.createdAt || 0);
    });
}

function sortNewest(first, second) {
    return (
        new Date(second.updatedAt || second.createdAt || 0) -
        new Date(first.updatedAt || first.createdAt || 0)
    );
}

function addDashboardSession(embed, dashboard) {
    return embed.addFields({
        name: 'Dashboard Session',
        value:
            `${dashboard.executorMention} • Expires <t:${Math.floor(dashboard.expiresAt / 1000)}:R>`,
    });
}

function createDashboardErrorEmbed(dashboard) {
    return addDashboardSession(
        createEmbed('Watchlist Dashboard Refresh Failed', 'isrp', {
            guild: dashboard.guild,
            client: dashboard.client,
            tone: 'danger',
        })
            .setColor('#C0392B')
            .setDescription(
                'The private records could not be refreshed. No watchlist data was changed.'
            ),
        dashboard
    );
}

function discordTimestamp(value, style = 'F') {
    const milliseconds = new Date(value).getTime();
    return Number.isFinite(milliseconds)
        ? `<t:${Math.floor(milliseconds / 1000)}:${style}>`
        : 'Unknown';
}

function formatAuditAction(action) {
    return String(action || 'updated')
        .replace(/^entry_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeCode(value) {
    return String(value || 'Unknown').replace(/`/g, "'");
}

function safeText(value, maximumLength) {
    const text = String(value || 'Unknown')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[*_~`|>\\]/g, '\\$&');
    return text.length <= maximumLength
        ? text
        : `${text.slice(0, maximumLength - 3)}...`;
}

module.exports = {
    DASHBOARD_TTL_MS,
    attachWatchlistDashboardMessage,
    buildWatchlistDashboardView,
    createWatchlistDashboard,
    createWatchlistDashboardButtons,
    handleWatchlistDashboardButton,
    removeWatchlistDashboard,
    summarizeWatchlistRecords,
};
