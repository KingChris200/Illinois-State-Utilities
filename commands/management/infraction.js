const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');

const {
    readDatabase,
    updateDatabase,
    createRecordId,
} = require('../../utils/database');

const {
    createCase,
    updateCase,
} = require('../../utils/caseManager');

const STAFF_RANKS = [
    'Trial Moderator',
    'Senior Moderator',
    'Community Moderator',

    'Junior Supervisory',
    'Senior Supervisory',
    'Head Supervisory',

    'Junior Manager',
    'Manager',
    'Senior Manager',

    'Junior Internal Affairs',
    'Senior Internal Affairs',
    'Superior Internal Affairs',

    'Assistant Server Director',
    'Deputy Server Director',
    'Server Director',

    'Co Owner',
    'Owner',
];

const RANK_CHOICES = STAFF_RANKS.map((rank) => ({
    name: rank,
    value: rank,
}));

const INFRACTION_TYPES = {
    notice: {
        label: 'Notice',
        title: 'ISRP | Staff Notice',
        color: 0xf1c40f,
        recordPrefix: 'notice',
        counterField: 'noticeCount',
        opening:
            'has received an official staff notice from Illinois State Roleplay management.',
        closing:
            'This notice formally documents the concern and provides an opportunity for improvement.',
    },

    inactivity_notice: {
        label: 'Inactivity Notice',
        title: 'ISRP | Inactivity Notice',
        color: 0xe67e22,
        recordPrefix: 'inactivity',
        counterField: 'inactivityNoticeCount',
        opening:
            'has received an official inactivity notice from Illinois State Roleplay management.',
        closing:
            'Please improve your activity or communicate with management if an approved leave of absence is required.',
    },

    warning: {
        label: 'Warning',
        title: 'ISRP | Staff Warning',
        color: 0xf39c12,
        recordPrefix: 'warning',
        counterField: 'warningCount',
        opening:
            'has received a formal staff warning within Illinois State Roleplay.',
        closing:
            'Further violations or failure to improve may result in additional disciplinary action.',
    },

    strike: {
        label: 'Strike',
        title: 'ISRP | Staff Strike',
        color: 0xe74c3c,
        recordPrefix: 'strike',
        counterField: 'strikeCount',
        opening:
            'has received a formal staff strike within Illinois State Roleplay.',
        closing:
            'This is a serious disciplinary action. Further violations may result in demotion or termination.',
    },

    termination: {
        label: 'Termination',
        title: 'ISRP | Staff Termination',
        color: 0x992d22,
        recordPrefix: 'termination',
        counterField: 'terminationCount',
        opening:
            'has been officially terminated from the Illinois State Roleplay staff team.',
        closing:
            'This decision has been formally recorded within the Illinois State Utilities staff-management system.',
    },

    blacklist: {
        label: 'Blacklist',
        title: 'ISRP | Staff Blacklist',
        color: 0x2b2d31,
        recordPrefix: 'blacklist',
        counterField: 'blacklistCount',
        opening:
            'has been officially blacklisted from the Illinois State Roleplay staff team.',
        closing:
            'This blacklist has been permanently recorded and may only be reviewed by authorized leadership.',
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

    const parsedColor = Number.parseInt(cleanedColor, 16);

    return Number.isNaN(parsedColor)
        ? 0x005b96
        : parsedColor;
}

function getDisplayName(user) {
    return user.globalName || user.username;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infraction')
        .setDescription(
            'Issue and permanently record an ISRP staff disciplinary action.'
        )

        // Required options
        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription(
                    'The staff member receiving the disciplinary action.'
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription(
                    'The type of disciplinary action being issued.'
                )
                .addChoices(
                    {
                        name: 'Notice',
                        value: 'notice',
                    },
                    {
                        name: 'Inactivity Notice',
                        value: 'inactivity_notice',
                    },
                    {
                        name: 'Warning',
                        value: 'warning',
                    },
                    {
                        name: 'Strike',
                        value: 'strike',
                    },
                    {
                        name: 'Termination',
                        value: 'termination',
                    },
                    {
                        name: 'Blacklist',
                        value: 'blacklist',
                    }
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('current-rank')
                .setDescription(
                    'The staff member’s current or final staff rank.'
                )
                .addChoices(...RANK_CHOICES)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription(
                    'The reason for this disciplinary action.'
                )
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true)
        )

        // Optional options
        .addStringOption((option) =>
            option
                .setName('evidence')
                .setDescription(
                    'An evidence link, message link, or case reference.'
                )
                .setMaxLength(1000)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('duration')
                .setDescription(
                    'Optional duration or expiration, such as 30 days or Permanent.'
                )
                .setMaxLength(100)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription(
                    'Optional additional management notes.'
                )
                .setMaxLength(750)
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'The channel where the disciplinary action will be announced.'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription(
                    'An optional role to notify about this action.'
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

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const staffMember =
                interaction.options.getUser(
                    'staff-member',
                    true
                );

            const infractionTypeKey =
                interaction.options.getString(
                    'type',
                    true
                );

            const currentRank =
                interaction.options.getString(
                    'current-rank',
                    true
                );

            const reason =
                interaction.options
                    .getString('reason', true)
                    .trim();

            const evidence =
                interaction.options
                    .getString('evidence')
                    ?.trim() || null;

            const duration =
                interaction.options
                    .getString('duration')
                    ?.trim() || null;

            const notes =
                interaction.options
                    .getString('notes')
                    ?.trim() || null;

            const selectedChannel =
                interaction.options.getChannel('channel');

            const pingRole =
                interaction.options.getRole('ping');

            const infractionType =
                INFRACTION_TYPES[infractionTypeKey];

            if (!infractionType) {
                return interaction.editReply({
                    content:
                        '❌ The selected disciplinary-action type is not recognized.',
                });
            }

            if (staffMember.bot) {
                return interaction.editReply({
                    content:
                        '❌ Discord bots cannot receive staff disciplinary actions.',
                });
            }

            /*
             * Load server configuration.
             */
            const configurations =
                await readDatabase(
                    'guild-configs',
                    {}
                );

            const guildConfiguration =
                configurations[interaction.guildId];

            if (!guildConfiguration) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities has not been configured in this server yet.\n\nRun `/setup` before using the discipline system.',
                });
            }

            /*
             * Confirm the selected rank matches the saved staff profile.
             */
            const staffRecordsDatabase =
                await readDatabase(
                    'staff-records',
                    {}
                );

            const existingStaffRecord =
                staffRecordsDatabase[
                    interaction.guildId
                ]?.[staffMember.id] || null;

            if (
                existingStaffRecord?.currentRank &&
                existingStaffRecord.currentRank !==
                    currentRank
            ) {
                return interaction.editReply({
                    content:
                        `❌ The saved staff profile lists ${staffMember} as **${existingStaffRecord.currentRank}**, not **${currentRank}**.\n\n` +
                        'Please select the rank currently saved in their profile.',
                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const configuredSessionChannel =
                guildConfiguration.sessionChannelId
                    ? interaction.guild.channels.cache.get(
                          guildConfiguration.sessionChannelId
                      )
                    : null;

            const destinationChannel =
                selectedChannel ||
                configuredSessionChannel ||
                interaction.channel;

            if (
                !destinationChannel ||
                !destinationChannel.isTextBased()
            ) {
                return interaction.editReply({
                    content:
                        '❌ I could not find a valid channel for this disciplinary announcement.',
                });
            }

            const createdAt =
                new Date().toISOString();

            /*
             * This is the disciplinary record ID stored in infractions.json.
             */
            const infractionId =
                createRecordId(
                    infractionType.recordPrefix
                );

            const isTermination =
                infractionTypeKey === 'termination';

            const isBlacklist =
                infractionTypeKey === 'blacklist';

            const infractionRecord = {
                id: infractionId,

                type: infractionTypeKey,
                typeLabel: infractionType.label,

                guildId: interaction.guildId,
                guildName: interaction.guild.name,

                staffMemberId: staffMember.id,
                staffUsername: staffMember.username,
                staffDisplayName:
                    getDisplayName(staffMember),

                currentRank,
                reason,
                evidence,
                duration,
                notes,

                issuedById: interaction.user.id,
                issuedByUsername:
                    interaction.user.username,
                issuedByDisplayName:
                    getDisplayName(
                        interaction.user
                    ),

                announcementChannelId:
                    destinationChannel.id,

                caseId: null,

                status: 'active',

                createdAt,
                updatedAt: createdAt,
            };

            /*
             * Create the official searchable case.
             */
            const officialCase =
                await createCase({
                    guildId:
                        interaction.guildId,

                    guildName:
                        interaction.guild.name,

                    caseType:
                        infractionTypeKey,

                    title:
                        `${infractionType.label} — ${getDisplayName(
                            staffMember
                        )}`,

                    staffMemberId:
                        staffMember.id,

                    staffUsername:
                        staffMember.username,

                    staffDisplayName:
                        getDisplayName(
                            staffMember
                        ),

                    issuedById:
                        interaction.user.id,

                    issuedByUsername:
                        interaction.user.username,

                    issuedByDisplayName:
                        getDisplayName(
                            interaction.user
                        ),

                    reason,
                    evidence,
                    notes,

                    relatedRecordId:
                        infractionId,

                    relatedChannelId:
                        destinationChannel.id,

                    metadata: {
                        currentRank,
                        duration,
                        infractionType:
                            infractionTypeKey,
                        infractionLabel:
                            infractionType.label,
                    },
                });

            infractionRecord.caseId =
                officialCase.id;

            /*
             * Save the disciplinary record.
             */
            await updateDatabase(
                'infractions',
                (infractions) => {
                    if (
                        !infractions ||
                        typeof infractions !==
                            'object' ||
                        Array.isArray(infractions)
                    ) {
                        infractions = {};
                    }

                    if (
                        !Array.isArray(
                            infractions[
                                interaction.guildId
                            ]
                        )
                    ) {
                        infractions[
                            interaction.guildId
                        ] = [];
                    }

                    infractions[
                        interaction.guildId
                    ].push(infractionRecord);

                    return infractions;
                },
                {}
            );

            /*
             * Add the disciplinary action to unified staff history.
             */
            await updateDatabase(
                'staff-history',
                (staffHistory) => {
                    if (
                        !staffHistory ||
                        typeof staffHistory !==
                            'object' ||
                        Array.isArray(staffHistory)
                    ) {
                        staffHistory = {};
                    }

                    if (
                        !staffHistory[
                            interaction.guildId
                        ] ||
                        typeof staffHistory[
                            interaction.guildId
                        ] !== 'object' ||
                        Array.isArray(
                            staffHistory[
                                interaction.guildId
                            ]
                        )
                    ) {
                        staffHistory[
                            interaction.guildId
                        ] = {};
                    }

                    if (
                        !Array.isArray(
                            staffHistory[
                                interaction.guildId
                            ][staffMember.id]
                        )
                    ) {
                        staffHistory[
                            interaction.guildId
                        ][staffMember.id] = [];
                    }

                    staffHistory[
                        interaction.guildId
                    ][staffMember.id].push({
                        ...infractionRecord,
                        historyType:
                            'infraction',
                    });

                    return staffHistory;
                },
                {}
            );

            /*
             * Create or update the main staff profile.
             */
            await updateDatabase(
                'staff-records',
                (staffRecords) => {
                    if (
                        !staffRecords ||
                        typeof staffRecords !==
                            'object' ||
                        Array.isArray(staffRecords)
                    ) {
                        staffRecords = {};
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
                        ][staffMember.id] || {};

                    const infractionHistory =
                        Array.isArray(
                            existingRecord
                                .infractionHistory
                        )
                            ? existingRecord
                                  .infractionHistory
                            : [];

                    infractionHistory.push({
                        infractionId,
                        caseId:
                            officialCase.id,

                        type:
                            infractionTypeKey,

                        typeLabel:
                            infractionType.label,

                        currentRank,
                        reason,
                        evidence,
                        duration,
                        notes,

                        issuedById:
                            interaction.user.id,

                        status: 'active',
                        createdAt,
                    });

                    const updatedRecord = {
                        ...existingRecord,

                        staffMemberId:
                            staffMember.id,

                        username:
                            staffMember.username,

                        displayName:
                            getDisplayName(
                                staffMember
                            ),

                        currentRank,

                        noticeCount:
                            Number(
                                existingRecord.noticeCount ||
                                    0
                            ),

                        inactivityNoticeCount:
                            Number(
                                existingRecord
                                    .inactivityNoticeCount ||
                                    0
                            ),

                        warningCount:
                            Number(
                                existingRecord.warningCount ||
                                    0
                            ),

                        strikeCount:
                            Number(
                                existingRecord.strikeCount ||
                                    0
                            ),

                        terminationCount:
                            Number(
                                existingRecord
                                    .terminationCount ||
                                    0
                            ),

                        blacklistCount:
                            Number(
                                existingRecord
                                    .blacklistCount ||
                                    0
                            ),

                        totalInfractionCount:
                            Number(
                                existingRecord
                                    .totalInfractionCount ||
                                    0
                            ) + 1,

                        promotionCount:
                            Number(
                                existingRecord
                                    .promotionCount ||
                                    0
                            ),

                        demotionCount:
                            Number(
                                existingRecord
                                    .demotionCount ||
                                    0
                            ),

                        awardCount:
                            Number(
                                existingRecord.awardCount ||
                                    0
                            ),

                        infractionHistory,

                        staffStatus:
                            existingRecord.staffStatus ||
                            'Active',

                        blacklistStatus:
                            existingRecord
                                .blacklistStatus ||
                            'Not Blacklisted',

                        activeLoa:
                            existingRecord.activeLoa ||
                            null,

                        joinedStaffAt:
                            existingRecord
                                .joinedStaffAt ||
                            createdAt,

                        createdAt:
                            existingRecord.createdAt ||
                            createdAt,

                        updatedAt: createdAt,
                    };

                    updatedRecord[
                        infractionType.counterField
                    ] =
                        Number(
                            updatedRecord[
                                infractionType
                                    .counterField
                            ] || 0
                        ) + 1;

                    if (isTermination) {
                        updatedRecord.staffStatus =
                            'Terminated';

                        updatedRecord.terminatedAt =
                            createdAt;

                        updatedRecord.terminatedById =
                            interaction.user.id;

                        updatedRecord.terminationRecordId =
                            infractionId;

                        updatedRecord.terminationCaseId =
                            officialCase.id;
                    }

                    if (isBlacklist) {
                        updatedRecord.staffStatus =
                            'Blacklisted';

                        updatedRecord.blacklistStatus =
                            duration || 'Permanent';

                        updatedRecord.blacklistedAt =
                            createdAt;

                        updatedRecord.blacklistedById =
                            interaction.user.id;

                        updatedRecord.blacklistRecordId =
                            infractionId;

                        updatedRecord.blacklistCaseId =
                            officialCase.id;
                    }

                    staffRecords[
                        interaction.guildId
                    ][staffMember.id] =
                        updatedRecord;

                    return staffRecords;
                },
                {}
            );

            const descriptionLines = [
                `${staffMember} ${infractionType.opening}`,
                '',
                '**Action Type**',
                infractionType.label,
                '',
                isTermination || isBlacklist
                    ? '**Final Rank**'
                    : '**Current Rank**',
                currentRank,
                '',
                '**Reason**',
                reason,
                '',
                '**Issued By**',
                `${interaction.user}`,
            ];

            if (duration) {
                descriptionLines.push(
                    '',
                    isBlacklist
                        ? '**Blacklist Duration**'
                        : '**Duration / Expiration**',
                    duration
                );
            }

            if (evidence) {
                descriptionLines.push(
                    '',
                    '**Evidence / Reference**',
                    evidence
                );
            }

            if (notes) {
                descriptionLines.push(
                    '',
                    '**Additional Notes**',
                    notes
                );
            }

            descriptionLines.push(
                '',
                '**Infraction Record ID**',
                `\`${infractionId}\``,
                '',
                '**Official Case ID**',
                `\`${officialCase.id}\``,
                '',
                infractionType.closing
            );

            const infractionEmbed =
                new EmbedBuilder()
                    .setColor(
                        infractionType.color
                    )
                    .setTitle(
                        infractionType.title
                    )
                    .setDescription(
                        descriptionLines.join('\n')
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
                            'Illinois State Utilities • Staff Discipline System',

                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            const announcementMessage =
                await destinationChannel.send({
                    content:
                        pingRole
                            ? `${pingRole}`
                            : undefined,

                    embeds: [
                        infractionEmbed,
                    ],

                    allowedMentions: {
                        roles:
                            pingRole
                                ? [pingRole.id]
                                : [],

                        users: [
                            staffMember.id,
                        ],
                    },
                });

            /*
             * Link the Discord announcement to the official case.
             */
            await updateCase(
                interaction.guildId,
                officialCase.id,
                {
                    performedById:
                        interaction.user.id,

                    performedByUsername:
                        interaction.user.username,

                    reason:
                        'Linked the disciplinary announcement to this case.',

                    action:
                        'announcement_linked',

                    updates: {
                        relatedMessageUrl:
                            announcementMessage.url,

                        relatedChannelId:
                            destinationChannel.id,
                    },
                }
            );

            /*
             * Send management log.
             */
            const logChannel =
                guildConfiguration.logChannelId
                    ? interaction.guild.channels.cache.get(
                          guildConfiguration.logChannelId
                      )
                    : null;

            if (
                logChannel &&
                logChannel.isTextBased()
            ) {
                const logEmbed =
                    new EmbedBuilder()
                        .setColor(
                            convertHexToDecimal(
                                guildConfiguration.brandColor
                            )
                        )
                        .setTitle(
                            `${infractionType.label} Recorded`
                        )
                        .setDescription(
                            [
                                `**Staff Member:** ${staffMember}`,
                                `**Action Type:** ${infractionType.label}`,
                                `**Current / Final Rank:** ${currentRank}`,
                                `**Reason:** ${reason}`,
                                `**Evidence / Reference:** ${
                                    evidence ||
                                    'None provided'
                                }`,
                                `**Duration / Expiration:** ${
                                    duration ||
                                    'Not provided'
                                }`,
                                `**Additional Notes:** ${
                                    notes ||
                                    'None provided'
                                }`,
                                `**Issued By:** ${interaction.user}`,
                                `**Announcement:** ${announcementMessage.url}`,
                                `**Infraction Record ID:** \`${infractionId}\``,
                                `**Official Case ID:** \`${officialCase.id}\``,
                                '**Case Status:** Open',
                            ].join('\n')
                        )
                        .setThumbnail(
                            staffMember.displayAvatarURL({
                                size: 256,
                            })
                        )
                        .setFooter({
                            text:
                                'Illinois State Utilities • Management Logs',

                            iconURL:
                                interaction.client.user.displayAvatarURL(),
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
                    .catch((error) => {
                        console.error(
                            'Infraction saved, but the management log could not be sent:',
                            error
                        );
                    });
            }

            return interaction.editReply({
                content:
                    `✅ A **${infractionType.label}** was successfully issued to ${staffMember} in ${destinationChannel}.\n\n` +
                    `Infraction Record ID: \`${infractionId}\`\n` +
                    `Official Case ID: \`${officialCase.id}\`\n\n` +
                    `Use \`/case view\` with the official case ID to open the complete record.`,

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /infraction:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while processing this staff disciplinary action.',
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