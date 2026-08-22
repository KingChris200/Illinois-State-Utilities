const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const {
    readDatabase,
    updateDatabase,
    createRecordId,
} = require('../../utils/database');
const brands = require('../../config/branding');

const AWARD_TYPES = {
    staff_of_the_week: {
        name: 'Staff of the Week',
        emoji: '🌟',
    },

    staff_of_the_month: {
        name: 'Staff of the Month',
        emoji: '🏆',
    },

    outstanding_leadership: {
        name: 'Outstanding Leadership',
        emoji: '👑',
    },

    exceptional_activity: {
        name: 'Exceptional Activity',
        emoji: '⚡',
    },

    community_excellence: {
        name: 'Community Excellence',
        emoji: '💙',
    },

    distinguished_service: {
        name: 'Distinguished Service',
        emoji: '🎖️',
    },

    professionalism: {
        name: 'Professionalism Award',
        emoji: '🛡️',
    },

    custom: {
        name: 'Custom Award',
        emoji: '🏅',
    },
};

function convertHexToDecimal(hexColor) {
    if (typeof hexColor !== 'string') {
        return 0x005b96;
    }

    const cleanedColor = hexColor
        .trim()
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    const parsedColor = Number.parseInt(
        cleanedColor,
        16
    );

    return Number.isNaN(parsedColor)
        ? 0x005b96
        : parsedColor;
}

function canManageAwards(interaction) {
    return (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageMessages
        ) ||
        interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        ) ||
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function createDiscordTimestamp(
    dateInput,
    style = 'F'
) {
    const timestamp = new Date(
        dateInput
    ).getTime();

    if (Number.isNaN(timestamp)) {
        return 'Unknown date';
    }

    return `<t:${Math.floor(
        timestamp / 1000
    )}:${style}>`;
}

function truncateText(
    text,
    maximumLength,
    fallback = 'Not provided'
) {
    if (
        text === null ||
        text === undefined ||
        String(text).trim().length === 0
    ) {
        return fallback;
    }

    const normalizedText =
        String(text).trim();

    if (
        normalizedText.length <=
        maximumLength
    ) {
        return normalizedText;
    }

    return `${normalizedText.slice(
        0,
        maximumLength - 3
    )}...`;
}

function findAwardById(
    awardsDatabase,
    guildId,
    awardId
) {
    const guildAwards =
        Array.isArray(
            awardsDatabase[guildId]
        )
            ? awardsDatabase[guildId]
            : [];

    return (
        guildAwards.find(
            (award) =>
                String(
                    award.id
                ).toLowerCase() ===
                String(
                    awardId
                ).toLowerCase()
        ) || null
    );
}

async function addStaffHistoryRecord(
    guildId,
    staffMemberId,
    historyRecord
) {
    await updateDatabase(
        'staff-history',

        (staffHistory) => {
            if (
                !staffHistory ||
                typeof staffHistory !== 'object' ||
                Array.isArray(staffHistory)
            ) {
                staffHistory = {};
            }

            if (
                !staffHistory[guildId] ||
                typeof staffHistory[guildId] !==
                    'object' ||
                Array.isArray(
                    staffHistory[guildId]
                )
            ) {
                staffHistory[guildId] = {};
            }

            if (
                !Array.isArray(
                    staffHistory[
                        guildId
                    ][staffMemberId]
                )
            ) {
                staffHistory[
                    guildId
                ][staffMemberId] = [];
            }

            staffHistory[
                guildId
            ][staffMemberId].push(
                historyRecord
            );

            return staffHistory;
        },

        {}
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('award')
        .setDMPermission(false)
        .setDescription(
            'Manage Illinois State Roleplay staff awards.'
        )

        /*
         * /award give
         */
        .addSubcommand((subcommand) =>
            subcommand
                .setName('give')
                .setDescription(
                    'Give an official award to a staff member.'
                )

                .addUserOption((option) =>
                    option
                        .setName('staff-member')
                        .setDescription(
                            'The staff member receiving the award.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('award')
                        .setDescription(
                            'The award being issued.'
                        )
                        .addChoices(
                            {
                                name:
                                    'Staff of the Week',
                                value:
                                    'staff_of_the_week',
                            },
                            {
                                name:
                                    'Staff of the Month',
                                value:
                                    'staff_of_the_month',
                            },
                            {
                                name:
                                    'Outstanding Leadership',
                                value:
                                    'outstanding_leadership',
                            },
                            {
                                name:
                                    'Exceptional Activity',
                                value:
                                    'exceptional_activity',
                            },
                            {
                                name:
                                    'Community Excellence',
                                value:
                                    'community_excellence',
                            },
                            {
                                name:
                                    'Distinguished Service',
                                value:
                                    'distinguished_service',
                            },
                            {
                                name:
                                    'Professionalism Award',
                                value:
                                    'professionalism',
                            },
                            {
                                name:
                                    'Custom Award',
                                value:
                                    'custom',
                            }
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Why this staff member earned the award.'
                        )
                        .setMinLength(3)
                        .setMaxLength(1000)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('custom-name')
                        .setDescription(
                            'Required only when Custom Award is selected.'
                        )
                        .setMaxLength(100)
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription(
                            'Optional additional notes.'
                        )
                        .setMaxLength(500)
                        .setRequired(false)
                )
        )

        /*
         * /award remove
         */
        .addSubcommand((subcommand) =>
            subcommand
                .setName('remove')
                .setDescription(
                    'Revoke a previously issued award.'
                )

                .addStringOption((option) =>
                    option
                        .setName('award-id')
                        .setDescription(
                            'The permanent ID of the award.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Why the award is being revoked.'
                        )
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription(
                            'Optional management notes.'
                        )
                        .setMaxLength(500)
                        .setRequired(false)
                )
        )

        /*
         * /award history
         */
        .addSubcommand((subcommand) =>
            subcommand
                .setName('history')
                .setDescription(
                    'View the awards issued to a staff member.'
                )

                .addUserOption((option) =>
                    option
                        .setName('staff-member')
                        .setDescription(
                            'The staff member whose awards you want to view.'
                        )
                        .setRequired(true)
                )

                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription(
                            'The maximum number of awards to display.'
                        )
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('visibility')
                        .setDescription(
                            'Choose whether the response is private or public.'
                        )
                        .addChoices(
                            {
                                name:
                                    'Private — Only you can see it',
                                value: 'private',
                            },
                            {
                                name:
                                    'Public — Everyone can see it',
                                value: 'public',
                            }
                        )
                        .setRequired(false)
                )
        )

        /*
         * /award list
         */
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription(
                    'View recently issued staff awards.'
                )

                .addStringOption((option) =>
                    option
                        .setName('status')
                        .setDescription(
                            'Choose which awards to display.'
                        )
                        .addChoices(
                            {
                                name:
                                    'Active Awards',
                                value: 'active',
                            },
                            {
                                name:
                                    'Revoked Awards',
                                value: 'revoked',
                            },
                            {
                                name:
                                    'All Awards',
                                value: 'all',
                            }
                        )
                        .setRequired(false)
                )

                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription(
                            'The maximum number of awards to display.'
                        )
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.reply({
                    content:
                        '❌ This command can only be used inside a Discord server.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const subcommand =
                interaction.options.getSubcommand();

            const visibility =
                subcommand === 'history'
                    ? interaction.options.getString(
                          'visibility'
                      ) || 'private'
                    : 'private';

            await interaction.deferReply({
                flags:
                    visibility === 'private'
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
                        '❌ Illinois State Utilities has not been configured yet. Run `/setup` first.',
                });
            }

            const brandColor =
                convertHexToDecimal(
                    guildConfiguration.brandColor
                );

            const logChannel =
                guildConfiguration.logChannelId
                    ? interaction.guild.channels.cache.get(
                          guildConfiguration.logChannelId
                      )
                    : null;

            /*
             * /award give
             */
            if (subcommand === 'give') {
                if (
                    !canManageAwards(interaction)
                ) {
                    return interaction.editReply({
                        content:
                            '❌ You need the **Manage Messages** permission to issue staff awards.',
                    });
                }

                const staffMember =
                    interaction.options.getUser(
                        'staff-member',
                        true
                    );

                const awardTypeKey =
                    interaction.options.getString(
                        'award',
                        true
                    );

                const reason =
                    interaction.options
                        .getString(
                            'reason',
                            true
                        )
                        .trim();

                const customName =
                    interaction.options
                        .getString(
                            'custom-name'
                        )
                        ?.trim() || null;

                const notes =
                    interaction.options
                        .getString('notes')
                        ?.trim() || null;

                if (staffMember.bot) {
                    return interaction.editReply({
                        content:
                            '❌ Discord bots cannot receive staff awards.',
                    });
                }

                const awardType =
                    AWARD_TYPES[
                        awardTypeKey
                    ];

                if (!awardType) {
                    return interaction.editReply({
                        content:
                            '❌ The selected award type is not recognized.',
                    });
                }

                if (
                    awardTypeKey ===
                        'custom' &&
                    !customName
                ) {
                    return interaction.editReply({
                        content:
                            '❌ You selected **Custom Award**, so you must provide the `custom-name` option.',
                    });
                }

                const finalAwardName =
                    awardTypeKey ===
                    'custom'
                        ? customName
                        : awardType.name;

                const awardId =
                    createRecordId(
                        'award'
                    );

                const createdAt =
                    new Date().toISOString();

                const awardRecord = {
                    id: awardId,

                    type: 'award',

                    awardType:
                        awardTypeKey,

                    awardName:
                        finalAwardName,

                    awardEmoji:
                        awardType.emoji,

                    guildId:
                        interaction.guildId,

                    guildName:
                        interaction.guild.name,

                    staffMemberId:
                        staffMember.id,

                    staffUsername:
                        staffMember.username,

                    staffDisplayName:
                        staffMember.globalName ||
                        staffMember.username,

                    reason,
                    notes,

                    issuedById:
                        interaction.user.id,

                    issuedByUsername:
                        interaction.user.username,

                    issuedByDisplayName:
                        interaction.user
                            .globalName ||
                        interaction.user
                            .username,

                    status: 'active',

                    revokedAt: null,
                    revokedById: null,
                    revocationReason: null,
                    revocationNotes: null,

                    createdAt,
                    updatedAt:
                        createdAt,
                };

                await updateDatabase(
                    'awards',

                    (awardsDatabase) => {
                        if (
                            !awardsDatabase ||
                            typeof awardsDatabase !==
                                'object' ||
                            Array.isArray(
                                awardsDatabase
                            )
                        ) {
                            awardsDatabase =
                                {};
                        }

                        if (
                            !Array.isArray(
                                awardsDatabase[
                                    interaction.guildId
                                ]
                            )
                        ) {
                            awardsDatabase[
                                interaction.guildId
                            ] = [];
                        }

                        awardsDatabase[
                            interaction.guildId
                        ].push(
                            awardRecord
                        );

                        return awardsDatabase;
                    },

                    {}
                );

                await updateDatabase(
                    'staff-records',

                    (staffRecords) => {
                        if (
                            !staffRecords ||
                            typeof staffRecords !==
                                'object' ||
                            Array.isArray(
                                staffRecords
                            )
                        ) {
                            staffRecords =
                                {};
                        }

                        if (
                            !staffRecords[
                                interaction.guildId
                            ] ||
                            typeof staffRecords[
                                interaction.guildId
                            ] !== 'object' ||
                            Array.isArray(
                                staffRecords[
                                    interaction.guildId
                                ]
                            )
                        ) {
                            staffRecords[
                                interaction.guildId
                            ] = {};
                        }

                        const existingRecord =
                            staffRecords[
                                interaction.guildId
                            ][
                                staffMember.id
                            ] || {};

                        const awardHistory =
                            Array.isArray(
                                existingRecord
                                    .awardHistory
                            )
                                ? existingRecord
                                      .awardHistory
                                : [];

                        awardHistory.push({
                            awardId,

                            awardName:
                                finalAwardName,

                            awardType:
                                awardTypeKey,

                            reason,
                            notes,

                            issuedById:
                                interaction.user.id,

                            status:
                                'active',

                            createdAt,
                        });

                        staffRecords[
                            interaction.guildId
                        ][staffMember.id] = {
                            ...existingRecord,

                            staffMemberId:
                                staffMember.id,

                            username:
                                staffMember.username,

                            displayName:
                                staffMember.globalName ||
                                staffMember.username,

                            currentRank:
                                existingRecord
                                    .currentRank ||
                                'Not Recorded',

                            staffStatus:
                                existingRecord
                                    .staffStatus ||
                                'Active',

                            awardCount:
                                Number(
                                    existingRecord
                                        .awardCount ||
                                        0
                                ) + 1,

                            awardHistory,

                            joinedStaffAt:
                                existingRecord
                                    .joinedStaffAt ||
                                createdAt,

                            createdAt:
                                existingRecord
                                    .createdAt ||
                                createdAt,

                            updatedAt:
                                createdAt,
                        };

                        return staffRecords;
                    },

                    {}
                );

                await addStaffHistoryRecord(
                    interaction.guildId,
                    staffMember.id,
                    {
                        ...awardRecord,

                        historyType:
                            'award_given',
                    }
                );

                const descriptionLines = [
                    `Congratulations, ${staffMember}!`,
                    '',
                    `**Award:** ${awardType.emoji} ${finalAwardName}`,
                    `**Reason:** ${reason}`,
                    `**Awarded By:** ${interaction.user}`,
                ];

                if (notes) {
                    descriptionLines.push(
                        '',
                        `**Notes:** ${notes}`
                    );
                }

                const awardEmbed =
                    new EmbedBuilder()
                        .setColor(
                            0xf1c40f
                        )
                        .setTitle(
                            'Staff Award'
                        )
                        .setDescription(
                            descriptionLines.join(
                                '\n'
                            )
                        )
                        .setThumbnail(
                            staffMember
                                .displayAvatarURL({
                                    size: 256,
                                })
                        )
                        .setAuthor({
                            name:
                                guildConfiguration.serverName ||
                                interaction.guild.name,

                            iconURL: brands.assets.logo,
                        })
                        .setFooter({
                            text:
                                'Illinois State Roleplay',

                            iconURL: brands.assets.logo,
                        })
                        .setTimestamp();

                /*
                 * The award announcement is sent
                 * to the channel where the command is used.
                 */
                const announcementMessage =
                    await interaction.channel.send({
                        content:
                            `${staffMember}`,

                        embeds: [
                            awardEmbed,
                        ],

                        allowedMentions: {
                            users: [
                                staffMember.id,
                            ],
                        },
                    });

                /*
                 * Send a private management log
                 * using the channel saved through /setup.
                 */
                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    const logEmbed =
                        new EmbedBuilder()
                            .setColor(
                                brandColor
                            )
                            .setTitle(
                                'Staff Award Recorded'
                            )
                            .setDescription(
                                [
                                    `**Staff Member:** ${staffMember}`,
                                    `**Award:** ${awardType.emoji} ${finalAwardName}`,
                                    `**Reason:** ${reason}`,
                                    `**Additional Notes:** ${
                                        notes ||
                                        'None provided'
                                    }`,
                                    `**Awarded By:** ${interaction.user}`,
                                    `**Announcement:** ${announcementMessage.url}`,
                                    `**Award ID:** \`${awardId}\``,
                                ].join(
                                    '\n'
                                )
                            )
                            .setThumbnail(
                                staffMember
                                    .displayAvatarURL({
                                        size: 256,
                                    })
                            )
                            .setFooter({
                                text:
                                    'Illinois State Utilities • Management Logs',

                                iconURL: brands.assets.logo,
                            })
                            .setTimestamp();

                    await logChannel
                        .send({
                            embeds: [
                                logEmbed,
                            ],

                            allowedMentions: {
                                parse: [],
                            },
                        })
                        .catch(
                            (error) => {
                                console.error(
                                    'Award saved, but the management log could not be sent:',
                                    error
                                );
                            }
                        );
                }

                /*
                 * Send the recipient a DM.
                 * Failure is ignored if their DMs are disabled.
                 */
                await staffMember
                    .send({
                        embeds: [
                            awardEmbed,
                        ],
                    })
                    .catch(() => {});

                return interaction.editReply({
                    content:
                        `✅ ${staffMember} received the **${finalAwardName}** award.\n\n` +
                        `Award ID: \`${awardId}\``,

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * /award remove
             */
            if (
                subcommand === 'remove'
            ) {
                if (
                    !canManageAwards(interaction)
                ) {
                    return interaction.editReply({
                        content:
                            '❌ You need the **Manage Messages** permission to revoke staff awards.',
                    });
                }

                const awardId =
                    interaction.options
                        .getString(
                            'award-id',
                            true
                        )
                        .trim();

                const reason =
                    interaction.options
                        .getString(
                            'reason',
                            true
                        )
                        .trim();

                const notes =
                    interaction.options
                        .getString('notes')
                        ?.trim() || null;

                const awardsDatabase =
                    await readDatabase(
                        'awards',
                        {}
                    );

                const awardRecord =
                    findAwardById(
                        awardsDatabase,
                        interaction.guildId,
                        awardId
                    );

                if (!awardRecord) {
                    return interaction.editReply({
                        content:
                            `❌ No award was found with ID \`${awardId}\`.`,
                    });
                }

                if (
                    awardRecord.status ===
                    'revoked'
                ) {
                    return interaction.editReply({
                        content:
                            '❌ That award has already been revoked.',
                    });
                }

                const revokedAt =
                    new Date().toISOString();

                await updateDatabase(
                    'awards',

                    (awards) => {
                        const record =
                            findAwardById(
                                awards,
                                interaction.guildId,
                                awardId
                            );

                        if (!record) {
                            return awards;
                        }

                        record.status =
                            'revoked';

                        record.revokedAt =
                            revokedAt;

                        record.revokedById =
                            interaction.user.id;

                        record.revocationReason =
                            reason;

                        record.revocationNotes =
                            notes;

                        record.updatedAt =
                            revokedAt;

                        return awards;
                    },

                    {}
                );

                await updateDatabase(
                    'staff-records',

                    (staffRecords) => {
                        const staffProfile =
                            staffRecords[
                                interaction.guildId
                            ]?.[
                                awardRecord
                                    .staffMemberId
                            ];

                        if (!staffProfile) {
                            return staffRecords;
                        }

                        staffProfile.awardCount =
                            Math.max(
                                0,
                                Number(
                                    staffProfile
                                        .awardCount ||
                                        0
                                ) - 1
                            );

                        if (
                            Array.isArray(
                                staffProfile
                                    .awardHistory
                            )
                        ) {
                            const historyEntry =
                                staffProfile
                                    .awardHistory
                                    .find(
                                        (
                                            entry
                                        ) =>
                                            entry.awardId ===
                                            awardId
                                    );

                            if (
                                historyEntry
                            ) {
                                historyEntry.status =
                                    'revoked';

                                historyEntry.revokedAt =
                                    revokedAt;

                                historyEntry.revokedById =
                                    interaction.user.id;

                                historyEntry.revocationReason =
                                    reason;

                                historyEntry.revocationNotes =
                                    notes;
                            }
                        }

                        staffProfile.updatedAt =
                            revokedAt;

                        return staffRecords;
                    },

                    {}
                );

                await addStaffHistoryRecord(
                    interaction.guildId,
                    awardRecord.staffMemberId,
                    {
                        id:
                            createRecordId(
                                'award-revoked'
                            ),

                        type:
                            'award_revoked',

                        historyType:
                            'award_removed',

                        awardId,

                        awardName:
                            awardRecord.awardName,

                        awardEmoji:
                            awardRecord.awardEmoji,

                        staffMemberId:
                            awardRecord.staffMemberId,

                        reason,
                        notes,

                        issuedById:
                            interaction.user.id,

                        createdAt:
                            revokedAt,
                    }
                );

                const revokeEmbed =
                    new EmbedBuilder()
                        .setColor(
                            0xe67e22
                        )
                        .setTitle(
                            'Staff Award Revoked'
                        )
                        .setDescription(
                            [
                                `**Staff Member:** <@${awardRecord.staffMemberId}>`,
                                `**Award:** ${awardRecord.awardEmoji || '🏅'} ${awardRecord.awardName}`,
                                `**Revocation Reason:** ${reason}`,
                                `**Additional Notes:** ${
                                    notes ||
                                    'None provided'
                                }`,
                                `**Revoked By:** ${interaction.user}`,
                                `**Award ID:** \`${awardId}\``,
                            ].join(
                                '\n'
                            )
                        )
                        .setFooter({
                            text:
                                'Illinois State Utilities • Management Logs',

                            iconURL: brands.assets.logo,
                        })
                        .setTimestamp();

                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    await logChannel
                        .send({
                            embeds: [
                                revokeEmbed,
                            ],

                            allowedMentions: {
                                parse: [],
                            },
                        })
                        .catch(
                            (error) => {
                                console.error(
                                    'Award revoked, but the management log could not be sent:',
                                    error
                                );
                            }
                        );
                }

                return interaction.editReply({
                    content:
                        `✅ Award \`${awardId}\` was revoked.`,
                });
            }

            /*
             * /award history
             */
            if (
                subcommand === 'history'
            ) {
                const staffMember =
                    interaction.options.getUser(
                        'staff-member',
                        true
                    );

                const limit =
                    interaction.options.getInteger(
                        'limit'
                    ) || 5;

                const awardsDatabase =
                    await readDatabase(
                        'awards',
                        {}
                    );

                const staffAwards =
                    (
                        Array.isArray(
                            awardsDatabase[
                                interaction.guildId
                            ]
                        )
                            ? awardsDatabase[
                                  interaction.guildId
                              ]
                            : []
                    )
                        .filter(
                            (award) =>
                                award.staffMemberId ===
                                staffMember.id
                        )
                        .sort(
                            (
                                firstAward,
                                secondAward
                            ) =>
                                new Date(
                                    secondAward.createdAt
                                ).getTime() -
                                new Date(
                                    firstAward.createdAt
                                ).getTime()
                        );

                if (
                    staffAwards.length ===
                    0
                ) {
                    return interaction.editReply({
                        content:
                            `${staffMember} does not have any saved awards yet.`,

                        allowedMentions: {
                            parse: [],
                        },
                    });
                }

                const displayedAwards =
                    staffAwards.slice(
                        0,
                        limit
                    );

                const sections =
                    displayedAwards.map(
                        (
                            award,
                            index
                        ) =>
                            [
                                `### ${award.awardEmoji || '🏅'} ${index + 1}. ${award.awardName}`,
                                `**Status:** ${
                                    award.status ===
                                    'revoked'
                                        ? '🔴 Revoked'
                                        : '🟢 Active'
                                }`,
                                `**Date:** ${createDiscordTimestamp(
                                    award.createdAt,
                                    'F'
                                )}`,
                                `**Awarded By:** <@${award.issuedById}>`,
                                `**Reason:** ${truncateText(
                                    award.reason,
                                    300
                                )}`,
                                award.notes
                                    ? `**Additional Notes:** ${truncateText(
                                          award.notes,
                                          200
                                      )}`
                                    : null,
                                award.status ===
                                    'revoked'
                                    ? `**Revocation Reason:** ${truncateText(
                                          award.revocationReason,
                                          200
                                      )}`
                                    : null,
                                `**Award ID:** \`${award.id}\``,
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    '\n'
                                )
                    );

                const historyEmbed =
                    new EmbedBuilder()
                        .setColor(
                            0xf1c40f
                        )
                        .setTitle(
                            'ISRP | Staff Award History'
                        )
                        .setDescription(
                            [
                                `Below are the saved awards for ${staffMember}.`,
                                '',
                                `**Showing ${displayedAwards.length} of ${staffAwards.length} award${staffAwards.length === 1 ? '' : 's'}**`,
                                '',
                                sections.join(
                                    '\n\n━━━━━━━━━━━━━━━━━━━━\n\n'
                                ),
                            ].join(
                                '\n'
                            )
                        )
                        .setThumbnail(
                            staffMember
                                .displayAvatarURL({
                                    size: 256,
                                })
                        )
                        .setAuthor({
                            name:
                                guildConfiguration.serverName ||
                                interaction.guild.name,

                            iconURL: brands.assets.logo,
                        })
                        .setFooter({
                            text:
                                'Illinois State Utilities • Awards & Recognition System',

                            iconURL: brands.assets.logo,
                        })
                        .setTimestamp();

                return interaction.editReply({
                    embeds: [
                        historyEmbed,
                    ],

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * /award list
             */
            if (
                subcommand === 'list'
            ) {
                const status =
                    interaction.options.getString(
                        'status'
                    ) || 'active';

                const limit =
                    interaction.options.getInteger(
                        'limit'
                    ) || 10;

                const awardsDatabase =
                    await readDatabase(
                        'awards',
                        {}
                    );

                let guildAwards =
                    Array.isArray(
                        awardsDatabase[
                            interaction.guildId
                        ]
                    )
                        ? [
                              ...awardsDatabase[
                                  interaction.guildId
                              ],
                          ]
                        : [];

                if (
                    status !== 'all'
                ) {
                    guildAwards =
                        guildAwards.filter(
                            (award) =>
                                award.status ===
                                status
                        );
                }

                guildAwards =
                    guildAwards
                        .sort(
                            (
                                firstAward,
                                secondAward
                            ) =>
                                new Date(
                                    secondAward.createdAt
                                ).getTime() -
                                new Date(
                                    firstAward.createdAt
                                ).getTime()
                        )
                        .slice(
                            0,
                            limit
                        );

                if (
                    guildAwards.length ===
                    0
                ) {
                    return interaction.editReply({
                        content:
                            '📭 No awards match the selected status.',
                    });
                }

                const sections =
                    guildAwards.map(
                        (
                            award,
                            index
                        ) =>
                            [
                                `### ${award.awardEmoji || '🏅'} ${index + 1}. ${award.awardName}`,
                                `**Staff Member:** <@${award.staffMemberId}>`,
                                `**Status:** ${
                                    award.status ===
                                    'revoked'
                                        ? '🔴 Revoked'
                                        : '🟢 Active'
                                }`,
                                `**Date:** ${createDiscordTimestamp(
                                    award.createdAt,
                                    'D'
                                )}`,
                                `**Award ID:** \`${award.id}\``,
                            ].join(
                                '\n'
                            )
                    );

                const listEmbed =
                    new EmbedBuilder()
                        .setColor(
                            brandColor
                        )
                        .setTitle(
                            'ISRP | Staff Awards'
                        )
                        .setDescription(
                            sections.join(
                                '\n\n━━━━━━━━━━━━━━━━━━━━\n\n'
                            )
                        )
                        .setAuthor({
                            name:
                                guildConfiguration.serverName ||
                                interaction.guild.name,

                            iconURL: brands.assets.logo,
                        })
                        .setFooter({
                            text:
                                'Illinois State Utilities • Awards & Recognition System',

                            iconURL: brands.assets.logo,
                        })
                        .setTimestamp();

                return interaction.editReply({
                    embeds: [
                        listEmbed,
                    ],

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            return interaction.editReply({
                content:
                    '❌ That award action could not be completed.',
            });
        } catch (error) {
            console.error(
                'Error executing /award:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while processing this award action.',
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
