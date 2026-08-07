const {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const {
    readDatabase,
} = require('../../utils/database');

const {
    memberCanReviewMovements,
} = require('../../config/serverConfigs');

/*
 * ============================================================
 * CASE PRESENTATION
 * ============================================================
 */

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
        color: 0x2ecc71,
    },

    closed: {
        label: 'Closed',
        emoji: '🔒',
        color: 0x747f8d,
    },

    voided: {
        label: 'Voided',
        emoji: '⚫',
        color: 0x2b2d31,
    },
};

const AUDIT_ACTION_NAMES = {
    case_created: 'Case Created',
    case_updated: 'Case Updated',
    case_closed: 'Case Closed',
    case_open: 'Case Reopened',
    case_voided: 'Case Voided',
    announcement_linked: 'Announcement Linked',
};

/*
 * ============================================================
 * PERMISSIONS
 * ============================================================
 */

function canManageCases(interaction) {
    const permissions =
        interaction.memberPermissions;

    return (
        interaction.guild?.ownerId ===
            interaction.user?.id ||
        permissions?.has(
            PermissionFlagsBits.ManageGuild
        ) ||
        permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
        memberCanReviewMovements(
            interaction.member,
            interaction.guildId
        )
    );
}

async function validateCaseAccess(
    interaction,
    {
        defer = true,
    } = {}
) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content:
                '❌ This command can only be used inside a Discord server.',

            flags:
                MessageFlags.Ephemeral,
        });

        return {
            allowed: false,
            guildConfiguration: null,
        };
    }

    if (!canManageCases(interaction)) {
        await interaction.reply({
            content:
                '❌ Case records are restricted to configured management, Internal Affairs, directors, and server ownership.',

            flags:
                MessageFlags.Ephemeral,
        });

        return {
            allowed: false,
            guildConfiguration: null,
        };
    }

    if (defer) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });
    }

    const guildConfiguration =
        await getGuildConfiguration(
            interaction.guildId
        );

    if (!guildConfiguration) {
        const response = {
            content:
                '❌ Illinois State Utilities has not been configured yet. Run `/setup` first.',
        };

        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.editReply(
                response
            );
        } else {
            await interaction.reply({
                ...response,

                flags:
                    MessageFlags.Ephemeral,
            });
        }

        return {
            allowed: false,
            guildConfiguration: null,
        };
    }

    return {
        allowed: true,
        guildConfiguration,
    };
}

/*
 * ============================================================
 * CONFIGURATION
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

    return (
        configurations[guildId] ||
        null
    );
}

/*
 * ============================================================
 * GENERAL FORMATTING
 * ============================================================
 */

function convertHexToDecimal(
    hexColor,
    fallbackColor = 0x005b96
) {
    if (
        typeof hexColor !== 'string'
    ) {
        return fallbackColor;
    }

    const cleanedColor =
        hexColor
            .trim()
            .replace(/^#/, '')
            .replace(/^0x/i, '');

    const parsedColor =
        Number.parseInt(
            cleanedColor,
            16
        );

    return Number.isNaN(
        parsedColor
    )
        ? fallbackColor
        : parsedColor;
}

function truncateText(
    text,
    maximumLength,
    fallback = 'Not provided'
) {
    if (
        text === null ||
        text === undefined
    ) {
        return fallback;
    }

    const normalizedText =
        String(text).trim();

    if (
        normalizedText.length === 0
    ) {
        return fallback;
    }

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

function formatTextLabel(value) {
    return String(
        value || 'Unknown'
    )
        .replaceAll('_', ' ')
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );
}

function createDiscordTimestamp(
    dateInput,
    style = 'F'
) {
    if (!dateInput) {
        return 'Not recorded';
    }

    const timestamp =
        new Date(dateInput).getTime();

    if (
        Number.isNaN(timestamp)
    ) {
        return 'Not recorded';
    }

    return `<t:${Math.floor(
        timestamp / 1000
    )}:${style}>`;
}

function createPlainTimestamp(
    dateInput
) {
    if (!dateInput) {
        return 'Not recorded';
    }

    const date =
        new Date(dateInput);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return 'Not recorded';
    }

    return date.toLocaleString(
        'en-US',
        {
            dateStyle: 'full',
            timeStyle: 'short',
        }
    );
}

function getCasePresentation(
    caseType
) {
    return (
        CASE_PRESENTATION[
            caseType
        ] ||
        CASE_PRESENTATION.other
    );
}

function getStatusPresentation(
    status
) {
    return (
        STATUS_PRESENTATION[
            status
        ] ||
        STATUS_PRESENTATION.open
    );
}

function formatAuditAction(
    action
) {
    return (
        AUDIT_ACTION_NAMES[
            action
        ] ||
        formatTextLabel(action)
    );
}

function formatUserReference({
    userId,
    username,
    displayName,
}) {
    if (userId) {
        return `<@${userId}>`;
    }

    return (
        displayName ||
        username ||
        'Unknown'
    );
}

/*
 * ============================================================
 * AUDIT LOG FORMATTING
 * ============================================================
 */

function formatAuditValue(
    value
) {
    if (
        value === null ||
        value === undefined
    ) {
        return 'None';
    }

    if (
        typeof value === 'object'
    ) {
        try {
            return truncateText(
                JSON.stringify(
                    value
                ),
                120
            );
        } catch {
            return 'Updated data';
        }
    }

    return truncateText(
        value,
        120
    );
}

function formatAuditChanges(
    changes
) {
    if (
        !changes ||
        typeof changes !==
            'object' ||
        Array.isArray(changes)
    ) {
        return null;
    }

    const entries =
        Object.entries(changes);

    if (
        entries.length === 0
    ) {
        return null;
    }

    return entries
        .slice(0, 5)
        .map(
            ([field, change]) => {
                const previousValue =
                    formatAuditValue(
                        change?.from
                    );

                const newValue =
                    formatAuditValue(
                        change?.to
                    );

                return (
                    `**${formatTextLabel(
                        field
                    )}:** ` +
                    `${previousValue} → ${newValue}`
                );
            }
        )
        .join('\n');
}

function createAuditSection(
    auditEntry,
    index
) {
    const performer =
        auditEntry.performedById
            ? `<@${auditEntry.performedById}>`
            : auditEntry.performedByUsername ||
              'Unknown';

    const lines = [
        `**${index + 1}. ${formatAuditAction(
            auditEntry.action
        )}**`,
        `Performed by: ${performer}`,
        `Date: ${createDiscordTimestamp(
            auditEntry.createdAt,
            'f'
        )}`,
    ];

    if (auditEntry.reason) {
        lines.push(
            `Reason: ${truncateText(
                auditEntry.reason,
                220
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

/*
 * ============================================================
 * CASE RECORD EMBED
 * ============================================================
 */

async function createCaseEmbed(
    interaction,
    guildConfiguration,
    caseRecord,
    {
        title = null,
        includeAuditLog = true,
        auditLimit = 5,
    } = {}
) {
    const casePresentation =
        getCasePresentation(
            caseRecord.type
        );

    const statusPresentation =
        getStatusPresentation(
            caseRecord.status
        );

    const brandColor =
        convertHexToDecimal(
            guildConfiguration
                ?.brandColor
        );

    const displayColor =
        caseRecord.status ===
        'open'
            ? casePresentation.color ||
              brandColor
            : statusPresentation.color;

    const staffMember =
        formatUserReference({
            userId:
                caseRecord.staffMemberId,

            username:
                caseRecord.staffUsername,

            displayName:
                caseRecord.staffDisplayName,
        });

    const issuedBy =
        formatUserReference({
            userId:
                caseRecord.issuedById,

            username:
                caseRecord.issuedByUsername,

            displayName:
                caseRecord.issuedByDisplayName,
        });

    const descriptionLines = [
        `### ${casePresentation.emoji} ${casePresentation.label}`,
        '',
        `**Status:** ${statusPresentation.emoji} ${statusPresentation.label}`,
        `**Case ID:** \`${caseRecord.id}\``,
        '',
        '**Staff Member**',
        staffMember,
        '',
        '**Issued By**',
        issuedBy,
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

    if (
        caseRecord.relatedRecordId ||
        caseRecord.relatedChannelId ||
        caseRecord.relatedMessageUrl
    ) {
        descriptionLines.push(
            '',
            '**Related Information**'
        );

        if (
            caseRecord.relatedRecordId
        ) {
            descriptionLines.push(
                `Record ID: \`${caseRecord.relatedRecordId}\``
            );
        }

        if (
            caseRecord.relatedChannelId
        ) {
            descriptionLines.push(
                `Channel: <#${caseRecord.relatedChannelId}>`
            );
        }

        if (
            caseRecord.relatedMessageUrl
        ) {
            descriptionLines.push(
                `[Open Related Message](${caseRecord.relatedMessageUrl})`
            );
        }
    }

    descriptionLines.push(
        '',
        '**Timeline**',
        `Created: ${createDiscordTimestamp(
            caseRecord.createdAt,
            'F'
        )}`,
        `Updated: ${createDiscordTimestamp(
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
            `Reopened: ${createDiscordTimestamp(
                caseRecord.reopenedAt,
                'F'
            )}`
        );
    }

    if (
        includeAuditLog &&
        Array.isArray(
            caseRecord.auditLog
        ) &&
        caseRecord.auditLog.length >
            0
    ) {
        const recentAuditEntries =
            [...caseRecord.auditLog]
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
                .slice(
                    0,
                    Math.max(
                        1,
                        Math.min(
                            auditLimit,
                            10
                        )
                    )
                );

        descriptionLines.push(
            '',
            '**Recent Case Activity**',
            ''
        );

        recentAuditEntries.forEach(
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
                    recentAuditEntries.length -
                        1
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

    const embed =
        new EmbedBuilder()
            .setColor(displayColor)
            .setTitle(
                title ||
                    'ISRP | Case Record'
            )
            .setDescription(
                truncateText(
                    descriptionLines.join(
                        '\n'
                    ),
                    4000,
                    'Case information unavailable.'
                )
            )
            .setAuthor({
                name:
                    guildConfiguration
                        ?.serverName ||
                    interaction.guild
                        ?.name ||
                    'Illinois State Roleplay',

                iconURL:
                    interaction.guild
                        ?.iconURL({
                            size: 256,
                        }) ||
                    undefined,
            })
            .setFooter({
                text:
                    'Illinois State Utilities • Case Management System',

                iconURL:
                    interaction.client.user.displayAvatarURL(),
            })
            .setTimestamp();

    if (
        caseRecord.staffMemberId
    ) {
        const staffUser =
            await interaction.client.users
                .fetch(
                    caseRecord.staffMemberId
                )
                .catch(() => null);

        if (staffUser) {
            embed.setThumbnail(
                staffUser.displayAvatarURL({
                    size: 256,
                })
            );
        }
    }

    return embed;
}

/*
 * ============================================================
 * RESPONSE EMBEDS
 * ============================================================
 */

function createSuccessEmbed({
    title = 'Action Completed',
    description,
    guildConfiguration = null,
    interaction = null,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(
                convertHexToDecimal(
                    guildConfiguration
                        ?.brandColor,
                    0x2ecc71
                )
            )
            .setTitle(
                `✅ ${title}`
            )
            .setDescription(
                description ||
                    'The action was completed successfully.'
            )
            .setTimestamp();

    if (interaction) {
        embed.setFooter({
            text:
                'Illinois State Utilities • Case Management System',

            iconURL:
                interaction.client.user.displayAvatarURL(),
        });
    }

    return embed;
}

function createErrorEmbed({
    title = 'Action Failed',
    description,
    interaction = null,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(
                `❌ ${title}`
            )
            .setDescription(
                description ||
                    'The requested action could not be completed.'
            )
            .setTimestamp();

    if (interaction) {
        embed.setFooter({
            text:
                'Illinois State Utilities • Case Management System',

            iconURL:
                interaction.client.user.displayAvatarURL(),
        });
    }

    return embed;
}

async function sendCaseError(
    interaction,
    description,
    title = 'Case Management Error'
) {
    const errorEmbed =
        createErrorEmbed({
            title,
            description,
            interaction,
        });

    if (
        interaction.deferred ||
        interaction.replied
    ) {
        return interaction.editReply({
            content: null,
            embeds: [errorEmbed],
        });
    }

    return interaction.reply({
        embeds: [errorEmbed],

        flags:
            MessageFlags.Ephemeral,
    });
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    CASE_PRESENTATION,
    STATUS_PRESENTATION,
    AUDIT_ACTION_NAMES,

    canManageCases,
    validateCaseAccess,

    getGuildConfiguration,

    convertHexToDecimal,
    truncateText,
    formatTextLabel,
    createDiscordTimestamp,
    createPlainTimestamp,
    getCasePresentation,
    getStatusPresentation,
    formatAuditAction,
    formatUserReference,

    formatAuditValue,
    formatAuditChanges,
    createAuditSection,

    createCaseEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    sendCaseError,
};
