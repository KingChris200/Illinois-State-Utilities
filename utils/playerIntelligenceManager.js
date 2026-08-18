const { randomUUID } = require('crypto');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const erlcService = require('../services/erlcService');
const createEmbed = require('./createEmbed');
const {
    cleanInlineCode,
    cleanMarkdownText,
    formatPlayerIdentity,
    formatRelativeTime,
    parsePlayerIdentity,
    sortNewest,
} = require('./erlcActivityUtils');
const { resolvePlayer } = require('./playerResolver');
const {
    collectPlayerActivity,
    createPlayerIndicators,
    findOnlinePlayer,
    formatSafeLocation,
    identityMatches,
} = require('./playerIntelligenceUtils');

const PLAYER_PANEL_TTL_MS = 180_000;
const panels = new Map();

async function createPlayerIntelligencePanel({
    query,
    executorId,
    executorMention,
    guild = null,
    client = null,
    config,
}) {
    const snapshot =
        await erlcService.getPlayerIntelligenceSnapshot();
    const resolved = resolvePlayer(snapshot.Players, query);
    const panel = {
        id: randomUUID(),
        target: {
            username: resolved.player.username,
            userId: resolved.player.userId,
        },
        executorId,
        executorMention,
        guild,
        client,
        config,
        view: 'overview',
        processing: false,
        message: null,
        expiresAt: Date.now() + PLAYER_PANEL_TTL_MS,
        timer: null,
    };
    const embed = await buildPlayerView(
        panel,
        panel.view,
        snapshot
    );

    panel.timer = setTimeout(
        () => expirePlayerPanel(panel.id),
        PLAYER_PANEL_TTL_MS
    );
    panel.timer.unref?.();
    panels.set(panel.id, panel);

    return {
        id: panel.id,
        target: panel.target,
        matchType: resolved.matchType,
        embed,
        components: createPlayerButtons(
            panel.id,
            panel.view
        ),
    };
}

function attachPlayerPanelMessage(id, message) {
    const panel = panels.get(id);

    if (panel) {
        panel.message = message;
    }
}

function removePlayerPanel(id) {
    const panel = panels.get(id);

    if (panel) {
        clearTimeout(panel.timer);
        panels.delete(id);
    }
}

async function handlePlayerIntelligenceButton(interaction) {
    const match = interaction.customId.match(
        /^erlc_player:(overview|activity|vehicles|calls|refresh):([a-f0-9-]+)$/
    );

    if (!match) {
        return false;
    }

    const [, action, id] = match;
    const panel = panels.get(id);

    if (!panel || Date.now() >= panel.expiresAt) {
        removePlayerPanel(id);
        await interaction.reply({
            content:
                'This player-intelligence profile has expired. Run `?player <username>` to open a new one.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (interaction.user.id !== panel.executorId) {
        await interaction.reply({
            content:
                'Only the staff member who opened this player profile can use its controls.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (panel.processing) {
        await interaction.reply({
            content:
                'This player profile is already refreshing. Please wait a moment.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    panel.processing = true;
    const nextView =
        action === 'refresh' ? panel.view : action;
    await interaction.deferUpdate();

    try {
        const embed = await buildPlayerView(panel, nextView);
        panel.view = nextView;
        await interaction.editReply({
            embeds: [embed],
            components: [
                createPlayerButtons(id, nextView),
            ],
        });
        console.log(
            `[ER:LC PLAYER INTELLIGENCE] target=${panel.target.username} executor=${panel.executorId} view=${nextView} outcome=success`
        );
    } catch (error) {
        console.error(
            'Could not refresh the ER:LC player profile:',
            error
        );
        await interaction.editReply({
            embeds: [createErrorEmbed(panel, error)],
            components: [
                createPlayerButtons(id, panel.view),
            ],
        });
    } finally {
        panel.processing = false;
    }

    return true;
}

function createPlayerButtons(
    id,
    activeView,
    disabled = false
) {
    const buttons = [
        ['overview', 'Overview', '👤'],
        ['activity', 'Activity', '📋'],
        ['vehicles', 'Vehicles', '🚗'],
        ['calls', 'Mod Calls', '🚨'],
    ].map(([view, label, emoji]) =>
        new ButtonBuilder()
            .setCustomId(`erlc_player:${view}:${id}`)
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
            .setCustomId(`erlc_player:refresh:${id}`)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );

    return new ActionRowBuilder().addComponents(buttons);
}

async function expirePlayerPanel(id) {
    const panel = panels.get(id);

    if (!panel) {
        return;
    }

    panels.delete(id);

    if (panel.message) {
        await panel.message
            .edit({
                components: [
                    createPlayerButtons(
                        id,
                        panel.view,
                        true
                    ),
                ],
            })
            .catch(() => null);
    }
}

async function buildPlayerView(
    panel,
    view,
    providedSnapshot = null
) {
    const snapshot =
        providedSnapshot ||
        (await erlcService.getPlayerIntelligenceSnapshot());
    const onlinePlayer = findOnlinePlayer(
        snapshot.Players,
        panel.target
    );
    const activity = collectPlayerActivity(
        snapshot,
        panel.target
    );

    switch (view) {
        case 'activity':
            return buildActivityView(
                panel,
                onlinePlayer,
                activity
            );
        case 'vehicles':
            return buildVehiclesView(
                panel,
                onlinePlayer,
                activity
            );
        case 'calls':
            return buildCallsView(
                panel,
                onlinePlayer,
                activity
            );
        default:
            return buildOverviewView(
                panel,
                onlinePlayer,
                activity
            );
    }
}

function buildOverviewView(panel, onlinePlayer, activity) {
    const title = `Player Intelligence — ${cleanMarkdownText(panel.target.username, 60)}`;
    const embed = createEmbed(title, 'isrp', {
        guild: panel.guild,
        client: panel.client,
    })
        .setDescription(
            onlinePlayer
                ? 'Live, read-only ER:LC player context for staff review.'
                : 'This player is no longer visible in the ER:LC server. Historical session context is retained below.'
        )
        .addFields(
            {
                name: 'Status',
                value: onlinePlayer
                    ? '🟢 Online'
                    : '⚪ Offline',
                inline: true,
            },
            {
                name: 'Roblox User ID',
                value: panel.target.userId
                    ? `\`${panel.target.userId}\``
                    : 'Unavailable',
                inline: true,
            },
            {
                name: 'Team',
                value: cleanMarkdownText(
                    onlinePlayer?.raw?.Team || 'Unavailable',
                    80
                ),
                inline: true,
            },
            {
                name: 'Callsign',
                value: cleanMarkdownText(
                    onlinePlayer?.raw?.Callsign || 'None',
                    40
                ),
                inline: true,
            },
            {
                name: 'Permission',
                value: cleanMarkdownText(
                    onlinePlayer?.permission || 'Unavailable',
                    80
                ),
                inline: true,
            },
            {
                name: 'Wanted Stars',
                value: onlinePlayer
                    ? String(
                          Math.max(
                              0,
                              Number(
                                  onlinePlayer.raw?.WantedStars
                              ) || 0
                          )
                      )
                    : 'Unavailable',
                inline: true,
            },
            {
                name: 'Location',
                value: onlinePlayer
                    ? formatSafeLocation(
                          onlinePlayer.raw?.Location
                      )
                    : 'Unavailable while offline',
            },
            {
                name: 'Session Observations',
                value: createPlayerIndicators({
                    onlinePlayer,
                    activity,
                }).join('\n'),
            },
            {
                name: 'Privacy',
                value:
                    'Raw map coordinates and command logs are intentionally excluded.',
            }
        );

    if (!onlinePlayer) {
        embed.setColor('#7F8C8D');
    }

    return addPanelSession(embed, panel);
}

function buildActivityView(panel, onlinePlayer, activity) {
    const movements = sortNewest(activity.joins)
        .slice(0, 6)
        .map(
            (log) =>
                `${log.Join === true ? '🟢 Joined' : '🔴 Left'} · ${formatRelativeTime(log.Timestamp)}`
        );
    const combat = createCombatEvents(activity, panel.target)
        .slice(0, 8)
        .map(formatCombatEvent);
    const embed = createEmbed(
        `Player Intelligence — ${cleanMarkdownText(panel.target.username, 60)} — Activity`,
        'isrp',
        {
            guild: panel.guild,
            client: panel.client,
        }
    )
        .setDescription(
            onlinePlayer
                ? 'Current-session activity returned by ER:LC.'
                : 'The target is offline; showing the latest returned session activity.'
        )
        .addFields(
            {
                name: `Joins & Departures — ${activity.joins.length}`,
                value:
                    movements.join('\n') ||
                    '*No matching movement records*',
            },
            {
                name: 'Combat Summary',
                value: [
                    `Eliminations: **${activity.kills.length}**`,
                    `Deaths: **${activity.deaths.length}**`,
                    `Last five minutes: **${activity.recentKills.length} eliminations / ${activity.recentDeaths.length} deaths**`,
                ].join('\n'),
            },
            {
                name: 'Recent Combat Events',
                value:
                    combat.join('\n') ||
                    '*No matching combat records*',
            }
        );

    return addPanelSession(embed, panel);
}

function buildVehiclesView(panel, onlinePlayer, activity) {
    const vehicles = activity.vehicles.slice(0, 10);
    const embed = createEmbed(
        `Player Intelligence — ${cleanMarkdownText(panel.target.username, 60)} — Vehicles`,
        'isrp',
        {
            guild: panel.guild,
            client: panel.client,
        }
    ).setDescription(
        vehicles.length
            ? `Showing ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} currently attributed to this player.`
            : '*No active vehicles are currently attributed to this player.*'
    );

    if (vehicles.length) {
        embed.addFields(
            ...vehicles.map(formatVehicleField)
        );
    }

    if (!onlinePlayer) {
        embed.setColor('#7F8C8D');
    }

    return addPanelSession(embed, panel);
}

function buildCallsView(panel, onlinePlayer, activity) {
    const calls = createCallEvents(activity)
        .slice(0, 8)
        .map(formatCallEvent);
    const embed = createEmbed(
        `Player Intelligence — ${cleanMarkdownText(panel.target.username, 60)} — Mod Calls`,
        'isrp',
        {
            guild: panel.guild,
            client: panel.client,
            tone:
                activity.unansweredCalls.length > 0
                    ? 'warning'
                    : 'info',
        }
    )
        .setDescription(
            calls.join('\n\n') ||
                '*No matching moderator-call involvement was returned.*'
        )
        .addFields(
            {
                name: 'As Caller',
                value: String(activity.callsAsCaller.length),
                inline: true,
            },
            {
                name: 'As Responding Moderator',
                value: String(
                    activity.callsAsModerator.length
                ),
                inline: true,
            },
            {
                name: 'Unanswered Calls',
                value: String(activity.unansweredCalls.length),
                inline: true,
            }
        );

    if (!onlinePlayer) {
        embed.setColor('#7F8C8D');
    }

    return addPanelSession(embed, panel);
}

function createCombatEvents(activity, target) {
    const events = [];

    for (const log of activity.kills) {
        events.push({ type: 'kill', log });
    }

    for (const log of activity.deaths) {
        if (
            !identityMatches(log?.Killer, target)
        ) {
            events.push({ type: 'death', log });
        }
    }

    return events.sort(
        (first, second) =>
            Number(second.log?.Timestamp || 0) -
            Number(first.log?.Timestamp || 0)
    );
}

function formatCombatEvent(event) {
    const otherPlayer = parsePlayerIdentity(
        event.type === 'kill'
            ? event.log?.Killed
            : event.log?.Killer
    );
    return event.type === 'kill'
        ? `🎯 Eliminated ${formatPlayerIdentity(otherPlayer)} · ${formatRelativeTime(event.log?.Timestamp)}`
        : `💀 Eliminated by ${formatPlayerIdentity(otherPlayer)} · ${formatRelativeTime(event.log?.Timestamp)}`;
}

function createCallEvents(activity) {
    const events = [
        ...activity.callsAsCaller.map((call) => ({
            type: 'caller',
            call,
        })),
        ...activity.callsAsModerator.map((call) => ({
            type: 'moderator',
            call,
        })),
    ];

    return events.sort(
        (first, second) =>
            Number(second.call?.Timestamp || 0) -
            Number(first.call?.Timestamp || 0)
    );
}

function formatCallEvent(event) {
    if (event.type === 'caller') {
        const moderator = event.call?.Moderator
            ? parsePlayerIdentity(event.call.Moderator)
            : null;
        return [
            `**As Caller** · ${formatRelativeTime(event.call?.Timestamp)}`,
            moderator
                ? `✅ Answered by ${formatPlayerIdentity(moderator)}`
                : '⚠️ No responding moderator recorded',
        ].join('\n');
    }

    const caller = parsePlayerIdentity(event.call?.Caller);
    return [
        `**As Responding Moderator** · ${formatRelativeTime(event.call?.Timestamp)}`,
        `Caller: ${formatPlayerIdentity(caller)}`,
    ].join('\n');
}

function formatVehicleField(vehicle, index) {
    return {
        name: `${index + 1}. ${cleanMarkdownText(vehicle?.Name || 'Unknown Vehicle', 80)}`,
        value: [
            `Plate: \`${cleanInlineCode(vehicle?.Plate, 20)}\``,
            `Livery: ${cleanMarkdownText(vehicle?.Texture || 'Standard', 80)}`,
            `Color: ${cleanMarkdownText(vehicle?.ColorName || 'Unknown', 40)} · \`${cleanInlineCode(vehicle?.ColorHex || 'Unknown', 12)}\``,
        ].join('\n'),
    };
}

function addPanelSession(embed, panel) {
    return embed.addFields({
        name: 'Profile Session',
        value: `${panel.executorMention} · Expires <t:${Math.floor(panel.expiresAt / 1000)}:R>`,
    });
}

function createErrorEmbed(panel, error) {
    return addPanelSession(
        createEmbed(
            `Player Intelligence — ${cleanMarkdownText(panel.target.username, 60)} — Refresh Failed`,
            'isrp',
            {
                guild: panel.guild,
                client: panel.client,
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
                    'No ER:LC command was executed. You can try Refresh again.',
            }),
        panel
    );
}

module.exports = {
    PLAYER_PANEL_TTL_MS,
    attachPlayerPanelMessage,
    buildPlayerView,
    createPlayerButtons,
    createPlayerIntelligencePanel,
    handlePlayerIntelligenceButton,
    removePlayerPanel,
};
