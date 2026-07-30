const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const sessionManager = require('../utils/sessionManager');

const SERVER_CODE = 'ILLINOISrp';
const SERVER_NAME = 'Illinois State Roleplay | Strict';

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        /*
         * ==========================================
         * SLASH COMMAND HANDLER
         * ==========================================
         */

        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(
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

                const errorMessage =
                    '❌ An unexpected error occurred while running this command.';

                if (interaction.replied || interaction.deferred) {
                    await interaction
                        .followUp({
                            content: errorMessage,
                            ephemeral: true,
                        })
                        .catch(() => null);
                } else {
                    await interaction
                        .reply({
                            content: errorMessage,
                            ephemeral: true,
                        })
                        .catch(() => null);
                }
            }

            return;
        }

        /*
         * ==========================================
         * BUTTON HANDLER
         * ==========================================
         */

        if (!interaction.isButton()) {
            return;
        }

        const validVoteButtons = [
            'ssu_attending',
            'ssu_not_attending',
        ];

        if (!validVoteButtons.includes(interaction.customId)) {
            return;
        }

        const activeVote = sessionManager.getVote();

        /*
         * Make sure the vote still exists.
         */

        if (!activeVote || activeVote.status !== 'voting') {
            return interaction.reply({
                content:
                    '❌ This server vote is no longer active.',
                ephemeral: true,
            });
        }

        /*
         * Make sure the button belongs to the active vote.
         */

        if (
            interaction.guildId !== activeVote.guildId ||
            interaction.channelId !== activeVote.channelId ||
            interaction.message.id !== activeVote.messageId
        ) {
            return interaction.reply({
                content:
                    '❌ These buttons belong to an old server vote.',
                ephemeral: true,
            });
        }

        /*
         * Check whether voting has expired.
         */

        if (Date.now() >= activeVote.endsAt) {
            sessionManager.completeVote();

            const expiredButtons =
                createDisabledVoteButtons();

            const expiredEmbed =
                createVoteEmbed({
                    interaction,
                    vote: activeVote,
                    status: 'expired',
                });

            await interaction.message
                .edit({
                    embeds: [expiredEmbed],
                    components: [expiredButtons],
                })
                .catch(console.error);

            sessionManager.clearVote();

            return interaction.reply({
                content:
                    '❌ This server vote has expired.',
                ephemeral: true,
            });
        }

        /*
         * Record the member's selection.
         */

        const choice =
            interaction.customId === 'ssu_attending'
                ? 'attending'
                : 'not_attending';

        sessionManager.setVote(
            interaction.user.id,
            choice
        );

        const updatedVote = sessionManager.getVote();
        const attendingCount =
            sessionManager.getAttendingCount();

        /*
         * Tell the member their vote was recorded.
         */

        await interaction.deferUpdate();

        /*
         * If the vote goal has not been reached,
         * update the live vote counter.
         */

        if (!sessionManager.hasReachedGoal()) {
            const updatedEmbed =
                createVoteEmbed({
                    interaction,
                    vote: updatedVote,
                    status: 'voting',
                });

            await interaction.message.edit({
                embeds: [updatedEmbed],
            });

            return;
        }

        /*
         * ==========================================
         * VOTE GOAL REACHED
         * ==========================================
         */

        sessionManager.completeVote();

        const attendingMemberIds =
            sessionManager.getAttendingMembers();

        const completedEmbed =
            createVoteEmbed({
                interaction,
                vote: updatedVote,
                status: 'completed',
            });

        const disabledButtons =
            createDisabledVoteButtons();

        await interaction.message.edit({
            embeds: [completedEmbed],
            components: [disabledButtons],
        });

        /*
         * Build the automatic SSU embed.
         */

        const guildIcon =
            interaction.guild.iconURL({
                extension: 'png',
                size: 256,
            }) ?? null;

        const sessionStartedAt = Date.now();
        const sessionStartedTimestamp = Math.floor(
            sessionStartedAt / 1000
        );

        const hostMention =
            `<@${updatedVote.hostId}>`;

        const startupEmbed = new EmbedBuilder()
            .setColor('#2B6CB0')
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
                    name: '🎮 Server Code',
                    value: `\`${SERVER_CODE}\``,
                    inline: true,
                },
                {
                    name: '👤 Hosted By',
                    value: hostMention,
                    inline: true,
                },
                {
                    name: '📊 Confirmed Attendance',
                    value: `\`${attendingCount} members\``,
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
                        `<t:${sessionStartedTimestamp}:F>\n` +
                        `<t:${sessionStartedTimestamp}:R>`,
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

        /*
         * Ping everyone who selected Attending.
         *
         * Discord has a 2,000-character message limit,
         * so the mention list is safely shortened if needed.
         */

        const attendeeMentions =
            attendingMemberIds
                .map(userId => `<@${userId}>`)
                .join(' ');

        const safeMentionContent =
            attendeeMentions.length <= 1900
                ? attendeeMentions
                : attendeeMentions.slice(0, 1900);

        const startupMessage =
            await interaction.channel.send({
                content:
                    safeMentionContent ||
                    'The session is now online!',
                embeds: [startupEmbed],
                allowedMentions: {
                    users: attendingMemberIds,
                    roles: [],
                    parse: [],
                },
            });

        /*
         * Store the active session for /ssd.
         */

        sessionManager.startSession({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            hostId: updatedVote.hostId,
            startupMessageId: startupMessage.id,
            attendeeIds: attendingMemberIds,
            startedAt: sessionStartedAt,
        });

        /*
         * The active vote is no longer needed.
         */

        sessionManager.clearVote();

        console.log(
            `✅ Illinois State Roleplay session started with ${attendingCount} confirmed attendees.`
        );
    },
};

/*
 * ==========================================
 * VOTE EMBED BUILDER
 * ==========================================
 */

function createVoteEmbed({
    interaction,
    vote,
    status,
}) {
    const guildIcon =
        interaction.guild.iconURL({
            extension: 'png',
            size: 256,
        }) ?? null;

    const attendingCount =
        vote.attending?.size ?? 0;

    const notAttendingCount =
        vote.notAttending?.size ?? 0;

    const voteEndsTimestamp =
        Math.floor(vote.endsAt / 1000);

    let embedColor = '#1E3A5F';
    let title = '🗳️ Server Vote';
    let statusName = '🟡 Status';
    let statusValue = '`Waiting for Votes`';

    if (status === 'completed') {
        embedColor = '#2F855A';
        title = '✅ Server Vote Complete';
        statusName = '🟢 Status';
        statusValue = '`Goal Reached`';
    }

    if (status === 'expired') {
        embedColor = '#C53030';
        title = '⌛ Server Vote Expired';
        statusName = '🔴 Status';
        statusValue = '`Vote Closed`';
    }

    const progressBar =
        createProgressBar(
            attendingCount,
            vote.goal
        );

    const description =
        status === 'completed'
            ? [
                  'The required vote goal has been reached.',
                  '',
                  '**The session is starting automatically.**',
                  '',
                  'Thank you to everyone who voted.',
              ].join('\n')
            : status === 'expired'
              ? [
                    'This server vote ended before the required goal was reached.',
                    '',
                    'A new vote may be started later.',
                ].join('\n')
              : [
                    'Illinois State Roleplay is preparing to host a new session.',
                    '',
                    'Select **Attending** below only if you genuinely plan to join.',
                    '',
                    'The session will automatically begin once the required vote goal is reached.',
                ].join('\n');

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
            name: SERVER_NAME,
            iconURL: guildIcon ?? undefined,
        })
        .setTitle(title)
        .setDescription(description)
        .addFields(
            {
                name: '🎮 Server Code',
                value: `\`${SERVER_CODE}\``,
                inline: true,
            },
            {
                name: '👤 Hosted By',
                value: `<@${vote.hostId}>`,
                inline: true,
            },
            {
                name: '📊 Vote Progress',
                value:
                    `\`${attendingCount} / ${vote.goal}\`\n` +
                    `${progressBar}`,
                inline: true,
            },
            {
                name: '✅ Attending',
                value: `\`${attendingCount}\``,
                inline: true,
            },
            {
                name: '❌ Cannot Attend',
                value: `\`${notAttendingCount}\``,
                inline: true,
            },
            {
                name: statusName,
                value: statusValue,
                inline: true,
            }
        )
        .setFooter({
            text:
                `${SERVER_NAME} • Session Management`,
            iconURL: guildIcon ?? undefined,
        })
        .setTimestamp();

    if (status === 'voting') {
        embed.addFields({
            name: '⏰ Voting Ends',
            value:
                `<t:${voteEndsTimestamp}:F>\n` +
                `<t:${voteEndsTimestamp}:R>`,
            inline: false,
        });
    }

    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    return embed;
}

/*
 * ==========================================
 * DISABLED BUTTONS
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

    const percentage =
        Math.min(current / goal, 1);

    const filledBlocks =
        Math.round(percentage * totalBlocks);

    const emptyBlocks =
        totalBlocks - filledBlocks;

    return (
        '█'.repeat(filledBlocks) +
        '░'.repeat(emptyBlocks)
    );
}