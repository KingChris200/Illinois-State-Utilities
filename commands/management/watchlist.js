const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const brands = require('../../config/branding');
const robloxService = require('../../services/robloxService');
const erlcService = require('../../services/erlcService');
const {
    WatchlistError,
    addWatchlistEntry,
    findWatchlistEntries,
    getActiveWatchlistEntries,
    getWatchlistEntry,
    removeWatchlistEntry,
    resolveWatchlistEntry,
    searchWatchlistEntries,
    updateWatchlistEntry,
} = require('../../utils/watchlistManager');
const {
    matchWatchlistPlayers,
} = require('../../utils/watchlistMatcher');
const {
    canManageWatchlist,
} = require('../../utils/watchlistPermissions');
const {
    attachWatchlistDashboardMessage,
    createWatchlistDashboard,
    removeWatchlistDashboard,
} = require('../../utils/watchlistDashboardManager');

const SEVERITY_CHOICES = [
    { name: 'Low — Monitor only', value: 'low' },
    { name: 'Medium — Needs attention', value: 'medium' },
    { name: 'High — Serious concern', value: 'high' },
    { name: 'Critical — Leadership attention', value: 'critical' },
];

const STATUS_CHOICES = [
    { name: 'Active', value: 'active' },
    { name: 'Resolved', value: 'resolved' },
    { name: 'Removed / Archived', value: 'removed' },
    { name: 'All Records', value: 'all' },
];

const SEVERITY_PRESENTATION = {
    low: { label: 'Low', emoji: '🟢', color: 0x57f287 },
    medium: { label: 'Medium', emoji: '🟡', color: 0xfee75c },
    high: { label: 'High', emoji: '🟠', color: 0xe67e22 },
    critical: { label: 'Critical', emoji: '🔴', color: 0xed4245 },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watchlist')
        .setDMPermission(false)
        .setDescription(
            'Privately manage internal Roblox-user watchlist records.'
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('add')
                .setDescription(
                    'Add a verified Roblox user to the private watchlist.'
                )
                .addStringOption((option) =>
                    option
                        .setName('roblox-user')
                        .setDescription('Roblox username or numeric user ID.')
                        .setMinLength(1)
                        .setMaxLength(50)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('severity')
                        .setDescription('How urgently should management review this?')
                        .addChoices(...SEVERITY_CHOICES)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Factual reason for the internal watchlist entry.')
                        .setMinLength(3)
                        .setMaxLength(1000)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('evidence')
                        .setDescription('Evidence link, message link, or case reference.')
                        .setMaxLength(1000)
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription('Optional private management notes.')
                        .setMaxLength(750)
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('view')
                .setDescription('Privately view matching watchlist records.')
                .addStringOption((option) =>
                    option
                        .setName('target')
                        .setDescription('Entry ID, Roblox username, or Roblox user ID.')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('search')
                .setDescription('Search private watchlist records.')
                .addStringOption((option) =>
                    option
                        .setName('query')
                        .setDescription('Username, user ID, reason, evidence, notes, or entry ID.')
                        .setMaxLength(200)
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('status')
                        .setDescription('Which record status should be included?')
                        .addChoices(...STATUS_CHOICES)
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('severity')
                        .setDescription('Only show one severity level.')
                        .addChoices(...SEVERITY_CHOICES)
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription('Maximum records to show (default 10).')
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('scan')
                .setDescription(
                    'Privately compare online ER:LC players with active records.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription(
                    'Open the private interactive watchlist command center.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('update')
                .setDescription('Update an existing private watchlist entry.')
                .addStringOption((option) =>
                    option
                        .setName('entry-id')
                        .setDescription('Permanent watchlist entry ID.')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('change-reason')
                        .setDescription('Why is this record being changed?')
                        .setMinLength(3)
                        .setMaxLength(500)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('severity')
                        .setDescription('Updated severity, if it changed.')
                        .addChoices(...SEVERITY_CHOICES)
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Updated factual watchlist reason.')
                        .setMaxLength(1000)
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('evidence')
                        .setDescription('Updated evidence, or type clear to remove it.')
                        .setMaxLength(1000)
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription('Updated notes, or type clear to remove them.')
                        .setMaxLength(750)
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('resolve')
                .setDescription('Resolve an active watchlist entry with an outcome.')
                .addStringOption((option) =>
                    option
                        .setName('entry-id')
                        .setDescription('Permanent watchlist entry ID.')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('resolution')
                        .setDescription('How and why was this concern resolved?')
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription('Archive an entry while preserving its audit trail.')
                .addStringOption((option) =>
                    option
                        .setName('entry-id')
                        .setDescription('Permanent watchlist entry ID.')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Why should this entry be removed?')
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        ),

    async autocomplete(interaction) {
        if (
            !interaction.inGuild() ||
            !canManageWatchlist(interaction)
        ) {
            await interaction.respond([]).catch(() => {});
            return;
        }

        try {
            const focused = interaction.options.getFocused(true);
            const records = await searchWatchlistEntries(
                interaction.guildId,
                {
                    query: focused.value,
                    status: 'all',
                    limit: 20,
                }
            );

            const choices = records
                .filter((record) => {
                    if (focused.name === 'entry-id') {
                        return record.status !== 'removed';
                    }

                    return true;
                })
                .map((record) => ({
                    name: truncate(
                        `${record.robloxUsername} • ${capitalize(record.severity)} • ${record.status} • ${record.id}`,
                        100
                    ),
                    value:
                        focused.name === 'entry-id'
                            ? record.id
                            : record.id,
                }));

            await interaction.respond(choices.slice(0, 25));
        } catch (error) {
            console.error(
                'Error handling /watchlist autocomplete:',
                error
            );
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: '❌ This command can only be used inside a Discord server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        if (!canManageWatchlist(interaction)) {
            await interaction.editReply({
                content:
                    '❌ This private system is restricted to authorized management, Internal Affairs, directors, and ownership.',
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand(true);

        try {
            switch (subcommand) {
                case 'add':
                    await handleAdd(interaction);
                    break;
                case 'view':
                    await handleView(interaction);
                    break;
                case 'search':
                    await handleSearch(interaction);
                    break;
                case 'scan':
                    await handleScan(interaction);
                    break;
                case 'dashboard':
                    await handleDashboard(interaction);
                    break;
                case 'update':
                    await handleUpdate(interaction);
                    break;
                case 'resolve':
                    await handleResolve(interaction);
                    break;
                case 'remove':
                    await handleRemove(interaction);
                    break;
                default:
                    throw new WatchlistError(
                        'UNKNOWN_ACTION',
                        'That watchlist action is not available.'
                    );
            }
        } catch (error) {
            console.error(
                `Error while executing /watchlist ${subcommand}:`,
                error
            );

            await interaction.editReply({
                content:
                    error instanceof WatchlistError
                        ? `❌ ${error.message}`
                        : '❌ The private watchlist could not complete that request. Please try again and check the bot logs if the problem continues.',
                embeds: [],
                allowedMentions: { parse: [] },
            });
        }
    },

    canManageWatchlist,
    createScanEmbed,
    createWatchlistEmbed,
    createSearchEmbed,
};

async function handleAdd(interaction) {
    const query = interaction.options
        .getString('roblox-user', true)
        .trim();
    const identity = await resolveRobloxIdentity(query);
    const record = await addWatchlistEntry({
        guildId: interaction.guildId,
        guildName: interaction.guild.name,
        robloxUserId: identity.id,
        robloxUsername: identity.name,
        robloxDisplayName: identity.displayName,
        severity: interaction.options.getString('severity', true),
        reason: interaction.options.getString('reason', true),
        evidence: interaction.options.getString('evidence'),
        notes: interaction.options.getString('notes'),
        createdById: interaction.user.id,
        createdByUsername: interaction.user.username,
    });

    logAction('add', record, interaction.user.id);
    await interaction.editReply({
        content:
            '✅ The verified Roblox user was added to the private watchlist.',
        embeds: [createWatchlistEmbed(record, interaction)],
        allowedMentions: { parse: [] },
    });
}

async function handleView(interaction) {
    const target = interaction.options.getString('target', true);
    const matches = await findWatchlistEntries(
        interaction.guildId,
        target,
        { includeRemoved: true }
    );

    if (matches.length === 0) {
        throw new WatchlistError(
            'ENTRY_NOT_FOUND',
            'No private watchlist records matched that entry ID or Roblox user.'
        );
    }

    await interaction.editReply({
        content:
            matches.length > 1
                ? `🔒 ${matches.length} private records matched. Showing the newest record; use \`/watchlist search\` to review the history.`
                : '🔒 Private watchlist record found.',
        embeds: [
            createWatchlistEmbed(
                matches[0],
                interaction
            ),
        ],
        allowedMentions: { parse: [] },
    });
}

async function handleSearch(interaction) {
    const records = await searchWatchlistEntries(
        interaction.guildId,
        {
            query: interaction.options.getString('query'),
            status:
                interaction.options.getString('status') ||
                'active',
            severity:
                interaction.options.getString('severity'),
            limit:
                interaction.options.getInteger('limit') || 10,
        }
    );

    await interaction.editReply({
        embeds: [createSearchEmbed(records, interaction)],
        allowedMentions: { parse: [] },
    });
}

async function handleScan(interaction) {
    const records = await getActiveWatchlistEntries(
        interaction.guildId
    );

    if (records.length === 0) {
        await interaction.editReply({
            embeds: [
                createScanEmbed([], interaction, {
                    activeRecordCount: 0,
                    onlinePlayerCount: null,
                    isMockMode: erlcService.isMockMode(),
                }),
            ],
            allowedMentions: { parse: [] },
        });
        return;
    }

    let players;

    try {
        players = await erlcService.getPlayers();
    } catch (error) {
        throw new WatchlistError(
            error.code || 'ERLC_SCAN_FAILED',
            erlcService.getPublicErrorMessage(error)
        );
    }

    const matches = matchWatchlistPlayers(records, players);

    console.log(
        `[WATCHLIST] action=scan active=${records.length} online=${players.length} matches=${matches.length} executor=${interaction.user.id} mode=${erlcService.isMockMode() ? 'mock' : 'live'} outcome=success`
    );

    await interaction.editReply({
        embeds: [
            createScanEmbed(matches, interaction, {
                activeRecordCount: records.length,
                onlinePlayerCount: players.length,
                isMockMode: erlcService.isMockMode(),
            }),
        ],
        allowedMentions: { parse: [] },
    });
}

async function handleDashboard(interaction) {
    const dashboard = await createWatchlistDashboard({
        guildId: interaction.guildId,
        executorId: interaction.user.id,
        executorMention: `<@${interaction.user.id}>`,
        guild: interaction.guild,
        client: interaction.client,
    });

    try {
        const message = await interaction.editReply({
            embeds: [dashboard.embed],
            components: [dashboard.components],
            allowedMentions: { parse: [] },
        });

        attachWatchlistDashboardMessage(
            dashboard.id,
            message
        );
    } catch (error) {
        removeWatchlistDashboard(dashboard.id);
        throw error;
    }
}

async function handleUpdate(interaction) {
    const patch = {};

    for (const field of [
        'severity',
        'reason',
        'evidence',
        'notes',
    ]) {
        const value = interaction.options.getString(field);

        if (value === null) {
            continue;
        }

        patch[field] =
            ['evidence', 'notes'].includes(field) &&
            ['clear', 'none', 'remove'].includes(
                value.trim().toLowerCase()
            )
                ? null
                : value;
    }

    if (Object.keys(patch).length === 0) {
        throw new WatchlistError(
            'NO_CHANGES',
            'Provide at least one field to update.'
        );
    }

    const record = await updateWatchlistEntry(
        interaction.guildId,
        interaction.options.getString('entry-id', true),
        {
            patch,
            actorId: interaction.user.id,
            actorUsername: interaction.user.username,
            changeReason: interaction.options.getString(
                'change-reason',
                true
            ),
        }
    );

    logAction('update', record, interaction.user.id);
    await interaction.editReply({
        content: '✅ The private watchlist entry was updated.',
        embeds: [createWatchlistEmbed(record, interaction)],
        allowedMentions: { parse: [] },
    });
}

async function handleResolve(interaction) {
    const record = await resolveWatchlistEntry(
        interaction.guildId,
        interaction.options.getString('entry-id', true),
        {
            resolution: interaction.options.getString(
                'resolution',
                true
            ),
            actorId: interaction.user.id,
            actorUsername: interaction.user.username,
        }
    );

    logAction('resolve', record, interaction.user.id);
    await interaction.editReply({
        content: '✅ The private watchlist entry was resolved.',
        embeds: [createWatchlistEmbed(record, interaction)],
        allowedMentions: { parse: [] },
    });
}

async function handleRemove(interaction) {
    const record = await removeWatchlistEntry(
        interaction.guildId,
        interaction.options.getString('entry-id', true),
        {
            removalReason: interaction.options.getString(
                'reason',
                true
            ),
            actorId: interaction.user.id,
            actorUsername: interaction.user.username,
        }
    );

    logAction('remove', record, interaction.user.id);
    await interaction.editReply({
        content:
            '✅ The entry was removed from active use and archived with its audit history intact.',
        embeds: [createWatchlistEmbed(record, interaction)],
        allowedMentions: { parse: [] },
    });
}

async function resolveRobloxIdentity(query) {
    let identity;

    try {
        identity = await robloxService.resolveUser(query);
    } catch (error) {
        console.error('Roblox watchlist lookup failed:', error);
        throw new WatchlistError(
            'ROBLOX_LOOKUP_FAILED',
            'Roblox could not be reached to verify that user. Please try again shortly.'
        );
    }

    if (!identity) {
        throw new WatchlistError(
            'ROBLOX_USER_NOT_FOUND',
            'That Roblox username or user ID could not be verified.'
        );
    }

    return identity;
}

function createWatchlistEmbed(record, interaction) {
    const severity =
        SEVERITY_PRESENTATION[record.severity] ||
        SEVERITY_PRESENTATION.medium;
    const guildIcon = interaction.guild?.iconURL?.({
        extension: 'png',
        size: 256,
    });
    const status = formatStatus(record.status);
    const profileUrl =
        `https://www.roblox.com/users/${record.robloxUserId}/profile`;
    const auditLines = (record.auditLog || [])
        .slice(-5)
        .reverse()
        .map((entry) =>
            `• **${formatAuditAction(entry.action)}** by ${entry.actorId ? `<@${entry.actorId}>` : safeText(entry.actorUsername, 40)} · ${discordTimestamp(entry.createdAt, 'R')}`
        );

    const embed = new EmbedBuilder()
        .setColor(severity.color)
        .setAuthor({
            name: interaction.guild?.name || brands.isrp.name,
            ...(guildIcon ? { iconURL: guildIcon } : {}),
        })
        .setTitle(
            `🔒 Private Watchlist — ${safeText(record.robloxUsername, 50)}`
        )
        .setDescription(
            'Internal management context only. An entry is an indicator for review—not proof of wrongdoing.'
        )
        .addFields(
            {
                name: 'Roblox Account',
                value:
                    `**[${safeText(record.robloxDisplayName, 80)} (@${safeText(record.robloxUsername, 50)})](${profileUrl})**\nUser ID: \`${safeCode(record.robloxUserId)}\``,
            },
            {
                name: 'Severity',
                value: `${severity.emoji} **${severity.label}**`,
                inline: true,
            },
            {
                name: 'Status',
                value: status,
                inline: true,
            },
            {
                name: 'Entry ID',
                value: `\`${safeCode(record.id)}\``,
                inline: true,
            },
            {
                name: 'Reason',
                value: safeText(record.reason, 1000),
            },
            {
                name: 'Evidence / Reference',
                value: safeText(
                    record.evidence,
                    1000,
                    'No evidence was attached.'
                ),
            },
            {
                name: 'Private Notes',
                value: safeText(
                    record.notes,
                    750,
                    'No additional notes.'
                ),
            },
            {
                name: 'Record Timeline',
                value: [
                    `Created: ${discordTimestamp(record.createdAt)}`,
                    `Updated: ${discordTimestamp(record.updatedAt, 'R')}`,
                    `Added by: ${record.createdById ? `<@${record.createdById}>` : safeText(record.createdByUsername, 50)}`,
                ].join('\n'),
            }
        )
        .setFooter({
            text:
                'Illinois State Utilities • Management access only',
            ...(guildIcon ? { iconURL: guildIcon } : {}),
        })
        .setTimestamp(new Date(record.updatedAt || record.createdAt));

    if (record.resolution) {
        embed.addFields({
            name: 'Resolution',
            value: safeText(record.resolution, 750),
        });
    }

    if (record.removalReason) {
        embed.addFields({
            name: 'Removal Reason',
            value: safeText(record.removalReason, 750),
        });
    }

    if (record.lastAcknowledgedAt) {
        embed.addFields({
            name: 'Latest Alert Acknowledgement',
            value: `${record.lastAcknowledgedById ? `<@${record.lastAcknowledgedById}>` : 'Authorized management'} • ${discordTimestamp(record.lastAcknowledgedAt, 'R')}`,
        });
    }

    if (record.lastDismissalReason) {
        embed.addFields({
            name: 'Latest False-Match Review',
            value: [
                `${record.lastDismissedById ? `<@${record.lastDismissedById}>` : 'Authorized management'} • ${discordTimestamp(record.lastDismissedAt, 'R')}`,
                safeText(record.lastDismissalReason, 500),
            ].join('\n'),
        });
    }

    if (auditLines.length) {
        embed.addFields({
            name: 'Recent Audit History',
            value: truncate(auditLines.join('\n'), 1000),
        });
    }

    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    return embed;
}

function createSearchEmbed(records, interaction) {
    const guildIcon = interaction.guild?.iconURL?.({
        extension: 'png',
        size: 256,
    });
    const embed = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setTitle('Watchlist Search')
        .setDescription(
            records.length
                ? [
                      `Found **${records.length}** matching private record${records.length === 1 ? '' : 's'}.`,
                      records.length > 15
                          ? 'Showing the first **15** results to stay within Discord’s safe display limits.'
                          : null,
                  ]
                      .filter(Boolean)
                      .join('\n')
                : 'No private watchlist records matched those filters.'
        )
        .setFooter({
            text:
                'Illinois State Utilities • Management access only',
            ...(guildIcon ? { iconURL: guildIcon } : {}),
        })
        .setTimestamp();

    for (const record of records.slice(0, 15)) {
        const severity =
            SEVERITY_PRESENTATION[record.severity] ||
            SEVERITY_PRESENTATION.medium;

        embed.addFields({
            name:
                `${severity.emoji} ${safeText(record.robloxUsername, 50)} • ${capitalize(record.status)}`,
            value: [
                `\`${safeCode(record.id)}\` • Roblox ID \`${safeCode(record.robloxUserId)}\``,
                truncate(record.reason, 180),
                `Updated ${discordTimestamp(record.updatedAt, 'R')}`,
            ].join('\n'),
        });
    }

    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    return embed;
}

function createScanEmbed(
    matches,
    interaction,
    {
        activeRecordCount = 0,
        onlinePlayerCount = 0,
        isMockMode = false,
    } = {}
) {
    const guildIcon = interaction.guild?.iconURL?.({
        extension: 'png',
        size: 256,
    });
    const visibleMatches = matches.slice(0, 10);
    const embed = new EmbedBuilder()
        .setColor(matches.length ? 0xed4245 : 0x57f287)
        .setTitle('Live Watchlist Scan')
        .setDescription(
            activeRecordCount === 0
                ? '✅ There are no active private watchlist records to scan.'
                : matches.length
                  ? `⚠️ Found **${matches.length}** verified active watchlist match${matches.length === 1 ? '' : 'es'} among the currently connected players.`
                  : '✅ No active watchlist users are visible in the ER:LC server.'
        )
        .addFields(
            {
                name: 'Scan Coverage',
                value: [
                    `Active records: **${activeRecordCount}**`,
                    onlinePlayerCount === null
                        ? 'Online players: **Not checked**'
                        : `Online players: **${onlinePlayerCount}**`,
                    `Mode: **${isMockMode ? 'Mock' : 'Live'}**`,
                ].join('\n'),
                inline: true,
            },
            {
                name: 'Safety',
                value:
                    'Exact Roblox IDs are matched first. Exact usernames are only used as a fallback; partial matches are never accepted.',
                inline: true,
            }
        )
        .setFooter({
            text:
                'Illinois State Utilities • Management access only • No public alert was sent',
            ...(guildIcon ? { iconURL: guildIcon } : {}),
        })
        .setTimestamp();

    for (const { record, player, matchedBy } of visibleMatches) {
        const severity =
            SEVERITY_PRESENTATION[record.severity] ||
            SEVERITY_PRESENTATION.medium;
        const profileUrl =
            `https://www.roblox.com/users/${record.robloxUserId}/profile`;

        embed.addFields({
            name:
                `${severity.emoji} ${safeText(record.robloxUsername, 50)} • ${severity.label}`,
            value: [
                `**[Open Roblox profile](${profileUrl})** • ID \`${safeCode(record.robloxUserId)}\``,
                `Entry \`${safeCode(record.id)}\` • In-game permission: **${safeText(player.permission, 80)}**`,
                `Reason: ${safeText(record.reason, 220)}`,
                `Verified by exact ${matchedBy === 'user_id' ? 'Roblox ID' : 'username'} match.`,
            ].join('\n'),
        });
    }

    if (matches.length > visibleMatches.length) {
        embed.addFields({
            name: 'Additional Matches',
            value:
                `There are **${matches.length - visibleMatches.length}** more verified matches. Use \`/watchlist search\` to review all active records.`,
        });
    }

    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    return embed;
}

function formatStatus(status) {
    const values = {
        active: '🟠 **Active Review**',
        resolved: '✅ **Resolved**',
        removed: '⚫ **Removed / Archived**',
    };
    return values[status] || `⚪ **${capitalize(status)}**`;
}

function formatAuditAction(action) {
    return String(action || 'updated')
        .replace(/^entry_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function discordTimestamp(value, style = 'F') {
    const milliseconds = new Date(value).getTime();

    if (!Number.isFinite(milliseconds)) {
        return 'Unknown';
    }

    return `<t:${Math.floor(milliseconds / 1000)}:${style}>`;
}

function safeCode(value) {
    return String(value || 'Unknown').replace(/`/g, 'ˋ');
}

function safeText(value, maximumLength, fallback = 'Not provided') {
    const text = String(value || '').trim();
    return text ? truncate(text, maximumLength) : fallback;
}

function truncate(value, maximumLength) {
    const text = String(value || '');
    return text.length <= maximumLength
        ? text
        : `${text.slice(0, maximumLength - 3)}...`;
}

function capitalize(value) {
    const text = String(value || 'unknown');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function logAction(action, record, executorId) {
    console.log(
        `[WATCHLIST] action=${action} entry=${record.id} roblox=${record.robloxUserId} executor=${executorId} outcome=success`
    );
}
