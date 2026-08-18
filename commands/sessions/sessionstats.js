const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const { readDatabase } = require('../../utils/database');
const {
    DATABASE_NAME,
} = require('../../services/sessionAnalyticsService');
const {
    normalizeSessionHistory,
    summarizeSessionHistory,
    findSessionRecords,
} = require('../../utils/sessionAnalytics');
const brands = require('../../config/branding');

const SERVER_NAME = 'Illinois State Roleplay | Strict';
const EMBED_COLOR = '#24589B';

function formatDuration(milliseconds) {
    if (!Number.isFinite(milliseconds)) {
        return 'Unavailable';
    }

    const totalMinutes = Math.max(
        0,
        Math.floor(milliseconds / 60000)
    );
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days > 0) {
        parts.push(`${days} day${days === 1 ? '' : 's'}`);
    }

    if (hours > 0) {
        parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    }

    if (minutes > 0 || parts.length === 0) {
        parts.push(
            `${minutes} minute${minutes === 1 ? '' : 's'}`
        );
    }

    return parts.join(', ');
}

function formatNumber(value, digits = 1) {
    if (!Number.isFinite(value)) {
        return 'Unavailable';
    }

    return Number(value.toFixed(digits)).toString();
}

function getRecordTimestamp(record) {
    const timestamp = new Date(
        record?.endedAt ||
            record?.createdAt ||
            record?.startedAt ||
            0
    ).getTime();

    return Number.isFinite(timestamp) && timestamp > 0
        ? Math.floor(timestamp / 1000)
        : null;
}

function formatRecord(record, value) {
    if (!record) {
        return '`No recorded session`';
    }

    const timestamp = getRecordTimestamp(record);
    const details = [
        `**${value}**`,
        timestamp ? `<t:${timestamp}:D>` : 'Date unavailable',
    ];

    if (record.hostId) {
        details.push(`Hosted by <@${record.hostId}>`);
    }

    if (record.recapMessageUrl) {
        details.push(
            `[View original recap](${record.recapMessageUrl})`
        );
    }

    return details.join('\n');
}

function createBaseEmbed({ guildIcon, title, description }) {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({
            name: SERVER_NAME,
            iconURL: guildIcon || undefined,
        })
        .setTitle(title)
        .setDescription(description)
        .setFooter({
            text:
                'Illinois State Utilities • Private Session Intelligence',
            iconURL: guildIcon || undefined,
        })
        .setTimestamp();

    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    return embed;
}

function createLatestSessionEmbed(history, guildIcon) {
    const latest = history[0];
    const embed = createBaseEmbed({
        guildIcon,
        title: '📋 Latest Session Report',
        description:
            'The most recently completed Illinois State Roleplay session.',
    });

    embed.addFields(
        {
            name: 'Starting Players',
            value: `\`${formatNumber(latest.startingPlayerCount)}\``,
            inline: true,
        },
        {
            name: 'Peak Players',
            value: `\`${formatNumber(latest.peakPlayerCount)}\``,
            inline: true,
        },
        {
            name: 'Ending Players',
            value: `\`${formatNumber(latest.endingPlayerCount)}\``,
            inline: true,
        },
        {
            name: 'Average Population',
            value: `\`${formatNumber(latest.averagePlayerCount)}\``,
            inline: true,
        },
        {
            name: 'Confirmed Attendance',
            value: `\`${formatNumber(latest.attendeeCount, 0)}\``,
            inline: true,
        },
        {
            name: 'Peak Queue',
            value: `\`${formatNumber(latest.peakQueueCount, 0)}\``,
            inline: true,
        },
        {
            name: 'Session Duration',
            value: `\`${formatDuration(
                latest.durationMilliseconds
            )}\``,
            inline: true,
        },
        {
            name: 'Session Host',
            value: latest.hostId
                ? `<@${latest.hostId}>`
                : '`Unavailable`',
            inline: true,
        },
        {
            name: 'Roleplay Zone',
            value: latest.roleplayZone || 'Statewide',
            inline: true,
        }
    );

    const endedTimestamp = getRecordTimestamp(latest);
    const details = [];

    if (endedTimestamp) {
        details.push(
            `Completed <t:${endedTimestamp}:F> (<t:${endedTimestamp}:R>)`
        );
    }

    if (latest.recapMessageUrl) {
        details.push(
            `[Open the original shutdown recap](${latest.recapMessageUrl})`
        );
    }

    if (details.length > 0) {
        embed.addFields({
            name: 'Session Record',
            value: details.join('\n'),
        });
    }

    return embed;
}

function createSummaryEmbed(history, guildIcon) {
    const summary = summarizeSessionHistory(history);
    const embed = createBaseEmbed({
        guildIcon,
        title: '📊 Session Statistics Summary',
        description:
            'Combined performance across every completed session currently stored by Illinois State Utilities.',
    });

    embed.addFields(
        {
            name: 'Sessions Recorded',
            value: `\`${summary.sessionCount}\``,
            inline: true,
        },
        {
            name: 'Total Session Time',
            value: `\`${formatDuration(
                summary.totalDurationMilliseconds
            )}\``,
            inline: true,
        },
        {
            name: 'Average Duration',
            value: `\`${formatDuration(
                summary.averageDurationMilliseconds
            )}\``,
            inline: true,
        },
        {
            name: 'Average Peak Players',
            value: `\`${formatNumber(
                summary.averagePeakPlayerCount
            )}\``,
            inline: true,
        },
        {
            name: 'Average Population',
            value: `\`${formatNumber(
                summary.averagePlayerCount
            )}\``,
            inline: true,
        },
        {
            name: 'Average Confirmed',
            value: `\`${formatNumber(
                summary.averageConfirmedAttendance
            )}\``,
            inline: true,
        },
        {
            name: 'Total Confirmed Attendance',
            value: `\`${summary.totalConfirmedAttendance}\``,
            inline: true,
        }
    );

    const oldestTimestamp = getRecordTimestamp(
        summary.oldestSession
    );
    const newestTimestamp = getRecordTimestamp(
        summary.newestSession
    );

    if (oldestTimestamp && newestTimestamp) {
        embed.addFields({
            name: 'Tracking Window',
            value:
                `<t:${oldestTimestamp}:D> — ` +
                `<t:${newestTimestamp}:D>`,
            inline: true,
        });
    }

    return embed;
}

function createRecordsEmbed(history, guildIcon) {
    const records = findSessionRecords(history);
    const embed = createBaseEmbed({
        guildIcon,
        title: '🏆 Illinois Session Records',
        description:
            'All-time session highs calculated from completed session recaps.',
    });

    embed.addFields(
        {
            name: '👥 Highest Player Peak',
            value: formatRecord(
                records.highestPeak,
                records.highestPeak
                    ? `${records.highestPeak.peakPlayerCount} players`
                    : 'Unavailable'
            ),
            inline: true,
        },
        {
            name: '📈 Highest Average Population',
            value: formatRecord(
                records.highestAverage,
                records.highestAverage
                    ? `${formatNumber(
                          records.highestAverage.averagePlayerCount
                      )} players`
                    : 'Unavailable'
            ),
            inline: true,
        },
        {
            name: '⏱️ Longest Session',
            value: formatRecord(
                records.longestSession,
                records.longestSession
                    ? formatDuration(
                          records.longestSession.durationMilliseconds
                      )
                    : 'Unavailable'
            ),
            inline: true,
        },
        {
            name: '🚦 Largest Queue',
            value: formatRecord(
                records.largestQueue,
                records.largestQueue
                    ? `${records.largestQueue.peakQueueCount} queued`
                    : 'Unavailable'
            ),
            inline: true,
        },
        {
            name: '✅ Most Confirmed Attendees',
            value: formatRecord(
                records.highestConfirmedAttendance,
                records.highestConfirmedAttendance
                    ? `${records.highestConfirmedAttendance.attendeeCount} confirmed`
                    : 'Unavailable'
            ),
            inline: true,
        },
        {
            name: '🔥 Strongest Turnout',
            value: formatRecord(
                records.strongestTurnout,
                records.strongestTurnout
                    ? `${
                          records.strongestTurnout
                              .attendanceDifference >= 0
                              ? '+'
                              : ''
                      }${records.strongestTurnout.attendanceDifference} vs confirmed`
                    : 'Unavailable'
            ),
            inline: true,
        }
    );

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sessionstats')
        .setDMPermission(false)
        .setDescription(
            'Privately view completed Illinois State Roleplay session statistics.'
        )
        .addStringOption((option) =>
            option
                .setName('view')
                .setDescription(
                    'Choose which session report to display.'
                )
                .addChoices(
                    {
                        name: 'Server Summary',
                        value: 'summary',
                    },
                    {
                        name: 'Latest Session',
                        value: 'latest',
                    },
                    {
                        name: 'Records & Highs',
                        value: 'records',
                    }
                )
                .setRequired(false)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content:
                    '❌ This command can only be used inside a Discord server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const canViewStatistics =
            interaction.guild.ownerId ===
                interaction.user.id ||
            interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            );

        if (!canViewStatistics) {
            return interaction.reply({
                content:
                    '❌ You need the **Manage Server** permission to view private session intelligence.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const view =
            interaction.options.getString('view') || 'summary';

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        try {
            const database = await readDatabase(
                DATABASE_NAME,
                {}
            );
            const history = normalizeSessionHistory(
                database[interaction.guildId]
            );

            if (history.length === 0) {
                return interaction.editReply({
                    content:
                        '📊 No completed session analytics are recorded yet. Complete a session with `/ssd`, then run `/sessionstats` again.',
                });
            }

            const guildIcon = brands.assets.logo;

            let embed;

            if (view === 'latest') {
                embed = createLatestSessionEmbed(
                    history,
                    guildIcon
                );
            } else if (view === 'records') {
                embed = createRecordsEmbed(
                    history,
                    guildIcon
                );
            } else {
                embed = createSummaryEmbed(
                    history,
                    guildIcon
                );
            }

            await interaction.editReply({
                embeds: [embed],
                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /sessionstats:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ Something went wrong while loading the session statistics.',
            });
        }
    },

    createLatestSessionEmbed,
    createSummaryEmbed,
    createRecordsEmbed,
    formatDuration,
};
