const {
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

const {
    readDatabase,
    updateDatabase,
    createRecordId,
} = require('./database');

/*
 * ============================================================
 * CHANNEL CONFIGURATION
 * ============================================================
 */

const CHANNELS = {
    /*
     * Temporary configuration:
     * both movement types use the existing movement channel.
     *
     * These can be changed to separate channel IDs later.
     */

    movements: '1490759095500800190',
    promotions: '1490759095500800190',
    infractions: '1490759095500800190',
};

/*
 * ============================================================
 * STAFF ROLE IDS
 * ============================================================
 *
 * Every role used by the movement system is stored here.
 *
 * The label must match the rank name used by the slash command.
 */

const RANK_ROLES = {
    /*
     * Ownership
     */

    'Ownership Team': '1520179382407266354',
    Owner: '1490522930608738406',
    'Assistant Owner': '1490522983947698349',

    /*
     * Directorate
     */

    'Server Director': '1491215580223639604',
    'Deputy Server Director': '1490523081129857196',
    'Assistant Server Director': '1490523390778544291',
    'Director Team': '1490808065514016887',

    /*
     * Internal Affairs
     */

    'Superior Internal Affairs': '1526345126794756156',
    'Senior Internal Affairs': '1526344724238307459',
    'Junior Internal Affairs': '1526344620844253325',
    'Internal Affairs Team': '1526344302618218656',

    /*
     * Management
     */

    'Senior Manager': '1490523518901813339',
    Manager: '1510594665852829716',
    'Junior Manager': '1490885470522183740',
    'Management Board': '1490523581187231795',

    /*
     * Staff Supervisory
     */

    'Head Staff Supervisor': '1490523702142701811',
    'Senior Staff Supervisor': '1510602643016388728',
    'Junior Staff Supervisor': '1510594647766990988',
    'Staff Supervisory Board': '1490523797629960392',

    /*
     * Moderation
     */

    'Community Moderator': '1490524276820807710',
    'Senior Moderator': '1490524339550949580',
    'Trial Moderator': '1490524523794268250',
    'Moderation Board': '1520521292711854283',

    /*
     * General staff roles
     */

    'Server Staff Team': '1490847791940112485',
    'Staff Training and Education': '1490884232380420106',
};

/*
 * ============================================================
 * MOVEMENT REVIEWER ROLES
 * ============================================================
 *
 * Members with at least one of these roles may review appeals
 * and perform protected movement actions.
 *
 * Moderators and general staff roles are intentionally excluded.
 */

const REVIEWER_ROLE_IDS = [
    /*
     * Ownership
     */

    RANK_ROLES['Ownership Team'],
    RANK_ROLES.Owner,
    RANK_ROLES['Assistant Owner'],

    /*
     * Directorate
     */

    RANK_ROLES['Server Director'],
    RANK_ROLES['Deputy Server Director'],
    RANK_ROLES['Assistant Server Director'],
    RANK_ROLES['Director Team'],

    /*
     * Internal Affairs
     */

    RANK_ROLES['Superior Internal Affairs'],
    RANK_ROLES['Senior Internal Affairs'],
    RANK_ROLES['Junior Internal Affairs'],
    RANK_ROLES['Internal Affairs Team'],

    /*
     * Management
     */

    RANK_ROLES['Senior Manager'],
    RANK_ROLES.Manager,
    RANK_ROLES['Junior Manager'],
    RANK_ROLES['Management Board'],

    /*
     * Staff Supervisory
     */

    RANK_ROLES['Head Staff Supervisor'],
    RANK_ROLES['Senior Staff Supervisor'],
    RANK_ROLES['Junior Staff Supervisor'],
    RANK_ROLES['Staff Supervisory Board'],
].filter(Boolean);

/*
 * ============================================================
 * RANK CHOICES
 * ============================================================
 *
 * These ranks appear inside Discord slash-command choices.
 *
 * Discord allows a maximum of 25 static choices per option.
 * This list contains the actual individual staff ranks rather
 * than board/team membership roles.
 */

const STAFF_RANKS = [
    'Owner',
    'Assistant Owner',

    'Server Director',
    'Deputy Server Director',
    'Assistant Server Director',

    'Superior Internal Affairs',
    'Senior Internal Affairs',
    'Junior Internal Affairs',

    'Senior Manager',
    'Manager',
    'Junior Manager',

    'Head Staff Supervisor',
    'Senior Staff Supervisor',
    'Junior Staff Supervisor',

    'Community Moderator',
    'Senior Moderator',
    'Trial Moderator',
];

const RANK_CHOICES = STAFF_RANKS.map((rank) => ({
    name: rank,
    value: rank,
}));

/*
 * ============================================================
 * BRAND CONFIGURATION
 * ============================================================
 */

const BRAND_COLOR = 0x2b2d31;

const FOOTER_TEXT =
    'Illinois State Roleplay • Staff Affairs';

/*
 * ============================================================
 * MOVEMENT TYPES
 * ============================================================
 */

const MOVEMENT_TYPES = {
    VERBAL_WARNING: {
        label: 'Verbal Warning',
        color: 0xf5c518,
        requires: [],
        destination: 'infractions',
        verb: 'issued a verbal warning to',
        appealable: true,
    },

    STRIKE: {
        label: '1x Strike',
        color: 0xe67e22,
        requires: [],
        destination: 'infractions',
        verb: 'issued a strike to',
        appealable: true,
    },

    SUSPENSION: {
        label: 'Suspension',
        color: 0xe74c3c,
        requires: ['duration'],
        destination: 'infractions',
        verb: 'suspended',
        appealable: true,
    },

    TERMINATION: {
        label: 'Termination',
        color: 0x992d22,
        requires: [],
        destination: 'infractions',
        verb: 'terminated',
        appealable: true,
    },

    TERMINATION_BLACKLIST: {
        label: 'Termination + Blacklist',
        color: 0x5a0a0a,
        requires: [],
        destination: 'infractions',
        verb: 'terminated and blacklisted',
        appealable: true,
    },

    DEMOTION: {
        label: 'Demotion',
        color: 0xc0392b,
        requires: ['old-rank', 'new-rank'],
        destination: 'promotions',
        verb: 'demoted',
        appealable: true,
    },

    RETIREMENT: {
        label: 'Retirement',
        color: 0x3498db,
        requires: [],
        destination: 'promotions',
        verb: 'accepted the retirement of',
        appealable: false,
    },

    PROMOTION: {
        label: 'Promotion',
        color: 0x2ecc71,
        requires: ['old-rank', 'new-rank'],
        destination: 'promotions',
        verb: 'promoted',
        appealable: false,
    },
};

const TYPE_CHOICES = Object.values(
    MOVEMENT_TYPES
).map((type) => ({
    name: type.label,
    value: type.label,
}));

/*
 * ============================================================
 * MOVEMENT LOOKUP HELPERS
 * ============================================================
 */

function getMovementTypeByLabel(label) {
    return Object.values(
        MOVEMENT_TYPES
    ).find(
        (type) =>
            type.label === label
    );
}

function checkIsReviewer(member) {
    if (!member) {
        return false;
    }

    return member.roles.cache.some(
        (role) =>
            REVIEWER_ROLE_IDS.includes(
                role.id
            )
    );
}

/*
 * ============================================================
 * DATABASE HELPERS
 * ============================================================
 */

async function getMovements(guildId) {
    const database =
        await readDatabase(guildId);

    if (
        !Array.isArray(
            database.movements
        )
    ) {
        database.movements = [];
    }

    return database;
}

async function findMovement(
    guildId,
    recordId
) {
    const database =
        await getMovements(guildId);

    const record =
        database.movements.find(
            (entry) =>
                entry.id === recordId
        );

    return {
        database,
        record,
    };
}

async function saveMovement(
    guildId,
    database
) {
    await updateDatabase(
        guildId,
        database
    );
}

/*
 * ============================================================
 * EMBED BUILDERS
 * ============================================================
 */

function buildConfirmationEmbed({
    movementType,
    staffMember,
    reason,
    oldRank,
    newRank,
    duration,
    proof,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(BRAND_COLOR)
            .setAuthor({
                name: 'Confirm Staff Movement',
                iconURL:
                    staffMember.displayAvatarURL(),
            })
            .setDescription(
                `Please review the details below before this movement is logged. This action will notify **${staffMember.username}** and cannot be undone without filing a revoke.`
            )
            .addFields(
                {
                    name: 'Staff Member',
                    value: `${staffMember}`,
                    inline: true,
                },
                {
                    name: 'Type',
                    value:
                        movementType.label,
                    inline: true,
                },
                {
                    name: 'Reason',
                    value: reason,
                }
            )
            .setFooter({
                text: FOOTER_TEXT,
            })
            .setTimestamp();

    if (
        oldRank &&
        newRank
    ) {
        embed.addFields({
            name: 'Rank Change',
            value:
                `${oldRank} ➜ ${newRank}`,
        });
    }

    if (duration) {
        embed.addFields({
            name: 'Duration',
            value: duration,
            inline: true,
        });
    }

    if (proof) {
        embed.addFields({
            name: 'Proof',
            value: proof,
        });
    }

    return embed;
}

function buildLogEmbed({
    movementType,
    staffMember,
    issuedBy,
    reason,
    oldRank,
    newRank,
    duration,
    proof,
    recordId,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(
                movementType.color
            )
            .setAuthor({
                name:
                    `Staff Movement — ${movementType.label}`,
                iconURL:
                    staffMember.displayAvatarURL(),
            })
            .setDescription(
                `${issuedBy} has ${movementType.verb} ${staffMember}.`
            )
            .addFields(
                {
                    name: 'Staff Member',
                    value:
                        `${staffMember} (${staffMember.id})`,
                    inline: true,
                },
                {
                    name: 'Issued By',
                    value:
                        `${issuedBy} (${issuedBy.id})`,
                    inline: true,
                },
                {
                    name: 'Case ID',
                    value:
                        `\`${recordId}\``,
                    inline: true,
                }
            )
            .setThumbnail(
                staffMember.displayAvatarURL()
            )
            .setFooter({
                text: FOOTER_TEXT,
            })
            .setTimestamp();

    if (
        oldRank &&
        newRank
    ) {
        embed.addFields({
            name: 'Rank Change',
            value:
                `${oldRank} ➜ ${newRank}`,
        });
    }

    if (duration) {
        embed.addFields({
            name: 'Duration',
            value: duration,
            inline: true,
        });
    }

    embed.addFields({
        name: 'Reason',
        value: reason,
    });

    if (proof) {
        embed.addFields({
            name: 'Proof',
            value: proof,
        });
    }

    return embed;
}

function buildDmNotificationEmbed({
    movementType,
    reason,
    oldRank,
    newRank,
    duration,
    guildName,
    recordId,
}) {
    const embed =
        new EmbedBuilder()
            .setColor(
                movementType.color
            )
            .setTitle(
                `Staff Movement Notice — ${guildName}`
            )
            .setDescription(
                `You have received the following staff movement: **${movementType.label}**.`
            )
            .addFields(
                {
                    name: 'Reason',
                    value: reason,
                },
                {
                    name: 'Case ID',
                    value:
                        `\`${recordId}\``,
                    inline: true,
                }
            )
            .setFooter({
                text: FOOTER_TEXT,
            })
            .setTimestamp();

    if (
        oldRank &&
        newRank
    ) {
        embed.addFields({
            name: 'Rank Change',
            value:
                `${oldRank} ➜ ${newRank}`,
        });
    }

    if (duration) {
        embed.addFields({
            name: 'Duration',
            value: duration,
            inline: true,
        });
    }

    if (
        movementType.appealable
    ) {
        embed.addFields({
            name: 'Appeals',
            value:
                'If you believe this action was made in error, you may submit an appeal using the button below.',
        });
    }

    return embed;
}

function markRevokedEmbed(
    embed,
    revokedBy,
    revokeReason
) {
    const originalTitle =
        embed.data.title ??
        'Staff Movement';

    return EmbedBuilder.from(embed)
        .setColor(0x5c5f66)
        .setTitle(
            `${originalTitle} — REVOKED`
        )
        .addFields(
            {
                name: 'Revoked By',
                value: `${revokedBy}`,
                inline: true,
            },
            {
                name: 'Revoke Reason',
                value: revokeReason,
            }
        );
}

/*
 * ============================================================
 * AUTOMATIC RANK MANAGEMENT
 * ============================================================
 */

async function applyAutoRank(
    guild,
    staffMember,
    oldRankLabel,
    newRankLabel
) {
    const result = {
        applied: false,
        removedRole: false,
        addedRole: false,
        error: null,
    };

    try {
        if (
            !guild ||
            !staffMember?.id
        ) {
            throw new Error(
                'The guild or staff member was not provided.'
            );
        }

        const member =
            await guild.members.fetch(
                staffMember.id
            );

        const oldRoleId =
            oldRankLabel
                ? RANK_ROLES[
                      oldRankLabel
                  ]
                : null;

        const newRoleId =
            newRankLabel
                ? RANK_ROLES[
                      newRankLabel
                  ]
                : null;

        if (
            oldRankLabel &&
            !oldRoleId
        ) {
            throw new Error(
                `No role ID is configured for the old rank "${oldRankLabel}".`
            );
        }

        if (
            newRankLabel &&
            !newRoleId
        ) {
            throw new Error(
                `No role ID is configured for the new rank "${newRankLabel}".`
            );
        }

        if (
            oldRoleId &&
            member.roles.cache.has(
                oldRoleId
            )
        ) {
            await member.roles.remove(
                oldRoleId,
                `Staff movement: ${oldRankLabel} → ${newRankLabel}`
            );

            result.removedRole =
                true;
        }

        if (
            newRoleId &&
            !member.roles.cache.has(
                newRoleId
            )
        ) {
            await member.roles.add(
                newRoleId,
                `Staff movement: ${oldRankLabel} → ${newRankLabel}`
            );

            result.addedRole = true;
        }

        result.applied = true;
    } catch (error) {
        result.error =
            error instanceof Error
                ? error.message
                : String(error);
    }

    return result;
}

/*
 * ============================================================
 * MOVEMENT REVOCATION
 * ============================================================
 */

async function revokeMovement({
    guild,
    recordId,
    revokedBy,
    revokeReason,
}) {
    const {
        database,
        record,
    } = await findMovement(
        guild.id,
        recordId
    );

    if (!record) {
        return {
            success: false,
            reason:
                'No movement was found with that Case ID.',
        };
    }

    if (
        record.status ===
        'revoked'
    ) {
        return {
            success: false,
            reason:
                'That movement has already been revoked.',
        };
    }

    record.status = 'revoked';
    record.revokedById =
        revokedBy.id;
    record.revokeReason =
        revokeReason;
    record.revokedAt =
        Date.now();

    await saveMovement(
        guild.id,
        database
    );

    if (
        record.logChannelId &&
        record.logMessageId
    ) {
        try {
            const logChannel =
                await guild.channels.fetch(
                    record.logChannelId
                );

            if (
                logChannel &&
                logChannel.type ===
                    ChannelType.GuildText
            ) {
                const logMessage =
                    await logChannel.messages.fetch(
                        record.logMessageId
                    );

                const originalEmbed =
                    logMessage.embeds[0];

                if (originalEmbed) {
                    const revokedEmbed =
                        markRevokedEmbed(
                            originalEmbed,
                            revokedBy,
                            revokeReason
                        );

                    await logMessage.edit({
                        embeds: [
                            revokedEmbed,
                        ],
                        components: [],
                    });
                }
            }
        } catch (error) {
            console.error(
                `Failed to update revoked movement log ${recordId}:`,
                error
            );
        }
    }

    /*
     * Reverse rank changes when a promotion or demotion is revoked.
     */

    let rankResult = null;

    if (
        record.oldRank &&
        record.newRank
    ) {
        rankResult =
            await applyAutoRank(
                guild,
                {
                    id:
                        record.staffMemberId,
                },
                record.newRank,
                record.oldRank
            );
    }

    return {
        success: true,
        record,
        rankResult,
    };
}

/*
 * ============================================================
 * APPEAL CREATION
 * ============================================================
 */

async function createAppeal({
    guildId,
    recordId,
    appealerId,
    appealReason,
}) {
    const {
        database,
        record,
    } = await findMovement(
        guildId,
        recordId
    );

    if (!record) {
        return {
            success: false,
            reason:
                'No movement was found with that Case ID.',
        };
    }

    if (
        record.staffMemberId !==
        appealerId
    ) {
        return {
            success: false,
            reason:
                'You may only appeal movements filed against you.',
        };
    }

    if (
        record.status ===
        'revoked'
    ) {
        return {
            success: false,
            reason:
                'That movement has already been revoked and cannot be appealed.',
        };
    }

    if (
        record.appeal &&
        record.appeal.status ===
            'pending'
    ) {
        return {
            success: false,
            reason:
                'You already have a pending appeal for this case.',
        };
    }

    record.appeal = {
        reason: appealReason,
        status: 'pending',
        submittedAt:
            Date.now(),
        reviewedById: null,
        reviewedAt: null,
    };

    await saveMovement(
        guildId,
        database
    );

    return {
        success: true,
        record,
    };
}

/*
 * ============================================================
 * APPEAL RESOLUTION
 * ============================================================
 */

async function resolveAppeal({
    guildId,
    recordId,
    reviewerId,
    approve,
}) {
    const {
        database,
        record,
    } = await findMovement(
        guildId,
        recordId
    );

    if (
        !record ||
        !record.appeal
    ) {
        return {
            success: false,
            reason:
                'No pending appeal was found for that Case ID.',
        };
    }

    if (
        record.appeal.status !==
        'pending'
    ) {
        return {
            success: false,
            reason:
                'That appeal has already been reviewed.',
        };
    }

    record.appeal.status =
        approve
            ? 'approved'
            : 'denied';

    record.appeal.reviewedById =
        reviewerId;

    record.appeal.reviewedAt =
        Date.now();

    if (approve) {
        record.status =
            'revoked';

        record.revokedById =
            reviewerId;

        record.revokeReason =
            'Appeal approved.';

        record.revokedAt =
            Date.now();
    }

    await saveMovement(
        guildId,
        database
    );

    return {
        success: true,
        record,
    };
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    CHANNELS,

    REVIEWER_ROLE_IDS,

    STAFF_RANKS,
    RANK_CHOICES,
    RANK_ROLES,

    MOVEMENT_TYPES,
    TYPE_CHOICES,

    BRAND_COLOR,
    FOOTER_TEXT,

    getMovementTypeByLabel,
    checkIsReviewer,

    findMovement,
    getMovements,
    saveMovement,
    createRecordId,

    buildConfirmationEmbed,
    buildLogEmbed,
    buildDmNotificationEmbed,
    markRevokedEmbed,

    applyAutoRank,
    revokeMovement,

    createAppeal,
    resolveAppeal,
};