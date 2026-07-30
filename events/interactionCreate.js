const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const sessionManager = require('../utils/sessionManager');

const SERVER_NAME = 'Illinois State Roleplay | Strict';
const JOIN_CODE = 'ILLINOISrp';

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        /*
         * ==========================================
         * SLASH COMMANDS
         * ==========================================
         */

        if (interaction.isChatInputCommand()) {
            const command =
                interaction.client.commands.get(
                    interaction.commandName
                );

            if (!command) {
                console.error(
                    `No command matching /${interaction.commandName} was found.`
                );

                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(
                    `Error while executing /${interaction.commandName}:`,
                    error
                );

                const errorMessage = {
                    content:
                        '❌ An unexpected error occurred while running this command.',
                    ephemeral: true,
                };

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {
                    await interaction
                        .followUp(errorMessage)
                        .catch(() => null);
                } else {
                    await interaction
                        .reply(errorMessage)
                        .catch(() => null);
                }
            }

            return;
        }

        /*
         * ==========================================
         * SERVER VOTE BUTTONS
         * ==========================================
         */

        if (!interaction.isButton()) {
            return;
        }

        if (
            interaction.customId !== 'ssu_attending' &&
            interaction.customId !==
                'ssu_not_attending'
        ) {
            return;
        }

        const activeVote = sessionManager.getVote();

        if (!activeVote) {
            return interaction.reply({
                content:
                    '❌ This server vote is no longer active.',
                ephemeral: true,
            });
        }

        if (
            interaction.guildId !== activeVote.guildId ||
            interaction.channelId !==
                activeVote.channelId ||
            interaction.message.id !==
                activeVote.messageId
        ) {
            return interaction.reply({
                content:
                    '❌ This button does not belong to the currently active server vote.',
                ephemeral: true,
            });
        }

        if (Date.now() >= activeVote.endsAt) {
            sessionManager.clearVote();

            await interaction.message
                .edit({
                    components: [
                        createDisabledVoteButtons(),
                    ],
                })
                .catch(() => null);

            return interaction.reply({
                content:
                    '❌ This server vote has expired.',
                ephemeral: true,
            });
        }

        const selectedChoice =
            interaction.customId === 'ssu_attending'
                ? 'attending'
                : 'not_attending';

        const previousChoice =
            activeVote.votes.get(interaction.user.id);

        sessionManager.setVote(
            interaction.user.id,
            selectedChoice
        );

        const attendingCount =
            sessionManager.getAttendingCount();

        const progressBar = createProgressBar(
            attendingCount,
            activeVote.goal
        );

        const voteEmbed = createVoteEmbed({
            interaction,
            activeVote,
            attendingCount,
            progressBar,
        });

        await interaction.message.edit({
            embeds: [voteEmbed],
        });

        /*
         * Show a private confirmation to the voter.
         */

        let confirmationMessage;

        if (selectedChoice === 'attending') {
            confirmationMessage =
                previousChoice === 'attending'
                    ? '✅ You are already confirmed as **Attending**.'
                    : '✅ **You’re confirmed!** You will be included in the startup attendance notification.';
        } else {
            confirmationMessage =
                previousChoice === 'not_attending'
                    ? '❌ Your vote is already set to **Can’t Attend**.'
                    : '❌ Your vote has been updated. You will not be included in the startup attendance notification.';
        }

        await interaction.reply({
            content: confirmationMessage,
            ephemeral: true,
        });

        /*
         * Stop here until the vote goal is reached.
         */

        if (!sessionManager.hasReachedGoal()) {
            return;
        }

        /*
         * Prevent two nearly simultaneous button presses
         * from producing two startup messages.
         */

        if (activeVote.completed) {
            return;
        }

        sessionManager.markVoteCompleted();

        const attendeeIds =
            sessionManager.getAttendingMembers();

        const finalAttendeeCount =
            attendeeIds.length;

        const disabledButtons =
            createDisabledVoteButtons();

        const completedVoteEmbed =
            createCompletedVoteEmbed({
                interaction,
                activeVote,
                attendeeCount: finalAttendeeCount,
            });

        await interaction.message.edit({
            embeds: [completedVoteEmbed],
            components: [disabledButtons],
        });

        const startupEmbed = createStartupEmbed({
            interaction,
            activeVote,
            attendeeCount: finalAttendeeCount,
        });

        const attendanceNotification =
            createAttendanceNotification(
                attendeeIds
            );

        /*
         * Discord limitation:
         *
         * Users must appear as real mentions in the message
         * content to receive a notification. Discord cannot
         * silently ping hidden users through allowedMentions.
         *
         * Therefore:
         * - 1–20 attendees are mentioned.
         * - More than 20 shows a clean attendance count instead
         *   of creating a massive wall of mentions.
         */

        const usersToMention =
            finalAttendeeCount <= 20
                ? attendeeIds
                : [];

        try {
            const startupMessage =
                await interaction.channel.send({
                    content: attendanceNotification,
                    embeds: [startupEmbed],
                    allowedMentions: {
                        users: usersToMention,
                        roles: [],
                        parse: [],
                    },
                });

            sessionManager.startSession({
                guildId: activeVote.guildId,
                channelId: activeVote.channelId,
                hostId: activeVote.hostId,
                hostUsername:
                    activeVote.hostUsername,
                startupMessageId:
                    startupMessage.id,
                attendeeIds,
                startedAt: Date.now(),
            });

            sessionManager.clearVote();

            console.log(
                `🚓 Session automatically started with ${finalAttendeeCount} confirmed attendee(s).`
            );
        } catch (error) {
            console.error(
                'Error while posting automatic server startup:',
                error
            );

            /*
             * Allow another attempt if the message failed.
             */

            activeVote.completed = false;

            await interaction.channel
                .send({
                    content:
                        '❌ The vote goal was reached, but I could not post the Server Startup. Please check my channel permissions.',
                })
                .catch(() => null);
        }
    },
};

/*
 * ==========================================
 * ACTIVE VOTE EMBED
 * ==========================================
 */

function createVoteEmbed({
    interaction,
    activeVote,
    attendingCount,
    progressBar,
}) {
    const guildIcon =
        interaction.guild.iconURL({
            extension: 'png',
            size: 256,
        }) ?? null;

    const endsTimestamp = Math.floor(
        activeVote.endsAt / 1000
    );

    const voteEmbed = new EmbedBuilder()
        .setColor('#24589B')
        .setAuthor({
            name: SERVER_NAME,
            iconURL: guildIcon ?? undefined,
        })
        .setTitle('🗳️ Server Vote')
        .setDescription(
            [
                'Illinois State Roleplay is preparing to host a new session.',
                '',
                'Select **Attending** below only if you genuinely plan to join.',
                '',
                'The session will automatically begin once the required vote goal is reached.',
            ].join('\n')
        )
        .addFields(
            {
                name: '🎮 Join Code',
                value: `\`${JOIN_CODE}\``,
                inline: true,
            },
            {
                name: '👤 Hosted By',
                value:
                    `\`${activeVote.hostUsername}\``,
                inline: true,
            },
            {
                name: '📊 Vote Progress',
                value:
                    `\`${attendingCount} / ${activeVote.goal}\`\n${progressBar}`,
                inline: true,
            },
            {
                name: '⏰ Voting Ends',
                value:
                    `<t:${endsTimestamp}:R>`,
                inline: true,
            },
            {
                name: '🟡 Status',
                value: '`Waiting for Votes`',
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
        voteEmbed.setThumbnail(guildIcon);
    }

    return voteEmbed;
}

/*
 * ==========================================
 * COMPLETED VOTE EMBED
 * ==========================================
 */

function createCompletedVoteEmbed({
    interaction,
    activeVote,
    attendeeCount,
}) {
    const guildIcon =
        interaction.guild.iconURL({
            extension: 'png',
            size: 256,
        }) ?? null;

    const completedTimestamp = Math.floor(
        Date.now() / 1000
    );

    const completedEmbed = new EmbedBuilder()
        .setColor('#3A8D48')
        .setAuthor({
            name: SERVER_NAME,
            iconURL: guildIcon ?? undefined,
        })
        .setTitle('✅ Server Vote Completed')
        .setDescription(
            [
                'The required server-vote goal has been reached.',
                '',
                '**The session startup has been automatically posted.**',
            ].join('\n')
        )
        .addFields(
            {
                name: '🎮 Join Code',
                value: `\`${JOIN_CODE}\``,
                inline: true,
            },
            {
                name: '👤 Hosted By',
                value:
                    `\`${activeVote.hostUsername}\``,
                inline: true,
            },
            {
                name: '📊 Final Attendance',
                value:
                    `\`${attendeeCount} members\``,
                inline: true,
            },
            {
                name: '🟢 Status',
                value: '`Goal Reached`',
                inline: true,
            },
            {
                name: '🕒 Completed',
                value:
                    `<t:${completedTimestamp}:R>`,
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
        completedEmbed.setThumbnail(guildIcon);
    }

    return completedEmbed;
}

/*
 * ==========================================
 * SERVER STARTUP EMBED
 * ==========================================
 */

function createStartupEmbed({
    interaction,
    activeVote,
    attendeeCount,
}) {
    const guildIcon =
        interaction.guild.iconURL({
            extension: 'png',
            size: 256,
        }) ?? null;

    const startedTimestamp = Math.floor(
        Date.now() / 1000
    );

    const startupEmbed = new EmbedBuilder()
        .setColor('#2D6FA7')
        .setAuthor({
            name: SERVER_NAME,
            iconURL: guildIcon ?? undefined,
        })
        .setTitle('🚓 Server Startup')
        .setDescription(
            [
                'The required server-vote goal has been reached.',
                '',
                '**The session is now online and ready for members to join.**',
                '',
                'Please join promptly and prepare for a professional and realistic roleplay session.',
            ].join('\n')
        )
        .addFields(
            {
                name: '🎮 Join Code',
                value: `\`${JOIN_CODE}\``,
                inline: true,
            },
            {
                name: '👤 Hosted By',
                value:
                    `\`${activeVote.hostUsername}\``,
                inline: true,
            },
            {
                name: '📊 Confirmed Attendance',
                value:
                    `\`${attendeeCount} member${attendeeCount === 1 ? '' : 's'}\``,
                inline: true,
            },
            {
                name: '🟢 Status',
                value: '`Online`',
                inline: true,
            },
            {
                name: '⏰ Session Started',
                value:
                    `<t:${startedTimestamp}:F>\n` +
                    `<t:${startedTimestamp}:R>`,
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
        startupEmbed.setThumbnail(guildIcon);
    }

    return startupEmbed;
}

/*
 * ==========================================
 * ATTENDANCE NOTIFICATION
 * ==========================================
 */

function createAttendanceNotification(attendeeIds) {
    const attendeeCount = attendeeIds.length;

    if (attendeeCount === 0) {
        return [
            '🚔 **Session Notification**',
            '',
            'The server is now online.',
        ].join('\n');
    }

    if (attendeeCount <= 10) {
        const attendeeMentions =
            attendeeIds
                .map((userId) => `<@${userId}>`)
                .join('\n');

        return [
            '🚔 **Session Notification**',
            '',
            'The server is now online!',
            '',
            '**Attending Members**',
            attendeeMentions,
        ].join('\n');
    }

    if (attendeeCount <= 20) {
        const attendeeMentions =
            attendeeIds
                .map((userId) => `<@${userId}>`)
                .join(' ');

        return [
            '🚔 **Session Notification**',
            '',
            `**${attendeeCount} members** confirmed attendance.`,
            '',
            attendeeMentions,
        ].join('\n');
    }

    return [
        '🚔 **Session Notification**',
        '',
        `**${attendeeCount} members** confirmed attendance.`,
        '',
        'The server is now online. Have a great patrol!',
    ].join('\n');
}

/*
 * ==========================================
 * BUTTONS
 * ==========================================
 */

function createDisabledVoteButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ssu_attending_closed')
            .setLabel('Attending')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId('ssu_not_attending_closed')
            .setLabel("Can't Attend")
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );
}

/*
 * ==========================================
 * PROGRESS BAR
 * ==========================================
 */

function createProgressBar(current, goal) {
    const totalBlocks = 10;

    const percentage = Math.min(
        current / goal,
        1
    );

    const filledBlocks = Math.round(
        percentage * totalBlocks
    );

    const emptyBlocks =
        totalBlocks - filledBlocks;

    return (
        '▰'.repeat(filledBlocks) +
        '▱'.repeat(emptyBlocks)
    );
}