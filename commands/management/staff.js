const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const {
    readDatabase,
} = require('../../utils/database');

const {
    memberCanReviewMovements,
} = require('../../config/serverConfigs');

const {
    analyzeStaffProfile,
} = require('../../utils/staffProfileIntelligence');

function convertHexToDecimal(hexColor) {
    if (typeof hexColor !== 'string') {
        return 0x005b96;
    }

    const cleanedColor = hexColor
        .trim()
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    const parsedColor = Number.parseInt(cleanedColor, 16);

    if (Number.isNaN(parsedColor)) {
        return 0x005b96;
    }

    return parsedColor;
}

function createDiscordTimestamp(dateInput, style = 'F') {
    if (!dateInput) {
        return 'Not recorded';
    }

    const timestamp = new Date(dateInput).getTime();

    if (Number.isNaN(timestamp)) {
        return 'Not recorded';
    }

    return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function formatDuration(milliseconds) {
    const totalMilliseconds = Number(milliseconds || 0);

    if (
        !Number.isFinite(totalMilliseconds) ||
        totalMilliseconds <= 0
    ) {
        return '0 hours';
    }

    const totalMinutes = Math.floor(
        totalMilliseconds / 60000
    );

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    if (minutes === 0) {
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    return `${hours}h ${minutes}m`;
}

function getActionInformation(record) {
    const recordType =
        record.historyType ||
        record.type ||
        'unknown';

    if (recordType === 'promotion') {
        return {
            emoji: '⬆️',
            label: 'Promotion',
            summary:
                `${record.previousRank || 'Unknown'} → ` +
                `${record.newRank || 'Unknown'}`,
        };
    }

    if (recordType === 'demotion') {
        return {
            emoji: '⬇️',
            label: 'Demotion',
            summary:
                `${record.previousRank || 'Unknown'} → ` +
                `${record.newRank || 'Unknown'}`,
        };
    }

    if (
        recordType === 'award' ||
        String(recordType).startsWith('award')
    ) {
        return {
            emoji: record.awardEmoji || '🏆',
            label:
                record.awardName ||
                'Staff Award',
            summary:
                record.reason ||
                'Recognition recorded',
        };
    }

    const infractionLabels = {
        notice: 'Notice',
        inactivity_notice: 'Inactivity Notice',
        warning: 'Warning',
        strike: 'Strike',
        termination: 'Termination',
        blacklist: 'Blacklist',
    };

    const infractionEmojis = {
        notice: '🟡',
        inactivity_notice: '🟠',
        warning: '⚠️',
        strike: '🔴',
        termination: '⛔',
        blacklist: '🚫',
    };

    if (infractionLabels[record.type]) {
        return {
            emoji:
                infractionEmojis[record.type] || '📋',

            label:
                infractionLabels[record.type],

            summary:
                record.reason || 'No reason recorded',
        };
    }

    return {
        emoji: '📋',
        label: 'Staff Action',
        summary:
            record.reason ||
            record.notes ||
            'No details recorded',
    };
}

function truncateText(text, maximumLength) {
    const value = String(
        text || 'No details recorded'
    ).trim();

    if (value.length <= maximumLength) {
        return value;
    }

    return `${value.slice(0, maximumLength - 3)}...`;
}

function canViewPrivateInsights(interaction) {
    const member = interaction.member;

    return Boolean(
        interaction.guild?.ownerId ===
            interaction.user.id ||
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
        member?.permissions?.has(
            PermissionFlagsBits.ManageGuild
        ) ||
        memberCanReviewMovements(
            member,
            interaction.guildId
        )
    );
}

function formatTimeline(records, emptyMessage) {
    if (!Array.isArray(records) || records.length === 0) {
        return emptyMessage;
    }

    return records
        .slice(0, 5)
        .map((record) => {
            const action = getActionInformation({
                ...record,
                historyType:
                    record.eventType ||
                    record.historyType,
            });

            const status = [
                'revoked',
                'resolved',
                'dismissed',
                'expired',
                'closed',
            ].includes(
                String(record.status || '')
                    .toLowerCase()
            )
                ? ` • ${record.status}`
                : '';

            return [
                `${action.emoji} **${action.label}**${status} — ${createDiscordTimestamp(
                    record.createdAt,
                    'd'
                )}`,
                truncateText(action.summary, 140),
            ].join('\n');
        })
        .join('\n\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription(
            'View an Illinois State Roleplay staff profile.'
        )

        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription(
                    'The staff member whose profile you want to view.'
                )
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('visibility')
                .setDescription(
                    'Choose whether the profile is private or public.'
                )
                .addChoices(
                    {
                        name: 'Private — Only you can see it',
                        value: 'private',
                    },
                    {
                        name: 'Public — Everyone can see it',
                        value: 'public',
                    }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.reply({
                    content:
                        '❌ This command can only be used inside a Discord server.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const staffMember =
                interaction.options.getUser(
                    'staff-member',
                    true
                );

            const hasPrivateAccess =
                canViewPrivateInsights(
                    interaction
                );

            const requestedVisibility =
                interaction.options.getString(
                    'visibility'
                );

            const visibility =
                requestedVisibility ||
                (hasPrivateAccess
                    ? 'private'
                    : 'public');

            const isPrivate =
                visibility === 'private';

            await interaction.deferReply({
                flags: isPrivate
                    ? MessageFlags.Ephemeral
                    : undefined,
            });

            if (
                isPrivate &&
                !hasPrivateAccess
            ) {
                return interaction.editReply({
                    content:
                        '❌ Private staff intelligence is limited to authorized management, Internal Affairs, directors, and ownership. Use `visibility:Public` for the safe staff résumé.',
                });
            }

            const configurations =
                await readDatabase(
                    'guild-configs',
                    {}
                );

            const guildConfiguration =
                configurations[
                    interaction.guildId
                ];

            if (!guildConfiguration) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities has not been configured in this server yet.\n\nRun `/setup` before using staff profiles.',
                });
            }

            const staffRecordsDatabase =
                await readDatabase(
                    'staff-records',
                    {}
                );

            const guildStaffRecords =
                staffRecordsDatabase[
                    interaction.guildId
                ] || {};

            const staffProfile =
                guildStaffRecords[
                    staffMember.id
                ];

            if (!staffProfile) {
                const missingProfileEmbed =
                    new EmbedBuilder()
                        .setColor(
                            convertHexToDecimal(
                                guildConfiguration.brandColor
                            )
                        )
                        .setTitle(
                            'ISRP | Staff Profile'
                        )
                        .setDescription(
                            [
                                `${staffMember} does not have a saved staff profile yet.`,
                                '',
                                'A profile is created automatically after their first recorded promotion, demotion, or disciplinary action.',
                            ].join('\n')
                        )
                        .setThumbnail(
                            staffMember.displayAvatarURL({
                                size: 256,
                            })
                        )
                        .setAuthor({
                            name:
                                guildConfiguration.serverName ||
                                interaction.guild.name,

                            iconURL:
                                interaction.guild.iconURL({
                                    dynamic: true,
                                }) || undefined,
                        })
                        .setFooter({
                            text:
                                'Illinois State Utilities • Staff Management System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                return interaction.editReply({
                    embeds: [
                        missingProfileEmbed,
                    ],

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const staffHistoryDatabase =
                await readDatabase(
                    'staff-history',
                    {}
                );

            const staffHistory =
                Array.isArray(
                    staffHistoryDatabase[
                        interaction.guildId
                    ]?.[staffMember.id]
                )
                    ? staffHistoryDatabase[
                          interaction.guildId
                      ][staffMember.id]
                    : [];

            const profileAnalysis =
                analyzeStaffProfile({
                    profile: staffProfile,
                    history: staffHistory,
                });

            const recentActions = isPrivate
                ? profileAnalysis.events.slice(0, 5)
                : profileAnalysis.careerTimeline;

            const staffStatus =
                staffProfile.staffStatus ||
                'Active';

            const blacklistStatus =
                staffProfile.blacklistStatus ||
                'Not Blacklisted';

            const activeLoa =
                staffProfile.activeLoa;

            const loaDisplay =
                activeLoa
                    ? activeLoa.status ||
                      'Active LOA'
                    : 'None';

            const profileDescription = [
                isPrivate
                    ? `Private management review for ${staffMember}.`
                    : `Public staff résumé for ${staffMember}.`,
                '',
                '**Current Rank**',
                staffProfile.currentRank ||
                    'Not recorded',
                '',
                '**Staff Status**',
                staffStatus,
                '',
                '**Leave of Absence**',
                loaDisplay,
                '',
                '**Career Records**',
                `Promotions: ${profileAnalysis.totals.promotions}`,
                `Active Awards: ${profileAnalysis.totals.awards}`,
                '',
                '**Shift Activity**',
                `Total Recorded Time: ${formatDuration(
                    staffProfile
                        .totalShiftMilliseconds
                )}`,
                '',
                '**Profile Information**',
                `Joined Staff: ${createDiscordTimestamp(
                    staffProfile.joinedStaffAt,
                    'D'
                )}`,
                `Profile Created: ${createDiscordTimestamp(
                    staffProfile.createdAt,
                    'D'
                )}`,
                `Last Updated: ${createDiscordTimestamp(
                    staffProfile.updatedAt,
                    'R'
                )}`,
            ];

            if (isPrivate) {
                profileDescription.push(
                    '',
                    '**Restricted Management Records**',
                    `Blacklist Status: ${blacklistStatus}`,
                    `Demotions: ${profileAnalysis.totals.demotions}`,
                    `Notices: ${Number(
                        staffProfile.noticeCount || 0
                    )}`,
                    `Inactivity Notices: ${Number(
                        staffProfile
                            .inactivityNoticeCount || 0
                    )}`,
                    `Warnings: ${Number(
                        staffProfile.warningCount || 0
                    )}`,
                    `Strikes: ${Number(
                        staffProfile.strikeCount || 0
                    )}`,
                    `Terminations: ${Number(
                        staffProfile
                            .terminationCount || 0
                    )}`,
                    `Blacklists: ${Number(
                        staffProfile.blacklistCount || 0
                    )}`,
                    `Active Actions: ${profileAnalysis.totals.activeInfractions}`
                );
            }

            if (isPrivate) {
                profileDescription.push(
                    '',
                    '**Recent Activity Summary**',
                    `${profileAnalysis.recent.actions30Days} action(s) within 30 days`,
                    `${profileAnalysis.recent.actions90Days} action(s) within 90 days`,
                    `${profileAnalysis.totals.activeInfractions} active disciplinary record(s)`
                );
            } else {
                profileDescription.push(
                    '',
                    '**Recent Career Highlights**',
                    formatTimeline(
                        recentActions,
                        'No recent promotions or active awards are recorded.'
                    )
                );
            }

            const statusColor =
                staffStatus === 'Blacklisted'
                    ? 0x2b2d31
                    : staffStatus === 'Terminated'
                      ? 0x992d22
                      : convertHexToDecimal(
                            guildConfiguration.brandColor
                        );

            const staffProfileEmbed =
                new EmbedBuilder()
                    .setColor(statusColor)
                    .setTitle(
                        isPrivate
                            ? 'ISRP | Staff Management Profile'
                            : 'ISRP | Public Staff Profile'
                    )
                    .setDescription(
                        profileDescription.join('\n')
                    )
                    .setThumbnail(
                        staffMember.displayAvatarURL({
                            size: 256,
                        })
                    )
                    .setAuthor({
                        name:
                            guildConfiguration.serverName ||
                            interaction.guild.name,

                        iconURL:
                            interaction.guild.iconURL({
                                dynamic: true,
                            }) || undefined,
                    })
                    .setFooter({
                        text:
                            isPrivate
                                ? 'Illinois State Utilities • Private Management Review'
                                : 'Illinois State Utilities • Public Staff Résumé',

                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            const managementInsightsEmbed =
                isPrivate
                    ? new EmbedBuilder()
                          .setColor(
                              profileAnalysis
                                  .standing.color
                          )
                          .setTitle(
                              '🧠 Private Management Intelligence'
                          )
                          .setDescription(
                              'Rule-based decision support generated from saved staff records. This does not replace leadership judgment or authorize an automatic promotion.'
                          )
                          .addFields(
                              {
                                  name: 'Overall Standing',
                                  value: `${profileAnalysis.standing.emoji} **${profileAnalysis.standing.label}**\nReview index: **${profileAnalysis.score} / 100**`,
                                  inline: true,
                              },
                              {
                                  name: 'Promotion Guidance',
                                  value: `${profileAnalysis.eligibility.emoji} **${profileAnalysis.eligibility.label}**\n${profileAnalysis.eligibility.recommendation}`,
                                  inline: false,
                              },
                              {
                                  name: 'Review Context',
                                  value: [
                                      `Recorded tenure: **${
                                          profileAnalysis.tenureDays ===
                                          null
                                              ? 'Unknown'
                                              : `${profileAnalysis.tenureDays} day(s)`
                                      }**`,
                                      `Last promotion: **${
                                          profileAnalysis.daysSincePromotion ===
                                          null
                                              ? 'None recorded'
                                              : `${profileAnalysis.daysSincePromotion} day(s) ago`
                                      }**`,
                                      `Active discipline: **${profileAnalysis.totals.activeInfractions}**`,
                                  ].join('\n'),
                                  inline: true,
                              },
                              {
                                  name: 'Assessment Factors',
                                  value: profileAnalysis.factors
                                      .map(
                                          (factor) =>
                                              `• ${factor}`
                                      )
                                      .join('\n'),
                                  inline: false,
                              },
                              {
                                  name: 'Career Timeline',
                                  value: formatTimeline(
                                      profileAnalysis.careerTimeline,
                                      'No promotions or active awards are recorded.'
                                  ),
                                  inline: false,
                              },
                              {
                                  name: 'Disciplinary Timeline',
                                  value: formatTimeline(
                                      profileAnalysis.disciplinaryTimeline,
                                      'No demotions or disciplinary actions are recorded.'
                                  ),
                                  inline: false,
                              }
                          )
                          .setThumbnail(
                              staffMember.displayAvatarURL({
                                  size: 256,
                              })
                          )
                          .setFooter({
                              text:
                                  'Illinois State Utilities • Authorized Management Only',
                              iconURL:
                                  interaction.client.user.displayAvatarURL(),
                          })
                          .setTimestamp()
                    : null;

            await interaction.editReply({
                embeds: managementInsightsEmbed
                    ? [
                          staffProfileEmbed,
                          managementInsightsEmbed,
                      ]
                    : [staffProfileEmbed],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /staff:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while loading this staff profile.',
            };

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await interaction
                    .editReply(
                        errorMessage
                    )
                    .catch(() => {});
            } else {
                await interaction
                    .reply({
                        ...errorMessage,

                        flags:
                            MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }
        }
    },
};
