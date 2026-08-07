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
 * CASE LIST HANDLER
 * ============================================================
 *
 * Handles:
 * /case list
 *
 * The slash-command options are registered inside:
 * commands/cases/case.js
 */

/*
 * Create one compact case section for the list embed.
 */

function createCaseListSection(
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

    const staffMember =
        caseRecord.staffMemberId
            ? `<@${caseRecord.staffMemberId}>`
            : caseRecord.staffDisplayName ||
              caseRecord.staffUsername ||
              'Unknown staff member';

    const titleLine =
        caseRecord.title
            ? `**Title:** ${truncateText(
                  caseRecord.title,
                  90
              )}`
            : null;

    return [
        `### ${position}. ${casePresentation.emoji} \`${caseRecord.id}\``,
        `**Type:** ${casePresentation.label}`,
        `**Status:** ${statusPresentation.emoji} ${statusPresentation.label}`,
        `**Staff Member:** ${staffMember}`,
        titleLine,
        `**Reason:** ${truncateText(
            caseRecord.reason,
            160
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
 * Create a readable summary of active list filters.
 */

function createListFilterSummary({
    staffMember,
    caseType,
    status,
}) {
    const filters = [];

    if (staffMember) {
        filters.push(
            `**Staff Member:** <@${staffMember.id}>`
        );
    }

    if (caseType) {
        const casePresentation =
            getCasePresentation(
                caseType
            );

        filters.push(
            `**Type:** ${casePresentation.emoji} ${casePresentation.label}`
        );
    }

    if (status) {
        const statusPresentation =
            getStatusPresentation(
                status
            );

        filters.push(
            `**Status:** ${statusPresentation.emoji} ${statusPresentation.label}`
        );
    }

    if (filters.length === 0) {
        return '**Filters:** None — displaying the server’s most recent cases.';
    }

    return filters.join('\n');
}

/*
 * ============================================================
 * COMMAND MODULE
 * ============================================================
 */

module.exports = {
    subcommandName: 'list',

    async execute(interaction) {
        try {
            const access =
                await validateCaseAccess(
                    interaction
                );

            if (!access.allowed) {
                return;
            }

            const {
                guildConfiguration,
            } = access;

            /*
             * Read optional list filters.
             */

            const staffMember =
                interaction.options.getUser(
                    'staff-member'
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
             * Retrieve cases using the central case manager.
             *
             * listCases() automatically sorts cases from newest
             * to oldest before applying the limit.
             */

            const recentCases =
                await listCases(
                    interaction.guildId,
                    {
                        staffMemberId:
                            staffMember?.id ||
                            null,

                        caseType:
                            caseType ||
                            null,

                        status:
                            status ||
                            null,

                        limit:
                            resultLimit,
                    }
                );

            if (
                recentCases.length ===
                0
            ) {
                const filterSummary =
                    createListFilterSummary({
                        staffMember,
                        caseType,
                        status,
                    });

                return interaction.editReply({
                    content: [
                        '📭 No cases were found using the selected filters.',
                        '',
                        filterSummary,
                    ].join('\n'),

                    embeds: [],

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * Build each result section while preventing the
             * embed description from exceeding Discord's limit.
             */

            const displayedSections = [];

            let currentLength = 0;

            for (
                let index = 0;
                index <
                recentCases.length;
                index += 1
            ) {
                const section =
                    createCaseListSection(
                        recentCases[index],
                        index + 1
                    );

                const separatorLength =
                    displayedSections.length >
                    0
                        ? 26
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
                createListFilterSummary({
                    staffMember,
                    caseType,
                    status,
                });

            const description = [
                `Displaying **${displayedCount}** recent case${displayedCount === 1 ? '' : 's'}.`,
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

            const listEmbed =
                new EmbedBuilder()
                    .setColor(
                        convertHexToDecimal(
                            guildConfiguration
                                ?.brandColor
                        )
                    )
                    .setTitle(
                        '📋 ISRP | Recent Case Records'
                    )
                    .setDescription(
                        truncateText(
                            description,
                            4096,
                            'Case list unavailable.'
                        )
                    )
                    .setAuthor({
                        name:
                            guildConfiguration
                                ?.serverName ||
                            interaction.guild
                                .name,

                        iconURL:
                            interaction.guild.iconURL({
                                size: 256,
                            }) ||
                            undefined,
                    })
                    .setFooter({
                        text:
                            recentCases.length >
                            displayedCount
                                ? `Illinois State Utilities • Showing ${displayedCount} of ${recentCases.length} retrieved cases`
                                : 'Illinois State Utilities • Case Management System',

                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            return interaction.editReply({
                content: null,

                embeds: [
                    listEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case list:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while retrieving the recent case list. Please try again and check the bot logs if the problem continues.',
                'Unable to List Cases'
            ).catch(() => {});
        }
    },
};
