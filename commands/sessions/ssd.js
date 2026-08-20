const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const sessionManager = require('../../utils/sessionManager');
const {
    announceSessionEvent,
} = require('../../services/sessionErlcAutomation');
const {
    refreshPlayerCountMessage,
    startSessionPlayerCountMonitor,
    stopSessionPlayerCountMonitor,
} = require('../../services/sessionPlayerCountMonitor');
const {
    saveSessionState,
} = require('../../services/sessionStateStore');
const {
    saveCompletedSessionAnalytics,
} = require('../../services/sessionAnalyticsService');
const brands = require('../../config/branding');

const SERVER_NAME = 'Illinois State Roleplay | Strict';
const SERVER_CODE = 'ILLINOISrp';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssd')
        .setDescription('End the active Illinois State Roleplay session.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * Prevent an SSD while a server vote is still running.
         */

        if (sessionManager.hasActiveVote()) {
            return interaction.reply({
                content:
                    '❌ A server vote is currently running, but the session has not started yet.',
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * Make sure there is an active session to end.
         */

        if (!sessionManager.hasActiveSession()) {
            return interaction.reply({
                content:
                    '❌ There is no active session to shut down.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        /*
         * Freeze the repeating monitor, then request one final
         * best-effort ER:LC sample for the ending player count.
         * API or message failures never prevent a safe shutdown.
         */

        const activeSession =
            sessionManager.getSession();

        stopSessionPlayerCountMonitor(
            interaction.guildId
        );

        if (
            activeSession?.startupMessageId &&
            activeSession?.channelId
        ) {
            try {
                await refreshPlayerCountMessage({
                    client: interaction.client,
                    guildId: activeSession.guildId,
                    channelId:
                        activeSession.channelId,
                    messageId:
                        activeSession.startupMessageId,
                    persistState: false,
                });
            } catch (error) {
                console.warn(
                    '[SESSION ANALYTICS] Final live sample unavailable:',
                    error.code || error.message
                );
            }
        }

        /*
         * End the session and retrieve its saved information.
         */

        const endedSession = sessionManager.endSession();

        if (!endedSession) {
            return interaction.editReply({
                content:
                    '❌ The session could not be ended because its information was unavailable.',
            });
        }

        const endedAt = endedSession.endedAt ?? Date.now();
        const startedAt = endedSession.startedAt ?? endedAt;

        const sessionDuration = formatDuration(
            endedAt - startedAt
        );

        const startedTimestamp = Math.floor(
            startedAt / 1000
        );

        const endedTimestamp = Math.floor(
            endedAt / 1000
        );

        const guildIcon = brands.assets.logo;

        /*
         * The original session host is shown separately
         * from the person who ran /ssd.
         */

        const sessionHostMention =
            `<@${endedSession.hostId}>`;

        const shutdownByMention =
            `${interaction.user}`;

        const attendeeCount =
            endedSession.attendeeIds?.length ?? 0;

        const shutdownEmbed = new EmbedBuilder()
            .setColor('#8B1E2D')
            .setAuthor({
                name: SERVER_NAME,
                iconURL: guildIcon ?? undefined,
            })
            .setTitle('Server Shutdown')
            .setDescription(
                [
                    'The session has ended. The server is now offline.',
                    'Thanks to everyone who joined.',
                ].join('\n')
            )
            .addFields(
                {
                    name: 'Server Code',
                    value: `\`${SERVER_CODE}\``,
                    inline: true,
                },
                {
                    name: 'Host',
                    value: sessionHostMention,
                    inline: true,
                },
                {
                    name: 'Ended By',
                    value: shutdownByMention,
                    inline: true,
                },
                {
                    name: 'Duration',
                    value: `\`${sessionDuration}\``,
                    inline: true,
                },
                {
                    name: 'Attending',
                    value: `\`${attendeeCount} members\``,
                    inline: true,
                },
                {
                    name: 'Started',
                    value:
                        `<t:${startedTimestamp}:F>\n` +
                        `<t:${startedTimestamp}:R>`,
                    inline: true,
                },
                {
                    name: 'Ended',
                    value:
                        `<t:${endedTimestamp}:F>\n` +
                        `<t:${endedTimestamp}:R>`,
                    inline: true,
                }
            )
            .setFooter({
                text:
                    `${SERVER_NAME} • Session Management`,
                iconURL: guildIcon ?? undefined,
            })
            .setTimestamp();

        if (guildIcon) {
            shutdownEmbed.setThumbnail(guildIcon);
        }

        await saveSessionState();

        shutdownEmbed.addFields({
            name: 'Roleplay Area',
            value:
                endedSession.roleplayZone ??
                'Statewide',
            inline: true,
        });

        if (endedSession.notes) {
            shutdownEmbed.addFields({
                name: 'Notes',
                value: endedSession.notes,
            });
        }

        if (
            Number.isFinite(
                endedSession.livePlayerCount
            )
        ) {
            shutdownEmbed.addFields({
                name: 'Final Player Count',
                value:
                    `\`${endedSession.livePlayerCount} / ${endedSession.maxPlayerCount ?? 40}\` players in-game`,
                inline: true,
            });
        }

        try {
            const shutdownMessage =
                await interaction.channel.send({
                    embeds: [shutdownEmbed],
                });

            try {
                await saveCompletedSessionAnalytics({
                    session: endedSession,
                    endedAt,
                    shutdownById:
                        interaction.user.id,
                    recapMessageId:
                        shutdownMessage.id,
                    recapMessageUrl:
                        shutdownMessage.url,
                });
            } catch (analyticsError) {
                console.error(
                    '[SESSION ANALYTICS] Could not save the completed recap:',
                    analyticsError
                );
            }

            await announceSessionEvent(
                'session_shutdown',
                {
                    sourceChannelId:
                        interaction.channel.id,
                    hostUsername:
                        endedSession.hostUsername,
                    shutdownBy:
                        interaction.user.username,
                    duration: sessionDuration,
                }
            );

            await interaction.editReply({
                content:
                    `✅ Shutdown posted in ${interaction.channel}.\n` +
                    `Duration: **${sessionDuration}** • ${shutdownMessage.url}`,
            });

            console.log(
                `🛑 Illinois State Roleplay session ended by ${interaction.user.tag}. Duration: ${sessionDuration}`
            );
        } catch (error) {
            console.error(
                'Error while posting the server shutdown:',
                error
            );

            /*
             * The active session has already been cleared,
             * so we restore it if sending the embed fails.
             */

            sessionManager.startSession({
                guildId: endedSession.guildId,
                channelId: endedSession.channelId,
                hostId: endedSession.hostId,
                hostUsername:
                    endedSession.hostUsername,
                startupMessageId:
                    endedSession.startupMessageId,
                attendeeIds:
                    endedSession.attendeeIds,
                startedAt:
                    endedSession.startedAt,
                roleplayZone:
                    endedSession.roleplayZone,
                notes: endedSession.notes,
                livePlayerCount:
                    endedSession.livePlayerCount,
                maxPlayerCount:
                    endedSession.maxPlayerCount,
                playerCountUpdatedAt:
                    endedSession.playerCountUpdatedAt,
                analytics:
                    endedSession.analytics,
            });

            startSessionPlayerCountMonitor({
                client: interaction.client,
                guildId: endedSession.guildId,
                channelId: endedSession.channelId,
                messageId:
                    endedSession.startupMessageId,
            });
            await saveSessionState();

            await interaction.editReply({
                content:
                    '❌ I could not post the server shutdown. Make sure I can view the channel, send messages, and embed links.',
            });
        }
    },
};

/*
 * ==========================================
 * SESSION DURATION FORMATTER
 * ==========================================
 */

function formatDuration(durationMilliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.floor(durationMilliseconds / 1000)
    );

    const days = Math.floor(
        totalSeconds / 86400
    );

    const hours = Math.floor(
        (totalSeconds % 86400) / 3600
    );

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds =
        totalSeconds % 60;

    const durationParts = [];

    if (days > 0) {
        durationParts.push(
            `${days} day${days === 1 ? '' : 's'}`
        );
    }

    if (hours > 0) {
        durationParts.push(
            `${hours} hour${hours === 1 ? '' : 's'}`
        );
    }

    if (minutes > 0) {
        durationParts.push(
            `${minutes} minute${minutes === 1 ? '' : 's'}`
        );
    }

    if (
        seconds > 0 ||
        durationParts.length === 0
    ) {
        durationParts.push(
            `${seconds} second${seconds === 1 ? '' : 's'}`
        );
    }

    return durationParts.join(', ');
}
