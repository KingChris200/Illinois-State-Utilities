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
    ISRP_CHANNELS,
    MAIN_SERVER_ID,
    memberCanReviewMovements,
} = require('../../config/serverConfigs');

const {
    getFeedbackCooldown,
    isEligibleStaffMember,
    submitStaffFeedback,
} = require('../../utils/staffFeedbackManager');

const {
    analyzeStaffProfile,
} = require('../../utils/staffProfileIntelligence');
const brands = require('../../config/branding');

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
                `**${action.label}**${status} — ${createDiscordTimestamp(
                    record.createdAt,
                    'd'
                )}`,
                truncateText(action.summary, 140),
            ].join('\n');
        })
        .join('\n\n');
}

async function executeStaffFeedback(interaction) {
    if (interaction.guildId !== MAIN_SERVER_ID) {
        await interaction.reply({
            content: 'This command is only available in Illinois State Roleplay.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (interaction.channelId !== ISRP_CHANNELS.commands) {
        await interaction.reply({
            content: `Use \`/staff feedback\` in <#${ISRP_CHANNELS.commands}>.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const targetUser = interaction.options.getUser('staff', true);
    const rating = interaction.options.getInteger('rating', true);
    const reason = interaction.options.getString('reason', true).trim();

    if (targetUser.id === interaction.user.id) {
        await interaction.reply({
            content: 'You cannot submit feedback about yourself.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const targetMember = await interaction.guild.members
        .fetch(targetUser.id)
        .catch(() => null);

    if (!isEligibleStaffMember(targetMember)) {
        await interaction.reply({
            content: 'Choose a current Illinois State Roleplay staff member.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const cooldownExpiresAt = await getFeedbackCooldown(
        interaction.guildId,
        interaction.user.id,
        targetUser.id
    );

    if (cooldownExpiresAt) {
        await interaction.reply({
            content: `You can leave feedback for this staff member again <t:${Math.ceil(cooldownExpiresAt / 1000)}:R>.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        await submitStaffFeedback({
            interaction,
            targetMember,
            rating,
            reason,
        });
    } catch (error) {
        console.error('[STAFF FEEDBACK] Submission failed:', error);
        await interaction.editReply(
            'I could not submit that feedback. Please try again.'
        ).catch(() => null);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDMPermission(false)
        .setDescription(
            'Staff records and feedback.'
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('profile')
                .setDescription('View a staff record.')
                .addUserOption((option) =>
                    option
                        .setName('staff-member')
                        .setDescription(
                            'The staff member to view.'
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('visibility')
                        .setDescription(
                            'Show the record privately or publicly.'
                        )
                        .addChoices(
                            {
                                name: 'Private',
                                value: 'private',
                            },
                            {
                                name: 'Public',
                                value: 'public',
                            }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('feedback')
                .setDescription('Give feedback about a staff member.')
                .addUserOption((option) =>
                    option
                        .setName('staff')
                        .setDescription('The staff member who assisted you.')
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('rating')
                        .setDescription('Rate your experience from one to five stars.')
                        .setRequired(true)
                        .addChoices(
                            { name: '⭐ 1 Star', value: 1 },
                            { name: '⭐⭐ 2 Stars', value: 2 },
                            { name: '⭐⭐⭐ 3 Stars', value: 3 },
                            { name: '⭐⭐⭐⭐ 4 Stars', value: 4 },
                            { name: '⭐⭐⭐⭐⭐ 5 Stars', value: 5 }
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Explain your experience with this staff member.')
                        .setRequired(true)
                        .setMinLength(15)
                        .setMaxLength(1000)
                )
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

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'feedback') {
                await executeStaffFeedback(interaction);
                return;
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
                        '❌ Private staff records are limited to management, Internal Affairs, directors, and ownership. Use `visibility:Public` for the public profile.',
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
                        .setTitle('Staff Record')
                        .setDescription(
                            [
                                `${staffMember} does not have a saved staff profile yet.`,
                                '',
                                'Their record will appear after the first staff action is logged.',
                            ].join('\n')
                        )
                        .setThumbnail(
                            staffMember.displayAvatarURL({
                                size: 256,
                            })
                        )
                        .setFooter({
                            text: 'Illinois State Utilities',
                            iconURL: brands.assets.logo,
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
                `${staffMember}`,
                '',
                `**Rank:** ${staffProfile.currentRank || 'Not recorded'}`,
                `**Status:** ${staffStatus}`,
                `**LOA:** ${loaDisplay}`,
                `**Staff since:** ${createDiscordTimestamp(staffProfile.joinedStaffAt, 'D')}`,
                `**Shift time:** ${formatDuration(staffProfile.totalShiftMilliseconds)}`,
            ];

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
                            ? 'Staff Record'
                            : 'Staff Profile'
                    )
                    .setDescription(
                        profileDescription.join('\n')
                    )
                    .setThumbnail(
                        staffMember.displayAvatarURL({
                            size: 256,
                        })
                    )
                    .setFooter({
                        text:
                            isPrivate
                                ? 'Private management record'
                                : 'Illinois State Roleplay',

                        iconURL: brands.assets.logo,
                    })
                    .setTimestamp();

            staffProfileEmbed.addFields({
                name: isPrivate ? 'Record Summary' : 'Career Summary',
                value: [
                    `Promotions: **${profileAnalysis.totals.promotions}**`,
                    `Awards: **${profileAnalysis.totals.awards}**`,
                    ...(isPrivate
                        ? [
                              `Demotions: **${profileAnalysis.totals.demotions}**`,
                              `Active actions: **${profileAnalysis.totals.activeInfractions}**`,
                              `Blacklist: **${blacklistStatus}**`,
                          ]
                        : []),
                ].join('\n'),
                inline: true,
            });

            staffProfileEmbed.addFields({
                name: 'Recent Records',
                value: formatTimeline(
                    isPrivate
                        ? profileAnalysis.events
                        : profileAnalysis.careerTimeline,
                    'No recent records.'
                ),
            });

            if (isPrivate) {
                staffProfileEmbed.addFields({
                    name: 'Management Note',
                    value: `**${profileAnalysis.standing.label}** — ${profileAnalysis.eligibility.recommendation}`,
                });
            }

            await interaction.editReply({
                embeds: [staffProfileEmbed],

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
