const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const {
    readDatabase,
} = require('../../utils/database');

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

            const visibility =
                interaction.options.getString(
                    'visibility'
                ) || 'private';

            const isPrivate =
                visibility === 'private';

            await interaction.deferReply({
                flags: isPrivate
                    ? MessageFlags.Ephemeral
                    : undefined,
            });

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

            const recentActions =
                [...staffHistory]
                    .sort(
                        (
                            firstRecord,
                            secondRecord
                        ) =>
                            new Date(
                                secondRecord.createdAt
                            ).getTime() -
                            new Date(
                                firstRecord.createdAt
                            ).getTime()
                    )
                    .slice(0, 5);

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

            const totalDisciplinaryActions =
                Number(
                    staffProfile.totalInfractionCount ||
                    0
                );

            const profileDescription = [
                `Below is the saved staff profile for ${staffMember}.`,
                '',
                '**Current Rank**',
                staffProfile.currentRank ||
                    'Not recorded',
                '',
                '**Staff Status**',
                staffStatus,
                '',
                '**Blacklist Status**',
                blacklistStatus,
                '',
                '**Leave of Absence**',
                loaDisplay,
                '',
                '**Career Records**',
                `Promotions: ${Number(
                    staffProfile.promotionCount || 0
                )}`,
                `Demotions: ${Number(
                    staffProfile.demotionCount || 0
                )}`,
                `Awards: ${Number(
                    staffProfile.awardCount || 0
                )}`,
                '',
                '**Disciplinary Records**',
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
                `Total Actions: ${totalDisciplinaryActions}`,
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

            if (recentActions.length > 0) {
                profileDescription.push(
                    '',
                    '**Recent Staff Actions**'
                );

                for (
                    let index = 0;
                    index < recentActions.length;
                    index += 1
                ) {
                    const record =
                        recentActions[index];

                    const action =
                        getActionInformation(
                            record
                        );

                    const actionDate =
                        createDiscordTimestamp(
                            record.createdAt,
                            'd'
                        );

                    profileDescription.push(
                        '',
                        `${action.emoji} **${action.label}** — ${actionDate}`,
                        truncateText(
                            action.summary,
                            180
                        )
                    );
                }
            } else {
                profileDescription.push(
                    '',
                    '**Recent Staff Actions**',
                    'No unified staff-history records are available yet.'
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
                        'ISRP | Staff Profile'
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
                            'Illinois State Utilities • Staff Management System',

                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            await interaction.editReply({
                embeds: [
                    staffProfileEmbed,
                ],

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