const {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const brands = require('../config/branding');
const sessionConfig = require('../config/sessionAutomation');
const erlcService = require('../services/erlcService');
const {
    announceSessionEvent,
} = require('../services/sessionErlcAutomation');
const {
    parseSessionDashboardStats,
} = require('../services/sessionPlayerCountMonitor');
const sessionManager = require('./sessionManager');
const { fetchSessionChannel } = require('./sessionChannel');

const SESSION_UPDATE_TYPES = {
    low: {
        color: 0x3498db,
        title: 'Players Needed',
        message: 'We need a few more players to keep the session going.',
        event: 'session_low',
        confirmation: 'Player notice posted',
    },
    full: {
        color: 0x2ecc71,
        title: 'Session Update',
        message: 'The session has enough players now. Thanks for joining!',
        event: 'session_full',
        confirmation: 'Session update posted',
    },
};

function canManageSessions(interaction) {
    return Boolean(
        interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        ) ||
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

async function getAutomatedSessionStats(
    fetchStatus = () => erlcService.getSessionStatus()
) {
    try {
        return parseSessionDashboardStats(await fetchStatus());
    } catch {
        const activeSession = sessionManager.getSession();

        if (!Number.isFinite(activeSession?.livePlayerCount)) {
            return null;
        }

        return {
            currentPlayers: activeSession.livePlayerCount,
            maxPlayers: activeSession.maxPlayerCount || 40,
            staffCount: null,
            queueCount: null,
        };
    }
}

function createSessionUpdateEmbed({ type, stats, username }) {
    const definition = SESSION_UPDATE_TYPES[type];
    const lines = [
        definition.message,
        '',
        '**Code:** `ILLINOISrp`',
    ];

    if (stats) {
        lines.push(
            `**Players:** ${stats.currentPlayers}/${stats.maxPlayers}`
        );
    }

    return new EmbedBuilder()
        .setColor(definition.color)
        .setTitle(definition.title)
        .setDescription(lines.join('\n'))
        .setImage(brands.assets.sessionBanner)
        .setFooter({ text: `Posted by ${username}` })
        .setTimestamp();
}

async function executeSessionAnnouncement(
    interaction,
    type,
    { fetchStatus, fetchChannel = fetchSessionChannel } = {}
) {
    const definition = SESSION_UPDATE_TYPES[type];

    if (!definition) {
        throw new Error(`Unknown session update type: ${type}`);
    }

    if (!interaction.inGuild?.()) {
        return interaction.reply({
            content: '❌ This command can only be used inside a server.',
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!canManageSessions(interaction)) {
        return interaction.reply({
            content:
                '❌ You need the **Manage Server** permission to send session announcements.',
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!sessionManager.hasActiveSession()) {
        return interaction.reply({
            content: '❌ There is no active session to update.',
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const destination = await fetchChannel(interaction);

    if (!destination) {
        return interaction.editReply(
            `❌ The Sessions channel <#${sessionConfig.channelId}> is unavailable.`
        );
    }

    const stats = await getAutomatedSessionStats(fetchStatus);
    const message = await destination.send({
        content: `<@&${sessionConfig.pingRoleId}>`,
        embeds: [
            createSessionUpdateEmbed({
                type,
                stats,
                username: interaction.user.username,
            }),
        ],
        allowedMentions: {
            parse: [],
            users: [],
            roles: [sessionConfig.pingRoleId],
        },
    });

    await announceSessionEvent(definition.event, {
        sourceChannelId: destination.id,
        playerCount: stats?.currentPlayers ?? null,
        hostUsername: interaction.user.username,
    });

    await interaction.editReply(
        `✅ ${definition.confirmation} in ${destination}. ${message.url || ''}`.trim()
    );

    return message;
}

module.exports = {
    SESSION_UPDATE_TYPES,
    canManageSessions,
    createSessionUpdateEmbed,
    executeSessionAnnouncement,
    getAutomatedSessionStats,
};
