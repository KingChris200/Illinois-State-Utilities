const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const {
    readDatabase,
} = require('../../utils/database');
const brands = require('../../config/branding');

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

    if (Number.isNaN(parsedColor)) {
        return 0x005b96;
    }

    return parsedColor;
}

function createDiscordTimestamp(
    dateInput,
    style = 'F'
) {
    if (!dateInput) {
        return 'Unknown date';
    }

    const timestamp =
        new Date(dateInput).getTime();

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

function normalizeHistoryType(record) {
    if (
        record.historyType === 'promotion' ||
        record.type === 'promotion'
    ) {
        return 'promotion';
    }

    if (
        record.historyType === 'demotion' ||
        record.type === 'demotion'
    ) {
        return 'demotion';
    }

    if (
        record.historyType === 'infraction'
    ) {
        return record.type || 'infraction';
    }

    const supportedTypes = [
        'notice',
        'inactivity_notice',
        'warning',
        'strike',
        'termination',
        'blacklist',
    ];

    if (
        supportedTypes.includes(record.type)
    ) {
        return record.type;
    }

    if (
        record.previousRank &&
        record.newRank
    ) {
        const promotionWords =
            String(
                record.id || ''
            ).toLowerCase();

        if (
            promotionWords.includes(
                'demotion'
            )
        ) {
            return 'demotion';
        }

        return 'promotion';
    }

    return 'unknown';
}

function getActionPresentation(record) {
    const actionType =
        normalizeHistoryType(record);

    const presentationMap = {
        promotion: {
            emoji: '⬆️',
            label: 'Promotion',
            color: 0x2ecc71,
        },

        demotion: {
            emoji: '⬇️',
            label: 'Demotion',
            color: 0xc0392b,
        },

        notice: {
            emoji: '🟡',
            label: 'Notice',
            color: 0xf1c40f,
        },

        inactivity_notice: {
            emoji: '🟠',
            label: 'Inactivity Notice',
            color: 0xe67e22,
        },

        warning: {
            emoji: '⚠️',
            label: 'Warning',
            color: 0xf39c12,
        },

        strike: {
            emoji: '🔴',
            label: 'Strike',
            color: 0xe74c3c,
        },

        termination: {
            emoji: '⛔',
            label: 'Termination',
            color: 0x992d22,
        },

        blacklist: {
            emoji: '🚫',
            label: 'Blacklist',
            color: 0x2b2d31,
        },

        unknown: {
            emoji: '📋',
            label: 'Staff Action',
            color: 0x005b96,
        },
    };

    return (
        presentationMap[actionType] ||
        presentationMap.unknown
    );
}

function getIssuerMention(record) {
    const issuerId =
        record.promotedById ||
        record.issuedById ||
        record.demotedById ||
        null;

    if (issuerId) {
        return `<@${issuerId}>`;
    }

    return (
        record.promotedByDisplayName ||
        record.issuedByDisplayName ||
        record.promotedByUsername ||
        record.issuedByUsername ||
        'Unknown'
    );
}

function getRecordIdentifier(record) {
    return (
        record.id ||
        record.promotionId ||
        record.demotionId ||
        record.caseId ||
        null
    );
}

function getRecordDeduplicationKey(record) {
    const recordId =
        getRecordIdentifier(record);

    if (recordId) {
        return recordId;
    }

    return [
        normalizeHistoryType(record),
        record.staffMemberId || '',
        record.previousRank || '',
        record.newRank || '',
        record.reason || '',
        record.createdAt || '',
    ].join('|');
}

function mergeUniqueRecords(...recordGroups) {
    const recordMap = new Map();

    for (const group of recordGroups) {
        if (!Array.isArray(group)) {
            continue;
        }

        for (const record of group) {
            if (
                !record ||
                typeof record !== 'object'
            ) {
                continue;
            }

            const key =
                getRecordDeduplicationKey(
                    record
                );

            if (!recordMap.has(key)) {
                recordMap.set(
                    key,
                    record
                );
            }
        }
    }

    return Array.from(
        recordMap.values()
    );
}

function recordMatchesFilter(
    record,
    selectedFilter
) {
    if (selectedFilter === 'all') {
        return true;
    }

    return (
        normalizeHistoryType(record) ===
        selectedFilter
    );
}

function createHistorySection(
    record,
    index
) {
    const action =
        getActionPresentation(record);

    const actionType =
        normalizeHistoryType(record);

    const date =
        createDiscordTimestamp(
            record.createdAt,
            'F'
        );

    const relativeDate =
        createDiscordTimestamp(
            record.createdAt,
            'R'
        );

    const issuer =
        getIssuerMention(record);

    const recordId =
        getRecordIdentifier(record);

    const lines = [
        `### ${action.emoji} ${index + 1}. ${action.label}`,
    ];

    if (
        actionType === 'promotion' ||
        actionType === 'demotion'
    ) {
        lines.push(
            `**Rank Change:** ${
                record.previousRank ||
                'Unknown'
            } → ${
                record.newRank ||
                'Unknown'
            }`
        );
    } else if (record.currentRank) {
        lines.push(
            `**Rank at Time of Action:** ${record.currentRank}`
        );
    }

    lines.push(
        `**Date:** ${date} (${relativeDate})`,
        `**Issued By:** ${issuer}`
    );

    if (record.reason) {
        lines.push(
            `**Reason:** ${truncateText(
                record.reason,
                300
            )}`
        );
    }

    if (record.duration) {
        lines.push(
            `**Duration / Expiration:** ${truncateText(
                record.duration,
                100
            )}`
        );
    }

    if (record.evidence) {
        lines.push(
            `**Evidence / Reference:** ${truncateText(
                record.evidence,
                250
            )}`
        );
    }

    if (record.notes) {
        lines.push(
            `**Additional Notes:** ${truncateText(
                record.notes,
                200
            )}`
        );
    }

    if (record.status) {
        lines.push(
            `**Status:** ${record.status}`
        );
    }

    if (recordId) {
        lines.push(
            `**Record ID:** \`${recordId}\``
        );
    }

    return lines.join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDMPermission(false)
        .setDescription(
            'View the complete saved history of an ISRP staff member.'
        )

        /*
         * Required option first.
         */
        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription(
                    'The staff member whose history you want to view.'
                )
                .setRequired(true)
        )

        /*
         * Optional options follow.
         */
        .addStringOption((option) =>
            option
                .setName('filter')
                .setDescription(
                    'Choose which staff actions to display.'
                )
                .addChoices(
                    {
                        name: 'All Staff Actions',
                        value: 'all',
                    },
                    {
                        name: 'Promotions',
                        value: 'promotion',
                    },
                    {
                        name: 'Demotions',
                        value: 'demotion',
                    },
                    {
                        name: 'Notices',
                        value: 'notice',
                    },
                    {
                        name: 'Inactivity Notices',
                        value:
                            'inactivity_notice',
                    },
                    {
                        name: 'Warnings',
                        value: 'warning',
                    },
                    {
                        name: 'Strikes',
                        value: 'strike',
                    },
                    {
                        name: 'Terminations',
                        value: 'termination',
                    },
                    {
                        name: 'Blacklists',
                        value: 'blacklist',
                    }
                )
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option
                .setName('limit')
                .setDescription(
                    'The maximum number of recent records to display.'
                )
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('visibility')
                .setDescription(
                    'Choose whether the history is private or public.'
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

            const staffMember =
                interaction.options.getUser(
                    'staff-member',
                    true
                );

            const selectedFilter =
                interaction.options.getString(
                    'filter'
                ) || 'all';

            const recordLimit =
                interaction.options.getInteger(
                    'limit'
                ) || 5;

            const visibility =
                interaction.options.getString(
                    'visibility'
                ) || 'private';

            const isPrivate =
                visibility === 'private';

            await interaction.deferReply({
                flags: isPrivate
                    ? MessageFlags.Ephemeral
                    : undefined,
            });

            /*
             * Load server configuration.
             */
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
                        '❌ Illinois State Utilities has not been configured in this server yet.\n\nRun `/setup` before using staff history.',
                });
            }

            /*
             * Load every database that may contain
             * staff-history information.
             */
            const [
                staffHistoryDatabase,
                promotionsDatabase,
                demotionsDatabase,
                infractionsDatabase,
                staffRecordsDatabase,
            ] = await Promise.all([
                readDatabase(
                    'staff-history',
                    {}
                ),

                readDatabase(
                    'promotions',
                    {}
                ),

                readDatabase(
                    'demotions',
                    {}
                ),

                readDatabase(
                    'infractions',
                    {}
                ),

                readDatabase(
                    'staff-records',
                    {}
                ),
            ]);

            const unifiedHistory =
                Array.isArray(
                    staffHistoryDatabase[
                        interaction.guildId
                    ]?.[staffMember.id]
                )
                    ? staffHistoryDatabase[
                          interaction.guildId
                      ][staffMember.id]
                    : [];

            const legacyPromotions =
                Array.isArray(
                    promotionsDatabase[
                        interaction.guildId
                    ]
                )
                    ? promotionsDatabase[
                          interaction.guildId
                      ].filter(
                          (record) =>
                              record.staffMemberId ===
                              staffMember.id
                      )
                    : [];

            const legacyDemotions =
                Array.isArray(
                    demotionsDatabase[
                        interaction.guildId
                    ]
                )
                    ? demotionsDatabase[
                          interaction.guildId
                      ].filter(
                          (record) =>
                              record.staffMemberId ===
                              staffMember.id
                      )
                    : [];

            const legacyInfractions =
                Array.isArray(
                    infractionsDatabase[
                        interaction.guildId
                    ]
                )
                    ? infractionsDatabase[
                          interaction.guildId
                      ].filter(
                          (record) =>
                              record.staffMemberId ===
                              staffMember.id
                      )
                    : [];

            /*
             * Merge old and new records so nothing is lost.
             * Duplicate IDs are removed automatically.
             */
            const completeHistory =
                mergeUniqueRecords(
                    unifiedHistory,
                    legacyPromotions,
                    legacyDemotions,
                    legacyInfractions
                )
                    .filter((record) =>
                        recordMatchesFilter(
                            record,
                            selectedFilter
                        )
                    )
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
                    );

            const staffProfile =
                staffRecordsDatabase[
                    interaction.guildId
                ]?.[staffMember.id] ||
                null;

            if (
                completeHistory.length === 0
            ) {
                const noHistoryEmbed =
                    new EmbedBuilder()
                        .setColor(
                            convertHexToDecimal(
                                guildConfiguration.brandColor
                            )
                        )
                        .setTitle(
                            'ISRP | Staff History'
                        )
                        .setDescription(
                            [
                                `${staffMember} does not have any saved records matching the selected filter.`,
                                '',
                                selectedFilter ===
                                'all'
                                    ? 'Their history will appear here after a promotion, demotion, or disciplinary action is recorded.'
                                    : 'Try selecting **All Staff Actions** to view their complete saved timeline.',
                            ].join('\n')
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

                            iconURL: brands.assets.logo,
                        })
                        .setFooter({
                            text:
                                'Illinois State Utilities • Staff Management System',

                            iconURL: brands.assets.logo,
                        })
                        .setTimestamp();

                return interaction.editReply({
                    embeds: [
                        noHistoryEmbed,
                    ],

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            const displayedHistory =
                completeHistory.slice(
                    0,
                    recordLimit
                );

            const remainingRecords =
                completeHistory.length -
                displayedHistory.length;

            const filterLabels = {
                all: 'All Staff Actions',
                promotion: 'Promotions',
                demotion: 'Demotions',
                notice: 'Notices',
                inactivity_notice:
                    'Inactivity Notices',
                warning: 'Warnings',
                strike: 'Strikes',
                termination:
                    'Terminations',
                blacklist: 'Blacklists',
            };

            const historySections =
                displayedHistory.map(
                    (record, index) =>
                        createHistorySection(
                            record,
                            index
                        )
                );

            const descriptionLines = [
                `Below is the saved staff history for ${staffMember}.`,
                '',
                '**Current Rank**',
                staffProfile?.currentRank ||
                    'Not recorded',
                '',
                '**Staff Status**',
                staffProfile?.staffStatus ||
                    'Active',
                '',
                '**History Filter**',
                filterLabels[
                    selectedFilter
                ] || 'All Staff Actions',
                '',
                `**Showing ${displayedHistory.length} of ${completeHistory.length} matching record${completeHistory.length === 1 ? '' : 's'}**`,
                '',
            ];

            for (
                let index = 0;
                index <
                historySections.length;
                index += 1
            ) {
                descriptionLines.push(
                    historySections[index]
                );

                if (
                    index <
                    historySections.length - 1
                ) {
                    descriptionLines.push(
                        '',
                        '━━━━━━━━━━━━━━━━━━━━',
                        ''
                    );
                }
            }

            if (remainingRecords > 0) {
                descriptionLines.push(
                    '',
                    `*${remainingRecords} older matching record${remainingRecords === 1 ? '' : 's'} not shown. Run the command again with a higher limit to view more.*`
                );
            }

            /*
             * Choose a color based on the newest visible action.
             */
            const newestAction =
                getActionPresentation(
                    displayedHistory[0]
                );

            const historyColor =
                selectedFilter === 'all'
                    ? convertHexToDecimal(
                          guildConfiguration.brandColor
                      )
                    : newestAction.color;

            const historyEmbed =
                new EmbedBuilder()
                    .setColor(historyColor)
                    .setTitle(
                        'ISRP | Complete Staff History'
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

                        iconURL: brands.assets.logo,
                    })
                    .setFooter({
                        text:
                            'Illinois State Utilities • Unified Staff History',

                        iconURL: brands.assets.logo,
                    })
                    .setTimestamp();

            await interaction.editReply({
                embeds: [
                    historyEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /history:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while loading this staff member’s history.',
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
