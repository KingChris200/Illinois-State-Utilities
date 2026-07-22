const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const {
    readDatabase,
} = require('../../utils/database');

const {
    findCase,
} = require('../../utils/caseManager');

const CASE_PRESENTATION = {
    promotion: {
        label: 'Promotion',
        emoji: '⬆️',
        color: 0x2ecc71,
    },

    demotion: {
        label: 'Demotion',
        emoji: '⬇️',
        color: 0xc0392b,
    },

    notice: {
        label: 'Notice',
        emoji: '🟡',
        color: 0xf1c40f,
    },

    inactivity_notice: {
        label: 'Inactivity Notice',
        emoji: '🟠',
        color: 0xe67e22,
    },

    warning: {
        label: 'Warning',
        emoji: '⚠️',
        color: 0xf39c12,
    },

    strike: {
        label: 'Strike',
        emoji: '🔴',
        color: 0xe74c3c,
    },

    termination: {
        label: 'Termination',
        emoji: '⛔',
        color: 0x992d22,
    },

    blacklist: {
        label: 'Blacklist',
        emoji: '🚫',
        color: 0x2b2d31,
    },

    award: {
        label: 'Award',
        emoji: '🏆',
        color: 0xf1c40f,
    },

    loa: {
        label: 'Leave of Absence',
        emoji: '🏖️',
        color: 0x5865f2,
    },

    other: {
        label: 'Staff Case',
        emoji: '📁',
        color: 0x005b96,
    },
};

const STATUS_PRESENTATION = {
    open: {
        label: 'Open',
        emoji: '🟢',
    },

    closed: {
        label: 'Closed',
        emoji: '🔴',
    },

    voided: {
        label: 'Voided',
        emoji: '⚫',
    },
};

function canManageCases(interaction) {
    return (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageMessages
        ) ||
        interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        ) ||
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

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

    return Number.isNaN(parsedColor)
        ? 0x005b96
        : parsedColor;
}

function createDiscordTimestamp(
    dateInput,
    style = 'F'
) {
    if (!dateInput) {
        return 'Not recorded';
    }

    const timestamp = new Date(
        dateInput
    ).getTime();

    if (Number.isNaN(timestamp)) {
        return 'Not recorded';
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

function formatAuditAction(action) {
    const actionNames = {
        case_created: 'Case Created',
        case_updated: 'Case Updated',
        case_closed: 'Case Closed',
        case_open: 'Case Reopened',
        case_voided: 'Case Voided',
    };

    return (
        actionNames[action] ||
        String(action || 'Case Updated')
            .replaceAll('_', ' ')
            .replace(/\b\w/g, (letter) =>
                letter.toUpperCase()
            )
    );
}

function formatAuditChanges(changes) {
    if (
        !changes ||
        typeof changes !== 'object' ||
        Array.isArray(changes)
    ) {
        return null;
    }

    const entries = Object.entries(
        changes
    );

    if (entries.length === 0) {
        return null;
    }

    return entries
        .slice(0, 3)
        .map(([field, change]) => {
            const formattedField = field
                .replaceAll('_', ' ')
                .replace(/\b\w/g, (letter) =>
                    letter.toUpperCase()
                );

            const previousValue =
                change?.from === null ||
                change?.from === undefined
                    ? 'None'
                    : truncateText(
                          change.from,
                          80
                      );

            const newValue =
                change?.to === null ||
                change?.to === undefined
                    ? 'None'
                    : truncateText(
                          change.to,
                          80
                      );

            return `${formattedField}: ${previousValue} → ${newValue}`;
        })
        .join('\n');
}

function createAuditSection(
    auditEntry,
    index
) {
    const performedBy =
        auditEntry.performedById
            ? `<@${auditEntry.performedById}>`
            : auditEntry.performedByUsername ||
              'Unknown';

    const lines = [
        `**${index + 1}. ${formatAuditAction(
            auditEntry.action
        )}**`,
        `By: ${performedBy}`,
        `Date: ${createDiscordTimestamp(
            auditEntry.createdAt,
            'f'
        )}`,
    ];

    if (auditEntry.reason) {
        lines.push(
            `Reason: ${truncateText(
                auditEntry.reason,
                150
            )}`
        );
    }

    const formattedChanges =
        formatAuditChanges(
            auditEntry.changes
        );

    if (formattedChanges) {
        lines.push(
            `Changes:\n${formattedChanges}`
        );
    }

    return lines.join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription(
            'View and manage Illinois State Utilities case records.'
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('view')
                .setDescription(
                    'View a case using its permanent case ID.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('visibility')
                        .setDescription(
                            'Choose whether the case response is private or public.'
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
                )
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

            if (!canManageCases(interaction)) {
                return interaction.reply({
                    content:
                        '❌ You need the **Manage Messages** permission to view case records.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const subcommand =
                interaction.options.getSubcommand();

            const visibility =
                interaction.options.getString(
                    'visibility'
                ) || 'private';

            await interaction.deferReply({
                flags:
                    visibility === 'private'
                        ? MessageFlags.Ephemeral
                        : undefined,
            });

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
                        '❌ Illinois State Utilities has not been configured yet. Run `/setup` first.',
                });
            }

            if (subcommand !== 'view') {
                return interaction.editReply({
                    content:
                        '❌ That case-management action is not available yet.',
                });
            }

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            const caseRecord =
                await findCase(
                    interaction.guildId,
                    caseId
                );

            if (!caseRecord) {
                return interaction.editReply({
                    content:
                        `❌ No case was found with ID \`${caseId}\`.\n\n` +
                        'Double-check the ID and try again.',
                });
            }

            const casePresentation =
                CASE_PRESENTATION[
                    caseRecord.type
                ] ||
                CASE_PRESENTATION.other;

            const statusPresentation =
                STATUS_PRESENTATION[
                    caseRecord.status
                ] ||
                STATUS_PRESENTATION.open;

            const brandColor =
                convertHexToDecimal(
                    guildConfiguration.brandColor
                );

            const displayColor =
                caseRecord.status === 'open'
                    ? casePresentation.color ||
                      brandColor
                    : caseRecord.status ===
                        'voided'
                      ? 0x2b2d31
                      : 0x747f8d;

            const descriptionLines = [
                `Below is the complete saved record for case \`${caseRecord.id}\`.`,
                '',
                '**Case Type**',
                `${casePresentation.emoji} ${casePresentation.label}`,
                '',
                '**Case Status**',
                `${statusPresentation.emoji} ${statusPresentation.label}`,
                '',
                '**Staff Member**',
                caseRecord.staffMemberId
                    ? `<@${caseRecord.staffMemberId}>`
                    : caseRecord.staffDisplayName ||
                      caseRecord.staffUsername ||
                      'Unknown',
                '',
                '**Issued By**',
                caseRecord.issuedById
                    ? `<@${caseRecord.issuedById}>`
                    : caseRecord.issuedByDisplayName ||
                      caseRecord.issuedByUsername ||
                      'Unknown',
            ];

            if (caseRecord.title) {
                descriptionLines.push(
                    '',
                    '**Case Title**',
                    truncateText(
                        caseRecord.title,
                        200
                    )
                );
            }

            descriptionLines.push(
                '',
                '**Reason**',
                truncateText(
                    caseRecord.reason,
                    750
                )
            );

            if (caseRecord.evidence) {
                descriptionLines.push(
                    '',
                    '**Evidence / Reference**',
                    truncateText(
                        caseRecord.evidence,
                        750
                    )
                );
            }

            if (caseRecord.notes) {
                descriptionLines.push(
                    '',
                    '**Additional Notes**',
                    truncateText(
                        caseRecord.notes,
                        500
                    )
                );
            }

            if (caseRecord.relatedRecordId) {
                descriptionLines.push(
                    '',
                    '**Related Record ID**',
                    `\`${caseRecord.relatedRecordId}\``
                );
            }

            if (caseRecord.relatedChannelId) {
                descriptionLines.push(
                    '',
                    '**Related Channel**',
                    `<#${caseRecord.relatedChannelId}>`
                );
            }

            if (caseRecord.relatedMessageUrl) {
                descriptionLines.push(
                    '',
                    '**Related Message**',
                    `[Open Related Message](${caseRecord.relatedMessageUrl})`
                );
            }

            descriptionLines.push(
                '',
                '**Case Timeline**',
                `Created: ${createDiscordTimestamp(
                    caseRecord.createdAt,
                    'F'
                )}`,
                `Last Updated: ${createDiscordTimestamp(
                    caseRecord.updatedAt,
                    'R'
                )}`
            );

            if (caseRecord.closedAt) {
                descriptionLines.push(
                    `Closed: ${createDiscordTimestamp(
                        caseRecord.closedAt,
                        'F'
                    )}`
                );
            }

            if (caseRecord.voidedAt) {
                descriptionLines.push(
                    `Voided: ${createDiscordTimestamp(
                        caseRecord.voidedAt,
                        'F'
                    )}`
                );
            }

            if (caseRecord.reopenedAt) {
                descriptionLines.push(
                    `Last Reopened: ${createDiscordTimestamp(
                        caseRecord.reopenedAt,
                        'F'
                    )}`
                );
            }

            const auditLog =
                Array.isArray(
                    caseRecord.auditLog
                )
                    ? [...caseRecord.auditLog]
                          .sort(
                              (
                                  firstEntry,
                                  secondEntry
                              ) =>
                                  new Date(
                                      secondEntry.createdAt
                                  ).getTime() -
                                  new Date(
                                      firstEntry.createdAt
                                  ).getTime()
                          )
                          .slice(0, 5)
                    : [];

            if (auditLog.length > 0) {
                descriptionLines.push(
                    '',
                    '**Recent Audit Activity**',
                    ''
                );

                auditLog.forEach(
                    (
                        auditEntry,
                        index
                    ) => {
                        descriptionLines.push(
                            createAuditSection(
                                auditEntry,
                                index
                            )
                        );

                        if (
                            index <
                            auditLog.length - 1
                        ) {
                            descriptionLines.push(
                                '',
                                '──────────────',
                                ''
                            );
                        }
                    }
                );
            }

            descriptionLines.push(
                '',
                '**Case ID**',
                `\`${caseRecord.id}\``
            );

            const caseEmbed =
                new EmbedBuilder()
                    .setColor(displayColor)
                    .setTitle(
                        `${casePresentation.emoji} ISRP | Case Record`
                    )
                    .setDescription(
                        descriptionLines.join('\n')
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
                            'Illinois State Utilities • Case Management System',

                        iconURL:
                            interaction.client.user.displayAvatarURL(),
                    })
                    .setTimestamp();

            const caseUser =
                caseRecord.staffMemberId
                    ? await interaction.client.users
                          .fetch(
                              caseRecord.staffMemberId
                          )
                          .catch(() => null)
                    : null;

            if (caseUser) {
                caseEmbed.setThumbnail(
                    caseUser.displayAvatarURL({
                        size: 256,
                    })
                );
            }

            await interaction.editReply({
                embeds: [caseEmbed],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case:',
                error
            );

            const errorMessage = {
                content:
                    '❌ Something went wrong while loading this case record.',
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