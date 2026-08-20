const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const brands = require('../config/branding');
const shiftConfig = require('../config/ispShift');
const {
    formatDuration,
    getGuildState,
    getLeaderboard,
    getOnlineUsers,
} = require('./ispShiftStore');
const {
    buildManagePayload,
    createLeaderboardEmbed,
    createOnlineEmbed,
    isIspMember,
} = require('./ispShiftManager');
const { readDatabase, updateDatabase } = require('./database');

const ISP_SHIFT_DASHBOARD_DATABASE = 'isp-shift-dashboard';
const ISP_SHIFT_DASHBOARD_PREFIX = 'isp_shift_dashboard:';

async function createIspShiftDashboardPayload(guild) {
    const [online, leaderboard, guildState] = await Promise.all([
        getOnlineUsers(guild.id),
        getLeaderboard(guild.id),
        getGuildState(guild.id),
    ]);
    const onBreak = online.filter((entry) => entry.active.breakStartedAt).length;
    const activelyWorking = online.length - onBreak;
    const leaders = leaderboard.slice(0, 3).map((entry, index) => {
        const medal = ['🥇', '🥈', '🥉'][index];
        return `${medal} <@${entry.userId}> — **${formatDuration(entry.weeklyDurationMs)}**`;
    });
    const embed = new EmbedBuilder()
        .setColor(brands.isp.color)
        .setTitle('ISP Shift Dashboard')
        .setDescription('Current duty status and weekly shift time.')
        .addFields(
            {
                name: 'On Duty',
                value: `**${activelyWorking}** officer${activelyWorking === 1 ? '' : 's'}`,
                inline: true,
            },
            {
                name: 'On Break',
                value: `**${onBreak}** officer${onBreak === 1 ? '' : 's'}`,
                inline: true,
            },
            {
                name: 'Shift Logging',
                value: guildState.settings.loggingEnabled
                    ? '🟢 Enabled'
                    : '🔴 Disabled',
                inline: true,
            },
            {
                name: 'Weekly Quota',
                value: `**${formatDuration(guildState.settings.weeklyQuotaMs)}** per officer`,
                inline: false,
            },
            {
                name: 'Weekly Leaders',
                value: leaders.length
                    ? leaders.join('\n')
                    : 'No shift time has been recorded this wave.',
                inline: false,
            }
        )
        .setFooter({
            text: 'Updates every minute',
        })
        .setTimestamp();
    const icon = brands.isp.logo || guild.iconURL?.({ size: 256 });

    if (icon) {
        embed.setAuthor({ name: guild.name, iconURL: icon });
    }

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_DASHBOARD_PREFIX}manage`)
            .setLabel('Manage My Shift')
            .setEmoji('🚔')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_DASHBOARD_PREFIX}online`)
            .setLabel('View Online')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${ISP_SHIFT_DASHBOARD_PREFIX}leaderboard`)
            .setLabel('Leaderboard')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [controls],
        allowedMentions: { parse: [] },
    };
}

async function getStoredIspShiftDashboard(guildId) {
    const database = await readDatabase(ISP_SHIFT_DASHBOARD_DATABASE, {});
    return database[guildId] || null;
}

async function saveIspShiftDashboard(guildId, panel) {
    await updateDatabase(
        ISP_SHIFT_DASHBOARD_DATABASE,
        (database) => {
            database[guildId] = {
                guildId,
                ...panel,
            };
            return database;
        },
        {}
    );
    return panel;
}

async function removeStoredIspShiftDashboard(guildId) {
    let removed = null;

    await updateDatabase(
        ISP_SHIFT_DASHBOARD_DATABASE,
        (database) => {
            removed = database[guildId] || null;
            delete database[guildId];
            return database;
        },
        {}
    );
    return removed;
}

async function fetchStoredIspShiftDashboardMessage(client, panel) {
    if (!client || !panel) return null;
    let channel = client.channels?.cache?.get(panel.channelId) || null;
    if (!channel && client.channels?.fetch) {
        channel = await client.channels.fetch(panel.channelId).catch(() => null);
    }

    if (!channel?.messages?.fetch) return null;
    return channel.messages.fetch(panel.messageId).catch(() => null);
}

async function refreshIspShiftDashboard(client, guildId = shiftConfig.guildId) {
    const panel = await getStoredIspShiftDashboard(guildId);
    if (!panel) return { status: 'not_configured' };

    const message = await fetchStoredIspShiftDashboardMessage(client, panel);
    if (!message) return { status: 'message_unavailable', panel };

    let guild = client.guilds?.cache?.get(guildId) || message.guild || null;
    if (!guild && client.guilds?.fetch) {
        guild = await client.guilds.fetch(guildId).catch(() => null);
    }
    if (!guild) return { status: 'guild_unavailable', panel };

    await message.edit(await createIspShiftDashboardPayload(guild));
    await saveIspShiftDashboard(guildId, {
        ...panel,
        updatedAt: new Date().toISOString(),
    });
    return { status: 'updated', panel };
}

async function handleIspShiftDashboardInteraction(interaction) {
    if (
        !interaction.isButton?.() ||
        !interaction.customId?.startsWith(ISP_SHIFT_DASHBOARD_PREFIX)
    ) {
        return;
    }

    if (interaction.guildId !== shiftConfig.guildId) {
        await interaction.reply({
            content: 'This dashboard belongs to the Illinois State Police server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!isIspMember(interaction.member)) {
        await interaction.reply({
            content: 'You must be an Illinois State Police member to use this dashboard.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const action = interaction.customId.slice(ISP_SHIFT_DASHBOARD_PREFIX.length);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'manage') {
        await interaction.editReply(await buildManagePayload(interaction));
        return;
    }
    if (action === 'online') {
        await interaction.editReply({
            embeds: [await createOnlineEmbed(interaction.guild)],
            allowedMentions: { parse: [] },
        });
        return;
    }
    if (action === 'leaderboard') {
        await interaction.editReply({
            embeds: [await createLeaderboardEmbed(interaction.guild)],
            allowedMentions: { parse: [] },
        });
        return;
    }

    await interaction.editReply('That dashboard action is no longer available.');
}

module.exports = {
    ISP_SHIFT_DASHBOARD_DATABASE,
    ISP_SHIFT_DASHBOARD_PREFIX,
    createIspShiftDashboardPayload,
    fetchStoredIspShiftDashboardMessage,
    getStoredIspShiftDashboard,
    handleIspShiftDashboardInteraction,
    refreshIspShiftDashboard,
    removeStoredIspShiftDashboard,
    saveIspShiftDashboard,
};
