const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
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

const {
    getConfiguredChannelId,
    memberCanReviewMovements,
} = require('../../config/serverConfigs');

const {
    detectMemberRank,
} = require('../../utils/rankManager');

const {
    findRecentDuplicate,
    analyzeInfractionHistory,
} = require('../../utils/infractionIntelligence');

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

    demotion: {
        label: 'Demotion',
        title: 'ISRP | Staff Demotion',
        color: 0xc0392b,
        recordPrefix: 'demotion',
        counterField: 'demotionCount',
        opening:
            'has received an official disciplinary demotion within Illinois State Roleplay.',
        closing:
            'This demotion has been formally documented. Future advancement should follow management review and demonstrated improvement.',
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

function canIssueInfractions(interaction) {
    const member = interaction.member;

    return Boolean(
        interaction.guild?.ownerId === interaction.user.id ||
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

function hasRequiredChannelPermissions(channel, botMember) {
    if (!channel || !botMember) {
        return false;
    }

    const permissions = channel.permissionsFor(botMember);

    return Boolean(
        permissions?.has(PermissionFlagsBits.ViewChannel) &&
        permissions?.has(PermissionFlagsBits.SendMessages) &&
        permissions?.has(PermissionFlagsBits.EmbedLinks)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infraction')
        .setDMPermission(false)
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
                        name: 'Demotion',
                        value: 'demotion',
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

            if (!canIssueInfractions(interaction)) {
                return interaction.editReply({
                    content:
                        '❌ You need an authorized management, Internal Affairs, director, or ownership role to issue staff infractions.',
                });
            }

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

            const reason =
                interaction.options
                    .getString('reason', true)
                    .trim();

            const evidence =
                interaction.options
                    .getString('evidence')
                    ?.trim() || null;

            let duration =
                interaction.options
                    .getString('duration')
                    ?.trim() || null;

            const notes = null;

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

            if (staffMember.id === interaction.user.id) {
                return interaction.editReply({
                    content:
                        '❌ You cannot issue a disciplinary action to yourself.',
                });
            }

            if (
                infractionTypeKey === 'blacklist' &&
                !duration
            ) {
                duration = 'Permanent';
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

            const targetMember =
                await interaction.guild.members
                    .fetch(staffMember.id)
                    .catch(() => null);

            if (!targetMember) {
                return interaction.editReply({
                    content:
                        '❌ The selected user is not currently a member of this server.',
                });
            }

            const executorIsOwner =
                interaction.guild.ownerId ===
                interaction.user.id;
            const executorIsAdministrator =
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (
                !executorIsOwner &&
                !executorIsAdministrator &&
                interaction.member.roles.highest.comparePositionTo(
                    targetMember.roles.highest
                ) <= 0
            ) {
                return interaction.editReply({
                    content:
                        '❌ You cannot issue an infraction to a member whose highest role is equal to or above yours.',
                });
            }

            /*
             * Prefer the member's live Discord rank. A saved profile is a
             * safe fallback for members whose configured role is unavailable.
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
            const detectedRank =
                detectMemberRank(
                    interaction.guildId,
                    targetMember
                );
            const currentRank =
                detectedRank?.name ||
                existingStaffRecord?.currentRank ||
                'Not detected';
            const rankDetectionSource = detectedRank
                ? 'discord_roles'
                : existingStaffRecord?.currentRank
                  ? 'staff_profile'
                  : 'unavailable';

            const configuredInfractionChannelId =
                getConfiguredChannelId(
                    interaction.guildId,
                    'infractions'
                );

            const destinationChannel =
                configuredInfractionChannelId
                    ? interaction.guild.channels.cache.get(
                          configuredInfractionChannelId
                      ) ||
                      await interaction.guild.channels
                          .fetch(
                              configuredInfractionChannelId
                          )
                          .catch(() => null)
                    : null;

            if (
                !destinationChannel ||
                !destinationChannel.isTextBased()
            ) {
                return interaction.editReply({
                    content:
                        `❌ I could not access the configured infractions channel (<#${configuredInfractionChannelId || 'not-configured'}>).`,
                });
            }

            if (
                !hasRequiredChannelPermissions(
                    destinationChannel,
                    interaction.guild.members.me
                )
            ) {
                return interaction.editReply({
                    content:
                        `❌ I need **View Channel**, **Send Messages**, and **Embed Links** permissions in ${destinationChannel}.`,
                });
            }

            const infractionsDatabase =
                await readDatabase('infractions', {});
            const guildInfractions =
                Array.isArray(
                    infractionsDatabase[
                        interaction.guildId
                    ]
                )
                    ? infractionsDatabase[
                          interaction.guildId
                      ]
                    : [];

            const duplicateInfraction =
                findRecentDuplicate({
                    records: guildInfractions,
                    staffMemberId:
                        staffMember.id,
                    infractionType:
                        infractionTypeKey,
                    reason,
                });

            if (duplicateInfraction) {
                return interaction.editReply({
                    content:
                        `⚠️ Smart duplicate protection stopped this request. An identical **${infractionType.label}** was issued to ${staffMember} within the last 10 minutes.\n\n` +
                        `Existing record: \`${duplicateInfraction.id}\`\n` +
                        'Review the existing record before trying again.',
                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const historyAnalysis =
                analyzeInfractionHistory({
                    records: guildInfractions,
                    staffMemberId:
                        staffMember.id,
                    infractionType:
                        infractionTypeKey,
                });

            const confirmationId =
                `infraction_confirm:${interaction.id}`;
            const cancellationId =
                `infraction_cancel:${interaction.id}`;

            const confirmationEmbed =
                new EmbedBuilder()
                    .setColor(
                        infractionType.color
                    )
                    .setTitle(
                        `Confirm ${infractionType.label}`
                    )
                    .setDescription(
                        'Review the complete action below. Nothing will be recorded until you confirm.'
                    )
                    .addFields(
                        {
                            name: 'Staff Member',
                            value: `${staffMember}`,
                            inline: true,
                        },
                        {
                            name: 'Current / Final Rank',
                            value: currentRank,
                            inline: true,
                        },
                        {
                            name: 'Announcement Channel',
                            value: `${destinationChannel}`,
                            inline: true,
                        },
                        {
                            name: 'Reason',
                            value: reason,
                        },
                        {
                            name: 'Smart Risk Review',
                            value: [
                                `**${historyAnalysis.level}** risk • ${historyAnalysis.activeCount} active record(s) • ${historyAnalysis.recentCount} record(s) in 30 days`,
                                historyAnalysis.recommendation,
                            ].join('\n'),
                        },
                    )
                    .setThumbnail(
                        staffMember.displayAvatarURL({
                            size: 256,
                        })
                    )
                    .setFooter({
                        text:
                            'Illinois State Utilities • Smart Discipline Review',
                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            const confirmationButtons =
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            confirmationId
                        )
                        .setLabel(
                            `Confirm ${infractionType.label}`
                        )
                        .setStyle(
                            ButtonStyle.Danger
                        ),
                    new ButtonBuilder()
                        .setCustomId(
                            cancellationId
                        )
                        .setLabel('Cancel')
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

            await interaction.editReply({
                embeds: [confirmationEmbed],
                components: [confirmationButtons],
                allowedMentions: {
                    parse: [],
                },
            });

            const confirmationMessage =
                await interaction.fetchReply();

            const confirmation =
                await confirmationMessage
                    .awaitMessageComponent({
                        filter: (buttonInteraction) =>
                            buttonInteraction.user.id ===
                                interaction.user.id &&
                            [
                                confirmationId,
                                cancellationId,
                            ].includes(
                                buttonInteraction.customId
                            ),
                        time: 60_000,
                    })
                    .catch(() => null);

            if (!confirmation) {
                return interaction.editReply({
                    content:
                        '⌛ This infraction preview expired after 60 seconds. Nothing was recorded.',
                    embeds: [],
                    components: [],
                });
            }

            await confirmation.deferUpdate();

            if (
                confirmation.customId ===
                cancellationId
            ) {
                return interaction.editReply({
                    content:
                        '✅ Infraction cancelled. Nothing was recorded or announced.',
                    embeds: [],
                    components: [],
                });
            }

            await interaction.editReply({
                content:
                    '⏳ Confirmation received. Recording the official case and announcement…',
                embeds: [],
                components: [],
            });

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
                rankDetectionSource,
                reason,
                evidence,
                duration,
                notes,
                smartReview: {
                    level:
                        historyAnalysis.level,
                    activePriorRecords:
                        historyAnalysis.activeCount,
                    recentRecords:
                        historyAnalysis.recentCount,
                    recommendation:
                        historyAnalysis.recommendation,
                },

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
                        rankDetectionSource,
                        duration,
                        infractionType:
                            infractionTypeKey,
                        infractionLabel:
                            infractionType.label,
                        smartRiskLevel:
                            historyAnalysis.level,
                        activePriorRecords:
                            historyAnalysis.activeCount,
                        recentRecords:
                            historyAnalysis.recentCount,
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
                '**Accountability Summary**',
                `${historyAnalysis.level} risk • ${historyAnalysis.activeCount} prior active record(s) • ${historyAnalysis.recentCount} record(s) within 30 days`
            );

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
                    embeds: [
                        infractionEmbed,
                    ],

                    allowedMentions: {
                        parse: [],
                        roles: [],
                        users: [],
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
