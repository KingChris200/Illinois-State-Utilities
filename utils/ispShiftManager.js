const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const brands = require('../config/branding');
const shiftConfig = require('../config/ispShift');
const {
    ISP_RANKS,
    getServerConfig,
} = require('../config/serverConfigs');
const {
    endAllShifts,
    formatDuration,
    getGuildState,
    getLeaderboard,
    getOnlineUsers,
    getShiftSnapshot,
    startShift,
    stopShift,
    toggleBreak,
} = require('./ispShiftStore');

const ISP_SHIFT_PREFIX = 'isp_shift:';

function memberHasRole(member, roleId) {
    return Boolean(roleId && member?.roles?.cache?.has(roleId));
}

function isShiftAdministrator(member, memberPermissions) {
    return (
        memberPermissions?.has?.(PermissionFlagsBits.Administrator) ||
        memberHasRole(member, shiftConfig.managementRoleId)
    );
}

function isIspMember(member) {
    if (!member) return false;
    const departmentRoleId = getServerConfig(shiftConfig.guildId)?.roleGroups
        ?.illinoisStatePolice;

    return (
        memberHasRole(member, departmentRoleId) ||
        ISP_RANKS.some((rank) => memberHasRole(member, rank.roleId)) ||
        memberHasRole(member, shiftConfig.managementRoleId)
    );
}

function getIspRank(member) {
    return (
        [...ISP_RANKS]
            .reverse()
            .find((rank) => memberHasRole(member, rank.roleId))?.name ||
        'ISP Personnel'
    );
}

function getIdentity(user) {
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.globalName || user.username,
    };
}

function discordTimestamp(value, style = 'f') {
    const milliseconds = new Date(value).getTime();
    return Number.isNaN(milliseconds)
        ? 'Unknown'
        : `<t:${Math.floor(milliseconds / 1000)}:${style}>`;
}

function createProgressBar(current, target, length = 14) {
    if (!target) return '░'.repeat(length);
    const filled = Math.min(length, Math.floor((current / target) * length));
    return `${'█'.repeat(filled)}${'░'.repeat(length - filled)}`;
}

async function fetchGuildMember(guild, userId) {
    return (
        guild.members.cache.get(userId) ||
        (await guild.members.fetch(userId).catch(() => null))
    );
}

async function fetchGuildChannel(guild, channelId) {
    if (!channelId) return null;
    const channel =
        guild.channels.cache.get(channelId) ||
        (await guild.channels.fetch(channelId).catch(() => null));
    return channel?.isTextBased() ? channel : null;
}

async function updateOnDutyRole(guild, userId, enabled) {
    const member = await fetchGuildMember(guild, userId);
    if (!member) return 'The member could not be found for On-Duty role sync.';

    try {
        if (enabled && !member.roles.cache.has(shiftConfig.onDutyRoleId)) {
            await member.roles.add(
                shiftConfig.onDutyRoleId,
                'ISP shift started'
            );
        }
        if (!enabled && member.roles.cache.has(shiftConfig.onDutyRoleId)) {
            await member.roles.remove(
                shiftConfig.onDutyRoleId,
                'ISP shift ended'
            );
        }
        return null;
    } catch (error) {
        console.error('[ISP SHIFT] On-Duty role sync failed:', error);
        return 'The shift was saved, but I could not update the On-Duty role. Check the bot role hierarchy.';
    }
}

async function sendShiftLog(
    guild,
    {
        title,
        description,
        userId,
        actorId = userId,
        durationMs = null,
        reason = null,
        color = brands.isp.color,
        administration = false,
        force = false,
    }
) {
    const guildState = await getGuildState(guild.id);
    if (!force && guildState.settings.loggingEnabled === false) return null;

    const channelId = administration
        ? shiftConfig.shiftAdministrationChannelId
        : shiftConfig.shiftLogChannelId;
    const channel = await fetchGuildChannel(guild, channelId);
    if (!channel) return null;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: 'Officer', value: `<@${userId}>`, inline: true },
            { name: 'Actioned By', value: `<@${actorId}>`, inline: true }
        )
        .setFooter({ text: brands.isp.footer })
        .setTimestamp();

    if (durationMs !== null) {
        embed.addFields({
            name: 'Recorded Time',
            value: formatDuration(durationMs),
            inline: true,
        });
    }
    if (reason) {
        embed.addFields({ name: 'Reason', value: String(reason).slice(0, 1024) });
    }
    const icon = brands.isp.logo || guild.iconURL?.({ size: 128 });
    if (icon) embed.setAuthor({ name: guild.name, iconURL: icon });

    return channel
        .send({ embeds: [embed], allowedMentions: { parse: [] } })
        .catch((error) => {
            console.error('[ISP SHIFT] Could not send shift log:', error);
            return null;
        });
}

function createManagePayload(interaction, snapshot, member) {
    const user = member?.user || interaction.user;
    const active = snapshot.active;
    const onBreak = Boolean(active?.breakStartedAt);
    const status = !active
        ? '⚪ Off Shift'
        : onBreak
          ? '🟡 On Break'
          : '🔵 Active — ISP';
    const placement = snapshot.leaderboardPlacement
        ? `#${snapshot.leaderboardPlacement} / ${snapshot.leaderboardSize}`
        : 'Not ranked yet';
    const progress = createProgressBar(
        snapshot.weeklyDurationMs,
        snapshot.weeklyQuotaMs
    );
    const embed = new EmbedBuilder()
        .setColor(active ? 0x57f287 : brands.isp.color)
        .setTitle('Shift Manager')
        .setDescription(
            active
                ? `Your shift began ${discordTimestamp(active.startedAt, 'R')}.`
                : 'Start a shift when you are ready to begin official ISP duties.'
        )
        .addFields(
            {
                name: 'Logging',
                value: snapshot.loggingEnabled ? 'Enabled' : 'Disabled',
                inline: true,
            },
            { name: 'Status', value: status, inline: true },
            {
                name: 'Total This Wave',
                value: formatDuration(snapshot.weeklyDurationMs),
                inline: true,
            },
            { name: 'Leaderboard Placement', value: placement, inline: true },
            { name: 'Rank', value: getIspRank(member), inline: true },
            {
                name: 'Weekly Progress',
                value: `\`${progress}\` ${formatDuration(snapshot.weeklyDurationMs)} / ${formatDuration(snapshot.weeklyQuotaMs)}`,
            }
        )
        .setFooter({
            text: `Officer: ${user.username} • ${brands.isp.footer}`,
            iconURL: user.displayAvatarURL?.({ size: 128 }),
        })
        .setTimestamp();

    if (user.displayAvatarURL) {
        embed.setThumbnail(user.displayAvatarURL({ size: 256 }));
    }

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_PREFIX}start:${user.id}`)
            .setLabel('Start Shift')
            .setStyle(ButtonStyle.Success)
            .setDisabled(Boolean(active) || !snapshot.loggingEnabled),
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_PREFIX}break:${user.id}`)
            .setLabel(onBreak ? 'Resume Shift' : 'Toggle Break')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!active),
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_PREFIX}stop:${user.id}`)
            .setLabel('Stop Shift')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!active)
    );

    return {
        embeds: [embed],
        components: [controls],
        allowedMentions: { parse: [] },
    };
}

async function buildManagePayload(interaction, userId = interaction.user.id) {
    const member = await fetchGuildMember(interaction.guild, userId);
    const snapshot = await getShiftSnapshot(interaction.guildId, userId);
    return createManagePayload(interaction, snapshot, member);
}

async function startMemberShift(interaction, member = interaction.member) {
    const identity = getIdentity(member.user || interaction.user);
    const result = await startShift(interaction.guildId, identity);
    let roleWarning = null;

    if (result.status === 'started') {
        roleWarning = await updateOnDutyRole(interaction.guild, identity.id, true);
        await sendShiftLog(interaction.guild, {
            title: 'Shift Started',
            description: 'The officer is now on duty.',
            userId: identity.id,
            actorId: interaction.user.id,
            color: 0x57f287,
        });
    }
    return { ...result, roleWarning };
}

async function toggleMemberBreak(interaction, member = interaction.member) {
    const identity = getIdentity(member.user || interaction.user);
    const result = await toggleBreak(interaction.guildId, identity);

    if (['break_started', 'resumed'].includes(result.status)) {
        await sendShiftLog(interaction.guild, {
            title: result.status === 'resumed' ? 'Shift Resumed' : 'Break Started',
            description:
                result.status === 'resumed'
                    ? 'The officer returned to active duty.'
                    : 'The officer temporarily paused their shift.',
            userId: identity.id,
            actorId: interaction.user.id,
            color: result.status === 'resumed' ? 0x57f287 : 0xfee75c,
        });
    }
    return result;
}

async function stopMemberShift(
    interaction,
    member = interaction.member,
    options = {}
) {
    const identity = getIdentity(member.user || interaction.user);
    const result = await stopShift(interaction.guildId, identity, {
        endedById: interaction.user.id,
        ...options,
    });
    let roleWarning = null;

    if (result.status === 'stopped') {
        roleWarning = await updateOnDutyRole(interaction.guild, identity.id, false);
        await sendShiftLog(interaction.guild, {
            title: options.reason ? 'Shift Ended by Management' : 'Shift Ended',
            description: 'The officer is now off duty.',
            userId: identity.id,
            actorId: interaction.user.id,
            durationMs: result.session.durationMs,
            reason: options.reason || null,
            color: 0xed4245,
            administration: Boolean(options.reason),
        });
    }
    return { ...result, roleWarning };
}

async function endEveryShift(interaction) {
    const ended = await endAllShifts(
        interaction.guildId,
        interaction.user.id
    );

    await Promise.all(
        ended.map(({ userId }) =>
            updateOnDutyRole(interaction.guild, userId, false)
        )
    );
    await sendShiftLog(interaction.guild, {
        title: 'All Active Shifts Ended',
        description: `Management ended **${ended.length}** active shift${ended.length === 1 ? '' : 's'}.`,
        userId: interaction.user.id,
        actorId: interaction.user.id,
        color: 0xed4245,
        administration: true,
        force: true,
    });
    return ended;
}

async function createLeaderboardEmbed(guild) {
    const rows = await getLeaderboard(guild.id);
    const lines = rows.slice(0, 15).map((entry, index) => {
        const medal = ['🥇', '🥈', '🥉'][index] || `**${index + 1}.**`;
        return `${medal} <@${entry.userId}> — **${formatDuration(entry.weeklyDurationMs)}**`;
    });

    return new EmbedBuilder()
        .setColor(brands.isp.color)
        .setTitle('ISP Shift Leaderboard')
        .setDescription(
            lines.length
                ? lines.join('\n')
                : 'No shift time has been recorded during this wave.'
        )
        .setFooter({ text: `${brands.isp.footer} • Current weekly wave` })
        .setTimestamp();
}

async function createOnlineEmbed(guild) {
    const rows = await getOnlineUsers(guild.id);
    const lines = rows.slice(0, 25).map(
        (entry) =>
            `${entry.active.breakStartedAt ? '🟡' : '🔵'} <@${entry.userId}> — **${formatDuration(entry.activeDurationMs)}**`
    );

    return new EmbedBuilder()
        .setColor(rows.length ? 0x57f287 : brands.isp.color)
        .setTitle(`Officers Currently On Shift (${rows.length})`)
        .setDescription(
            lines.length ? lines.join('\n') : 'There are currently no officers on shift.'
        )
        .setFooter({ text: brands.isp.footer })
        .setTimestamp();
}

function createUserAdminEmbed(member, snapshot) {
    const cooldownActive =
        snapshot.promotionCooldownUntil &&
        new Date(snapshot.promotionCooldownUntil).getTime() > Date.now();
    const embed = new EmbedBuilder()
        .setColor(brands.isp.color)
        .setTitle('ISP Shift Administration')
        .setDescription(`Shift record for ${member}.`)
        .addFields(
            {
                name: 'Current Status',
                value: snapshot.active
                    ? snapshot.active.breakStartedAt
                        ? 'On Break'
                        : 'Active'
                    : 'Off Shift',
                inline: true,
            },
            {
                name: 'This Wave',
                value: formatDuration(snapshot.weeklyDurationMs),
                inline: true,
            },
            {
                name: 'All-Time',
                value: formatDuration(snapshot.allTimeDurationMs),
                inline: true,
            },
            {
                name: 'Active Infractions',
                value: String(snapshot.activeInfractions.length),
                inline: true,
            },
            {
                name: 'Excused This Wave',
                value: snapshot.excused ? 'Yes' : 'No',
                inline: true,
            },
            {
                name: 'Promotion Cooldown',
                value: cooldownActive
                    ? discordTimestamp(snapshot.promotionCooldownUntil, 'R')
                    : 'None',
                inline: true,
            }
        )
        .setFooter({ text: brands.isp.footer })
        .setTimestamp();

    const avatar = member.user.displayAvatarURL?.({ size: 256 });
    if (avatar) embed.setThumbnail(avatar);
    return embed;
}

function createEndAllConfirmation(actorId, activeCount) {
    const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Confirm Global Shift Action')
        .setDescription(
            `This will end **${activeCount}** active shift${activeCount === 1 ? '' : 's'} and remove every affected On-Duty role.`
        )
        .setFooter({ text: 'This action cannot be undone automatically.' });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_PREFIX}end_all:${actorId}`)
            .setLabel('End All Shifts')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_PREFIX}cancel:${actorId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
}

async function handleIspShiftInteraction(interaction) {
    if (
        !interaction.isButton?.() ||
        !interaction.customId?.startsWith(ISP_SHIFT_PREFIX)
    ) {
        return;
    }

    if (interaction.guildId !== shiftConfig.guildId) {
        await interaction.reply({
            content: 'This shift control belongs to the Illinois State Police server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const [, action, ownerId] = interaction.customId.split(':');
    if (ownerId !== interaction.user.id) {
        await interaction.reply({
            content: 'This private shift control belongs to another user.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (action === 'cancel') {
        await interaction.update({
            content: 'The global shift action was cancelled.',
            embeds: [],
            components: [],
        });
        return;
    }

    if (action === 'end_all') {
        if (!isShiftAdministrator(interaction.member, interaction.memberPermissions)) {
            await interaction.reply({
                content: 'Only the Office of Director can use this control.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.deferUpdate();
        const ended = await endEveryShift(interaction);
        await interaction.editReply({
            content: `✅ Ended ${ended.length} active shift${ended.length === 1 ? '' : 's'}.`,
            embeds: [],
            components: [],
        });
        return;
    }

    if (!isIspMember(interaction.member)) {
        await interaction.reply({
            content: 'You must be an ISP member to manage a shift.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferUpdate();
    let result;

    if (action === 'start') result = await startMemberShift(interaction);
    if (action === 'break') result = await toggleMemberBreak(interaction);
    if (action === 'stop') result = await stopMemberShift(interaction);

    const messages = {
        started: '✅ Your ISP shift has started.',
        break_started: '🟡 Your shift is now on break.',
        resumed: '✅ Your shift has resumed.',
        stopped: `✅ Your shift ended with **${formatDuration(result?.session?.durationMs)}** recorded.`,
        already_active: 'Your shift is already active.',
        not_active: 'You do not currently have an active shift.',
        disabled: 'Shift logging is currently disabled by ISP management.',
    };
    const payload = await buildManagePayload(interaction);
    const notice = [messages[result?.status] || 'The shift panel was refreshed.'];
    if (result?.roleWarning) notice.push(`⚠️ ${result.roleWarning}`);

    await interaction.editReply({
        content: notice.join('\n'),
        ...payload,
    });
}

async function recoverIspShiftRoles(client) {
    const guild =
        client.guilds.cache.get(shiftConfig.guildId) ||
        (await client.guilds.fetch(shiftConfig.guildId).catch(() => null));
    if (!guild) return { status: 'guild_unavailable', active: 0, corrected: 0 };

    const activeUsers = await getOnlineUsers(guild.id);
    const activeIds = new Set(activeUsers.map((entry) => entry.userId));
    let corrected = 0;

    for (const userId of activeIds) {
        const warning = await updateOnDutyRole(guild, userId, true);
        if (!warning) corrected += 1;
    }

    const role =
        guild.roles.cache.get(shiftConfig.onDutyRoleId) ||
        (await guild.roles.fetch(shiftConfig.onDutyRoleId).catch(() => null));
    if (role) {
        for (const member of role.members.values()) {
            if (activeIds.has(member.id)) continue;
            const warning = await updateOnDutyRole(guild, member.id, false);
            if (!warning) corrected += 1;
        }
    }

    return { status: 'recovered', active: activeIds.size, corrected };
}

module.exports = {
    ISP_SHIFT_PREFIX,
    buildManagePayload,
    createManagePayload,
    createEndAllConfirmation,
    createLeaderboardEmbed,
    createOnlineEmbed,
    createUserAdminEmbed,
    endEveryShift,
    fetchGuildMember,
    getIdentity,
    getIspRank,
    handleIspShiftInteraction,
    isIspMember,
    isShiftAdministrator,
    recoverIspShiftRoles,
    sendShiftLog,
    startMemberShift,
    stopMemberShift,
    toggleMemberBreak,
    updateOnDutyRole,
};
