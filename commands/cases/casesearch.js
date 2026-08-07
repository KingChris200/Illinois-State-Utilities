const {
    EmbedBuilder,
} = require('discord.js');

const {
    listCases,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    convertHexToDecimal,
    truncateText,
    createDiscordTimestamp,
    getCasePresentation,
    getStatusPresentation,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE SEARCH HANDLER
 * ============================================================
 *
 * Handles:
 * /case search
 *
 * The slash-command options are registered inside:
 * commands/cases/case.js
 *
 * Supported filters:
 * - query
 * - staff-member
 * - issued-by
 * - type
 * - status
 * - limit
 */

/*
 * Convert a value into normalized searchable text.
 */

function normalizeSearchText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return '';
    }

    return String(value)
        .trim()
        .toLowerCase();
}

/*
 * Build one searchable string containing the useful text
 * stored throughout a case record.
 */

function createCaseSearchIndex(
    caseRecord
) {
    const searchableValues = [
        caseRecord.id,
        caseRecord.type,
        caseRecord.status,
        caseRecord.title,
        caseRecord.reason,
        caseRecord.evidence,
        caseRecord.notes,

        caseRecord.staffMemberId,
        caseRecord.staffUsername,
        caseRecord.staffDisplayName,

        caseRecord.issuedById,
        caseRecord.issuedByUsername,
        caseRecord.issuedByDisplayName,

        caseRecord.relatedRecordId,
        caseRecord.relatedChannelId,
        caseRecord.relatedMessageUrl,

        caseRecord.closeReason,
        caseRecord.voidReason,
        caseRecord.reopenReason,
    ];

    return searchableValues
        .map(normalizeSearchText)
        .filter(Boolean)
        .join(' ');
}

/*
 * Split a query into terms.
 *
 * Every term must be present somewhere in the case's search
 * index. This allows searches such as:
 *
 * "chris warning"
 * "promotion closed"
 * "ISP 1045"
 */

function caseMatchesQuery(
    caseRecord,
    query
) {
    const normalizedQuery =
        normalizeSearchText(query);

    if (!normalizedQuery) {
        return true;
    }

    const searchTerms =
        normalizedQuery
            .split(/\s+/)
            .filter(Boolean);

    const searchIndex =
        createCaseSearchIndex(
            caseRecord
        );

    return searchTerms.every(
        (term) =>
            searchIndex.includes(term)
    );
}

/*
 * Format one compact result for the search embed.
 */

function createCaseResultSection(
    caseRecord,
    position
) {
    const casePresentation =
        getCasePresentation(
            caseRecord.type
        );

    const statusPresentation =
        getStatusPresentation(
            caseRecord.status
        );

    const staffReference =
        caseRecord.staffMemberId
            ? `<@${caseRecord.staffMemberId}>`
            : caseRecord.staffDisplayName ||
              caseRecord.staffUsername ||
              'Unknown staff member';

    const issuedByReference =
        caseRecord.issuedById
            ? `<@${caseRecord.issuedById}>`
            : caseRecord.issuedByDisplayName ||
              caseRecord.issuedByUsername ||
              'Unknown issuer';

    const titleLine =
        caseRecord.title
            ? `**Title:** ${truncateText(
                  caseRecord.title,
                  100
              )}`
            : null;

    return [
        `### ${position}. ${casePresentation.emoji} \`${caseRecord.id}\``,
        `**Type:** ${casePresentation.label}`,
        `**Status:** ${statusPresentation.emoji} ${statusPresentation.label}`,
        `**Staff Member:** ${staffReference}`,
        `**Issued By:** ${issuedByReference}`,
        titleLine,
        `**Reason:** ${truncateText(
            caseRecord.reason,
            180
        )}`,
        `**Created:** ${createDiscordTimestamp(
            caseRecord.createdAt,
            'd'
        )}`,
    ]
        .filter(Boolean)
        .join('\n');
}

/*
 * Create a readable summary of the filters used.
 */

function createFilterSummary({
    query,
    staffMember,
    issuedBy,
    caseType,
    status,
}) {
    const filters = [];

    if (query) {
        filters.push(
            `**Query:** \`${truncateText(
                query,
                80
            )}\``
        );
    }

    if (staffMember) {
        filters.push(
            `**Staff Member:** <@${staffMember.id}>`
        );
    }

    if (issuedBy) {
        filters.push(
            `**Issued By:** <@${issuedBy.id}>`
        );
    }

    if (caseType) {
        const presentation =
            getCasePresentation(
                caseType
            );

        filters.push(
            `**Type:** ${presentation.emoji} ${presentation.label}`
        );
    }

    if (status) {
        const presentation =
            getStatusPresentation(
                status
            );

        filters.push(
            `**Status:** ${presentation.emoji} ${presentation.label}`
        );
    }

    if (filters.length === 0) {
        return '**Filters:** None — showing the most recent cases.';
    }

    return filters.join('\n');
}

/*
 * ============================================================
 * COMMAND MODULE
 * ============================================================
 */

module.exports = {
    subcommandName: 'search',

    async execute(interaction) {
        try {
            const access =
                await validateCaseAccess(
                    interaction,
                    {
                        visibility: 'private',
                    }
                );

            if (!access.allowed) {
                return;
            }

            const {
                guildConfiguration,
            } = access;

            /*
             * Read optional search filters.
             */

            const rawQuery =
                interaction.options.getString(
                    'query'
                );

            const query =
                rawQuery?.trim() ||
                null;

            const staffMember =
                interaction.options.getUser(
                    'staff-member'
                );

            const issuedBy =
                interaction.options.getUser(
                    'issued-by'
                );

            const caseType =
                interaction.options.getString(
                    'type'
                );

            const status =
                interaction.options.getString(
                    'status'
                );

            const requestedLimit =
                interaction.options.getInteger(
                    'limit'
                ) || 10;

            const resultLimit =
                Math.max(
                    1,
                    Math.min(
                        requestedLimit,
                        20
                    )
                );

            /*
             * Ask the central case manager to apply its native
             * structured filters.
             *
             * We retrieve up to 100 filtered cases so the natural
             * text query can search a useful portion of the server's
             * recent case history.
             */

            const filteredCases =
                await listCases(
                    interaction.guildId,
                    {
                        staffMemberId:
                            staffMember?.id ||
                            null,

                        issuedById:
                            issuedBy?.id ||
                            null,

                        caseType:
                            caseType ||
                            null,

                        status:
                            status ||
                            null,

                        limit: 100,
                    }
                );

            /*
             * Apply the upgraded natural text search.
             */

            const matchingCases =
                filteredCases.filter(
                    (caseRecord) =>
                        caseMatchesQuery(
                            caseRecord,
                            query
                        )
                );

            if (
                matchingCases.length ===
                0
            ) {
                const filterSummary =
                    createFilterSummary({
                        query,
                        staffMember,
                        issuedBy,
                        caseType,
                        status,
                    });

                return interaction.editReply({
                    content: [
                        '📭 No cases matched the selected search filters.',
                        '',
                        filterSummary,
                    ].join('\n'),

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * Apply the requested result limit.
             */

            const limitedCases =
                matchingCases.slice(
                    0,
                    resultLimit
                );

            /*
             * Build the result sections while respecting Discord's
             * 4,096-character embed-description limit.
             */

            const displayedSections = [];

            let currentLength = 0;

            for (
                let index = 0;
                index <
                limitedCases.length;
                index += 1
            ) {
                const section =
                    createCaseResultSection(
                        limitedCases[index],
                        index + 1
                    );

                const separatorLength =
                    displayedSections.length >
                    0
                        ? 24
                        : 0;

                if (
                    currentLength +
                        section.length +
                        separatorLength >
                    3200
                ) {
                    break;
                }

                displayedSections.push(
                    section
                );

                currentLength +=
                    section.length +
                    separatorLength;
            }

            const displayedCount =
                displayedSections.length;

            const filterSummary =
                createFilterSummary({
                    query,
                    staffMember,
                    issuedBy,
                    caseType,
                    status,
                });

            const description = [
                `Found **${matchingCases.length}** matching case${matchingCases.length === 1 ? '' : 's'}.`,
                `Showing **${displayedCount}** result${displayedCount === 1 ? '' : 's'}.`,
                '',
                filterSummary,
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '',
                displayedSections.join(
                    '\n\n━━━━━━━━━━━━━━━━━━━━\n\n'
                ),
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '',
                'Use `/case view` with a case ID to open its complete record.',
            ].join('\n');

            const guildIcon =
                interaction.guild.iconURL({
                    size: 256,
                });

            const searchEmbed =
                new EmbedBuilder()
                    .setColor(
                        convertHexToDecimal(
                            guildConfiguration
                                ?.brandColor
                        )
                    )
                    .setTitle(
                        '🔍 ISRP | Case Search Results'
                    )
                    .setDescription(
                        truncateText(
                            description,
                            4096,
                            'Search results unavailable.'
                        )
                    )
                    .setAuthor({
                        name:
                            guildConfiguration
                                ?.serverName ||
                            interaction.guild
                                .name,

                        iconURL: guildIcon || undefined,
                    })
                    .setFooter({
                        text:
                            matchingCases.length >
                            displayedCount
                                ? `Illinois State Utilities • Showing ${displayedCount} of ${matchingCases.length} matches`
                                : 'Illinois State Utilities • Case Management System',

                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            if (guildIcon) {
                searchEmbed.setThumbnail(guildIcon);
            }

            return interaction.editReply({
                content: null,

                embeds: [
                    searchEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case search:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while searching the case database. Please try again and check the bot logs if the problem continues.',
                'Unable to Search Cases'
            ).catch(() => {});
        }
    },
};
