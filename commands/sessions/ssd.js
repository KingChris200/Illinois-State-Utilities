const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} = require('discord.js');

const sessionManager = require('../../utils/sessionManager');
const {
    announceSessionEvent,
} = require('../../services/sessionErlcAutomation');
const {
    startSessionPlayerCountMonitor,
    stopSessionPlayerCountMonitor,
} = require('../../services/sessionPlayerCountMonitor');
const {
    saveSessionState,
} = require('../../services/sessionStateStore');

const SERVER_NAME = 'Illinois State Roleplay | Strict';
const SERVER_CODE = 'ILLINOISrp';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssd')
        .setDescription('End the active Illinois State Roleplay session.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ This command can only be used inside a server.',
                ephemeral: true,
            });
        }

        /*
         * Prevent an SSD while a server vote is still running.
         */

        if (sessionManager.hasActiveVote()) {
            return interaction.reply({
                content:
                    '❌ A server vote is currently running, but the session has not started yet.',
                ephemeral: true,
            });
        }

        /*
         * Make sure there is an active session to end.
         */

        if (!sessionManager.hasActiveSession()) {
            return interaction.reply({
                content:
                    '❌ There is no active session to shut down.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({
            ephemeral: true,
        });

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

        const guildIcon =
            interaction.guild.iconURL({
                extension: 'png',
                size: 256,
            }) ?? null;

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
            .setTitle('🌙 Server Shutdown')
            .setDescription(
                [
                    'The Illinois State Roleplay session has officially concluded.',
                    '',
                    'Thank you to everyone who attended and participated in today’s session.',
                    '',
                    '**The server is now offline. Please wait for another startup announcement before joining.**',
                ].join('\n')
            )
            .addFields(
                {
                    name: '🎮 Server Code',
                    value: `\`${SERVER_CODE}\``,
                    inline: true,
                },
                {
                    name: '👤 Session Host',
                    value: sessionHostMention,
                    inline: true,
                },
                {
                    name: '🛡️ Shutdown By',
                    value: shutdownByMention,
                    inline: true,
                },
                {
                    name: '⏱️ Session Duration',
                    value: `\`${sessionDuration}\``,
                    inline: true,
                },
                {
                    name: '👥 Confirmed Attendance',
                    value: `\`${attendeeCount} members\``,
                    inline: true,
                },
                {
                    name: '🔴 Status',
                    value: '`Offline`',
                    inline: true,
                },
                {
                    name: '🕒 Session Started',
                    value:
                        `<t:${startedTimestamp}:F>\n` +
                        `<t:${startedTimestamp}:R>`,
                    inline: true,
                },
                {
                    name: '🛑 Session Ended',
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

        stopSessionPlayerCountMonitor(
            interaction.guildId
        );
        await saveSessionState();

        shutdownEmbed.addFields({
            name: '🗺️ Roleplay Zone',
            value:
                endedSession.roleplayZone ??
                'Statewide',
            inline: true,
        });

        if (endedSession.notes) {
            shutdownEmbed.addFields({
                name: '📝 Session Notes',
                value: endedSession.notes,
            });
        }

        if (
            Number.isFinite(
                endedSession.livePlayerCount
            )
        ) {
            shutdownEmbed.addFields({
                name: '🎮 Final Live Player Count',
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
                    `✅ The server shutdown was successfully posted in ${interaction.channel}.\n\n` +
                    `**Session Duration:** ${sessionDuration}\n` +
                    `**Shutdown Message:** ${shutdownMessage.url}`,
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
