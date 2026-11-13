onst {
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
    getServerConfig,
    getGuildRankIndex,
    getRankAutocompleteChoices,
    memberCanReviewMovements,
} = require('../../config/serverConfigs');

const {
    applyRankChange,
    detectMemberRank,
    getRankChangeErrorMessage,
} = require('../../utils/rankManager');

const {
    findRecentPromotionDuplicate,
    analyzePromotionProgression,
} = require('../../utils/promotionIntelligence');

/*
 * ============================================================
 * PROMOTION CONFIGURATION
 * ============================================================
 */

/*
 * Official Illinois State Roleplay promotion channel.
 *
 * The bot will use the promotions channel stored inside
 * serverConfigs.js first. This ID acts as the ISRP fallback.
 */
const ISRP_PROMOTION_CHANNEL_ID =
    '1547773652525916232';

const DEFAULT_BRAND_COLOR =
    0x2b2d31;

const FOOTER_TEXT =
    'Illinois State Utilities • Staff Management System';

/*
 * ============================================================
 * GENERAL HELPERS
 * ============================================================
 */

/**
 * Make sure a database value is a normal object.
 *
 * @param {*} value
 * @returns {object}
 */
function normalizeObject(value) {
    if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        return {};
    }

    return value;
}

/**
 * Return the best available visible name for a Discord user.
 *
 * @param {import('discord.js').User} user
 * @returns {string}
 */
function getUserDisplayName(user) {
    return (
        user.globalName ||
        user.username ||
        'Unknown User'
    );
}

/**
 * Prevent text from exceeding Discord embed limits.
 *
 * @param {*} value
 * @param {number} maximumLength
 * @returns {string}
 */
function truncateText(
    value,
    maximumLength
) {
    const text =
        String(value || '');

    if (
        text.length <=
        maximumLength
    ) {
        return text;
    }

    return `${text.slice(
        0,
        maximumLength - 3
    )}...`;
}

/**
 * Convert a saved hexadecimal color into a Discord color integer.
 *
 * @param {*} value
 * @returns {number}
 */
function parseBrandColor(value) {
    if (
        Number.isInteger(value)
    ) {
        return value;
    }

    if (
        typeof value !== 'string'
    ) {
        return DEFAULT_BRAND_COLOR;
    }

    const cleanedValue =
        value
            .trim()
            .replace(/^#/, '')
            .replace(/^0x/i, '');

    const parsedValue =
        Number.parseInt(
            cleanedValue,
            16
        );

    if (
        Number.isNaN(parsedValue)
    ) {
        return DEFAULT_BRAND_COLOR;
    }

    return parsedValue;
}

/**
 * Choose the configured server color.
 *
 * @param {object} serverConfig
 * @param {object} guildConfiguration
 * @returns {number}
 */
function getBrandColor(
    serverConfig,
    guildConfiguration
) {
    if (
        Number.isInteger(
            serverConfig?.brandColor
        )
    ) {
        return serverConfig.brandColor;
    }

    return parseBrandColor(
        guildConfiguration?.brandColor
    );
}

/**
 * Return the configured promotion embed title.
 *
 * @param {object} serverConfig
 * @returns {string}
 */
function getPromotionTitle(
    serverConfig
) {
    return (
        serverConfig
            ?.embedTitles
            ?.promotion ||
        `${
            serverConfig?.shortName ||
            'ISU'
        } | Staff Promotion`
    );
}

/**
 * Return the configured promotion opening message.
 *
 * @param {object} serverConfig
 * @returns {string}
 */
function getPromotionOpening(
    serverConfig
) {
    return (
        serverConfig
            ?.messages
            ?.promotionOpening ||
        'Please join us in congratulating this member on receiving a promotion!'
    );
}

/**
 * Return the configured promotion closing message.
 *
 * @param {object} serverConfig
 * @returns {string}
 */
function getPromotionClosing(
    serverConfig
) {
    return (
        serverConfig
            ?.messages
            ?.promotionClosing ||
        'Thank you for your continued professionalism, dedication, and service.'
    );
}

/**
 * Check whether the command user may issue promotions.
 *
 * Administrators and members with Manage Roles are allowed.
 * Configured movement reviewers are also allowed.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {boolean}
 */
function canUsePromotionCommand(
    interaction
) {
    const member =
        interaction.member;

    if (!member) {
        return false;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits
                .Administrator
        )
    ) {
        return true;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits
                .ManageRoles
        )
    ) {
        return true;
    }

    return memberCanReviewMovements(
        member,
        interaction.guildId
    );
}

async function requestPromotionConfirmation({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    promotionChannel,
    progressionAnalysis,
    serverConfig,
    guildConfiguration,
}) {
    const confirmationId =
        `promotion_confirm:${interaction.id}`;
    const cancellationId =
        `promotion_cancel:${interaction.id}`;

    const previewEmbed = new EmbedBuilder()
        .setColor(
            getBrandColor(
                serverConfig,
                guildConfiguration
            )
        )
        .setTitle('Confirm Staff Promotion')
        .setDescription(
            'Review this promotion carefully. No roles or records will change until you confirm.'
        )
        .addFields(
            {
                name: 'Staff Member',
                value: `${staffMember}`,
                inline: true,
            },
            {
                name: 'Rank Movement',
                value:
                    `**${previousRank}** → **${newRank}**`,
                inline: true,
            },
            {
                name: 'Announcement Channel',
                value: `${promotionChannel}`,
                inline: true,
            },
            {
                name: 'Promotion Reason',
                value: reason,
            },
            {
                name: 'Smart Progression Review',
                value: [
                    `**${progressionAnalysis.classification}** • ${progressionAnalysis.ranksAdvanced} rank level(s) advanced`,
                    `${progressionAnalysis.recentPromotionCount} promotion(s) recorded within 30 days`,
                    progressionAnalysis.recommendation,
                ].join('\n'),
            }
        )
        .setThumbnail(
            staffMember.displayAvatarURL({
                size: 256,
            })
        )
        .setFooter({
            text:
                'Illinois State Utilities • Smart Promotion Review',
            iconURL:
                interaction.client.user.displayAvatarURL({
                    size: 128,
                }),
        })
        .setTimestamp();

    const buttons =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(confirmationId)
                .setLabel('Confirm Promotion')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(cancellationId)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({
        embeds: [previewEmbed],
        components: [buttons],
        allowedMentions: {
            parse: [],
        },
    });

    const previewMessage =
        await interaction.fetchReply();
    const response = await previewMessage
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

    if (!response) {
        await interaction.editReply({
            content:
                '⌛ This promotion preview expired after 60 seconds. No roles or records were changed.',
            embeds: [],
            components: [],
        });
        return 'expired';
    }

    await response.deferUpdate();

    if (response.customId === cancellationId) {
        await interaction.editReply({
            content:
                '✅ Promotion cancelled. No roles or records were changed.',
            embeds: [],
            components: [],
        });
        return 'cancelled';
    }

    await interaction.editReply({
        content:
            '⏳ Confirmation received. Updating the member’s rank and permanent records…',
        embeds: [],
        components: [],
    });

    return 'confirmed';
}

/*
 * ============================================================
 * CHANNEL HELPERS
 * ============================================================
 */

/**
 * Fetch a text-based Discord channel safely.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @returns {Promise<import('discord.js').GuildBasedChannel|null>}
 */
async function fetchTextChannel(
    guild,
    channelId
) {
    if (
        !guild ||
        !channelId
    ) {
        return null;
    }

    const cachedChannel =
        guild.channels.cache.get(
            channelId
        );

    if (
        cachedChannel?.isTextBased()
    ) {
        return cachedChannel;
    }

    const fetchedChannel =
        await guild.channels
            .fetch(channelId)
            .catch(() => null);

    if (
        !fetchedChannel?.isTextBased()
    ) {
        return null;
    }

    return fetchedChannel;
}

/**
 * Find the official promotion channel for the current server.
 *
 * ISP and future servers use the promotions channel inside
 * serverConfigs.js.
 *
 * ISRP falls back to ISRP_PROMOTION_CHANNEL_ID when needed.
 *
 * @param {object} options
 * @returns {Promise<import('discord.js').GuildBasedChannel|null>}
 */
async function resolvePromotionChannel({
    interaction,
    serverConfig,
}) {
    const configuredChannelId =
        serverConfig
            ?.channels
            ?.promotions;

    if (configuredChannelId) {
        const configuredChannel =
            await fetchTextChannel(
                interaction.guild,
                configuredChannelId
            );

        if (configuredChannel) {
            return configuredChannel;
        }
    }

    if (
        serverConfig?.key === 'main'
    ) {
        return fetchTextChannel(
            interaction.guild,
            ISRP_PROMOTION_CHANNEL_ID
        );
    }

    return null;
}

/**
 * Find the private management log channel created through /setup.
 *
 * @param {object} options
 * @returns {Promise<import('discord.js').GuildBasedChannel|null>}
 */
async function resolveLogChannel({
    interaction,
    guildConfiguration,
}) {
    const possibleChannelIds = [
        guildConfiguration
            ?.logChannelId,

        guildConfiguration
            ?.managementLogChannelId,

        guildConfiguration
            ?.logsChannelId,
    ].filter(Boolean);

    for (
        const channelId of
        possibleChannelIds
    ) {
        const channel =
            await fetchTextChannel(
                interaction.guild,
                channelId
            );

        if (channel) {
            return channel;
        }
    }

    return null;
}

/**
 * Check whether the bot can send embeds in a channel.
 *
 * @param {import('discord.js').GuildBasedChannel} channel
 * @param {import('discord.js').GuildMember} botMember
 * @returns {boolean}
 */
function botCanSendEmbeds(
    channel,
    botMember
) {
    if (
        !channel ||
        !botMember
    ) {
        return false;
    }

    const permissions =
        channel.permissionsFor(
            botMember
        );

    if (!permissions) {
        return false;
    }

    return (
        permissions.has(
            PermissionFlagsBits
                .ViewChannel
        ) &&
        permissions.has(
            PermissionFlagsBits
                .SendMessages
        ) &&
        permissions.has(
            PermissionFlagsBits
                .EmbedLinks
        )
    );
}

/*
 * ============================================================
 * DATABASE HELPERS
 * ============================================================
 */

/**
 * Load optional settings created through /setup.
 *
 * @param {string} guildId
 * @returns {Promise<object>}
 */
async function getGuildConfiguration(
    guildId
) {
    const configurations =
        await readDatabase(
            'guild-configs',
            {}
        );

    const normalizedConfigurations =
        normalizeObject(
            configurations
        );

    return normalizeObject(
        normalizedConfigurations[
            guildId
        ]
    );
}

/**
 * Save a promotion in the complete promotion database.
 *
 * @param {object} options
 * @returns {Promise<void>}
 */
async function savePromotionRecord({
    guildId,
    promotionRecord,
}) {
    await updateDatabase(
        'promotions',

        (promotions) => {
            promotions =
                normalizeObject(
                    promotions
                );

            if (
                !Array.isArray(
                    promotions[guildId]
                )
            ) {
                promotions[guildId] =
                    [];
            }

            promotions[
                guildId
            ].push(
                promotionRecord
            );

            return promotions;
        },

        {}
    );
}

/**
 * Add announcement information after the message is sent.
 *
 * @param {object} options
 * @returns {Promise<void>}
 */
async function updatePromotionAnnouncement({
    guildId,
    promotionId,
    announcementMessage,
}) {
    await updateDatabase(
        'promotions',

        (promotions) => {
            promotions =
                normalizeObject(
                    promotions
                );

            const guildPromotions =
                promotions[guildId];

            if (
                !Array.isArray(
                    guildPromotions
                )
            ) {
                return promotions;
            }

            const recordIndex =
                guildPromotions.findIndex(
                    (record) =>
                        record.id ===
                        promotionId
                );

            if (
                recordIndex === -1
            ) {
                return promotions;
            }

            guildPromotions[
                recordIndex
            ] = {
                ...guildPromotions[
                    recordIndex
                ],

                announcementChannelId:
                    announcementMessage
                        .channelId,

                announcementMessageId:
                    announcementMessage.id,

                announcementMessageUrl:
                    announcementMessage.url,

                updatedAt:
                    new Date()
                        .toISOString(),
            };

            return promotions;
        },

        {}
    );
}

/**
 * Create or update the promoted member's staff record.
 *
 * @param {object} options
 * @returns {Promise<void>}
 */
async function updateStaffRecord({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    notes,
    promotionId,
    createdAt,
    progressionAnalysis,
}) {
    await updateDatabase(
        'staff-records',

        (staffRecords) => {
            staffRecords =
                normalizeObject(
                    staffRecords
                );

            staffRecords[
                interaction.guildId
            ] = normalizeObject(
                staffRecords[
                    interaction.guildId
                ]
            );

            const existingRecord =
                normalizeObject(
                    staffRecords[
                        interaction.guildId
                    ][staffMember.id]
                );

            const promotionHistory =
                Array.isArray(
                    existingRecord
                        .promotionHistory
                )
                    ? [
                          ...existingRecord
                              .promotionHistory,
                      ]
                    : [];

            promotionHistory.push({
                promotionId,

                previousRank,
                newRank,

                reason,
                notes,

                progressionReview: {
                    classification:
                        progressionAnalysis.classification,
                    ranksAdvanced:
                        progressionAnalysis.ranksAdvanced,
                    recentPromotionCount:
                        progressionAnalysis.recentPromotionCount,
                },

                promotedById:
                    interaction.user.id,

                promotedByUsername:
                    interaction.user
                        .username,

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
                    getUserDisplayName(
                        staffMember
                    ),

                currentRank:
                    newRank,

                promotionCount:
                    Number(
                        existingRecord
                            .promotionCount ||
                            0
                    ) + 1,

                demotionCount:
                    Number(
                        existingRecord
                            .demotionCount ||
                            0
                    ),

                infractionCount:
                    Number(
                        existingRecord
                            .infractionCount ||
                            0
                    ),

                warningCount:
                    Number(
                        existingRecord
                            .warningCount ||
                            0
                    ),

                awardCount:
                    Number(
                        existingRecord
                            .awardCount ||
                            0
                    ),

                trainingCount:
                    Number(
                        existingRecord
                            .trainingCount ||
                            0
                    ),

                totalShiftMilliseconds:
                    Number(
                        existingRecord
                            .totalShiftMilliseconds ||
                            0
                    ),

                activeLoa:
                    existingRecord
                        .activeLoa ||
                    null,

                joinedStaffAt:
                    existingRecord
                        .joinedStaffAt ||
                    createdAt,

                promotionHistory,

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
}

/*
 * ============================================================
 * ROLE ROLLBACK
 * ============================================================
 */

/**
 * Reverse a completed role change after a database failure.
 *
 * @param {object} options
 * @returns {Promise<{success: boolean, errors: Array}>}
 */
async function rollbackPromotionRoles({
    guildMember,
    removedRole,
    addedRole,
    reason,
}) {
    const errors = [];

    if (
        addedRole &&
        guildMember.roles.cache.has(
            addedRole.id
        )
    ) {
        await guildMember.roles
            .remove(
                addedRole,
                `Promotion rollback: ${reason}`
            )
            .catch((error) => {
                errors.push({
                    action:
                        'remove-new-role',

                    error,
                });
            });
    }

    if (
        removedRole &&
        !guildMember.roles.cache.has(
            removedRole.id
        )
    ) {
        await guildMember.roles
            .add(
                removedRole,
                `Promotion rollback: ${reason}`
            )
            .catch((error) => {
                errors.push({
                    action:
                        'restore-previous-role',

                    error,
                });
            });
    }

    return {
        success:
            errors.length === 0,

        errors,
    };
}

/*
 * ============================================================
 * EMBED BUILDERS
 * ============================================================
 */

/**
 * Build the public promotion announcement embed.
 *
 * @param {object} options
 * @returns {EmbedBuilder}
 */
function buildPromotionEmbed({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    notes,
    serverConfig,
    guildConfiguration,
    progressionAnalysis,
}) {
    const brandColor =
        getBrandColor(
            serverConfig,
            guildConfiguration
        );

    const serverName =
        serverConfig.serverName ||
        guildConfiguration
            .serverName ||
        interaction.guild.name;

    const descriptionLines = [
        `Congratulations, ${staffMember}!`,
        '',
        `**Previous Rank:** ${previousRank}`,
        `**New Rank:** ${newRank}`,
        `**Reason:** ${reason}`,
        `**Promoted By:** ${interaction.user}`,
    ];

    if (notes) {
        descriptionLines.push(
            '',
            `**Notes:** ${notes}`
        );
    }

    return new EmbedBuilder()
        .setColor(
            brandColor
        )

        .setTitle(
            getPromotionTitle(
                serverConfig
            )
        )

        .setDescription(
            truncateText(
                descriptionLines
                    .join('\n'),
                4096
            )
        )

        .setAuthor({
            name:
                serverName,

            iconURL:
                interaction.guild
                    .iconURL({
                        size: 256,
                    }) ||
                undefined,
        })

        .setThumbnail(
            staffMember
                .displayAvatarURL({
                    size: 256,
                })
        )

        .setFooter({
            text:
                FOOTER_TEXT,

            iconURL:
                interaction.client
                    .user
                    .displayAvatarURL({
                        size: 128,
                    }),
        })

        .setTimestamp();
}

/**
 * Build the private management log embed.
 *
 * @param {object} options
 * @returns {EmbedBuilder}
 */
function buildLogEmbed({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    notes,
    promotionId,
    rankResult,
    announcementMessage,
    serverConfig,
    guildConfiguration,
    progressionAnalysis,
}) {
    const brandColor =
        getBrandColor(
            serverConfig,
            guildConfiguration
        );

    const descriptionLines = [
        `**Server:** ${serverConfig.serverName}`,

        `**Staff Member:** ${staffMember} (\`${staffMember.id}\`)`,

        `**Previous Rank:** ${previousRank}`,

        `**New Rank:** ${newRank}`,

        `**Progression Review:** ${progressionAnalysis.classification} (${progressionAnalysis.ranksAdvanced} level(s))`,

        `**Promotions Within 30 Days:** ${progressionAnalysis.recentPromotionCount}`,

        `**Reason:** ${reason}`,

        `**Additional Notes:** ${
            notes ||
            'None provided'
        }`,

        `**Promoted By:** ${interaction.user} (\`${interaction.user.id}\`)`,

        `**Role Removed:** ${
            rankResult.removedRole ||
            'None (initial appointment)'
        }`,

        `**Role Added:** ${rankResult.addedRole}`,

        `**Announcement:** ${announcementMessage.url}`,

        `**Record ID:** \`${promotionId}\``,
    ];

    return new EmbedBuilder()
        .setColor(
            brandColor
        )

        .setTitle(
            'Staff Promotion Recorded'
        )

        .setDescription(
            truncateText(
                descriptionLines
                    .join('\n'),
                4096
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

            iconURL:
                interaction.client
                    .user
                    .displayAvatarURL({
                        size: 128,
                    }),
        })

        .setTimestamp();
}

/*
 * ============================================================
 * PROMOTE COMMAND
 * ============================================================
 */

module.exports = {
    data:
        new SlashCommandBuilder()

            .setName(
                'promote'
            )

            .setDescription(
                'Promote a staff member or department member.'
            )

            .setDMPermission(
                false
            )

            /*
             * Required options
             */

            .addUserOption(
                (option) =>
                    option

                        .setName(
                            'staff-member'
                        )

                        .setDescription(
                            'The member receiving the promotion.'
                        )

                        .setRequired(
                            true
                        )
            )

            .addStringOption(
                (option) =>
                    option

                        .setName(
                            'new-rank'
                        )

                        .setDescription(
                            'The higher rank being assigned.'
                        )

                        .setAutocomplete(
                            true
                        )

                        .setRequired(
                            true
                        )
            )

            .addStringOption(
                (option) =>
                    option

                        .setName(
                            'reason'
                        )

                        .setDescription(
                            'The reason for this promotion.'
                        )

                        .setMinLength(
                            3
                        )

                        .setMaxLength(
                            1000
                        )

                        .setRequired(
                            true
                        )
            )

            /*
             * Optional notes only.
             *
             * Channel and ping options have intentionally
             * been removed.
             */

            .addStringOption(
                (option) =>
                    option

                        .setName(
                            'notes'
                        )

                        .setDescription(
                            'Optional additional promotion notes.'
                        )

                        .setMaxLength(
                            500
                        )

                        .setRequired(
                            false
                        )
            ),

    /*
     * ========================================================
     * AUTOCOMPLETE
     * ========================================================
     */

    async autocomplete(
        interaction
    ) {
        try {
            if (
                !interaction.inGuild()
            ) {
                return interaction
                    .respond([]);
            }

            const serverConfig =
                getServerConfig(
                    interaction.guildId
                );

            if (!serverConfig) {
                console.error(
                    `❌ No server configuration found for /promote autocomplete in guild ${interaction.guildId}.`
                );

                return interaction
                    .respond([]);
            }

            const focusedOption =
                interaction.options
                    .getFocused(true);

            if (
                focusedOption.name !==
                    'new-rank'
            ) {
                return interaction
                    .respond([]);
            }

            let choices =
                getRankAutocompleteChoices(
                    interaction.guildId,
                    focusedOption.value
                );

            /*
             * Use the selected member's live Discord rank when it is
             * already cached. Members without a configured rank keep
             * every option, including Trial Moderator.
             */
            const selectedUser =
                interaction.options.getUser(
                    'staff-member'
                );
            const selectedMember = selectedUser
                ? interaction.guild?.members?.cache?.get(
                      selectedUser.id
                  )
                : null;
            const detectedRank =
                detectMemberRank(
                    interaction.guildId,
                    selectedMember
                );

            if (detectedRank) {
                choices = choices.filter(
                    (choice) =>
                        getGuildRankIndex(
                            interaction.guildId,
                            choice.value
                        ) > detectedRank.index
                );
            }

            return interaction.respond(
                choices.slice(
                    0,
                    25
                )
            );
        } catch (error) {
            console.error(
                '❌ Error handling /promote autocomplete:',
                error
            );

            return interaction
                .respond([])
                .catch(() => {});
        }
    },

    /*
     * ========================================================
     * EXECUTION
     * ========================================================
     */

    async execute(
        interaction
    ) {
        let completedRankResult =
            null;

        let targetGuildMember =
            null;

        try {
            /*
             * Server-only command validation.
             */
            if (
                !interaction.inGuild()
            ) {
                return interaction.reply({
                    content:
                        '❌ This command can only be used inside a Discord server.',

                    flags:
                        MessageFlags
                            .Ephemeral,
                });
            }

            await interaction.deferReply({
                flags:
                    MessageFlags
                        .Ephemeral,
            });

            /*
             * Load the multi-server configuration.
             */
            const serverConfig =
                getServerConfig(
                    interaction.guildId
                );

            if (!serverConfig) {
                return interaction.editReply({
                    content:
                        `❌ Illinois State Utilities is not configured for this server.\n\nServer ID: \`${interaction.guildId}\``,
                });
            }

            /*
             * Command-user permission validation.
             */
            if (
                !canUsePromotionCommand(
                    interaction
                )
            ) {
                return interaction.editReply({
                    content:
                        '❌ You do not have permission to issue promotions in this server.',
                });
            }

            /*
             * Read the command options.
             */
            const staffMember =
                interaction.options
                    .getUser(
                        'staff-member',
                        true
                    );

            const newRank =
                interaction.options
                    .getString(
                        'new-rank',
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
                    .getString(
                        'notes'
                    )
                    ?.trim() ||
                null;

            /*
             * Basic target-member validation.
             */
            if (
                staffMember.bot
            ) {
                return interaction.editReply({
                    content:
                        '❌ Discord bots cannot receive staff promotions.',
                });
            }

            if (
                staffMember.id ===
                interaction.user.id
            ) {
                return interaction.editReply({
                    content:
                        '❌ You cannot promote yourself.',
                });
            }

            /*
             * Validate the selected ranks.
             */
            const newRankIndex =
                getGuildRankIndex(
                    interaction.guildId,
                    newRank
                );

            if (
                newRankIndex ===
                -1
            ) {
                return interaction.editReply({
                    content:
                        `❌ **${newRank}** is not a configured rank for ${serverConfig.serverName}.`,
                });
            }

            /*
             * Fetch the target GuildMember.
             */
            targetGuildMember =
                await interaction.guild
                    .members
                    .fetch(
                        staffMember.id
                    )
                    .catch(
                        () => null
                    );

            if (
                !targetGuildMember
            ) {
                return interaction.editReply({
                    content:
                        '❌ I could not find that member inside this Discord server.',
                });
            }

            const detectedPreviousRank =
                detectMemberRank(
                    interaction.guildId,
                    targetGuildMember
                );
            const previousRank =
                detectedPreviousRank?.name ||
                'Initial Appointment';
            const previousRankIndex =
                detectedPreviousRank?.index ?? -1;

            if (
                previousRankIndex ===
                newRankIndex
            ) {
                return interaction.editReply({
                    content:
                        `❌ ${staffMember} already has the **${newRank}** rank role.`,
                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            if (
                newRankIndex <
                previousRankIndex
            ) {
                return interaction.editReply({
                    content:
                        `❌ ${staffMember} is currently **${previousRank}**. Changing them to **${newRank}** would be a demotion, so please use \`/demote\` instead.`,
                    allowedMentions: {
                        parse: [],
                    },
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
                    targetGuildMember.roles.highest
                ) <= 0
            ) {
                return interaction.editReply({
                    content:
                        '❌ You cannot promote a member whose highest role is equal to or above yours.',
                });
            }

            /*
             * Load optional /setup settings.
             */
            const guildConfiguration =
                await getGuildConfiguration(
                    interaction.guildId
                );

            const staffRecordsDatabase =
                await readDatabase(
                    'staff-records',
                    {}
                );
            const savedStaffRecord =
                staffRecordsDatabase[
                    interaction.guildId
                ]?.[staffMember.id] || null;

            const savedProfileRank =
                savedStaffRecord?.currentRank ||
                null;
            const profileRankReconciled =
                savedProfileRank !== null &&
                savedProfileRank !== previousRank;

            /*
             * Automatically resolve the official promotion channel.
             */
            const promotionChannel =
                await resolvePromotionChannel({
                    interaction,
                    serverConfig,
                });

            if (
                !promotionChannel
            ) {
                return interaction.editReply({
                    content:
                        '❌ I could not locate the official promotion channel for this server.',
                });
            }

            /*
             * Verify bot channel permissions.
             */
            const botMember =
                interaction.guild
                    .members.me;

            if (
                !botCanSendEmbeds(
                    promotionChannel,
                    botMember
                )
            ) {
                return interaction.editReply({
                    content:
                        `❌ I need **View Channel**, **Send Messages**, and **Embed Links** permissions in ${promotionChannel}.`,
                });
            }

            const promotionsDatabase =
                await readDatabase(
                    'promotions',
                    {}
                );
            const guildPromotions =
                Array.isArray(
                    promotionsDatabase[
                        interaction.guildId
                    ]
                )
                    ? promotionsDatabase[
                          interaction.guildId
                      ]
                    : [];

            const duplicatePromotion =
                findRecentPromotionDuplicate({
                    records: guildPromotions,
                    staffMemberId:
                        staffMember.id,
                    previousRank,
                    newRank,
                });

            if (duplicatePromotion) {
                return interaction.editReply({
                    content:
                        `⚠️ Smart duplicate protection stopped this request. The same promotion was recorded for ${staffMember} within the last 10 minutes.\n\n` +
                        `Existing promotion: \`${duplicatePromotion.id}\``,
                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const progressionAnalysis =
                analyzePromotionProgression({
                    records: guildPromotions,
                    staffMemberId:
                        staffMember.id,
                    previousRankIndex,
                    newRankIndex,
                });

            const confirmationOutcome =
                await requestPromotionConfirmation({
                    interaction,
                    staffMember,
                    previousRank,
                    newRank,
                    reason,
                    promotionChannel,
                    progressionAnalysis,
                    serverConfig,
                    guildConfiguration,
                });

            if (
                confirmationOutcome !==
                'confirmed'
            ) {
                return;
            }

            /*
             * Automatically update the member's Discord rank roles.
             */
            const rankResult =
                await applyRankChange({
                    guild:
                        interaction.guild,

                    member:
                        targetGuildMember,

                    previousRank:
                        detectedPreviousRank?.name ||
                        null,

                    newRank,

                    actionType:
                        'promotion',

                    reason:
                        `${reason} | Promoted by ${interaction.user.username}`,
                });

            if (
                !rankResult.success
            ) {
                return interaction.editReply({
                    content:
                        `❌ ${getRankChangeErrorMessage(
                            rankResult
                        )}`,
                });
            }

            completedRankResult =
                rankResult;

            /*
             * Create the database promotion record.
             */
            const promotionId =
                createRecordId(
                    'promotion'
                );

            const createdAt =
                new Date()
                    .toISOString();

            const promotionRecord = {
                id:
                    promotionId,

                type:
                    'promotion',

                status:
                    'active',

                guildId:
                    interaction.guildId,

                guildName:
                    interaction.guild
                        .name,

                serverKey:
                    serverConfig.key,

                serverName:
                    serverConfig
                        .serverName,

                staffMemberId:
                    staffMember.id,

                staffUsername:
                    staffMember
                        .username,

                staffDisplayName:
                    getUserDisplayName(
                        staffMember
                    ),

                previousRank,

                newRank,

                rankDetectionSource:
                    'discord_roles',

                initialAppointment:
                    !detectedPreviousRank,

                profileRankBeforePromotion:
                    savedProfileRank,

                profileRankReconciled,

                previousRoleId:
                    rankResult
                        .removedRole?.id ||
                    null,

                newRoleId:
                    rankResult
                        .addedRole.id,

                reason,

                notes,

                progressionReview: {
                    classification:
                        progressionAnalysis.classification,
                    ranksAdvanced:
                        progressionAnalysis.ranksAdvanced,
                    recentPromotionCount:
                        progressionAnalysis.recentPromotionCount,
                    totalPriorPromotions:
                        progressionAnalysis.totalPromotionCount,
                    recommendation:
                        progressionAnalysis.recommendation,
                },

                promotedById:
                    interaction.user.id,

                promotedByUsername:
                    interaction.user
                        .username,

                promotedByDisplayName:
                    getUserDisplayName(
                        interaction.user
                    ),

                announcementChannelId:
                    promotionChannel.id,

                announcementMessageId:
                    null,

                announcementMessageUrl:
                    null,

                createdAt,

                updatedAt:
                    createdAt,
            };

            /*
             * Save the promotion and update the staff profile.
             */
            try {
                await savePromotionRecord({
                    guildId:
                        interaction.guildId,

                    promotionRecord,
                });

                await updateStaffRecord({
                    interaction,

                    staffMember,

                    previousRank,

                    newRank,

                    reason,

                    notes,

                    promotionId,

                    createdAt,

                    progressionAnalysis,
                });
            } catch (
                databaseError
            ) {
                console.error(
                    '❌ Promotion database save failed:',
                    databaseError
                );

                const rollbackResult =
                    await rollbackPromotionRoles({
                        guildMember:
                            targetGuildMember,

                        removedRole:
                            rankResult
                                .removedRole,

                        addedRole:
                            rankResult
                                .addedRole,

                        reason:
                            'Promotion database save failed',
                    });

                completedRankResult =
                    null;

                if (
                    rollbackResult
                        .success
                ) {
                    return interaction.editReply({
                        content:
                            '❌ The promotion could not be saved, so the Discord role change was automatically reversed.',
                    });
                }

                console.error(
                    '❌ Promotion rollback failed:',
                    rollbackResult
                        .errors
                );

                return interaction.editReply({
                    content:
                        '❌ The promotion could not be saved, and the role rollback was not fully successful. Please review the member’s roles immediately.',
                });
            }

            /*
             * Build the public announcement.
             */
            const promotionEmbed =
                buildPromotionEmbed({
                    interaction,

                    staffMember,

                    previousRank,

                    newRank,

                    reason,

                    notes,

                    serverConfig,

                    guildConfiguration,
                    progressionAnalysis,
                });

            /*
             * Send the promotion directly to the official channel.
             *
             * There is no optional role ping.
             */
            let announcementMessage;

            try {
                announcementMessage =
                    await promotionChannel
                        .send({
                            embeds: [
                                promotionEmbed,
                            ],

                            allowedMentions: {
                                users: [
                                    staffMember.id,
                                ],

                                roles: [],

                                repliedUser:
                                    false,
                            },
                        });
            } catch (
                announcementError
            ) {
                console.error(
                    '❌ Promotion announcement failed:',
                    announcementError
                );

                /*
                 * The role change and database save already succeeded.
                 * We do not undo a valid promotion only because the
                 * public message failed.
                 */
                completedRankResult =
                    null;

                return interaction.editReply({
                    content:
                        [
                        `⚠️ ${staffMember} was promoted from **${previousRank}** to **${newRank}**.`,

                            '',

                            'The roles and database record were updated, but I could not send the announcement.',

                            '',

                            `**Promotion Channel:** ${promotionChannel}`,

                            `**Promotion Record:** \`${promotionId}\``,
                        ].join('\n'),

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * Save the announcement URL and message ID.
             */
            await updatePromotionAnnouncement({
                guildId:
                    interaction.guildId,

                promotionId,

                announcementMessage,
            }).catch((error) => {
                console.error(
                    '⚠️ Promotion announcement information could not be saved:',
                    error
                );
            });

            /*
             * Send the private management log when configured.
             */
            const logChannel =
                await resolveLogChannel({
                    interaction,
                    guildConfiguration,
                });

            if (
                logChannel &&
                botCanSendEmbeds(
                    logChannel,
                    botMember
                )
            ) {
                const logEmbed =
                    buildLogEmbed({
                        interaction,

                        staffMember,

                        previousRank,

                        newRank,

                        reason,

                        notes,

                        promotionId,

                        rankResult,

                        announcementMessage,

                        serverConfig,

                        guildConfiguration,

                        progressionAnalysis,
                    });

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
                            '⚠️ Promotion succeeded, but the management log could not be sent:',
                            error
                        );
                    });
            }

            /*
             * The promotion completed successfully.
             */
            completedRankResult =
                null;

            return interaction.editReply({
                content:
                    [
                        `✅ ${staffMember} was promoted to **${newRank}**.`,
                        `${promotionChannel} • ${announcementMessage.url}`,
                        `Record: \`${promotionId}\``,
                    ].join('\n'),

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                '❌ Error executing /promote:',
                error
            );

            /*
             * Emergency rollback for unexpected failures after a
             * completed rank change but before a confirmed outcome.
             */
            if (
                completedRankResult &&
                targetGuildMember
            ) {
                const rollbackResult =
                    await rollbackPromotionRoles({
                        guildMember:
                            targetGuildMember,

                        removedRole:
                            completedRankResult
                                .removedRole,

                        addedRole:
                            completedRankResult
                                .addedRole,

                        reason:
                            'Unexpected promotion command failure',
                    });

                if (
                    !rollbackResult
                        .success
                ) {
                    console.error(
                        '❌ Emergency promotion rollback failed:',
                        rollbackResult
                            .errors
                    );
                }
            }

            const errorResponse = {
                content:
                    '❌ Something went wrong while processing this promotion. Please check the bot logs for more information.',
            };

            if (
                interaction.deferred
            ) {
                return interaction
                    .editReply(
                        errorResponse
                    )
                    .catch(
                        () => {}
                    );
            }

            if (
                interaction.replied
            ) {
                return interaction
                    .followUp({
                        ...errorResponse,

                        flags:
                            MessageFlags
                                .Ephemeral,
                    })
                    .catch(
                        () => {}
                    );
            }

            return interaction
                .reply({
                    ...errorResponse,

                    flags:
                        MessageFlags
                            .Ephemeral,
                })
                .catch(
                    () => {}
                );
        }
    },
};
