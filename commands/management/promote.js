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
 * GENERAL HELPERS
 * ============================================================
 */

function normalizeDatabaseObject(value) {
    if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        return {};
    }

    return value;
}

function getDisplayName(user) {
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

    return `${text.slice(0, maximumLength - 3)}...`;
}

function getConfiguredChannel(
    interaction,
    selectedChannel,
    serverConfig,
    guildConfiguration
) {
    if (selectedChannel) {
        return selectedChannel;
    }

    const configuredPromotionChannelId =
        serverConfig?.channels?.promotions ||
        guildConfiguration?.promotionChannelId ||
        guildConfiguration?.promotionsChannelId ||
        guildConfiguration?.announcementChannelId;

    if (configuredPromotionChannelId) {
        const configuredChannel =
            interaction.guild.channels.cache.get(
                configuredPromotionChannelId
            );

        if (configuredChannel?.isTextBased()) {
            return configuredChannel;
        }
    }

    return interaction.channel;
}

function getConfiguredLogChannel(
    interaction,
    guildConfiguration
) {
    const logChannelId =
        guildConfiguration?.logChannelId ||
        guildConfiguration?.managementLogChannelId ||
        guildConfiguration?.logsChannelId;

    if (!logChannelId) {
        return null;
    }

    const channel =
        interaction.guild.channels.cache.get(logChannelId);

    if (!channel?.isTextBased()) {
        return null;
    }

    return channel;
}

function getBrandColor(
    serverConfig,
    guildConfiguration
) {
    if (
        Number.isInteger(serverConfig?.brandColor)
    ) {
        return serverConfig.brandColor;
    }

    const configuredColor =
        guildConfiguration?.brandColor;

    if (Number.isInteger(configuredColor)) {
        return configuredColor;
    }

    if (typeof configuredColor === 'string') {
        const cleanedColor = configuredColor
            .trim()
            .replace(/^#/, '')
            .replace(/^0x/i, '');

        const parsedColor =
            Number.parseInt(cleanedColor, 16);

        if (!Number.isNaN(parsedColor)) {
            return parsedColor;
        }
    }

    return 0x2b2d31;
}

function canManagePromotions(
    interaction,
    serverConfig
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

async function safelyRollbackRoles({
    member,
    removedRole,
    addedRole,
    reason,
}) {
    const rollbackErrors = [];

    if (
        addedRole &&
        member.roles.cache.has(addedRole.id)
    ) {
        await member.roles
            .remove(
                addedRole,
                `Promotion rollback: ${reason}`
            )
            .catch((error) => {
                rollbackErrors.push({
                    step: 'remove-new-role',
                    error,
                });
            });
    }

    if (
        removedRole &&
        !member.roles.cache.has(removedRole.id)
    ) {
        await member.roles
            .add(
                removedRole,
                `Promotion rollback: ${reason}`
            )
            .catch((error) => {
                rollbackErrors.push({
                    step: 'restore-previous-role',
                    error,
                });
            });
    }

    return {
        success: rollbackErrors.length === 0,
        errors: rollbackErrors,
    };
}

/*
 * ============================================================
 * DATABASE HELPERS
 * ============================================================
 */

async function savePromotionRecord({
    guildId,
    promotionRecord,
}) {
    await updateDatabase(
        'promotions',
        (promotions) => {
            promotions =
                normalizeDatabaseObject(promotions);

            if (!Array.isArray(promotions[guildId])) {
                promotions[guildId] = [];
            }

            promotions[guildId].push(
                promotionRecord
            );

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
                normalizeDatabaseObject(staffRecords);

            staffRecords[interaction.guildId] =
                normalizeDatabaseObject(
                    staffRecords[interaction.guildId]
                );

            const existingRecord =
                normalizeDatabaseObject(
                    staffRecords[interaction.guildId][
                        staffMember.id
                    ]
                );

            const promotionHistory =
                Array.isArray(
                    existingRecord.promotionHistory
                )
                    ? [...existingRecord.promotionHistory]
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
                    interaction.user.username,
                createdAt,
            });

            staffRecords[interaction.guildId][
                staffMember.id
            ] = {
                ...existingRecord,

                staffMemberId:
                    staffMember.id,

                username:
                    staffMember.username,

                displayName:
                    getDisplayName(staffMember),

                currentRank:
                    newRank,

                promotionCount:
                    Number(
                        existingRecord.promotionCount || 0
                    ) + 1,

                demotionCount:
                    Number(
                        existingRecord.demotionCount || 0
                    ),

                infractionCount:
                    Number(
                        existingRecord.infractionCount || 0
                    ),

                warningCount:
                    Number(
                        existingRecord.warningCount || 0
                    ),

                awardCount:
                    Number(
                        existingRecord.awardCount || 0
                    ),

                totalShiftMilliseconds:
                    Number(
                        existingRecord
                            .totalShiftMilliseconds || 0
                    ),

                activeLoa:
                    existingRecord.activeLoa || null,

                joinedStaffAt:
                    existingRecord.joinedStaffAt ||
                    createdAt,

                promotionHistory,

                createdAt:
                    existingRecord.createdAt ||
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
    brandColor,
}) {
    const serverName =
        serverConfig.serverName ||
        guildConfiguration?.serverName ||
        interaction.guild.name;

    const openingMessage =
        serverConfig.messages?.promotionOpening ||
        `Please congratulate ${staffMember} on receiving a staff promotion!`;

    const closingMessage =
        serverConfig.messages?.promotionClosing ||
        'Thank you for your continued professionalism and dedication.';

    const title =
        serverConfig.embedTitles?.promotion ||
        `${serverConfig.shortName || 'ISU'} | Staff Promotion`;

    const descriptionLines = [
        openingMessage,
        '',
        `Congratulations, ${staffMember}!`,
        '',
        '### Rank Advancement',
        `**Previous Rank:** ${previousRank}`,
        `**New Rank:** ${newRank}`,
        '',
        '### Promotion Reason',
        reason,
        '',
        '### Promoted By',
        `${interaction.user}`,
    ];

    if (notes) {
        descriptionLines.push(
            '',
            '### Additional Notes',
            notes
        );
    }

    descriptionLines.push(
        '',
        closingMessage,
        '',
        '**Congratulations on your promotion!**'
    );

    const embed = new EmbedBuilder()
        .setColor(brandColor)
        .setTitle(title)
        .setDescription(
            truncateText(
                descriptionLines.join('\n'),
                4096
            )
        )
        .setThumbnail(
            staffMember.displayAvatarURL({
                size: 256,
            })
        )
        .setAuthor({
            name: serverName,
            iconURL:
                interaction.guild.iconURL({
                    size: 256,
                }) || undefined,
        })
        .setFooter({
            text:
                'Illinois State Utilities • Staff Management System',
            iconURL:
                interaction.client.user
                    .displayAvatarURL(),
        })
        .setTimestamp();

    return embed;
}

function buildLogEmbed({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    notes,
    promotionId,
    announcementMessage,
    rankResult,
    brandColor,
    serverConfig,
}) {
    return new EmbedBuilder()
        .setColor(brandColor)
        .setTitle('Staff Promotion Recorded')
        .setDescription(
            [
                `**Server:** ${serverConfig.serverName}`,
                `**Staff Member:** ${staffMember} (\`${staffMember.id}\`)`,
                `**Previous Rank:** ${previousRank}`,
                `**New Rank:** ${newRank}`,
                `**Reason:** ${reason}`,
                `**Additional Notes:** ${
                    notes || 'None provided'
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
                    .displayAvatarURL(),
        })
        .setTimestamp();
}

/*
 * ============================================================
 * COMMAND
 * ============================================================
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription(
            'Promote a staff member or department member.'
        )

        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription(
                    'The member receiving the promotion.'
                )
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('previous-rank')
                .setDescription(
                    'The member’s current rank.'
                )
                .setAutocomplete(true)
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('new-rank')
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

        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'Optional announcement channel.'
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
                    'Optional role to notify.'
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
                return interaction.respond([]);
            }

            const focusedOption =
                interaction.options.getFocused(true);

            if (
                focusedOption.name !==
                    'previous-rank' &&
                focusedOption.name !==
                    'new-rank'
            ) {
                return interaction.respond([]);
            }

            const choices =
                getRankAutocompleteChoices(
                    interaction.guildId,
                    focusedOption.value
                );

            return interaction.respond(choices);
        } catch (error) {
            console.error(
                'Error handling /promote autocomplete:',
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

    async execute(interaction) {
        let completedRankResult = null;
        let targetGuildMember = null;

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

            const serverConfig =
                getServerConfig(
                    interaction.guildId
                );

            if (!serverConfig) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities does not currently have a server configuration for this Discord server.',
                });
            }

            if (
                !canManagePromotions(
                    interaction,
                    serverConfig
                )
            ) {
                return interaction.editReply({
                    content:
                        '❌ You do not have permission to issue staff promotions in this server.',
                });
            }

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
                interaction.options.getChannel(
                    'channel'
                );

            const pingRole =
                interaction.options.getRole(
                    'ping'
                );

            const notes =
                interaction.options
                    .getString('notes')
                    ?.trim() || null;

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
                previousRankIndex === -1 ||
                newRankIndex === -1
            ) {
                return interaction.editReply({
                    content:
                        `❌ One or both ranks are not recognized by the **${serverConfig.serverName}** hierarchy.`,
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

            const configurations =
                await readDatabase(
                    'guild-configs',
                    {}
                );

            const guildConfiguration =
                normalizeDatabaseObject(
                    configurations
                )[interaction.guildId] || {};

            const destinationChannel =
                getConfiguredChannel(
                    interaction,
                    selectedChannel,
                    serverConfig,
                    guildConfiguration
                );

            if (
                !destinationChannel ||
                !destinationChannel.isTextBased()
            ) {
                return interaction.editReply({
                    content:
                        '❌ I could not locate a valid promotion announcement channel.',
                });
            }

            const botMember =
                interaction.guild.members.me;

            const channelPermissions =
                destinationChannel.permissionsFor(
                    botMember
                );

            if (
                !channelPermissions?.has(
                    PermissionFlagsBits.ViewChannel
                ) ||
                !channelPermissions?.has(
                    PermissionFlagsBits.SendMessages
                ) ||
                !channelPermissions?.has(
                    PermissionFlagsBits.EmbedLinks
                )
            ) {
                return interaction.editReply({
                    content:
                        `❌ I need **View Channel**, **Send Messages**, and **Embed Links** permissions in ${destinationChannel}.`,
                });
            }

            targetGuildMember =
                await interaction.guild.members
                    .fetch(staffMember.id)
                    .catch(() => null);

            if (!targetGuildMember) {
                return interaction.editReply({
                    content:
                        '❌ I could not find that member inside this server.',
                });
            }

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

            const promotionId =
                createRecordId('promotion');

            const createdAt =
                new Date().toISOString();

            const brandColor =
                getBrandColor(
                    serverConfig,
                    guildConfiguration
                );

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
                    getDisplayName(
                        staffMember
                    ),

                previousRank,
                newRank,

                previousRoleId:
                    rankResult.removedRole.id,

                newRoleId:
                    rankResult.addedRole.id,

                reason,
                notes,

                promotedById:
                    interaction.user.id,

                promotedByUsername:
                    interaction.user.username,

                promotedByDisplayName:
                    getDisplayName(
                        interaction.user
                    ),

                announcementChannelId:
                    destinationChannel.id,

                announcementMessageId:
                    null,

                announcementMessageUrl:
                    null,

                createdAt,
                updatedAt:
                    createdAt,
            };

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
                });
            } catch (databaseError) {
                console.error(
                    'Promotion database save failed:',
                    databaseError
                );

                const rollbackResult =
                    await safelyRollbackRoles({
                        member:
                            targetGuildMember,

                        removedRole:
                            rankResult.removedRole,

                        addedRole:
                            rankResult.addedRole,

                        reason:
                            'Promotion database save failed',
                    });

                completedRankResult = null;

                return interaction.editReply({
                    content:
                        rollbackResult.success
                            ? '❌ The promotion could not be saved, so the Discord role change was automatically reversed.'
                            : '❌ The promotion could not be saved, and the automatic role rollback was not fully successful. Please contact a bot administrator immediately.',
                });
            }

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
                    brandColor,
                });

            let announcementMessage;

            try {
                announcementMessage =
                    await destinationChannel.send({
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
                    'Promotion announcement failed:',
                    announcementError
                );

                return interaction.editReply({
                    content:
                        `⚠️ ${staffMember} was promoted from **${previousRank}** to **${newRank}**, and the database record was saved, but I could not send the announcement in ${destinationChannel}.\n\n**Record ID:** \`${promotionId}\``,
                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            promotionRecord.announcementMessageId =
                announcementMessage.id;

            promotionRecord.announcementMessageUrl =
                announcementMessage.url;

            promotionRecord.updatedAt =
                new Date().toISOString();

            await updateDatabase(
                'promotions',
                (promotions) => {
                    promotions =
                        normalizeDatabaseObject(
                            promotions
                        );

                    const guildPromotions =
                        promotions[
                            interaction.guildId
                        ];

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

                    if (recordIndex !== -1) {
                        guildPromotions[
                            recordIndex
                        ] = {
                            ...guildPromotions[
                                recordIndex
                            ],

                            announcementMessageId:
                                announcementMessage.id,

                            announcementMessageUrl:
                                announcementMessage.url,

                            updatedAt:
                                promotionRecord.updatedAt,
                        };
                    }

                    return promotions;
                },
                {}
            ).catch((error) => {
                console.error(
                    'Could not attach announcement details to promotion record:',
                    error
                );
            });

            const logChannel =
                getConfiguredLogChannel(
                    interaction,
                    guildConfiguration
                );

            if (logChannel) {
                const logEmbed =
                    buildLogEmbed({
                        interaction,
                        staffMember,
                        previousRank,
                        newRank,
                        reason,
                        notes,
                        promotionId,
                        announcementMessage,
                        rankResult,
                        brandColor,
                        serverConfig,
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
                            'Promotion succeeded, but the management log could not be sent:',
                            error
                        );
                    });
            }

            completedRankResult = null;

            return interaction.editReply({
                content:
                    [
                        `✅ ${staffMember} was successfully promoted from **${previousRank}** to **${newRank}**.`,
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
                'Error executing /promote:',
                error
            );

            /*
             * This fallback only runs if the role change completed
             * but a later unexpected error occurred before the command
             * reached a known success state.
             */
            if (
                completedRankResult &&
                targetGuildMember
            ) {
                const rollbackResult =
                    await safelyRollbackRoles({
                        member:
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

                if (!rollbackResult.success) {
                    console.error(
                        'Emergency promotion rollback failed:',
                        rollbackResult.errors
                    );
                }
            }

            const errorMessage = {
                content:
                    '❌ Something went wrong while processing this promotion. No announcement was intentionally sent.',
            };

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                return interaction
                    .editReply(errorMessage)
                    .catch(() => {});
            }

            return interaction
                .reply({
                    ...errorMessage,
                    flags:
                        MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    },
};