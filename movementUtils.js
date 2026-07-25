const { EmbedBuilder, ChannelType } = require('discord.js');
const {
    readDatabase,
    updateDatabase,
    createRecordId,
} = require('./database');
 

 
const CHANNELS = {
    movements: '1490759095500800190',
};
 

const REVIEWER_ROLE_IDS = [

];
 
const STAFF_RANKS = [
    'Trial Moderator',
    
];
 
const RANK_CHOICES = STAFF_RANKS.map((rank) => ({ name: rank, value: rank }));

 
const BRAND_COLOR = 0x2B2D31;
const FOOTER_TEXT = 'Illinois State Roleplay • Staff Affairs';
 
const MOVEMENT_TYPES = {
    VERBAL_WARNING: {
        label: 'Verbal Warning',
        color: 0xF5C518,
        requires: [],
        destination: 'infractions',
        verb: 'issued a verbal warning to',
        appealable: true,
    },
    STRIKE: {
        label: '1x Strike',
        color: 0xE67E22,
        requires: [],
        destination: 'infractions',
        verb: 'issued a strike to',
        appealable: true,
    },
    SUSPENSION: {
        label: 'Suspension',
        color: 0xE74C3C,
        requires: ['duration'],
        destination: 'infractions',
        verb: 'suspended',
        appealable: true,
    },
    TERMINATION: {
        label: 'Termination',
        color: 0x992D22,
        requires: [],
        destination: 'infractions',
        verb: 'terminated',
        appealable: true,
    },
    TERMINATION_BLACKLIST: {
        label: 'Termination + Blacklist',
        color: 0x5A0A0A,
        requires: [],
        destination: 'infractions',
        verb: 'terminated and blacklisted',
        appealable: true,
    },
    DEMOTION: {
        label: 'Demotion',
        color: 0xC0392B,
        requires: ['old-rank', 'new-rank'],
        destination: 'promotions',
        verb: 'demoted',
        appealable: true,
    },
    RETIREMENT: {
        label: 'Retirement',
        color: 0x3498DB,
        requires: [],
        destination: 'promotions',
        verb: 'accepted the retirement of',
        appealable: false,
    },
    PROMOTION: {
        label: 'Promotion',
        color: 0x2ECC71,
        requires: ['old-rank', 'new-rank'],
        destination: 'promotions',
        verb: 'promoted',
        appealable: false,
    },
};
 
const TYPE_CHOICES = Object.values(MOVEMENT_TYPES).map((type) => ({
    name: type.label,
    value: type.label,
}));
 
function getMovementTypeByLabel(label) {
    return Object.values(MOVEMENT_TYPES).find((type) => type.label === label);
}
 
function checkIsReviewer(member) {
    if (!member) return false;
    return member.roles.cache.some((role) => REVIEWER_ROLE_IDS.includes(role.id));
}
 

 
async function getMovements(guildId) {
    const database = await readDatabase(guildId);
    if (!Array.isArray(database.movements)) {
        database.movements = [];
    }
    return database;
}
 
async function findMovement(guildId, recordId) {
    const database = await getMovements(guildId);
    const record = database.movements.find((entry) => entry.id === recordId);
    return { database, record };
}
 
async function saveMovement(guildId, database) {
    await updateDatabase(guildId, database);
}
 

 
function buildConfirmationEmbed({ movementType, staffMember, reason, oldRank, newRank, duration, proof }) {
    const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setAuthor({ name: 'Confirm Staff Movement', iconURL: staffMember.displayAvatarURL() })
        .setDescription(
            `Please review the details below before this movement is logged. This action will notify **${staffMember.username}** and cannot be undone without filing a revoke.`
        )
        .addFields(
            { name: 'Staff Member', value: `${staffMember}`, inline: true },
            { name: 'Type', value: movementType.label, inline: true },
            { name: 'Reason', value: reason },
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
 
    if (oldRank && newRank) {
        embed.addFields({ name: 'Rank Change', value: `${oldRank} ➜ ${newRank}` });
    }
    if (duration) {
        embed.addFields({ name: 'Duration', value: duration, inline: true });
    }
    if (proof) {
        embed.addFields({ name: 'Proof', value: proof });
    }
 
    return embed;
}
 
function buildLogEmbed({ movementType, staffMember, issuedBy, reason, oldRank, newRank, duration, proof, recordId }) {
    const embed = new EmbedBuilder()
        .setColor(movementType.color)
        .setAuthor({ name: `Staff Movement — ${movementType.label}`, iconURL: staffMember.displayAvatarURL() })
        .setDescription(`${issuedBy} has ${movementType.verb} ${staffMember}.`)
        .addFields(
            { name: 'Staff Member', value: `${staffMember} (${staffMember.id})`, inline: true },
            { name: 'Issued By', value: `${issuedBy} (${issuedBy.id})`, inline: true },
            { name: 'Case ID', value: `\`${recordId}\``, inline: true },
        )
        .setThumbnail(staffMember.displayAvatarURL())
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
 
    if (oldRank && newRank) {
        embed.addFields({ name: 'Rank Change', value: `${oldRank} ➜ ${newRank}` });
    }
    if (duration) {
        embed.addFields({ name: 'Duration', value: duration, inline: true });
    }
 
    embed.addFields({ name: 'Reason', value: reason });
 
    if (proof) {
        embed.addFields({ name: 'Proof', value: proof });
    }
 
    return embed;
}
 
function buildDmNotificationEmbed({ movementType, reason, oldRank, newRank, duration, guildName, recordId }) {
    const embed = new EmbedBuilder()
        .setColor(movementType.color)
        .setTitle(`Staff Movement Notice — ${guildName}`)
        .setDescription(`You have received the following staff movement: **${movementType.label}**.`)
        .addFields(
            { name: 'Reason', value: reason },
            { name: 'Case ID', value: `\`${recordId}\``, inline: true },
        )
        .setFooter({ text: FOOTER_TEXT })
        .setTimestamp();
 
    if (oldRank && newRank) {
        embed.addFields({ name: 'Rank Change', value: `${oldRank} ➜ ${newRank}` });
    }
    if (duration) {
        embed.addFields({ name: 'Duration', value: duration, inline: true });
    }
    if (movementType.appealable) {
        embed.addFields({
            name: 'Appeals',
            value: 'If you believe this action was made in error, you may submit an appeal using the button below.',
        });
    }
 
    return embed;
}
 
function markRevokedEmbed(embed, revokedBy, revokeReason) {
    const rebuilt = EmbedBuilder.from(embed)
        .setColor(0x5c5f66)
        .setTitle((embed.data.title ?? '') + ' — REVOKED')
        .addFields(
            { name: 'Revoked By', value: `${revokedBy}`, inline: true },
            { name: 'Revoke Reason', value: revokeReason },
        );
    return rebuilt;
}
 

 
async function applyAutoRank(guild, staffMember, oldRankLabel, newRankLabel) {
    const result = { applied: false, error: null };
    try {
        const member = await guild.members.fetch(staffMember.id);
        const oldRoleId = RANK_ROLES[oldRankLabel];
        const newRoleId = RANK_ROLES[newRankLabel];
 
        if (oldRoleId && member.roles.cache.has(oldRoleId)) {
            await member.roles.remove(oldRoleId);
        }
        if (newRoleId) {
            await member.roles.add(newRoleId);
        }
        result.applied = true;
    } catch (error) {
        result.error = error.message;
    }
    return result;
}

 
async function revokeMovement({ guild, recordId, revokedBy, revokeReason }) {
    const { database, record } = await findMovement(guild.id, recordId);
 
    if (!record) {
        return { success: false, reason: 'No movement was found with that Case ID.' };
    }
    if (record.status === 'revoked') {
        return { success: false, reason: 'That movement has already been revoked.' };
    }
 
    record.status = 'revoked';
    record.revokedById = revokedBy.id;
    record.revokeReason = revokeReason;
    record.revokedAt = Date.now();
 
    await saveMovement(guild.id, database);
 

    if (record.logChannelId && record.logMessageId) {
        try {
            const logChannel = await guild.channels.fetch(record.logChannelId);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                const logMessage = await logChannel.messages.fetch(record.logMessageId);
                const originalEmbed = logMessage.embeds[0];
                if (originalEmbed) {
                    const revokedEmbed = markRevokedEmbed(originalEmbed, revokedBy, revokeReason);
                    await logMessage.edit({ embeds: [revokedEmbed], components: [] });
                }
            }
        } catch {

        }
    }
 

    if (record.oldRank && record.newRank) {
        await applyAutoRank(guild, { id: record.staffMemberId }, record.newRank, record.oldRank);
    }
 
    return { success: true, record };
}
 

 
async function createAppeal({ guildId, recordId, appealerId, appealReason }) {
    const { database, record } = await findMovement(guildId, recordId);
 
    if (!record) {
        return { success: false, reason: 'No movement was found with that Case ID.' };
    }
    if (record.staffMemberId !== appealerId) {
        return { success: false, reason: 'You may only appeal movements filed against you.' };
    }
    if (record.status === 'revoked') {
        return { success: false, reason: 'That movement has already been revoked and cannot be appealed.' };
    }
    if (record.appeal && record.appeal.status === 'pending') {
        return { success: false, reason: 'You already have a pending appeal for this case.' };
    }
 
    record.appeal = {
        reason: appealReason,
        status: 'pending',
        submittedAt: Date.now(),
        reviewedById: null,
        reviewedAt: null,
    };
 
    await saveMovement(guildId, database);
    return { success: true, record };
}
 
async function resolveAppeal({ guildId, recordId, reviewerId, approve }) {
    const { database, record } = await findMovement(guildId, recordId);
 
    if (!record || !record.appeal) {
        return { success: false, reason: 'No pending appeal was found for that Case ID.' };
    }
    if (record.appeal.status !== 'pending') {
        return { success: false, reason: 'That appeal has already been reviewed.' };
    }
 
    record.appeal.status = approve ? 'approved' : 'denied';
    record.appeal.reviewedById = reviewerId;
    record.appeal.reviewedAt = Date.now();
 
    if (approve) {
        record.status = 'revoked';
        record.revokedById = reviewerId;
        record.revokeReason = 'Appeal approved.';
        record.revokedAt = Date.now();
    }
 
    await saveMovement(guildId, database);
    return { success: true, record };
}
 
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
