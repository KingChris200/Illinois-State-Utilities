const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
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
    getRankChangeErrorMessage,
} = require('../../utils/rankManager');

/*
 * ============================================================
 * CONSTANTS
 * ============================================================
 */

const DEFAULT_BRAND_COLOR = 0x2b2d31;

const FOOTER_TEXT =
    'Illinois State Utilities • Staff Management System';

/*
 * ============================================================
 * GENERAL HELPERS
 * ============================================================
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

function getUserDisplayName(user) {
    return (
        user.globalName ||
        user.username ||
        'Unknown User'
    );
}

function truncateText(value, maximumLength) {
    const text = String(value || '');

    if (text.length <= maximumLength) {
        return text;
    }

    return `${text.slice(
        0,
        maximumLength - 3
    )}...`;
}

function parseBrandColor(value) {
    if (Number.isInteger(value)) {
        return value;
    }

    if (typeof value !== 'string') {
        return DEFAULT_BRAND_COLOR;
    }

    const cleanedValue = value
        .trim()
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    const parsedValue =
        Number.parseInt(cleanedValue, 16);

    if (Number.isNaN(parsedValue)) {
        return DEFAULT_BRAND_COLOR;
    }

    return parsedValue;
}

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

function getPromotionTitle(serverConfig) {
    return (
        serverConfig?.embedTitles?.promotion ||
        `${
            serverConfig?.shortName || 'ISU'
        } | Staff Promotion`
    );
}

function getPromotionOpening(serverConfig) {
    return (
        serverConfig?.messages
            ?.promotionOpening ||
        'Please join us in congratulating this member on receiving a promotion!'
    );
}

function getPromotionClosing(serverConfig) {
    return (
        serverConfig?.messages
            ?.promotionClosing ||
        'Thank you for your continued professionalism, dedication, and service.'
    );
}

function canUsePromotionCommand(
    interaction
) {
    const member = interaction.member;

    if (!member) {
        return false;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {
        return true;
    }

    return memberCanReviewMovements(
        member,
        interaction.guildId
    );
}

/*
 * ============================================================
 * CHANNEL HELPERS
 * ============================================================
 */

function resolveCachedTextChannel(
    guild,
    channelId
) {
    if (!guild || !channelId) {
        return null;
    }

    const channel =
        guild.channels.cache.get(channelId);

    if (!channel?.isTextBased()) {
        return null;
    }

    return channel;
}

async function fetchTextChannel(
    guild,
    channelId
) {
    const cachedChannel =
        resolveCachedTextChannel(
            guild,
            channelId
        );

    if (cachedChannel) {
        return cachedChannel;
    }

    if (!guild || !channelId) {
        return null;
    }

    const fetchedChannel =
        await guild.channels
            .fetch(channelId)
            .catch(() => null);

    if (!fetchedChannel?.isTextBased()) {
        return null;
    }

    return fetchedChannel;
}

async function resolveAnnouncementChannel({
    interaction,
    selectedChannel,
    serverConfig,
    guildConfiguration,
}) {
    if (
        selectedChannel?.isTextBased()
    ) {
        return selectedChannel;
    }

    const configuredChannelIds = [
        serverConfig?.channels?.promotions,
        guildConfiguration
            ?.promotionChannelId,
        guildConfiguration
            ?.promotionsChannelId,
        guildConfiguration
            ?.announcementChannelId,
    ].filter(Boolean);

    for (
        const channelId of configuredChannelIds
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

    if (
        interaction.channel?.isTextBased()
    ) {
        return interaction.channel;
    }

    return null;
}

async function resolveLogChannel({
    interaction,
    guildConfiguration,
}) {
    const possibleLogChannelIds = [
        guildConfiguration?.logChannelId,
        guildConfiguration
            ?.managementLogChannelId,
        guildConfiguration
            ?.logsChannelId,
    ].filter(Boolean);

    for (
        const channelId of possibleLogChannelIds
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

function botCanSendEmbeds(
    channel,
    botMember
) {
    if (!channel || !botMember) {
        return false;
    }

    const permissions =
        channel.permissionsFor(botMember);

    if (!permissions) {
        return false;
    }

    return (
        permissions.has(
            PermissionFlagsBits.ViewChannel
        ) &&
        permissions.has(
            PermissionFlagsBits.SendMessages
        ) &&
        permissions.has(
            PermissionFlagsBits.EmbedLinks
        )
    );
}

/*
 * ============================================================
 * DATABASE HELPERS
 * ============================================================
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
        normalizeObject(configurations);

    return normalizeObject(
        normalizedConfigurations[guildId]
    );
}

async function savePromotionRecord({
    guildId,
    record,
}) {
    await updateDatabase(
        'promotions',

        (promotions) => {
            promotions =
                normalizeObject(promotions);

            if (
                !Array.isArray(
                    promotions[guildId]
                )
            ) {
                promotions[guildId] = [];
            }

            promotions[guildId].push(
                record
            );

            return promotions;
        },

        {}
    );
}

async function updatePromotionAnnouncement({
    guildId,
    promotionId,
    announcementMessage,
}) {
    await updateDatabase(
        'promotions',

        (promotions) => {
            promotions =
                normalizeObject(promotions);

            const guildPromotions =
                promotions[guildId];

            if (
                !Array.isArray(
                    guildPromotions
                )
            ) {
                return promotions;
            }

            const promotionIndex =
                guildPromotions.findIndex(
                    (promotion) =>
                        promotion.id ===
                        promotionId
                );

            if (promotionIndex === -1) {
                return promotions;
            }

            guildPromotions[
                promotionIndex
            ] = {
                ...guildPromotions[
                    promotionIndex
                ],

                announcementChannelId:
                    announcementMessage
                        .channelId,

                announcementMessageId:
                    announcementMessage.id,

                announcementMessageUrl:
                    announcementMessage.url,

                updatedAt:
                    new Date().toISOString(),
            };

            return promotions;
        },

        {}
    );
}

async function updateStaffRecord({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    notes,
    promotionId,
    createdAt,
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
                            .promotionCount || 0
                    ) + 1,

                demotionCount:
                    Number(
                        existingRecord
                            .demotionCount || 0
                    ),

                infractionCount:
                    Number(
                        existingRecord
                            .infractionCount || 0
                    ),

                warningCount:
                    Number(
                        existingRecord
                            .warningCount || 0
                    ),

                awardCount:
                    Number(
                        existingRecord
                            .awardCount || 0
                    ),

                trainingCount:
                    Number(
                        existingRecord
                            .trainingCount || 0
                    ),

                totalShiftMilliseconds:
                    Number(
                        existingRecord
                            .totalShiftMilliseconds ||
                            0
                    ),

                activeLoa:
                    existingRecord
                        .activeLoa || null,

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
                        'restore-old-role',
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

function buildPromotionEmbed({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    notes,
    serverConfig,
    guildConfiguration,
}) {
    const brandColor =
        getBrandColor(
            serverConfig,
            guildConfiguration
        );

    const serverName =
        serverConfig.serverName ||
        guildConfiguration.serverName ||
        interaction.guild.name;

    const description = [
        getPromotionOpening(
            serverConfig
        ),

        '',

        `## Congratulations, ${staffMember}!`,

        '',

        '**Previous Rank**',
        previousRank,

        '',

        '**New Rank**',
        newRank,

        '',

        '**Promotion Reason**',
        reason,

        '',

        '**Promoted By**',
        `${interaction.user}`,
    ];

    if (notes) {
        description.push(
            '',
            '**Additional Notes**',
            notes
        );
    }

    description.push(
        '',
        getPromotionClosing(
            serverConfig
        ),
        '',
        '**Congratulations on your promotion!**'
    );

    return new EmbedBuilder()
        .setColor(brandColor)

        .setTitle(
            getPromotionTitle(
                serverConfig
            )
        )

        .setDescription(
            truncateText(
                description.join('\n'),
                4096
            )
        )

        .setAuthor({
            name:
                serverName,

            iconURL:
                interaction.guild.iconURL({
                    size: 256,
                }) || undefined,
        })

        .setThumbnail(
            staffMember.displayAvatarURL({
                size: 256,
            })
        )

        .setFooter({
            text:
                FOOTER_TEXT,

            iconURL:
                interaction.client.user
                    .displayAvatarURL({
                        size: 128,
                    }),
        })

        .setTimestamp();
}

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
}) {
    const brandColor =
        getBrandColor(
            serverConfig,
            guildConfiguration
        );

    return new EmbedBuilder()
        .setColor(brandColor)

        .setTitle(
            'Staff Promotion Recorded'
        )

        .setDescription(
            [
                `**Server:** ${serverConfig.serverName}`,

                `**Staff Member:** ${staffMember} (\`${staffMember.id}\`)`,

                `**Previous Rank:** ${previousRank}`,

                `**New Rank:** ${newRank}`,

                `**Reason:** ${reason}`,

                `**Additional Notes:** ${
                    notes ||
                    'None provided'
                }`,

                `**Promoted By:** ${interaction.user} (\`${interaction.user.id}\`)`,

                `**Role Removed:** ${rankResult.removedRole}`,

                `**Role Added:** ${rankResult.addedRole}`,

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
                interaction.client.user
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
    data: new SlashCommandBuilder()
        .setName('promote')

        .setDescription(
            'Promote a staff member or department member.'
        )

        .setDMPermission(false)

        /*
         * Required options
         */

        .addUserOption((option) =>
            option
                .setName(
                    'staff-member'
                )

                .setDescription(
                    'The member receiving the promotion.'
                )

                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName(
                    'previous-rank'
                )

                .setDescription(
                    'The member’s current rank.'
                )

                .setAutocomplete(true)

                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName(
                    'new-rank'
                )

                .setDescription(
                    'The higher rank being assigned.'
                )

                .setAutocomplete(true)

                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('reason')

                .setDescription(
                    'The reason for this promotion.'
                )

                .setMinLength(3)

                .setMaxLength(1000)

                .setRequired(true)
        )

        /*
         * Optional options
         */

        .addChannelOption((option) =>
            option
                .setName('channel')

                .setDescription(
                    'Optional promotion announcement channel.'
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
                    'Optional role to notify about the promotion.'
                )

                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('notes')

                .setDescription(
                    'Optional additional promotion notes.'
                )

                .setMaxLength(500)

                .setRequired(false)
        ),

    /*
     * ========================================================
     * AUTOCOMPLETE
     * ========================================================
     */

    async autocomplete(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.respond(
                    []
                );
            }

            const serverConfig =
                getServerConfig(
                    interaction.guildId
                );

            if (!serverConfig) {
                console.error(
                    `❌ No server configuration found for autocomplete in guild ${interaction.guildId}.`
                );

                return interaction.respond(
                    []
                );
            }

            const focusedOption =
                interaction.options
                    .getFocused(true);

            if (
                focusedOption.name !==
                    'previous-rank' &&
                focusedOption.name !==
                    'new-rank'
            ) {
                return interaction.respond(
                    []
                );
            }

            let choices =
                getRankAutocompleteChoices(
                    interaction.guildId,
                    focusedOption.value
                );

            /*
             * When choosing the new rank, only display ranks
             * above the already selected previous rank.
             */

            if (
                focusedOption.name ===
                'new-rank'
            ) {
                const selectedPreviousRank =
                    interaction.options
                        .getString(
                            'previous-rank'
                        );

                const previousRankIndex =
                    getGuildRankIndex(
                        interaction.guildId,
                        selectedPreviousRank
                    );

                if (
                    previousRankIndex !== -1
                ) {
                    choices =
                        choices.filter(
                            (choice) =>
                                getGuildRankIndex(
                                    interaction.guildId,
                                    choice.value
                                ) >
                                previousRankIndex
                        );
                }
            }

            return interaction.respond(
                choices.slice(0, 25)
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
     * EXECUTE
     * ========================================================
     */

    async execute(interaction) {
        let completedRankResult = null;
        let targetGuildMember = null;

        try {
            if (!interaction.inGuild()) {
                return interaction.reply({
                    content:
                        '❌ This command can only be used inside a Discord server.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral,
            });

            const serverConfig =
                getServerConfig(
                    interaction.guildId
                );

            if (!serverConfig) {
                return interaction.editReply({
                    content:
                        `❌ Illinois State Utilities is not configured for this server.\n\nCurrent server ID: \`${interaction.guildId}\``,
                });
            }

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
             * Read command options
             */

            const staffMember =
                interaction.options.getUser(
                    'staff-member',
                    true
                );

            const previousRank =
                interaction.options
                    .getString(
                        'previous-rank',
                        true
                    )
                    .trim();

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

            const selectedChannel =
                interaction.options
                    .getChannel(
                        'channel'
                    );

            const pingRole =
                interaction.options
                    .getRole('ping');

            const notes =
                interaction.options
                    .getString('notes')
                    ?.trim() || null;

            /*
             * Basic member validation
             */

            if (staffMember.bot) {
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
             * Rank validation
             */

            const previousRankIndex =
                getGuildRankIndex(
                    interaction.guildId,
                    previousRank
                );

            const newRankIndex =
                getGuildRankIndex(
                    interaction.guildId,
                    newRank
                );

            if (
                previousRankIndex === -1
            ) {
                return interaction.editReply({
                    content:
                        `❌ **${previousRank}** is not a configured rank for ${serverConfig.serverName}.`,
                });
            }

            if (
                newRankIndex === -1
            ) {
                return interaction.editReply({
                    content:
                        `❌ **${newRank}** is not a configured rank for ${serverConfig.serverName}.`,
                });
            }

            if (
                previousRankIndex ===
                newRankIndex
            ) {
                return interaction.editReply({
                    content:
                        '❌ The previous rank and new rank cannot be the same.',
                });
            }

            if (
                newRankIndex <
                previousRankIndex
            ) {
                return interaction.editReply({
                    content:
                        '❌ That rank change would be a demotion. Please use `/demote` instead.',
                });
            }

            /*
             * Fetch the member
             */

            targetGuildMember =
                await interaction.guild.members
                    .fetch(
                        staffMember.id
                    )
                    .catch(() => null);

            if (!targetGuildMember) {
                return interaction.editReply({
                    content:
                        '❌ I could not find that member inside this Discord server.',
                });
            }

            /*
             * Load optional setup configuration
             */

            const guildConfiguration =
                await getGuildConfiguration(
                    interaction.guildId
                );

            /*
             * Resolve announcement channel
             */

            const announcementChannel =
                await resolveAnnouncementChannel({
                    interaction,

                    selectedChannel,

                    serverConfig,

                    guildConfiguration,
                });

            if (!announcementChannel) {
                return interaction.editReply({
                    content:
                        '❌ I could not locate a valid channel for the promotion announcement.',
                });
            }

            const botMember =
                interaction.guild.members.me;

            if (
                !botCanSendEmbeds(
                    announcementChannel,
                    botMember
                )
            ) {
                return interaction.editReply({
                    content:
                        `❌ I need **View Channel**, **Send Messages**, and **Embed Links** permissions in ${announcementChannel}.`,
                });
            }

            /*
             * Apply Discord rank roles
             */

            const rankResult =
                await applyRankChange({
                    guild:
                        interaction.guild,

                    member:
                        targetGuildMember,

                    previousRank,

                    newRank,

                    actionType:
                        'promotion',

                    reason:
                        `${reason} | Promoted by ${interaction.user.username}`,
                });

            if (!rankResult.success) {
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
             * Build promotion record
             */

            const promotionId =
                createRecordId(
                    'promotion'
                );

            const createdAt =
                new Date().toISOString();

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
                    interaction.guild.name,

                serverKey:
                    serverConfig.key,

                serverName:
                    serverConfig.serverName,

                staffMemberId:
                    staffMember.id,

                staffUsername:
                    staffMember.username,

                staffDisplayName:
                    getUserDisplayName(
                        staffMember
                    ),

                previousRank,
                newRank,

                previousRoleId:
                    rankResult
                        .removedRole.id,

                newRoleId:
                    rankResult
                        .addedRole.id,

                reason,
                notes,

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
                    announcementChannel.id,

                announcementMessageId:
                    null,

                announcementMessageUrl:
                    null,

                createdAt,

                updatedAt:
                    createdAt,
            };

            /*
             * Save database information
             */

            try {
                await savePromotionRecord({
                    guildId:
                        interaction.guildId,

                    record:
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
                });
            } catch (databaseError) {
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
                            'Database save failed',
                    });

                completedRankResult =
                    null;

                if (
                    rollbackResult.success
                ) {
                    return interaction.editReply({
                        content:
                            '❌ The promotion could not be saved, so the Discord role change was automatically reversed.',
                    });
                }

                console.error(
                    '❌ Promotion rollback errors:',
                    rollbackResult.errors
                );

                return interaction.editReply({
                    content:
                        '❌ The promotion could not be saved, and the automatic role rollback was not fully successful. Please review the member’s roles immediately.',
                });
            }

            /*
             * Create announcement embed
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
                });

            /*
             * Send announcement
             */

            let announcementMessage;

            try {
                announcementMessage =
                    await announcementChannel.send({
                        content:
                            pingRole
                                ? `${pingRole}`
                                : undefined,

                        embeds: [
                            promotionEmbed,
                        ],

                        allowedMentions: {
                            roles:
                                pingRole
                                    ? [
                                          pingRole.id,
                                      ]
                                    : [],

                            users: [
                                staffMember.id,
                            ],

                            repliedUser:
                                false,
                        },
                    });
            } catch (announcementError) {
                console.error(
                    '❌ Promotion announcement failed:',
                    announcementError
                );

                completedRankResult =
                    null;

                return interaction.editReply({
                    content:
                        [
                            `⚠️ ${staffMember} was successfully promoted from **${previousRank}** to **${newRank}**.`,

                            '',

                            'The role change and database record succeeded, but I could not send the promotion announcement.',

                            '',

                            `**Promotion Record:** \`${promotionId}\``,
                        ].join('\n'),

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * Attach announcement details to saved record
             */

            await updatePromotionAnnouncement({
                guildId:
                    interaction.guildId,

                promotionId,

                announcementMessage,
            }).catch((error) => {
                console.error(
                    '⚠️ Could not save promotion announcement information:',
                    error
                );
            });

            /*
             * Send private management log
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
             * Mark the command as fully successful.
             */

            completedRankResult = null;

            return interaction.editReply({
                content:
                    [
                        `✅ ${staffMember} was successfully promoted from **${previousRank}** to **${newRank}**!`,

                        '',

                        `**Server:** ${serverConfig.serverName}`,

                        `**Announcement:** ${announcementMessage.url}`,

                        `**Role Removed:** ${rankResult.removedRole}`,

                        `**Role Added:** ${rankResult.addedRole}`,

                        `**Promotion Record:** \`${promotionId}\``,
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
             * Emergency rollback if an unexpected error happened
             * after the Discord rank change.
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
                            'Unexpected command error',
                    });

                if (
                    !rollbackResult.success
                ) {
                    console.error(
                        '❌ Emergency promotion rollback failed:',
                        rollbackResult.errors
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
                    .catch(() => {});
            }

            if (
                interaction.replied
            ) {
                return interaction
                    .followUp({
                        ...errorResponse,

                        flags:
                            MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }

            return interaction
                .reply({
                    ...errorResponse,

                    flags:
                        MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    },
};