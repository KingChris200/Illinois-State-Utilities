const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const brands = require('../config/branding');
const { getServerConfig } = require('../config/serverConfigs');
const {
    createRecordId,
    readDatabase,
    updateDatabase,
} = require('./database');

const LOA_DATABASE = 'loa-records';
const LOA_PREFIX = 'loa:';
const DAY_MS = 24 * 60 * 60 * 1000;

function parseStartDate(value, now = new Date()) {
    if (!value) {
        return new Date(now);
    }

    const match = String(value)
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day, 12));

    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }

    const today = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
    );

    return parsed.getTime() < today ? null : parsed;
}

function calculateEndDate(startDate, durationDays) {
    return new Date(startDate.getTime() + durationDays * DAY_MS);
}

function discordTimestamp(value, style = 'f') {
    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp)
        ? 'Unknown date'
        : `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function getReviewRoleIds(guildId) {
    const groups = getServerConfig(guildId)?.roleGroups;

    return [groups?.ownershipTeam, groups?.directorTeam].filter(
        (roleId, index, roleIds) =>
            roleId && roleIds.indexOf(roleId) === index
    );
}

function memberHasRole(member, roleIds) {
    return roleIds.some((roleId) => member?.roles?.cache?.has(roleId));
}

function canReviewLoas(interaction) {
    return (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        ) || memberHasRole(
            interaction.member,
            getReviewRoleIds(interaction.guildId)
        )
    );
}

function canRequestLoa(interaction) {
    const serverConfig = getServerConfig(interaction.guildId);
    const allowedRoleIds = [
        serverConfig?.roleGroups?.serverStaffTeam,
        ...getReviewRoleIds(interaction.guildId),
    ].filter(Boolean);

    return (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        ) || memberHasRole(interaction.member, allowedRoleIds)
    );
}

function getGuildRecords(database, guildId) {
    return Array.isArray(database?.[guildId])
        ? database[guildId]
        : [];
}

function findRecord(database, guildId, recordId) {
    return getGuildRecords(database, guildId).find(
        (record) => record.id === recordId
    );
}

async function getLogChannel(interaction) {
    const configurations = await readDatabase('guild-configs', {});
    const channelId = configurations[interaction.guildId]?.logChannelId;

    if (!channelId) {
        return null;
    }

    const channel =
        interaction.guild.channels.cache.get(channelId) ||
        (await interaction.guild.channels.fetch(channelId).catch(() => null));

    return channel?.isTextBased() ? channel : null;
}

async function addHistoryRecord(guildId, staffMemberId, record) {
    await updateDatabase(
        'staff-history',
        (database) => {
            database =
                database && typeof database === 'object' && !Array.isArray(database)
                    ? database
                    : {};
            database[guildId] =
                database[guildId] &&
                typeof database[guildId] === 'object' &&
                !Array.isArray(database[guildId])
                    ? database[guildId]
                    : {};
            database[guildId][staffMemberId] = Array.isArray(
                database[guildId][staffMemberId]
            )
                ? database[guildId][staffMemberId]
                : [];
            database[guildId][staffMemberId].push(record);
            return database;
        },
        {}
    );
}

async function updateStaffLoaProfile(guildId, user, activeLoa) {
    if (!user) {
        return;
    }

    await updateDatabase(
        'staff-records',
        (database) => {
            database =
                database && typeof database === 'object' && !Array.isArray(database)
                    ? database
                    : {};
            database[guildId] =
                database[guildId] &&
                typeof database[guildId] === 'object' &&
                !Array.isArray(database[guildId])
                    ? database[guildId]
                    : {};
            const current = database[guildId][user.id] || {};
            const isNewLoa =
                activeLoa && current.activeLoa?.id !== activeLoa.id;

            database[guildId][user.id] = {
                ...current,
                staffMemberId: user.id,
                username: user.username,
                displayName: user.globalName || user.username,
                currentRank: current.currentRank || 'Not Recorded',
                staffStatus: activeLoa ? 'On LOA' : 'Active',
                activeLoa,
                loaCount:
                    Number(current.loaCount || 0) + (isNewLoa ? 1 : 0),
                joinedStaffAt:
                    current.joinedStaffAt || new Date().toISOString(),
                createdAt: current.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            return database;
        },
        {}
    );
}

function createReviewControls(recordId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${LOA_PREFIX}approve:${recordId}`)
            .setLabel('Accept')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`${LOA_PREFIX}deny:${recordId}`)
            .setLabel('Deny')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

function createRequestEmbed(record, guild, avatarUrl = null) {
    const embed = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setTitle('Leave of Absence Request')
        .setDescription(`<@${record.staffMemberId}> requested a leave of absence.`)
        .addFields(
            {
                name: 'Start Date',
                value: discordTimestamp(record.startDate),
                inline: true,
            },
            {
                name: 'End Date',
                value: discordTimestamp(record.endDate),
                inline: true,
            },
            {
                name: 'Duration',
                value: `${record.totalDays} day${record.totalDays === 1 ? '' : 's'}`,
                inline: true,
            },
            { name: 'Reason', value: record.reason },
            { name: 'Status', value: 'Pending leadership review', inline: true },
            { name: 'Request ID', value: `\`${record.id}\``, inline: true }
        )
        .setAuthor({
            name: guild.name,
            iconURL: brands.assets.logo,
        })
        .setFooter({
            text: 'Illinois State Utilities • Leave Management',
            iconURL: brands.assets.logo,
        })
        .setTimestamp(new Date(record.requestedAt));

    if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
    }

    return embed;
}

function createDecisionEmbed(record, guild) {
    const approved = record.status === 'approved';

    return new EmbedBuilder()
        .setColor(approved ? 0x57f287 : 0xed4245)
        .setTitle(approved ? 'Leave Accepted' : 'Leave Denied')
        .setDescription(
            `<@${record.staffMemberId}>'s leave request was **${record.status}**.`
        )
        .addFields(
            {
                name: 'Start Date',
                value: discordTimestamp(record.startDate),
                inline: true,
            },
            {
                name: 'End Date',
                value: discordTimestamp(record.endDate),
                inline: true,
            },
            { name: 'Reason', value: record.reason },
            {
                name: 'Reviewed By',
                value: `<@${record.reviewedById}>`,
                inline: true,
            },
            { name: 'Request ID', value: `\`${record.id}\``, inline: true }
        )
        .setAuthor({
            name: guild.name,
            iconURL: brands.assets.logo,
        })
        .setFooter({
            text: 'Illinois State Utilities • Leave Management',
            iconURL: brands.assets.logo,
        })
        .setTimestamp(new Date(record.reviewedAt));
}

function createManagePayload(records, user, guild) {
    const sorted = [...records].sort(
        (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
    );
    const active = sorted.find((record) =>
        ['pending', 'approved'].includes(record.status)
    );
    const pastCount = sorted.filter((record) =>
        ['denied', 'ended', 'cancelled'].includes(record.status)
    ).length;
    const embed = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setTitle('Leave Management')
        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL?.({ size: 128 }),
        })
        .setFooter({
            text: 'Illinois State Utilities • Your LOA records',
            iconURL: brands.assets.logo,
        });

    if (!active) {
        embed.setDescription(
            'You currently have no active leave of absence. Use `/loa request` when you need one.'
        );
    } else {
        embed
            .setDescription(
                active.status === 'pending'
                    ? 'Your leave request is waiting for leadership review.'
                    : 'Your leave of absence is currently active.'
            )
            .addFields(
                {
                    name: 'Status',
                    value: active.status === 'pending' ? 'Pending' : 'Approved',
                    inline: true,
                },
                {
                    name: 'Period',
                    value: `${discordTimestamp(active.startDate, 'D')} — ${discordTimestamp(active.endDate, 'D')}`,
                    inline: true,
                },
                { name: 'Reason', value: active.reason }
            );
    }

    embed.setThumbnail(brands.assets.logo);

    const controls = new ActionRowBuilder();

    if (active) {
        controls.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `${LOA_PREFIX}${active.status === 'pending' ? 'cancel' : 'end'}:${active.id}:${user.id}`
                )
                .setLabel(
                    active.status === 'pending' ? 'Cancel Request' : 'End My LOA'
                )
                .setStyle(
                    active.status === 'pending'
                        ? ButtonStyle.Secondary
                        : ButtonStyle.Danger
                )
        );
    }

    controls.addComponents(
        new ButtonBuilder()
            .setCustomId(`${LOA_PREFIX}history:${user.id}`)
            .setLabel(`Past LOAs (${pastCount})`)
            .setEmoji('📁')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pastCount === 0)
    );

    return {
        embeds: [embed],
        components: [controls],
        allowedMentions: { parse: [] },
    };
}

async function saveNewRecord(record) {
    await updateDatabase(
        LOA_DATABASE,
        (database) => {
            database =
                database && typeof database === 'object' && !Array.isArray(database)
                    ? database
                    : {};
            database[record.guildId] = Array.isArray(database[record.guildId])
                ? database[record.guildId]
                : [];
            database[record.guildId].push(record);
            return database;
        },
        {}
    );
}

async function removeRecord(guildId, recordId) {
    await updateDatabase(
        LOA_DATABASE,
        (database) => {
            database[guildId] = getGuildRecords(database, guildId).filter(
                (record) => record.id !== recordId
            );
            return database;
        },
        {}
    );
}

async function updateRecord(guildId, recordId, mutator) {
    let updated = null;

    await updateDatabase(
        LOA_DATABASE,
        (database) => {
            const record = findRecord(database, guildId, recordId);

            if (!record || mutator(record) === false) {
                return database;
            }

            updated = { ...record };
            return database;
        },
        {}
    );

    return updated;
}

async function submitLoaRequest(interaction, options) {
    if (!canRequestLoa(interaction)) {
        await interaction.editReply(
            'Only members of the ISRP staff team can request a leave of absence.'
        );
        return;
    }

    const duration = Number(options.duration);
    const startDate = parseStartDate(options.start);

    if (!Number.isInteger(duration) || duration < 1 || duration > 90) {
        await interaction.editReply('Duration must be between 1 and 90 days.');
        return;
    }

    if (!startDate) {
        await interaction.editReply(
            'Start must be today or a future date in `YYYY-MM-DD` format.'
        );
        return;
    }

    const database = await readDatabase(LOA_DATABASE, {});
    const existing = getGuildRecords(database, interaction.guildId).find(
        (record) =>
            record.staffMemberId === interaction.user.id &&
            ['pending', 'approved'].includes(record.status)
    );

    if (existing) {
        await interaction.editReply(
            `You already have a **${existing.status}** LOA. Use \`/loa manage\` to review it.`
        );
        return;
    }

    const logChannel = await getLogChannel(interaction);
    const reviewRoleIds = getReviewRoleIds(interaction.guildId);

    if (!logChannel || reviewRoleIds.length === 0) {
        await interaction.editReply(
            'The LOA review destination or leadership roles are not configured yet.'
        );
        return;
    }

    const now = new Date().toISOString();
    const record = {
        id: createRecordId('loa'),
        type: 'loa',
        guildId: interaction.guildId,
        guildName: interaction.guild.name,
        staffMemberId: interaction.user.id,
        staffUsername: interaction.user.username,
        staffDisplayName:
            interaction.user.globalName || interaction.user.username,
        startDate: startDate.toISOString(),
        endDate: calculateEndDate(startDate, duration).toISOString(),
        totalDays: duration,
        reason: options.reason.trim(),
        notes: null,
        status: 'pending',
        requestedAt: now,
        reviewedAt: null,
        reviewedById: null,
        reviewNotes: null,
        endedAt: null,
        endedById: null,
        endNotes: null,
        createdAt: now,
        updatedAt: now,
    };

    await saveNewRecord(record);

    let reviewMessage;

    try {
        reviewMessage = await logChannel.send({
            content: reviewRoleIds.map((roleId) => `<@&${roleId}>`).join(' '),
            embeds: [
                createRequestEmbed(
                    record,
                    interaction.guild,
                    interaction.user.displayAvatarURL({ size: 256 })
                ),
            ],
            components: [createReviewControls(record.id)],
            allowedMentions: {
                roles: reviewRoleIds,
                users: [],
                parse: [],
            },
        });
    } catch (error) {
        await removeRecord(interaction.guildId, record.id);
        console.error('[LOA] Could not post request for review:', error);
        await interaction.editReply(
            'Your request could not be delivered to leadership. Nothing was saved; please try again after the channel permissions are fixed.'
        );
        return;
    }

    await updateRecord(interaction.guildId, record.id, (stored) => {
        stored.requestMessageChannelId = reviewMessage.channelId;
        stored.requestMessageId = reviewMessage.id;
        stored.updatedAt = new Date().toISOString();
    });
    await addHistoryRecord(interaction.guildId, interaction.user.id, {
        ...record,
        historyType: 'loa_request',
    });

    const confirmation = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setTitle('LOA Request Submitted')
        .setDescription(
            'Your request was sent to the Ownership and Directive teams for review.'
        )
        .addFields(
            {
                name: 'Period',
                value: `${discordTimestamp(record.startDate, 'D')} — ${discordTimestamp(record.endDate, 'D')}`,
            },
            { name: 'Reason', value: record.reason },
            { name: 'Status', value: 'Pending leadership review' }
        )
        .setFooter({ text: 'Use /loa manage to view or cancel this request' });

    await interaction.editReply({
        embeds: [confirmation],
        allowedMentions: { parse: [] },
    });
}

async function showLoaManage(interaction) {
    if (!canRequestLoa(interaction)) {
        await interaction.editReply(
            'Only members of the ISRP staff team can manage leave records.'
        );
        return;
    }

    const database = await readDatabase(LOA_DATABASE, {});
    const records = getGuildRecords(database, interaction.guildId).filter(
        (record) => record.staffMemberId === interaction.user.id
    );

    await interaction.editReply(
        createManagePayload(records, interaction.user, interaction.guild)
    );
}

async function reviewLoa(interaction, action, recordId) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!canReviewLoas(interaction)) {
        await interaction.editReply(
            'Only the Ownership and Directive teams can review LOA requests.'
        );
        return;
    }

    const reviewedAt = new Date().toISOString();
    const record = await updateRecord(
        interaction.guildId,
        recordId,
        (stored) => {
            if (stored.status !== 'pending') {
                return false;
            }
            stored.status = action === 'approve' ? 'approved' : 'denied';
            stored.reviewedAt = reviewedAt;
            stored.reviewedById = interaction.user.id;
            stored.updatedAt = reviewedAt;
        }
    );

    if (!record) {
        await interaction.editReply(
            'This request was already reviewed or no longer exists.'
        );
        return;
    }

    const staffUser = await interaction.client.users
        .fetch(record.staffMemberId)
        .catch(() => null);

    if (record.status === 'approved') {
        await updateStaffLoaProfile(interaction.guildId, staffUser, {
            id: record.id,
            status: 'Approved',
            startDate: record.startDate,
            endDate: record.endDate,
            reason: record.reason,
            approvedAt: record.reviewedAt,
        });
    }

    await addHistoryRecord(interaction.guildId, record.staffMemberId, {
        ...record,
        id: createRecordId(`loa-${record.status}`),
        requestId: record.id,
        historyType: `loa_${record.status}`,
        createdAt: reviewedAt,
    });

    const decisionEmbed = createDecisionEmbed(record, interaction.guild);
    await interaction.message
        .edit({
            content: `Reviewed by <@${interaction.user.id}>`,
            embeds: [decisionEmbed],
            components: [createReviewControls(record.id, true)],
            allowedMentions: { parse: [] },
        })
        .catch(() => null);

    if (staffUser) {
        await staffUser
            .send({ embeds: [decisionEmbed], allowedMentions: { parse: [] } })
            .catch(() => null);
    }

    await interaction.editReply(
        `LOA request \`${record.id}\` was ${record.status}.`
    );
}

async function sendSelfActionLog(interaction, record, action) {
    const channel = await getLogChannel(interaction);

    if (!channel) {
        return;
    }

    const roleIds = getReviewRoleIds(interaction.guildId);
    const ended = action === 'end';
    const embed = new EmbedBuilder()
        .setColor(ended ? brands.isrp.color : 0x95a5a6)
        .setTitle(ended ? 'Leave Ended' : 'LOA Request Cancelled')
        .setDescription(
            `<@${record.staffMemberId}> ${ended ? 'ended their leave of absence early' : 'cancelled their pending leave request'}.`
        )
        .addFields(
            {
                name: 'Original Period',
                value: `${discordTimestamp(record.startDate, 'D')} — ${discordTimestamp(record.endDate, 'D')}`,
            },
            { name: 'Reason', value: record.reason },
            { name: 'Request ID', value: `\`${record.id}\`` }
        )
        .setFooter({ text: 'Illinois State Utilities • Leave Management' })
        .setTimestamp();

    await channel
        .send({
            content: roleIds.map((roleId) => `<@&${roleId}>`).join(' '),
            embeds: [embed],
            allowedMentions: { roles: roleIds, users: [], parse: [] },
        })
        .catch(() => null);
}

async function handleSelfAction(interaction, action, recordId, ownerId) {
    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'This LOA control belongs to another staff member.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferUpdate();
    const now = new Date().toISOString();
    const requiredStatus = action === 'end' ? 'approved' : 'pending';
    const newStatus = action === 'end' ? 'ended' : 'cancelled';
    const record = await updateRecord(
        interaction.guildId,
        recordId,
        (stored) => {
            if (
                stored.staffMemberId !== interaction.user.id ||
                stored.status !== requiredStatus
            ) {
                return false;
            }
            stored.status = newStatus;
            stored.endedAt = now;
            stored.endedById = interaction.user.id;
            stored.updatedAt = now;
        }
    );

    if (!record) {
        await interaction.editReply({
            content: 'This LOA is no longer active.',
            embeds: [],
            components: [],
        });
        return;
    }

    if (action === 'end') {
        await updateStaffLoaProfile(
            interaction.guildId,
            interaction.user,
            null
        );
    }

    await addHistoryRecord(interaction.guildId, record.staffMemberId, {
        ...record,
        id: createRecordId(`loa-${newStatus}`),
        requestId: record.id,
        historyType: `loa_${newStatus}`,
        createdAt: now,
    });
    await sendSelfActionLog(interaction, record, action);
    await showLoaManage(interaction);
}

async function showHistory(interaction, ownerId) {
    if (
        interaction.user.id !== ownerId &&
        !canReviewLoas(interaction)
    ) {
        await interaction.reply({
            content: 'This LOA history belongs to another staff member.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const database = await readDatabase(LOA_DATABASE, {});
    const records = getGuildRecords(database, interaction.guildId)
        .filter(
            (record) =>
                record.staffMemberId === ownerId &&
                ['denied', 'ended', 'cancelled'].includes(record.status)
        )
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() -
                new Date(left.updatedAt).getTime()
        )
        .slice(0, 10);
    const description = records.length
        ? records
              .map(
                  (record) =>
                      `**${record.status[0].toUpperCase()}${record.status.slice(1)}** • ${discordTimestamp(record.startDate, 'D')} — ${discordTimestamp(record.endDate, 'D')}\n${record.reason}`
              )
              .join('\n\n')
        : 'No past LOA records were found.';

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(brands.isrp.color)
                .setTitle('Past Leave Records')
                .setDescription(description)
                .setFooter({ text: 'Showing up to 10 recent records' }),
        ],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function handleLoaInteraction(interaction) {
    if (!interaction.isButton?.()) {
        return;
    }

    const [, action, recordId, ownerId] = interaction.customId.split(':');

    if (action === 'approve' || action === 'deny') {
        await reviewLoa(interaction, action, recordId);
    } else if (action === 'end' || action === 'cancel') {
        await handleSelfAction(interaction, action, recordId, ownerId);
    } else if (action === 'history') {
        await showHistory(interaction, recordId);
    }
}

module.exports = {
    LOA_DATABASE,
    LOA_PREFIX,
    calculateEndDate,
    canRequestLoa,
    canReviewLoas,
    createManagePayload,
    createRequestEmbed,
    getReviewRoleIds,
    handleLoaInteraction,
    parseStartDate,
    showLoaManage,
    submitLoaRequest,
};
