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
 * The hierarchy is ordered from lowest rank to highest rank.
 * This lets the bot verify that the new rank is above the old rank.
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote an Illinois State Roleplay staff member.')

        /*
         * Required options must appear before optional options.
         */
        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription('The staff member receiving the promotion.')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('previous-rank')
                .setDescription('The staff member’s current rank.')
                .addChoices(...RANK_CHOICES)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('new-rank')
                .setDescription('The rank the staff member is being promoted to.')
                .addChoices(...RANK_CHOICES)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('The reason for this promotion.')
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true)
        )

        /*
         * Optional options come after every required option.
         */
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel where the promotion will be announced.')
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription('An optional role to notify about the promotion.')
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription('Optional additional notes about the promotion.')
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
                interaction.options.getUser('staff-member', true);

            const previousRank =
                interaction.options.getString('previous-rank', true);

            const newRank =
                interaction.options.getString('new-rank', true);

            const reason =
                interaction.options.getString('reason', true).trim();

            const selectedChannel =
                interaction.options.getChannel('channel');

            const pingRole =
                interaction.options.getRole('ping');

            const notes =
                interaction.options.getString('notes')?.trim() || null;

            /*
             * Prevent the bot itself from being entered as the staff member.
             */
            if (staffMember.bot) {
                return interaction.editReply({
                    content:
                        '❌ Discord bots cannot receive staff promotions.',
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

            if (newRankIndex < previousRankIndex) {
                return interaction.editReply({
                    content:
                        '❌ That would be a demotion, not a promotion. Please use `/demote` for rank decreases.',
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
                        '❌ Illinois State Utilities has not been configured in this server yet.\n\nPlease run `/setup` before using the promotion system.',
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
                        '❌ I could not find a valid channel for the promotion announcement.',
                });
            }

            const brandColor = convertHexToDecimal(
                guildConfiguration.brandColor
            );

            const promotionId =
                createRecordId('promotion');

            const createdAt =
                new Date().toISOString();

            const promotionRecord = {
                id: promotionId,

                guildId: interaction.guildId,
                guildName: interaction.guild.name,

                staffMemberId: staffMember.id,
                staffUsername: staffMember.username,
                staffDisplayName:
                    staffMember.globalName || staffMember.username,

                previousRank,
                newRank,
                reason,
                notes,

                promotedById: interaction.user.id,
                promotedByUsername: interaction.user.username,
                promotedByDisplayName:
                    interaction.user.globalName ||
                    interaction.user.username,

                announcementChannelId:
                    destinationChannel.id,

                createdAt,
            };

            /*
             * Save the complete promotion history.
             *
             * Structure:
             * {
             *     "guildId": [
             *         promotion records
             *     ]
             * }
             */
            await updateDatabase(
                'promotions',
                (promotions) => {
                    if (
                        !promotions ||
                        typeof promotions !== 'object' ||
                        Array.isArray(promotions)
                    ) {
                        promotions = {};
                    }

                    if (!Array.isArray(promotions[interaction.guildId])) {
                        promotions[interaction.guildId] = [];
                    }

                    promotions[interaction.guildId].push(
                        promotionRecord
                    );

                    return promotions;
                },
                {}
            );

            /*
             * Create or update the staff member’s main profile.
             *
             * Structure:
             * {
             *     "guildId": {
             *         "discordUserId": {
             *             staff profile
             *         }
             *     }
             * }
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
                        !staffRecords[interaction.guildId] ||
                        typeof staffRecords[interaction.guildId] !==
                            'object' ||
                        Array.isArray(
                            staffRecords[interaction.guildId]
                        )
                    ) {
                        staffRecords[interaction.guildId] = {};
                    }

                    const existingRecord =
                        staffRecords[interaction.guildId][
                            staffMember.id
                        ];

                    const promotionHistory =
                        Array.isArray(
                            existingRecord?.promotionHistory
                        )
                            ? existingRecord.promotionHistory
                            : [];

                    promotionHistory.push({
                        promotionId,
                        previousRank,
                        newRank,
                        reason,
                        notes,
                        promotedById: interaction.user.id,
                        createdAt,
                    });

                    staffRecords[interaction.guildId][
                        staffMember.id
                    ] = {
                        staffMemberId: staffMember.id,
                        username: staffMember.username,
                        displayName:
                            staffMember.globalName ||
                            staffMember.username,

                        currentRank: newRank,

                        promotionCount:
                            Number(
                                existingRecord?.promotionCount || 0
                            ) + 1,

                        demotionCount:
                            Number(
                                existingRecord?.demotionCount || 0
                            ),

                        infractionCount:
                            Number(
                                existingRecord?.infractionCount || 0
                            ),

                        warningCount:
                            Number(
                                existingRecord?.warningCount || 0
                            ),

                        awardCount:
                            Number(
                                existingRecord?.awardCount || 0
                            ),

                        totalShiftMilliseconds:
                            Number(
                                existingRecord
                                    ?.totalShiftMilliseconds || 0
                            ),

                        activeLoa:
                            existingRecord?.activeLoa || null,

                        joinedStaffAt:
                            existingRecord?.joinedStaffAt ||
                            createdAt,

                        promotionHistory,

                        createdAt:
                            existingRecord?.createdAt ||
                            createdAt,

                        updatedAt: createdAt,
                    };

                    return staffRecords;
                },
                {}
            );

            const descriptionLines = [
                `Congratulations to ${staffMember} on receiving a staff promotion!`,
                '',
                'Your continued activity, professionalism, and dedication to Illinois State Roleplay have been recognized.',
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
                '**Promoted By**',
                `${interaction.user}`,
            ];

            if (notes) {
                descriptionLines.push(
                    '',
                    '**Additional Notes**',
                    notes
                );
            }

            descriptionLines.push(
                '',
                'Thank you for your continued dedication to Illinois State Roleplay.',
                '',
                '**Congratulations on your promotion!**'
            );

            const promotionEmbed = new EmbedBuilder()
                .setColor(brandColor)
                .setTitle('ISRP | Staff Promotion')
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
                    embeds: [promotionEmbed],
                    allowedMentions: {
                        roles: pingRole
                            ? [pingRole.id]
                            : [],
                        users: [staffMember.id],
                    },
                });

            /*
             * Send a separate private management log.
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
                    const logEmbed = new EmbedBuilder()
                        .setColor(brandColor)
                        .setTitle(
                            'Staff Promotion Recorded'
                        )
                        .setDescription(
                            [
                                `**Staff Member:** ${staffMember}`,
                                `**Previous Rank:** ${previousRank}`,
                                `**New Rank:** ${newRank}`,
                                `**Reason:** ${reason}`,
                                `**Additional Notes:** ${
                                    notes || 'None provided'
                                }`,
                                `**Promoted By:** ${interaction.user}`,
                                `**Announcement:** ${announcementMessage.url}`,
                                `**Record ID:** \`${promotionId}\``,
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
                            embeds: [logEmbed],
                            allowedMentions: {
                                parse: [],
                            },
                        })
                        .catch((error) => {
                            console.error(
                                'Promotion saved, but the management log could not be sent:',
                                error
                            );
                        });
                }
            }

            await interaction.editReply({
                content:
                    `✅ ${staffMember} was successfully promoted from **${previousRank}** to **${newRank}** in ${destinationChannel}.\n\n` +
                    `Promotion record: \`${promotionId}\``,
                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /promote:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while processing this staff promotion.',
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
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }
        }
    },
};