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

function convertHexToDecimal(hexColor) {
    if (typeof hexColor !== 'string') {
        return 0x005b96;
    }

    const cleanedColor = hexColor
        .trim()
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    const parsedColor = Number.parseInt(cleanedColor, 16);

    return Number.isNaN(parsedColor)
        ? 0x005b96
        : parsedColor;
}

function parseDate(dateInput) {
    const normalizedInput = String(dateInput).trim();
    const match = normalizedInput.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsedDate = new Date(
        Date.UTC(year, month - 1, day, 12, 0, 0)
    );

    if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
    ) {
        return null;
    }

    return parsedDate;
}

function createDiscordTimestamp(dateInput, style = 'D') {
    const timestamp = new Date(dateInput).getTime();

    if (Number.isNaN(timestamp)) {
        return 'Unknown date';
    }

    return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function calculateDayCount(startDate, endDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return (
        Math.floor(
            (endDate.getTime() - startDate.getTime()) /
                millisecondsPerDay
        ) + 1
    );
}

function canManageLoas(interaction) {
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

function getStatusDisplay(status) {
    const statusMap = {
        pending: '🟡 Pending',
        approved: '🟢 Approved',
        denied: '🔴 Denied',
        ended: '⚪ Ended',
    };

    return statusMap[status] || status;
}

function findRequestById(records, guildId, requestId) {
    const guildRecords = Array.isArray(records[guildId])
        ? records[guildId]
        : [];

    return guildRecords.find(
        (record) =>
            record.id.toLowerCase() ===
            requestId.toLowerCase()
    );
}

async function addHistoryRecord(
    guildId,
    staffMemberId,
    record
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
                typeof staffHistory[guildId] !== 'object' ||
                Array.isArray(staffHistory[guildId])
            ) {
                staffHistory[guildId] = {};
            }

            if (
                !Array.isArray(
                    staffHistory[guildId][staffMemberId]
                )
            ) {
                staffHistory[guildId][staffMemberId] = [];
            }

            staffHistory[guildId][staffMemberId].push(record);

            return staffHistory;
        },
        {}
    );
}

async function updateStaffLoaProfile(
    guildId,
    staffUser,
    loaData
) {
    await updateDatabase(
        'staff-records',
        (staffRecords) => {
            if (
                !staffRecords ||
                typeof staffRecords !== 'object' ||
                Array.isArray(staffRecords)
            ) {
                staffRecords = {};
            }

            if (
                !staffRecords[guildId] ||
                typeof staffRecords[guildId] !== 'object' ||
                Array.isArray(staffRecords[guildId])
            ) {
                staffRecords[guildId] = {};
            }

            const existingRecord =
                staffRecords[guildId][staffUser.id] || {};

            staffRecords[guildId][staffUser.id] = {
                ...existingRecord,

                staffMemberId: staffUser.id,
                username: staffUser.username,
                displayName:
                    staffUser.globalName ||
                    staffUser.username,

                currentRank:
                    existingRecord.currentRank ||
                    'Not Recorded',

                staffStatus: loaData
                    ? 'On LOA'
                    : existingRecord.staffStatus === 'On LOA'
                      ? 'Active'
                      : existingRecord.staffStatus ||
                        'Active',

                activeLoa: loaData,

                loaCount:
                    loaData &&
                    existingRecord.activeLoa?.id !== loaData.id
                        ? Number(
                              existingRecord.loaCount || 0
                          ) + 1
                        : Number(
                              existingRecord.loaCount || 0
                          ),

                joinedStaffAt:
                    existingRecord.joinedStaffAt ||
                    new Date().toISOString(),

                createdAt:
                    existingRecord.createdAt ||
                    new Date().toISOString(),

                updatedAt: new Date().toISOString(),
            };

            return staffRecords;
        },
        {}
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loa')
        .setDescription(
            'Manage Illinois State Roleplay leave-of-absence requests.'
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('request')
                .setDescription(
                    'Submit a new leave-of-absence request.'
                )

                .addStringOption((option) =>
                    option
                        .setName('start-date')
                        .setDescription(
                            'The LOA start date in YYYY-MM-DD format.'
                        )
                        .setMinLength(10)
                        .setMaxLength(10)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('end-date')
                        .setDescription(
                            'The LOA end date in YYYY-MM-DD format.'
                        )
                        .setMinLength(10)
                        .setMaxLength(10)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'The reason for requesting an LOA.'
                        )
                        .setMinLength(5)
                        .setMaxLength(1000)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription(
                            'Optional additional information.'
                        )
                        .setMaxLength(500)
                        .setRequired(false)
                )
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('approve')
                .setDescription(
                    'Approve a pending LOA request.'
                )

                .addStringOption((option) =>
                    option
                        .setName('request-id')
                        .setDescription(
                            'The permanent LOA request ID.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription(
                            'Optional approval notes.'
                        )
                        .setMaxLength(500)
                        .setRequired(false)
                )
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('deny')
                .setDescription(
                    'Deny a pending LOA request.'
                )

                .addStringOption((option) =>
                    option
                        .setName('request-id')
                        .setDescription(
                            'The permanent LOA request ID.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'The reason the request is being denied.'
                        )
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('end')
                .setDescription(
                    'End an approved LOA.'
                )

                .addStringOption((option) =>
                    option
                        .setName('request-id')
                        .setDescription(
                            'The permanent LOA request ID.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription(
                            'Optional notes about ending the LOA.'
                        )
                        .setMaxLength(500)
                        .setRequired(false)
                )
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription(
                    'View pending or approved LOA requests.'
                )

                .addStringOption((option) =>
                    option
                        .setName('status')
                        .setDescription(
                            'Choose which LOA requests to display.'
                        )
                        .addChoices(
                            {
                                name: 'Pending Requests',
                                value: 'pending',
                            },
                            {
                                name: 'Approved LOAs',
                                value: 'approved',
                            },
                            {
                                name: 'All Active Requests',
                                value: 'active',
                            },
                            {
                                name: 'All Records',
                                value: 'all',
                            }
                        )
                        .setRequired(false)
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

            const subcommand =
                interaction.options.getSubcommand();

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const configurations =
                await readDatabase('guild-configs', {});

            const guildConfiguration =
                configurations[interaction.guildId];

            if (!guildConfiguration) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities has not been configured yet. Run `/setup` first.',
                });
            }

            const brandColor = convertHexToDecimal(
                guildConfiguration.brandColor
            );

            const logChannel =
                interaction.guild.channels.cache.get(
                    guildConfiguration.logChannelId
                );

            /*
             * /loa request
             */
            if (subcommand === 'request') {
                const startDateInput =
                    interaction.options
                        .getString('start-date', true)
                        .trim();

                const endDateInput =
                    interaction.options
                        .getString('end-date', true)
                        .trim();

                const reason =
                    interaction.options
                        .getString('reason', true)
                        .trim();

                const notes =
                    interaction.options
                        .getString('notes')
                        ?.trim() || null;

                const startDate =
                    parseDate(startDateInput);

                const endDate =
                    parseDate(endDateInput);

                if (!startDate || !endDate) {
                    return interaction.editReply({
                        content:
                            '❌ Dates must use `YYYY-MM-DD` format, such as `2026-07-25`.',
                    });
                }

                if (
                    endDate.getTime() <
                    startDate.getTime()
                ) {
                    return interaction.editReply({
                        content:
                            '❌ The end date cannot be earlier than the start date.',
                    });
                }

                const loaLength =
                    calculateDayCount(
                        startDate,
                        endDate
                    );

                if (loaLength > 90) {
                    return interaction.editReply({
                        content:
                            '❌ LOA requests cannot exceed **90 days**.',
                    });
                }

                const database =
                    await readDatabase(
                        'loa-records',
                        {}
                    );

                const guildRecords =
                    Array.isArray(
                        database[interaction.guildId]
                    )
                        ? database[
                              interaction.guildId
                          ]
                        : [];

                const existingRequest =
                    guildRecords.find(
                        (record) =>
                            record.staffMemberId ===
                                interaction.user.id &&
                            [
                                'pending',
                                'approved',
                            ].includes(
                                record.status
                            )
                    );

                if (existingRequest) {
                    return interaction.editReply({
                        content:
                            `❌ You already have a **${existingRequest.status}** LOA.\n\n` +
                            `Request ID: \`${existingRequest.id}\``,
                    });
                }

                const requestId =
                    createRecordId('loa');

                const createdAt =
                    new Date().toISOString();

                const loaRecord = {
                    id: requestId,
                    type: 'loa',

                    guildId:
                        interaction.guildId,

                    guildName:
                        interaction.guild.name,

                    staffMemberId:
                        interaction.user.id,

                    staffUsername:
                        interaction.user.username,

                    staffDisplayName:
                        interaction.user.globalName ||
                        interaction.user.username,

                    startDate:
                        startDate.toISOString(),

                    endDate:
                        endDate.toISOString(),

                    totalDays: loaLength,

                    reason,
                    notes,

                    status: 'pending',

                    requestedAt: createdAt,

                    reviewedAt: null,
                    reviewedById: null,
                    reviewNotes: null,

                    endedAt: null,
                    endedById: null,
                    endNotes: null,

                    createdAt,
                    updatedAt: createdAt,
                };

                await updateDatabase(
                    'loa-records',
                    (records) => {
                        if (
                            !records ||
                            typeof records !== 'object' ||
                            Array.isArray(records)
                        ) {
                            records = {};
                        }

                        if (
                            !Array.isArray(
                                records[
                                    interaction.guildId
                                ]
                            )
                        ) {
                            records[
                                interaction.guildId
                            ] = [];
                        }

                        records[
                            interaction.guildId
                        ].push(loaRecord);

                        return records;
                    },
                    {}
                );

                await addHistoryRecord(
                    interaction.guildId,
                    interaction.user.id,
                    {
                        ...loaRecord,
                        historyType:
                            'loa_request',
                    }
                );

                const requestEmbed =
                    new EmbedBuilder()
                        .setColor(0x5865f2)
                        .setTitle(
                            'ISRP | LOA Request'
                        )
                        .setDescription(
                            [
                                `${interaction.user} submitted a new leave-of-absence request.`,
                                '',
                                '**LOA Period**',
                                `${createDiscordTimestamp(
                                    startDate
                                )} — ${createDiscordTimestamp(
                                    endDate
                                )}`,
                                '',
                                '**Total Duration**',
                                `${loaLength} day${loaLength === 1 ? '' : 's'}`,
                                '',
                                '**Reason**',
                                reason,
                                '',
                                '**Additional Notes**',
                                notes ||
                                    'None provided',
                                '',
                                '**Request Status**',
                                '🟡 Pending Management Review',
                                '',
                                '**Request ID**',
                                `\`${requestId}\``,
                                '',
                                '**Management Commands**',
                                `\`/loa approve request-id:${requestId}\``,
                                `\`/loa deny request-id:${requestId}\``,
                            ].join('\n')
                        )
                        .setThumbnail(
                            interaction.user
                                .displayAvatarURL({
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
                                'Illinois State Utilities • Leave of Absence System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                let requestMessage = null;

                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    requestMessage =
                        await logChannel.send({
                            embeds: [
                                requestEmbed,
                            ],
                        });
                }

                const confirmationEmbed =
                    new EmbedBuilder()
                        .setColor(brandColor)
                        .setTitle(
                            'LOA Request Submitted'
                        )
                        .setDescription(
                            [
                                'Your LOA request was submitted successfully.',
                                '',
                                '**Status**',
                                'Pending Management Review',
                                '',
                                '**LOA Period**',
                                `${createDiscordTimestamp(
                                    startDate
                                )} — ${createDiscordTimestamp(
                                    endDate
                                )}`,
                                '',
                                '**Request ID**',
                                `\`${requestId}\``,
                                '',
                                requestMessage
                                    ? `[View Management Request](${requestMessage.url})`
                                    : 'The request was saved successfully.',
                            ].join('\n')
                        )
                        .setFooter({
                            text:
                                'Illinois State Utilities • Leave of Absence System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                return interaction.editReply({
                    embeds: [
                        confirmationEmbed,
                    ],
                });
            }

            /*
             * Management-only subcommands
             */
            if (!canManageLoas(interaction)) {
                return interaction.editReply({
                    content:
                        '❌ You need the **Manage Messages** permission to manage LOA requests.',
                });
            }

            /*
             * /loa list
             */
            if (subcommand === 'list') {
                const selectedStatus =
                    interaction.options.getString(
                        'status'
                    ) || 'active';

                const database =
                    await readDatabase(
                        'loa-records',
                        {}
                    );

                const guildRecords =
                    Array.isArray(
                        database[interaction.guildId]
                    )
                        ? database[
                              interaction.guildId
                          ]
                        : [];

                let filteredRecords =
                    guildRecords;

                if (
                    selectedStatus === 'active'
                ) {
                    filteredRecords =
                        guildRecords.filter(
                            (record) =>
                                [
                                    'pending',
                                    'approved',
                                ].includes(
                                    record.status
                                )
                        );
                } else if (
                    selectedStatus !== 'all'
                ) {
                    filteredRecords =
                        guildRecords.filter(
                            (record) =>
                                record.status ===
                                selectedStatus
                        );
                }

                filteredRecords =
                    filteredRecords
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
                        .slice(0, 10);

                if (
                    filteredRecords.length === 0
                ) {
                    return interaction.editReply({
                        content:
                            '📭 No LOA records match that status.',
                    });
                }

                const recordSections =
                    filteredRecords.map(
                        (record, index) =>
                            [
                                `### ${index + 1}. ${getStatusDisplay(
                                    record.status
                                )}`,
                                `**Staff Member:** <@${record.staffMemberId}>`,
                                `**Period:** ${createDiscordTimestamp(
                                    record.startDate
                                )} — ${createDiscordTimestamp(
                                    record.endDate
                                )}`,
                                `**Duration:** ${record.totalDays} day${record.totalDays === 1 ? '' : 's'}`,
                                `**Reason:** ${record.reason}`,
                                `**Request ID:** \`${record.id}\``,
                            ].join('\n')
                    );

                const listEmbed =
                    new EmbedBuilder()
                        .setColor(brandColor)
                        .setTitle(
                            'ISRP | LOA Records'
                        )
                        .setDescription(
                            recordSections.join(
                                '\n\n━━━━━━━━━━━━━━━━━━━━\n\n'
                            )
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
                                'Illinois State Utilities • Leave of Absence System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                return interaction.editReply({
                    embeds: [listEmbed],

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const requestId =
                interaction.options
                    .getString(
                        'request-id',
                        true
                    )
                    .trim();

            const database =
                await readDatabase(
                    'loa-records',
                    {}
                );

            const loaRecord =
                findRequestById(
                    database,
                    interaction.guildId,
                    requestId
                );

            if (!loaRecord) {
                return interaction.editReply({
                    content:
                        `❌ No LOA request was found with ID \`${requestId}\`.`,
                });
            }

            const staffUser =
                await interaction.client.users
                    .fetch(
                        loaRecord.staffMemberId
                    )
                    .catch(() => null);

            /*
             * /loa approve
             */
            if (subcommand === 'approve') {
                if (
                    loaRecord.status !==
                    'pending'
                ) {
                    return interaction.editReply({
                        content:
                            `❌ This request is already **${loaRecord.status}**.`,
                    });
                }

                const approvalNotes =
                    interaction.options
                        .getString('notes')
                        ?.trim() || null;

                const reviewedAt =
                    new Date().toISOString();

                await updateDatabase(
                    'loa-records',
                    (records) => {
                        const record =
                            findRequestById(
                                records,
                                interaction.guildId,
                                requestId
                            );

                        record.status =
                            'approved';

                        record.reviewedAt =
                            reviewedAt;

                        record.reviewedById =
                            interaction.user.id;

                        record.reviewNotes =
                            approvalNotes;

                        record.updatedAt =
                            reviewedAt;

                        return records;
                    },
                    {}
                );

                if (staffUser) {
                    await updateStaffLoaProfile(
                        interaction.guildId,
                        staffUser,
                        {
                            id: requestId,
                            status: 'Approved',
                            startDate:
                                loaRecord.startDate,
                            endDate:
                                loaRecord.endDate,
                            reason:
                                loaRecord.reason,
                            approvedAt:
                                reviewedAt,
                        }
                    );
                }

                await addHistoryRecord(
                    interaction.guildId,
                    loaRecord.staffMemberId,
                    {
                        ...loaRecord,

                        id:
                            createRecordId(
                                'loa-approved'
                            ),

                        requestId,

                        status: 'approved',

                        reviewedAt,
                        reviewedById:
                            interaction.user.id,

                        reviewNotes:
                            approvalNotes,

                        createdAt:
                            reviewedAt,

                        historyType:
                            'loa_approved',
                    }
                );

                const approvalEmbed =
                    new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setTitle(
                            'ISRP | LOA Approved'
                        )
                        .setDescription(
                            [
                                `<@${loaRecord.staffMemberId}>, your leave-of-absence request has been approved.`,
                                '',
                                '**LOA Period**',
                                `${createDiscordTimestamp(
                                    loaRecord.startDate
                                )} — ${createDiscordTimestamp(
                                    loaRecord.endDate
                                )}`,
                                '',
                                '**Total Duration**',
                                `${loaRecord.totalDays} day${loaRecord.totalDays === 1 ? '' : 's'}`,
                                '',
                                '**Approved By**',
                                `${interaction.user}`,
                                '',
                                '**Management Notes**',
                                approvalNotes ||
                                    'None provided',
                                '',
                                '**Request ID**',
                                `\`${requestId}\``,
                            ].join('\n')
                        )
                        .setFooter({
                            text:
                                'Illinois State Utilities • Leave of Absence System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    await logChannel.send({
                        embeds: [
                            approvalEmbed,
                        ],
                    });
                }

                if (staffUser) {
                    await staffUser
                        .send({
                            embeds: [
                                approvalEmbed,
                            ],
                        })
                        .catch(() => {});
                }

                return interaction.editReply({
                    content:
                        `✅ LOA request \`${requestId}\` was approved successfully.`,
                });
            }

            /*
             * /loa deny
             */
            if (subcommand === 'deny') {
                if (
                    loaRecord.status !==
                    'pending'
                ) {
                    return interaction.editReply({
                        content:
                            `❌ This request is already **${loaRecord.status}**.`,
                    });
                }

                const denialReason =
                    interaction.options
                        .getString(
                            'reason',
                            true
                        )
                        .trim();

                const reviewedAt =
                    new Date().toISOString();

                await updateDatabase(
                    'loa-records',
                    (records) => {
                        const record =
                            findRequestById(
                                records,
                                interaction.guildId,
                                requestId
                            );

                        record.status =
                            'denied';

                        record.reviewedAt =
                            reviewedAt;

                        record.reviewedById =
                            interaction.user.id;

                        record.reviewNotes =
                            denialReason;

                        record.updatedAt =
                            reviewedAt;

                        return records;
                    },
                    {}
                );

                await addHistoryRecord(
                    interaction.guildId,
                    loaRecord.staffMemberId,
                    {
                        ...loaRecord,

                        id:
                            createRecordId(
                                'loa-denied'
                            ),

                        requestId,

                        status: 'denied',

                        reviewedAt,
                        reviewedById:
                            interaction.user.id,

                        reviewNotes:
                            denialReason,

                        createdAt:
                            reviewedAt,

                        historyType:
                            'loa_denied',
                    }
                );

                const denialEmbed =
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle(
                            'ISRP | LOA Denied'
                        )
                        .setDescription(
                            [
                                `<@${loaRecord.staffMemberId}>, your leave-of-absence request has been denied.`,
                                '',
                                '**Requested Period**',
                                `${createDiscordTimestamp(
                                    loaRecord.startDate
                                )} — ${createDiscordTimestamp(
                                    loaRecord.endDate
                                )}`,
                                '',
                                '**Denial Reason**',
                                denialReason,
                                '',
                                '**Reviewed By**',
                                `${interaction.user}`,
                                '',
                                '**Request ID**',
                                `\`${requestId}\``,
                            ].join('\n')
                        )
                        .setFooter({
                            text:
                                'Illinois State Utilities • Leave of Absence System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    await logChannel.send({
                        embeds: [
                            denialEmbed,
                        ],
                    });
                }

                if (staffUser) {
                    await staffUser
                        .send({
                            embeds: [
                                denialEmbed,
                            ],
                        })
                        .catch(() => {});
                }

                return interaction.editReply({
                    content:
                        `✅ LOA request \`${requestId}\` was denied successfully.`,
                });
            }

            /*
             * /loa end
             */
            if (subcommand === 'end') {
                if (
                    loaRecord.status !==
                    'approved'
                ) {
                    return interaction.editReply({
                        content:
                            '❌ Only an approved LOA can be ended.',
                    });
                }

                const endNotes =
                    interaction.options
                        .getString('notes')
                        ?.trim() || null;

                const endedAt =
                    new Date().toISOString();

                await updateDatabase(
                    'loa-records',
                    (records) => {
                        const record =
                            findRequestById(
                                records,
                                interaction.guildId,
                                requestId
                            );

                        record.status = 'ended';
                        record.endedAt = endedAt;

                        record.endedById =
                            interaction.user.id;

                        record.endNotes =
                            endNotes;

                        record.updatedAt =
                            endedAt;

                        return records;
                    },
                    {}
                );

                if (staffUser) {
                    await updateStaffLoaProfile(
                        interaction.guildId,
                        staffUser,
                        null
                    );
                }

                await addHistoryRecord(
                    interaction.guildId,
                    loaRecord.staffMemberId,
                    {
                        ...loaRecord,

                        id:
                            createRecordId(
                                'loa-ended'
                            ),

                        requestId,

                        status: 'ended',

                        endedAt,
                        endedById:
                            interaction.user.id,

                        endNotes,

                        createdAt: endedAt,

                        historyType:
                            'loa_ended',
                    }
                );

                const endEmbed =
                    new EmbedBuilder()
                        .setColor(brandColor)
                        .setTitle(
                            'ISRP | LOA Ended'
                        )
                        .setDescription(
                            [
                                `<@${loaRecord.staffMemberId}>'s leave of absence has officially ended.`,
                                '',
                                '**Original LOA Period**',
                                `${createDiscordTimestamp(
                                    loaRecord.startDate
                                )} — ${createDiscordTimestamp(
                                    loaRecord.endDate
                                )}`,
                                '',
                                '**Ended By**',
                                `${interaction.user}`,
                                '',
                                '**Additional Notes**',
                                endNotes ||
                                    'None provided',
                                '',
                                '**Request ID**',
                                `\`${requestId}\``,
                                '',
                                'The staff member has been returned to active status.',
                            ].join('\n')
                        )
                        .setFooter({
                            text:
                                'Illinois State Utilities • Leave of Absence System',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
                        })
                        .setTimestamp();

                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    await logChannel.send({
                        embeds: [endEmbed],
                    });
                }

                if (staffUser) {
                    await staffUser
                        .send({
                            embeds: [endEmbed],
                        })
                        .catch(() => {});
                }

                return interaction.editReply({
                    content:
                        `✅ LOA request \`${requestId}\` was ended successfully.`,
                });
            }

            return interaction.editReply({
                content:
                    '❌ That LOA action could not be completed.',
            });
        } catch (error) {
            console.error(
                'Error executing /loa:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while processing this LOA action.',
            };

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                await interaction
                    .editReply(errorMessage)
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