const { randomUUID } = require('crypto');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const createEmbed = require('./createEmbed');
const erlcService = require('../services/erlcService');
const {
    cleanMarkdownText,
    formatPlayerIdentity,
    formatRelativeTime,
    parsePlayerIdentity,
    sortNewest,
} = require('./erlcActivityUtils');

const DASHBOARD_TTL_MS = 180_000;
const dashboards = new Map();

async function createOperationsDashboard({
    executorId,
    executorMention,
    client,
    guild = null,
    config,
}) {
    const dashboard = {
        id: randomUUID(),
        executorId,
        executorMention,
        client,
        guild,
        config,
        view: 'overview',
        processing: false,
        message: null,
        expiresAt: Date.now() + DASHBOARD_TTL_MS,
        timer: null,
    };
    const embed = await buildOperationsView(
        dashboard,
        dashboard.view
    );

    dashboard.timer = setTimeout(
        () => expireDashboard(dashboard.id),
        DASHBOARD_TTL_MS
    );
    dashboard.timer.unref?.();
    dashboards.set(dashboard.id, dashboard);

    return {
        id: dashboard.id,
        embed,
        components: createOperationsButtons(
            dashboard.id,
            dashboard.view
        ),
    };
}

function attachOperationsMessage(id, message) {
    const dashboard = dashboards.get(id);

    if (dashboard) {
        dashboard.message = message;
    }
}

function removeOperationsDashboard(id) {
    const dashboard = dashboards.get(id);

    if (dashboard) {
        clearTimeout(dashboard.timer);
        dashboards.delete(id);
    }
}

async function handleOperationsButton(interaction) {
    const match = interaction.customId.match(
        /^erlc_ops:(overview|calls|activity|health|refresh):([a-f0-9-]+)$/
    );

    if (!match) {
        return false;
    }

    const [, action, id] = match;
    const dashboard = dashboards.get(id);

    if (!dashboard || Date.now() >= dashboard.expiresAt) {
        removeOperationsDashboard(id);
        await interaction.reply({
            content:
                'This operations dashboard has expired. Run `?operations` to open a new one.',
            ephemeral: true,
        });
        return true;
    }

    if (interaction.user.id !== dashboard.executorId) {
        await interaction.reply({
            content:
                'Only the staff member who opened this operations dashboard can use its controls.',
            ephemeral: true,
        });
        return true;
    }

    if (dashboard.processing) {
        await interaction.reply({
            content:
                'This dashboard is already refreshing. Please wait a moment.',
            ephemeral: true,
        });
        return true;
    }

    dashboard.processing = true;
    const nextView =
        action === 'refresh' ? dashboard.view : action;
    await interaction.deferUpdate();

    try {
        const embed = await buildOperationsView(
            dashboard,
            nextView
        );
        dashboard.view = nextView;
        await interaction.editReply({
            embeds: [embed],
            components: [
                createOperationsButtons(id, nextView),
            ],
        });
        console.log(
            `[ER:LC OPERATIONS] user=${dashboard.executorId} view=${nextView} outcome=success`
        );
    } catch (error) {
        console.error(
            'Could not refresh the ER:LC operations dashboard:',
            error
        );
        await interaction.editReply({
            embeds: [createErrorEmbed(dashboard, error)],
            components: [
                createOperationsButtons(
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

function createOperationsButtons(
    id,
    activeView,
    disabled = false
) {
    const buttons = [
        ['overview', 'Overview', '📊'],
        ['calls', 'Mod Calls', '🚨'],
        ['activity', 'Activity', '📋'],
        ['health', 'Health', '🩺'],
    ].map(([view, label, emoji]) =>
        new ButtonBuilder()
            .setCustomId(`erlc_ops:${view}:${id}`)
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
            .setCustomId(`erlc_ops:refresh:${id}`)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );

    return new ActionRowBuilder().addComponents(buttons);
}

async function expireDashboard(id) {
    const dashboard = dashboards.get(id);

    if (!dashboard) {
        return;
    }

    dashboards.delete(id);

    if (dashboard.message) {
        await dashboard.message
            .edit({
                components: [
                    createOperationsButtons(
                        id,
                        dashboard.view,
                        true
                    ),
                ],
            })
            .catch(() => null);
    }
}

async function buildOperationsView(dashboard, view) {
    switch (view) {
        case 'calls':
            return buildCallsView(dashboard);
        case 'activity':
            return buildActivityView(dashboard);
        case 'health':
            return buildHealthView(dashboard);
        default:
            return buildOverviewView(dashboard);
    }
}

async function buildOverviewView(dashboard) {
    const server = await erlcService.getOperationsOverview();
    const currentPlayers = safeNumber(server.CurrentPlayers);
    const maxPlayers = safeNumber(server.MaxPlayers);
    const staffCount =
        Object.keys(server.Staff.Admins).length +
        Object.keys(server.Staff.Mods).length +
        Object.keys(server.Staff.Helpers).length;
    const embed = createEmbed(
        'ER:LC Operations Center — Overview',
        'isrp',
        {
            guild: dashboard.guild,
            client: dashboard.client,
        }
    )
        .setDescription(
            `Live operational snapshot for **${cleanMarkdownText(server.Name || 'Unknown Server', 100)}**.`
        )
        .addFields(
            {
                name: 'Players',
                value: `**${currentPlayers} / ${maxPlayers || '?'}**\n${createCapacityBar(currentPlayers, maxPlayers)}`,
                inline: true,
            },
            {
                name: 'In-Game Staff',
                value: String(staffCount),
                inline: true,
            },
            {
                name: 'Queue',
                value: String(server.Queue.length),
                inline: true,
            },
            {
                name: 'Active Vehicles',
                value: String(server.Vehicles.length),
                inline: true,
            },
            {
                name: 'Account Verification',
                value: cleanMarkdownText(
                    server.AccVerifiedReq || 'Unknown',
                    50
                ),
                inline: true,
            },
            {
                name: 'Team Balance',
                value: server.TeamBalance ? 'Enabled' : 'Disabled',
                inline: true,
            },
            {
                name: 'Team Distribution',
                value: formatTeamDistribution(server.Players),
            },
            {
                name: 'Operating Mode',
                value: getOperatingMode(dashboard.config),
                inline: true,
            }
        );

    return addDashboardSession(embed, dashboard);
}

async function buildCallsView(dashboard) {
    const calls = sortNewest(
        await erlcService.getModCalls()
    ).slice(0, 5);
    const unanswered = calls.filter(
        (call) => !hasModerator(call.Moderator)
    ).length;
    const embed = createEmbed(
        'ER:LC Operations Center — Mod Calls',
        'isrp',
        {
            guild: dashboard.guild,
            client: dashboard.client,
            tone: unanswered > 0 ? 'warning' : 'info',
        }
    )
        .setDescription(
            calls.length
                ? calls.map(formatModCall).join('\n\n')
                : '*No recent moderator calls were returned.*'
        )
        .addFields(
            {
                name: 'Answered',
                value: String(calls.length - unanswered),
                inline: true,
            },
            {
                name: 'Unanswered',
                value: String(unanswered),
                inline: true,
            }
        );

    if (unanswered > 0) {
        embed.setColor('#D68910');
    }

    return addDashboardSession(embed, dashboard);
}

async function buildActivityView(dashboard) {
    const activity = await erlcService.getOperationsActivity();
    const joins = sortNewest(activity.JoinLogs).slice(0, 5);
    const kills = sortNewest(activity.KillLogs).slice(0, 5);
    const embed = createEmbed(
        'ER:LC Operations Center — Activity',
        'isrp',
        {
            guild: dashboard.guild,
            client: dashboard.client,
        }
    )
        .setDescription(
            'Recent player movement and elimination activity.'
        )
        .addFields(
            {
                name: `Joins & Departures — ${joins.length}`,
                value:
                    joins.map(formatJoin).join('\n') ||
                    '*No recent join activity*',
            },
            {
                name: `Kill Logs — ${kills.length}`,
                value:
                    kills.map(formatKill).join('\n') ||
                    '*No recent kill activity*',
            }
        );

    return addDashboardSession(embed, dashboard);
}

async function buildHealthView(dashboard) {
    let connection;
    let connectionError;

    try {
        connection = await erlcService.checkConnection();
    } catch (error) {
        connectionError = error;
    }

    const health = erlcService.getApiHealth();
    const connected = Boolean(connection);
    const embed = createEmbed(
        'ER:LC Operations Center — Server Health',
        'isrp',
        {
            guild: dashboard.guild,
            client: dashboard.client,
            tone: connected ? 'success' : 'danger',
        }
    )
        .setColor(connected ? '#27AE60' : '#C0392B')
        .setDescription(
            connected
                ? 'The read-only ER:LC connection check completed successfully.'
                : erlcService.getPublicErrorMessage(connectionError)
        )
        .addFields(
            {
                name: 'Discord Bot',
                value: dashboard.client?.user?.tag
                    ? `🟢 Online as ${dashboard.client.user.tag}`
                    : '🟢 Online',
            },
            {
                name: 'Operating Mode',
                value: getOperatingMode(dashboard.config),
                inline: true,
            },
            {
                name: 'API Key',
                value: erlcService.isConfigured()
                    ? '✅ Configured'
                    : '⚠️ Not configured',
                inline: true,
            },
            {
                name: 'ER:LC Connection',
                value: connected
                    ? connection.mode === 'mock'
                        ? '🧪 Mock data available'
                        : '🟢 Healthy'
                    : '🔴 Unavailable',
                inline: true,
            },
            {
                name: 'Discord Latency',
                value: `${Math.max(0, Math.round(dashboard.client?.ws?.ping || 0))} ms`,
                inline: true,
            },
            {
                name: 'Last Successful API Check',
                value: health.lastSuccessAt
                    ? `<t:${Math.floor(health.lastSuccessAt / 1000)}:R>`
                    : connection?.mode === 'mock'
                      ? 'Mock mode does not contact ER:LC'
                      : 'Not recorded since startup',
                inline: true,
            },
            {
                name: 'Safety',
                value:
                    'This dashboard only reads ER:LC information. It cannot execute an in-game command.',
            }
        );

    return addDashboardSession(embed, dashboard);
}

function createErrorEmbed(dashboard, error) {
    return addDashboardSession(
        createEmbed(
            'ER:LC Operations Center — Refresh Failed',
            'isrp',
            {
                guild: dashboard.guild,
                client: dashboard.client,
                tone: 'danger',
            }
        )
            .setColor('#C0392B')
            .setDescription(
                erlcService.getPublicErrorMessage(error)
            )
            .addFields({
                name: 'Safety',
                value:
                    'No remote command was executed. You can try Refresh again.',
            }),
        dashboard
    );
}

function addDashboardSession(embed, dashboard) {
    return embed.addFields({
        name: 'Dashboard Session',
        value: `${dashboard.executorMention} · Expires <t:${Math.floor(dashboard.expiresAt / 1000)}:R>`,
    });
}

function formatModCall(call, index) {
    const caller = parsePlayerIdentity(call?.Caller);
    const moderator = hasModerator(call?.Moderator)
        ? parsePlayerIdentity(call.Moderator)
        : null;
    return [
        `**${index + 1}. Call** · ${formatRelativeTime(call?.Timestamp)}`,
        `Caller: ${formatPlayerIdentity(caller)}`,
        moderator
            ? `✅ Answered by ${formatPlayerIdentity(moderator)}`
            : '⚠️ No responding moderator recorded',
    ].join('\n');
}

function formatJoin(log) {
    const player = parsePlayerIdentity(log?.Player);
    return `${log?.Join === true ? '🟢 Joined' : '🔴 Left'} · ${formatPlayerIdentity(player)} · ${formatRelativeTime(log?.Timestamp)}`;
}

function formatKill(log) {
    const killer = parsePlayerIdentity(log?.Killer);
    const victim = parsePlayerIdentity(log?.Killed);
    return `${formatPlayerIdentity(killer)} → ${formatPlayerIdentity(victim)} · ${formatRelativeTime(log?.Timestamp)}`;
}

function formatTeamDistribution(players) {
    const teams = new Map();

    for (const player of players) {
        const team = cleanMarkdownText(
            player?.Team || 'Unknown',
            40
        );
        teams.set(team, (teams.get(team) || 0) + 1);
    }

    return (
        [...teams.entries()]
            .sort((first, second) => second[1] - first[1])
            .slice(0, 8)
            .map(([team, count]) => `**${team}:** ${count}`)
            .join(' · ') || '*No players online*'
    );
}

function createCapacityBar(current, maximum) {
    if (!maximum) {
        return '`□□□□□□□□□□`';
    }

    const filled = Math.min(
        10,
        Math.max(0, Math.round((current / maximum) * 10))
    );
    return `\`${'■'.repeat(filled)}${'□'.repeat(10 - filled)}\``;
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0
        ? Math.floor(number)
        : 0;
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

function getOperatingMode(config) {
    if (config.mockMode) {
        return '🧪 Mock Mode';
    }

    if (config.dryRun) {
        return '🛡️ Dry-Run Mode';
    }

    return '🟢 Live Mode';
}

module.exports = {
    DASHBOARD_TTL_MS,
    attachOperationsMessage,
    buildOperationsView,
    createOperationsButtons,
    createOperationsDashboard,
    handleOperationsButton,
    removeOperationsDashboard,
};
