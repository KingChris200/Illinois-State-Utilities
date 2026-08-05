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
    getServerConfig,
    getGuildRankIndex,
    getRankAutocompleteChoices,
    getConfiguredChannelId,
    memberCanReviewMovements,
} = require('../../config/serverConfigs');
const {
    applyRankChange,
    getRankChangeErrorMessage,
} = require('../../utils/rankManager');
const {
    findRecentDemotionDuplicate,
    analyzeDemotionContext,
} = require('../../utils/demotionIntelligence');

const DEMOTION_COLOR = 0xc0392b;
const FOOTER_TEXT =
    'Illinois State Utilities • Staff Management System';

function normalizeObject(value) {
    return value &&
        typeof value === 'object' &&
        !Array.isArray(value)
        ? value
        : {};
}

function getDisplayName(user) {
    return user.globalName || user.username;
}

function canUseDemotionCommand(interaction) {
    const member = interaction.member;

    return Boolean(
        interaction.guild?.ownerId === interaction.user.id ||
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
        member?.permissions?.has(
            PermissionFlagsBits.ManageRoles
        ) ||
        memberCanReviewMovements(
            member,
            interaction.guildId
        )
    );
}

function botCanSendEmbeds(channel, botMember) {
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

async function fetchTextChannel(guild, channelId) {
    if (!guild || !channelId) {
        return null;
    }

    const channel =
        guild.channels.cache.get(channelId) ||
        (await guild.channels.fetch(channelId).catch(() => null));

    return channel?.isTextBased() ? channel : null;
}

async function rollbackDemotionRoles({
    member,
    removedRole,
    addedRole,
    reason,
}) {
    const errors = [];

    try {
        if (!member.roles.cache.has(removedRole.id)) {
            await member.roles.add(removedRole, reason);
        }
    } catch (error) {
        errors.push(error);
    }

    try {
        if (member.roles.cache.has(addedRole.id)) {
            await member.roles.remove(addedRole, reason);
        }
    } catch (error) {
        errors.push(error);
    }

    return {
        success: errors.length === 0,
        errors,
    };
}

async function cleanupFailedDemotion({
    guildId,
    staffMemberId,
    demotionId,
    originalStaffRecord,
}) {
    await updateDatabase(
        'demotions',
        (database) => {
            database = normalizeObject(database);
            database[guildId] = Array.isArray(database[guildId])
                ? database[guildId].filter(
                      (record) => record.id !== demotionId
                  )
                : [];
            return database;
        },
        {}
    );

    await updateDatabase(
        'staff-history',
        (database) => {
            database = normalizeObject(database);
            database[guildId] = normalizeObject(database[guildId]);
            database[guildId][staffMemberId] = Array.isArray(
                database[guildId][staffMemberId]
            )
                ? database[guildId][staffMemberId].filter(
                      (record) => record.id !== demotionId
                  )
                : [];
            return database;
        },
        {}
    );

    await updateDatabase(
        'staff-records',
        (database) => {
            database = normalizeObject(database);
            database[guildId] = normalizeObject(database[guildId]);

            if (originalStaffRecord) {
                database[guildId][staffMemberId] =
                    originalStaffRecord;
            } else {
                delete database[guildId][staffMemberId];
            }

            return database;
        },
        {}
    );
}

async function requestDemotionConfirmation({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    evidence,
    destinationChannel,
    contextAnalysis,
    serverConfig,
}) {
    const confirmationId =
        `demotion_confirm:${interaction.id}`;
    const cancellationId =
        `demotion_cancel:${interaction.id}`;
    const previewEmbed = new EmbedBuilder()
        .setColor(DEMOTION_COLOR)
        .setTitle('Confirm Staff Demotion')
        .setDescription(
            'Review this action carefully. No roles or permanent records will change until you confirm.'
        )
        .addFields(
            {
                name: 'Staff Member',
                value: `${staffMember}`,
                inline: true,
            },
            {
                name: 'Rank Movement',
                value: `**${previousRank}** → **${newRank}**`,
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
                name: 'Evidence Review',
                value: evidence || 'No evidence was provided.',
            },
            {
                name: 'Smart Context Review',
                value: [
                    `**${contextAnalysis.level}** • ${contextAnalysis.ranksDropped} rank level(s) removed`,
                    `${contextAnalysis.recentDemotionCount} demotion(s) within 30 days • ${contextAnalysis.activeInfractionCount} active infraction(s)`,
                    contextAnalysis.recommendation,
                ].join('\n'),
            }
        )
        .setThumbnail(
            staffMember.displayAvatarURL({ size: 256 })
        )
        .setAuthor({
            name: serverConfig.serverName,
            iconURL:
                interaction.guild.iconURL({ size: 256 }) ||
                undefined,
        })
        .setFooter({
            text:
                'Illinois State Utilities • Smart Demotion Review',
            iconURL:
                interaction.client.user.displayAvatarURL({ size: 128 }),
        })
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(confirmationId)
            .setLabel('Confirm Demotion')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(cancellationId)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
        embeds: [previewEmbed],
        components: [buttons],
        allowedMentions: { parse: [] },
    });

    const previewMessage = await interaction.fetchReply();
    const response = await previewMessage
        .awaitMessageComponent({
            filter: (buttonInteraction) =>
                buttonInteraction.user.id === interaction.user.id &&
                [confirmationId, cancellationId].includes(
                    buttonInteraction.customId
                ),
            time: 60_000,
        })
        .catch(() => null);

    if (!response) {
        await interaction.editReply({
            content:
                '⌛ This demotion preview expired after 60 seconds. No roles or records were changed.',
            embeds: [],
            components: [],
        });
        return 'expired';
    }

    await response.deferUpdate();

    if (response.customId === cancellationId) {
        await interaction.editReply({
            content:
                '✅ Demotion cancelled. No roles or records were changed.',
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

function buildDemotionEmbed({
    interaction,
    staffMember,
    previousRank,
    newRank,
    reason,
    evidence,
    notes,
    demotionId,
    contextAnalysis,
    serverConfig,
}) {
    const description = [
        serverConfig.messages?.demotionOpening ||
            'A staff rank adjustment has been formally issued.',
        '',
        `## ${staffMember}`,
        '',
        '**Previous Rank**',
        previousRank,
        '',
        '**New Rank**',
        newRank,
        '',
        '**Demotion Severity**',
        `${contextAnalysis.level} • ${contextAnalysis.ranksDropped} rank level(s)`,
        '',
        '**Reason**',
        reason,
        '',
        '**Issued By**',
        `${interaction.user}`,
    ];

    if (evidence) {
        description.push('', '**Evidence / Reference**', evidence);
    }

    if (notes) {
        description.push('', '**Additional Notes**', notes);
    }

    description.push(
        '',
        `**Demotion Record:** \`${demotionId}\``,
        '',
        serverConfig.messages?.demotionClosing ||
            'Please review all expectations associated with your newly assigned rank.'
    );

    return new EmbedBuilder()
        .setColor(DEMOTION_COLOR)
        .setTitle(
            serverConfig.embedTitles?.demotion ||
                'Staff Demotion'
        )
        .setDescription(description.join('\n').slice(0, 4096))
        .setThumbnail(
            staffMember.displayAvatarURL({ size: 256 })
        )
        .setAuthor({
            name: serverConfig.serverName,
            iconURL:
                interaction.guild.iconURL({ size: 256 }) ||
                undefined,
        })
        .setFooter({
            text: FOOTER_TEXT,
            iconURL:
                interaction.client.user.displayAvatarURL({ size: 128 }),
        })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription(
            'Demote a staff member with confirmation and permanent records.'
        )
        .setDMPermission(false)
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
                .setDescription('The member’s current rank.')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('new-rank')
                .setDescription('The lower rank being assigned.')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('The reason for this demotion.')
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('evidence')
                .setDescription(
                    'Optional evidence link or case reference.'
                )
                .setMaxLength(500)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription('Optional management notes.')
                .setMaxLength(500)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.respond([]);
            }

            const focused = interaction.options.getFocused(true);

            if (
                focused.name !== 'previous-rank' &&
                focused.name !== 'new-rank'
            ) {
                return interaction.respond([]);
            }

            let choices = getRankAutocompleteChoices(
                interaction.guildId,
                focused.value
            );

            if (focused.name === 'new-rank') {
                const previousRank = interaction.options.getString(
                    'previous-rank'
                );
                const previousIndex = getGuildRankIndex(
                    interaction.guildId,
                    previousRank
                );

                if (previousIndex !== -1) {
                    choices = choices.filter(
                        (choice) =>
                            getGuildRankIndex(
                                interaction.guildId,
                                choice.value
                            ) < previousIndex
                    );
                }
            }

            return interaction.respond(choices.slice(0, 25));
        } catch (error) {
            console.error(
                'Error handling /demote autocomplete:',
                error
            );
            return interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        let completedRankResult = null;
        let targetMember = null;

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

            const serverConfig = getServerConfig(
                interaction.guildId
            );

            if (!serverConfig) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities is not configured to manage ranks in this server.',
                });
            }

            if (!canUseDemotionCommand(interaction)) {
                return interaction.editReply({
                    content:
                        '❌ You do not have permission to issue staff demotions.',
                });
            }

            const staffMember = interaction.options.getUser(
                'staff-member',
                true
            );
            const previousRank = interaction.options
                .getString('previous-rank', true)
                .trim();
            const newRank = interaction.options
                .getString('new-rank', true)
                .trim();
            const reason = interaction.options
                .getString('reason', true)
                .trim();
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

            if (staffMember.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ You cannot demote yourself.',
                });
            }

            const previousRankIndex = getGuildRankIndex(
                interaction.guildId,
                previousRank
            );
            const newRankIndex = getGuildRankIndex(
                interaction.guildId,
                newRank
            );

            if (
                previousRankIndex === -1 ||
                newRankIndex === -1
            ) {
                return interaction.editReply({
                    content:
                        '❌ One of the selected ranks is not configured for this server.',
                });
            }

            if (newRankIndex >= previousRankIndex) {
                return interaction.editReply({
                    content:
                        newRankIndex === previousRankIndex
                            ? '❌ The previous and new rank cannot be the same.'
                            : '❌ That change is a promotion. Please use `/promote` instead.',
                });
            }

            targetMember = await interaction.guild.members
                .fetch(staffMember.id)
                .catch(() => null);

            if (!targetMember) {
                return interaction.editReply({
                    content:
                        '❌ The selected user is not currently in this server.',
                });
            }

            const executorIsOwner =
                interaction.guild.ownerId === interaction.user.id;
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
                        '❌ You cannot demote a member whose highest role is equal to or above yours.',
                });
            }

            const configurations = await readDatabase(
                'guild-configs',
                {}
            );
            const guildConfiguration =
                configurations[interaction.guildId] || {};
            const staffRecords = await readDatabase(
                'staff-records',
                {}
            );
            const originalStaffRecord =
                staffRecords[interaction.guildId]?.[staffMember.id] ||
                null;

            if (
                originalStaffRecord?.currentRank &&
                originalStaffRecord.currentRank !== previousRank
            ) {
                return interaction.editReply({
                    content:
                        `❌ The permanent staff profile lists ${staffMember} as **${originalStaffRecord.currentRank}**, not **${previousRank}**.`,
                    allowedMentions: { parse: [] },
                });
            }

            const destinationChannel = await fetchTextChannel(
                interaction.guild,
                getConfiguredChannelId(
                    interaction.guildId,
                    'demotions'
                )
            );

            if (!destinationChannel) {
                return interaction.editReply({
                    content:
                        '❌ I could not locate the configured demotion channel.',
                });
            }

            const botMember = interaction.guild.members.me;

            if (!botCanSendEmbeds(destinationChannel, botMember)) {
                return interaction.editReply({
                    content:
                        `❌ I need **View Channel**, **Send Messages**, and **Embed Links** permissions in ${destinationChannel}.`,
                });
            }

            const demotionsDatabase = await readDatabase(
                'demotions',
                {}
            );
            const infractionsDatabase = await readDatabase(
                'infractions',
                {}
            );
            const guildDemotions = Array.isArray(
                demotionsDatabase[interaction.guildId]
            )
                ? demotionsDatabase[interaction.guildId]
                : [];
            const guildInfractions = Array.isArray(
                infractionsDatabase[interaction.guildId]
            )
                ? infractionsDatabase[interaction.guildId]
                : [];
            const duplicate = findRecentDemotionDuplicate({
                records: guildDemotions,
                staffMemberId: staffMember.id,
                previousRank,
                newRank,
            });

            if (duplicate) {
                return interaction.editReply({
                    content:
                        `⚠️ Smart duplicate protection stopped this request. The same demotion was recorded within the last 10 minutes.\n\nExisting record: \`${duplicate.id}\``,
                });
            }

            const contextAnalysis = analyzeDemotionContext({
                demotions: guildDemotions,
                infractions: guildInfractions,
                staffMemberId: staffMember.id,
                previousRankIndex,
                newRankIndex,
            });
            const confirmation = await requestDemotionConfirmation({
                interaction,
                staffMember,
                previousRank,
                newRank,
                reason,
                evidence,
                destinationChannel,
                contextAnalysis,
                serverConfig,
            });

            if (confirmation !== 'confirmed') {
                return;
            }

            const rankResult = await applyRankChange({
                guild: interaction.guild,
                member: targetMember,
                previousRank,
                newRank,
                actionType: 'demotion',
                reason:
                    `${reason} | Demoted by ${interaction.user.username}`,
            });

            if (!rankResult.success) {
                return interaction.editReply({
                    content:
                        `❌ ${getRankChangeErrorMessage(rankResult)}`,
                });
            }

            completedRankResult = rankResult;
            const demotionId = createRecordId('demotion');
            const createdAt = new Date().toISOString();
            const demotionRecord = {
                id: demotionId,
                type: 'demotion',
                status: 'active',
                guildId: interaction.guildId,
                guildName: interaction.guild.name,
                serverKey: serverConfig.key,
                staffMemberId: staffMember.id,
                staffUsername: staffMember.username,
                staffDisplayName: getDisplayName(staffMember),
                previousRank,
                newRank,
                previousRoleId: rankResult.removedRole.id,
                newRoleId: rankResult.addedRole.id,
                reason,
                evidence,
                notes,
                contextReview: {
                    ...contextAnalysis,
                },
                issuedById: interaction.user.id,
                issuedByUsername: interaction.user.username,
                issuedByDisplayName: getDisplayName(interaction.user),
                announcementChannelId: destinationChannel.id,
                announcementMessageId: null,
                announcementMessageUrl: null,
                createdAt,
                updatedAt: createdAt,
            };

            try {
                await updateDatabase(
                    'demotions',
                    (database) => {
                        database = normalizeObject(database);
                        database[interaction.guildId] = Array.isArray(
                            database[interaction.guildId]
                        )
                            ? database[interaction.guildId]
                            : [];
                        database[interaction.guildId].push(
                            demotionRecord
                        );
                        return database;
                    },
                    {}
                );

                await updateDatabase(
                    'staff-history',
                    (database) => {
                        database = normalizeObject(database);
                        database[interaction.guildId] = normalizeObject(
                            database[interaction.guildId]
                        );
                        database[interaction.guildId][staffMember.id] =
                            Array.isArray(
                                database[interaction.guildId][staffMember.id]
                            )
                                ? database[interaction.guildId][staffMember.id]
                                : [];
                        database[interaction.guildId][staffMember.id].push({
                            ...demotionRecord,
                            historyType: 'demotion',
                        });
                        return database;
                    },
                    {}
                );

                await updateDatabase(
                    'staff-records',
                    (database) => {
                        database = normalizeObject(database);
                        database[interaction.guildId] = normalizeObject(
                            database[interaction.guildId]
                        );
                        const existing = normalizeObject(
                            database[interaction.guildId][staffMember.id]
                        );
                        const demotionHistory = Array.isArray(
                            existing.demotionHistory
                        )
                            ? [...existing.demotionHistory]
                            : [];

                        demotionHistory.push({
                            demotionId,
                            previousRank,
                            newRank,
                            reason,
                            evidence,
                            notes,
                            contextReview: contextAnalysis,
                            issuedById: interaction.user.id,
                            createdAt,
                        });

                        database[interaction.guildId][staffMember.id] = {
                            ...existing,
                            staffMemberId: staffMember.id,
                            username: staffMember.username,
                            displayName: getDisplayName(staffMember),
                            currentRank: newRank,
                            demotionCount:
                                Number(existing.demotionCount || 0) + 1,
                            promotionCount: Number(
                                existing.promotionCount || 0
                            ),
                            infractionCount: Number(
                                existing.infractionCount || 0
                            ),
                            warningCount: Number(
                                existing.warningCount || 0
                            ),
                            demotionHistory,
                            joinedStaffAt:
                                existing.joinedStaffAt || createdAt,
                            createdAt: existing.createdAt || createdAt,
                            updatedAt: createdAt,
                        };
                        return database;
                    },
                    {}
                );
            } catch (databaseError) {
                console.error(
                    'Demotion database save failed:',
                    databaseError
                );

                const roleRollback = await rollbackDemotionRoles({
                    member: targetMember,
                    removedRole: rankResult.removedRole,
                    addedRole: rankResult.addedRole,
                    reason: 'Demotion database save failed',
                });

                await cleanupFailedDemotion({
                    guildId: interaction.guildId,
                    staffMemberId: staffMember.id,
                    demotionId,
                    originalStaffRecord,
                }).catch((cleanupError) =>
                    console.error(
                        'Demotion database cleanup failed:',
                        cleanupError
                    )
                );

                completedRankResult = null;

                return interaction.editReply({
                    content: roleRollback.success
                        ? '❌ The demotion could not be saved, so the Discord role change was automatically reversed.'
                        : '❌ The demotion failed and the role rollback was incomplete. Management must review this member’s roles immediately.',
                });
            }

            completedRankResult = null;
            const demotionEmbed = buildDemotionEmbed({
                interaction,
                staffMember,
                previousRank,
                newRank,
                reason,
                evidence,
                notes,
                demotionId,
                contextAnalysis,
                serverConfig,
            });
            let announcementMessage = null;

            try {
                announcementMessage = await destinationChannel.send({
                    embeds: [demotionEmbed],
                    allowedMentions: {
                        users: [staffMember.id],
                        roles: [],
                    },
                });
            } catch (announcementError) {
                console.error(
                    'Demotion announcement failed:',
                    announcementError
                );

                return interaction.editReply({
                    content:
                        `⚠️ ${staffMember} was demoted from **${previousRank}** to **${newRank}**, and the roles and permanent record were updated. I could not send the announcement.\n\nRecord: \`${demotionId}\``,
                    allowedMentions: { parse: [] },
                });
            }

            await updateDatabase(
                'demotions',
                (database) => {
                    database = normalizeObject(database);
                    const records = Array.isArray(
                        database[interaction.guildId]
                    )
                        ? database[interaction.guildId]
                        : [];
                    const index = records.findIndex(
                        (record) => record.id === demotionId
                    );

                    if (index !== -1) {
                        records[index] = {
                            ...records[index],
                            announcementMessageId:
                                announcementMessage.id,
                            announcementMessageUrl:
                                announcementMessage.url,
                            updatedAt: new Date().toISOString(),
                        };
                    }

                    database[interaction.guildId] = records;
                    return database;
                },
                {}
            ).catch((error) =>
                console.error(
                    'Could not save demotion announcement details:',
                    error
                )
            );

            const logChannel = guildConfiguration.logChannelId
                ? await fetchTextChannel(
                      interaction.guild,
                      guildConfiguration.logChannelId
                  )
                : null;

            if (
                logChannel &&
                botCanSendEmbeds(logChannel, botMember)
            ) {
                const logEmbed = new EmbedBuilder()
                    .setColor(DEMOTION_COLOR)
                    .setTitle('Staff Demotion Recorded')
                    .setDescription(
                        [
                            `**Staff Member:** ${staffMember} (\`${staffMember.id}\`)`,
                            `**Rank Movement:** ${previousRank} → ${newRank}`,
                            `**Context Review:** ${contextAnalysis.level} (${contextAnalysis.ranksDropped} level(s))`,
                            `**Reason:** ${reason}`,
                            `**Evidence:** ${evidence || 'None provided'}`,
                            `**Notes:** ${notes || 'None provided'}`,
                            `**Issued By:** ${interaction.user}`,
                            `**Role Removed:** ${rankResult.removedRole}`,
                            `**Role Added:** ${rankResult.addedRole}`,
                            `**Announcement:** ${announcementMessage.url}`,
                            `**Record ID:** \`${demotionId}\``,
                        ].join('\n')
                    )
                    .setThumbnail(
                        staffMember.displayAvatarURL({ size: 256 })
                    )
                    .setFooter({
                        text:
                            'Illinois State Utilities • Management Logs',
                        iconURL:
                            interaction.client.user.displayAvatarURL({
                                size: 128,
                            }),
                    })
                    .setTimestamp();

                await logChannel
                    .send({
                        embeds: [logEmbed],
                        allowedMentions: { parse: [] },
                    })
                    .catch((error) =>
                        console.error(
                            'Demotion saved, but logging failed:',
                            error
                        )
                    );
            }

            return interaction.editReply({
                content: [
                    `✅ ${staffMember} was successfully demoted from **${previousRank}** to **${newRank}**.`,
                    '',
                    `**Demotion Channel:** ${destinationChannel}`,
                    `**Announcement:** ${announcementMessage.url}`,
                    `**Role Removed:** ${rankResult.removedRole}`,
                    `**Role Added:** ${rankResult.addedRole}`,
                    `**Demotion Record:** \`${demotionId}\``,
                ].join('\n'),
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            console.error('Error executing /demote:', error);

            if (completedRankResult && targetMember) {
                await rollbackDemotionRoles({
                    member: targetMember,
                    removedRole: completedRankResult.removedRole,
                    addedRole: completedRankResult.addedRole,
                    reason: 'Unexpected demotion command failure',
                }).catch(() => {});
            }

            const payload = {
                content:
                    '❌ Something went wrong while processing this staff demotion.',
            };

            if (interaction.deferred || interaction.replied) {
                return interaction.editReply(payload).catch(() => {});
            }

            return interaction
                .reply({
                    ...payload,
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    },
};
