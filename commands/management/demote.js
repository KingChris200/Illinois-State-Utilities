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

/*
 * ISRP hierarchy ordered from lowest to highest.
 */
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

function convertHexToDecimal(hexColor) {
    if (typeof hexColor !== 'string') {
        return 0xc0392b;
    }

    const cleanedColor = hexColor
        .trim()
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    const parsedColor = Number.parseInt(cleanedColor, 16);

    if (Number.isNaN(parsedColor)) {
        return 0xc0392b;
    }

    return parsedColor;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription(
            'Demote an Illinois State Roleplay staff member.'
        )

        /*
         * Required options.
         */
        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription(
                    'The staff member receiving the demotion.'
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('previous-rank')
                .setDescription(
                    'The staff member’s current rank.'
                )
                .addChoices(...RANK_CHOICES)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('new-rank')
                .setDescription(
                    'The lower rank being assigned.'
                )
                .addChoices(...RANK_CHOICES)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription(
                    'The reason for this demotion.'
                )
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true)
        )

        /*
         * Optional options.
         */
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'The channel where the demotion will be announced.'
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
                    'An optional role to notify.'
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('evidence')
                .setDescription(
                    'Optional evidence link or reference.'
                )
                .setMaxLength(500)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription(
                    'Optional management notes.'
                )
                .setMaxLength(500)
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

            const previousRank =
                interaction.options.getString(
                    'previous-rank',
                    true
                );

            const newRank =
                interaction.options.getString(
                    'new-rank',
                    true
                );

            const reason =
                interaction.options
                    .getString('reason', true)
                    .trim();

            const selectedChannel =
                interaction.options.getChannel('channel');

            const pingRole =
                interaction.options.getRole('ping');

            const evidence =
                interaction.options
                    .getString('evidence')
                    ?.trim() || null;

            const notes =
                interaction.options
                    .getString('notes')
                    ?.trim() || null;

            if (staffMember.bot) {
                return interaction.editReply({
                    content:
                        '❌ Discord bots cannot receive staff demotions.',
                });
            }

            const previousRankIndex =
                STAFF_RANKS.indexOf(previousRank);

            const newRankIndex =
                STAFF_RANKS.indexOf(newRank);

            if (
                previousRankIndex === -1 ||
                newRankIndex === -1
            ) {
                return interaction.editReply({
                    content:
                        '❌ One of the selected ranks is not recognized by the ISRP hierarchy.',
                });
            }

            if (previousRank === newRank) {
                return interaction.editReply({
                    content:
                        '❌ The previous rank and new rank cannot be the same.',
                });
            }

            /*
             * Since the hierarchy is lowest to highest,
             * a demotion must move to a lower array index.
             */
            if (newRankIndex > previousRankIndex) {
                return interaction.editReply({
                    content:
                        '❌ That would be a promotion, not a demotion. Please use `/promote` for rank increases.',
                });
            }

            /*
             * Load the configuration created through /setup.
             */
            const configurations = await readDatabase(
                'guild-configs',
                {}
            );

            const guildConfiguration =
                configurations[interaction.guildId];

            if (!guildConfiguration) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities has not been configured in this server yet.\n\nPlease run `/setup` before using the demotion system.',
                });
            }

            /*
             * Load the member's current staff profile.
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

            /*
             * Protect database accuracy when a profile already exists.
             */
            if (
                existingStaffRecord?.currentRank &&
                existingStaffRecord.currentRank !==
                    previousRank
            ) {
                return interaction.editReply({
                    content:
                        `❌ The saved staff profile lists ${staffMember} as **${existingStaffRecord.currentRank}**, not **${previousRank}**.\n\n` +
                        'Please select their saved current rank before continuing.',
                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const destinationChannel =
                selectedChannel || interaction.channel;

            if (
                !destinationChannel ||
                !destinationChannel.isTextBased()
            ) {
                return interaction.editReply({
                    content:
                        '❌ I could not find a valid channel for the demotion announcement.',
                });
            }

            /*
             * Demotions use red so disciplinary rank changes
             * are visually distinct from promotions.
             */
            const demotionColor = 0xc0392b;

            const brandColor = convertHexToDecimal(
                guildConfiguration.brandColor
            );

            const demotionId =
                createRecordId('demotion');

            const createdAt =
                new Date().toISOString();

            const demotionRecord = {
                id: demotionId,

                type: 'demotion',

                guildId: interaction.guildId,
                guildName: interaction.guild.name,

                staffMemberId: staffMember.id,
                staffUsername: staffMember.username,
                staffDisplayName:
                    staffMember.globalName ||
                    staffMember.username,

                previousRank,
                newRank,
                reason,
                evidence,
                notes,

                issuedById: interaction.user.id,
                issuedByUsername:
                    interaction.user.username,
                issuedByDisplayName:
                    interaction.user.globalName ||
                    interaction.user.username,

                announcementChannelId:
                    destinationChannel.id,

                createdAt,
            };

            /*
             * Save the complete demotion record.
             */
            await updateDatabase(
                'demotions',
                (demotions) => {
                    if (
                        !demotions ||
                        typeof demotions !== 'object' ||
                        Array.isArray(demotions)
                    ) {
                        demotions = {};
                    }

                    if (
                        !Array.isArray(
                            demotions[interaction.guildId]
                        )
                    ) {
                        demotions[interaction.guildId] =
                            [];
                    }

                    demotions[
                        interaction.guildId
                    ].push(demotionRecord);

                    return demotions;
                },
                {}
            );

            /*
             * Save the action to the shared staff timeline.
             *
             * Future /history and /staff commands can use this
             * to display promotions, demotions, infractions,
             * warnings, awards, and other actions together.
             */
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
                    ][staffMember.id].push(
                        demotionRecord
                    );

                    return staffHistory;
                },
                {}
            );

            /*
             * Create or update the member's staff profile.
             */
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
                        ][staffMember.id];

                    const demotionHistory =
                        Array.isArray(
                            existingRecord
                                ?.demotionHistory
                        )
                            ? existingRecord
                                  .demotionHistory
                            : [];

                    demotionHistory.push({
                        demotionId,
                        previousRank,
                        newRank,
                        reason,
                        evidence,
                        notes,
                        issuedById:
                            interaction.user.id,
                        createdAt,
                    });

                    staffRecords[
                        interaction.guildId
                    ][staffMember.id] = {
                        staffMemberId:
                            staffMember.id,

                        username:
                            staffMember.username,

                        displayName:
                            staffMember.globalName ||
                            staffMember.username,

                        currentRank: newRank,

                        promotionCount: Number(
                            existingRecord
                                ?.promotionCount || 0
                        ),

                        demotionCount:
                            Number(
                                existingRecord
                                    ?.demotionCount || 0
                            ) + 1,

                        infractionCount: Number(
                            existingRecord
                                ?.infractionCount || 0
                        ),

                        warningCount: Number(
                            existingRecord
                                ?.warningCount || 0
                        ),

                        awardCount: Number(
                            existingRecord
                                ?.awardCount || 0
                        ),

                        totalShiftMilliseconds:
                            Number(
                                existingRecord
                                    ?.totalShiftMilliseconds ||
                                    0
                            ),

                        activeLoa:
                            existingRecord
                                ?.activeLoa || null,

                        joinedStaffAt:
                            existingRecord
                                ?.joinedStaffAt ||
                            createdAt,

                        promotionHistory:
                            Array.isArray(
                                existingRecord
                                    ?.promotionHistory
                            )
                                ? existingRecord
                                      .promotionHistory
                                : [],

                        demotionHistory,

                        createdAt:
                            existingRecord
                                ?.createdAt ||
                            createdAt,

                        updatedAt: createdAt,
                    };

                    return staffRecords;
                },
                {}
            );

            const descriptionLines = [
                `${staffMember} has received a staff rank adjustment within Illinois State Roleplay.`,
                '',
                '**Previous Rank**',
                previousRank,
                '',
                '**New Rank**',
                newRank,
                '',
                '**Reason**',
                reason,
                '',
                '**Issued By**',
                `${interaction.user}`,
            ];

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
                'This action has been formally recorded within the Illinois State Utilities staff-management system.',
                '',
                '**Please review all expectations associated with your assigned rank.**'
            );

            const demotionEmbed =
                new EmbedBuilder()
                    .setColor(demotionColor)
                    .setTitle(
                        'ISRP | Staff Demotion'
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
                            'Illinois State Utilities • Staff Management System',
                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            const announcementContent =
                pingRole ? `${pingRole}` : undefined;

            const announcementMessage =
                await destinationChannel.send({
                    content: announcementContent,
                    embeds: [demotionEmbed],
                    allowedMentions: {
                        roles: pingRole
                            ? [pingRole.id]
                            : [],
                        users: [staffMember.id],
                    },
                });

            /*
             * Send the private management log.
             */
            const logChannelId =
                guildConfiguration.logChannelId;

            if (logChannelId) {
                const logChannel =
                    interaction.guild.channels.cache.get(
                        logChannelId
                    );

                if (
                    logChannel &&
                    logChannel.isTextBased()
                ) {
                    const logDescription = [
                        `**Staff Member:** ${staffMember}`,
                        `**Previous Rank:** ${previousRank}`,
                        `**New Rank:** ${newRank}`,
                        `**Reason:** ${reason}`,
                        `**Evidence / Reference:** ${
                            evidence ||
                            'None provided'
                        }`,
                        `**Additional Notes:** ${
                            notes ||
                            'None provided'
                        }`,
                        `**Issued By:** ${interaction.user}`,
                        `**Announcement:** ${announcementMessage.url}`,
                        `**Record ID:** \`${demotionId}\``,
                    ];

                    const logEmbed =
                        new EmbedBuilder()
                            .setColor(brandColor)
                            .setTitle(
                                'Staff Demotion Recorded'
                            )
                            .setDescription(
                                logDescription.join(
                                    '\n'
                                )
                            )
                            .setThumbnail(
                                staffMember.displayAvatarURL(
                                    {
                                        size: 256,
                                    }
                                )
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
                            embeds: [logEmbed],
                            allowedMentions: {
                                parse: [],
                            },
                        })
                        .catch((error) => {
                            console.error(
                                'Demotion saved, but the management log could not be sent:',
                                error
                            );
                        });
                }
            }

            await interaction.editReply({
                content:
                    `✅ ${staffMember} was successfully demoted from **${previousRank}** to **${newRank}** in ${destinationChannel}.\n\n` +
                    `Demotion record: \`${demotionId}\``,
                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /demote:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while processing this staff demotion.',
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