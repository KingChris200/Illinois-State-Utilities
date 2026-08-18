const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags,
} = require('discord.js');

const path = require('path');
const fs = require('fs');

const sessionManager = require('../utils/sessionManager');
const {
    handleAutocomplete,
    handleSlashCommand,
} = require('../handlers/commandInteractionHandler');
const {
    routeComponentInteraction,
} = require('../handlers/componentInteractionHandler');
const {
    announceSessionEvent,
} = require('../services/sessionErlcAutomation');
const brands = require('../config/branding');
const {
    startSessionPlayerCountMonitor,
    createSessionDashboardEmbed,
} = require('../services/sessionPlayerCountMonitor');
const {
    saveSessionState,
} = require('../services/sessionStateStore');

/*
 * ==========================================
 * ISRP SESSION CONFIGURATION
 * ==========================================
 */

const SERVER_NAME = 'Illinois State Roleplay | Strict';
const JOIN_CODE = 'ILLINOISrp';

const SESSION_BANNER_NAME = 'sessions-banner-v2.png';

const SESSION_BANNER_PATH = path.join(
    __dirname,
    '../assets/thumbnails/sessions-banner-v2.png'
);

/*
 * ==========================================
 * INTERACTION EVENT
 * ==========================================
 */

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction);
            return;
        }

        /*
         * ==========================================
         * SLASH COMMAND HANDLING
         * ==========================================
         */

        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction);
            return;
        }

        if (
            await routeComponentInteraction(interaction)
        ) {
            return;
        }

        if (!interaction.isButton()) {
            return;
        }

        /*
         * ==========================================
         * SERVER VOTE BUTTON ROUTING
         * ==========================================
         */

        switch (interaction.customId) {
            case 'ssu_attending':
                await handleAttendanceVote(
                    interaction,
                    'attending'
                );
                return;

            case 'ssu_not_attending':
                await handleAttendanceVote(
                    interaction,
                    'not_attending'
                );
                return;

            case 'ssu_view_votes':
                await handleViewVotes(interaction);
                return;

            case 'ssu_attending_closed':
            case 'ssu_not_attending_closed':
            case 'ssu_view_votes_closed':
                await interaction.reply({
                    content:
                        '❌ This server vote is no longer accepting responses.',
                    flags: MessageFlags.Ephemeral,
                });
                return;

            default:
                return;
        }
    },
};

/*
 * ==========================================
 * ATTENDANCE VOTE HANDLER
 * ==========================================
 */

async function handleAttendanceVote(
    interaction,
    selectedChoice
) {
    const activeVote =
        validateActiveVote(interaction);

    if (!activeVote) {
        return;
    }

    /*
     * Check whether the voting timer has expired.
     */

    if (Date.now() >= activeVote.endsAt) {
        sessionManager.clearVote();
        await saveSessionState();

        await interaction.message
            .edit({
                components: [
                    createDisabledVoteButtons(),
                ],
            })
            .catch(() => null);

        await interaction.reply({
            content:
                '❌ This server vote has expired.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    const previousChoice =
        activeVote.votes.get(
            interaction.user.id
        );

    /*
     * Store or update the member's vote.
     */

    sessionManager.setVote(
        interaction.user.id,
        selectedChoice
    );
    await saveSessionState();

    const attendingCount =
        sessionManager.getAttendingCount();

    const progressBar =
        createProgressBar(
            attendingCount,
            activeVote.goal
        );

    /*
     * Rebuild the vote embed while keeping
     * the Sessions banner attached.
     */

    const voteEmbed =
        createVoteEmbed({
            interaction,
            activeVote,
            attendingCount,
            progressBar,
        });

    try {
        await interaction.message.edit({
            embeds: [voteEmbed],
            components: [
                createActiveVoteButtons(),
            ],
        });
    } catch (error) {
        console.error(
            'Could not update the server vote message:',
            error
        );

        await interaction.reply({
            content:
                '❌ Your vote was recorded, but I could not update the vote message.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    /*
     * Send a private confirmation.
     */

    const confirmationMessage =
        createVoteConfirmation({
            selectedChoice,
            previousChoice,
        });

    await interaction.reply({
        content: confirmationMessage,
        flags: MessageFlags.Ephemeral,
    });

    /*
     * Stop here if the goal has not been reached.
     */

    if (!sessionManager.hasReachedGoal()) {
        return;
    }

    /*
     * Prevent nearly simultaneous button presses
     * from posting duplicate startups.
     */

    if (activeVote.completed) {
        return;
    }

    sessionManager.markVoteCompleted();
    await saveSessionState();

    await completeServerVote(
        interaction,
        activeVote
    );
}

/*
 * ==========================================
 * VIEW VOTES HANDLER
 * ==========================================
 */

async function handleViewVotes(interaction) {
    const activeVote =
        validateActiveVote(interaction);

    if (!activeVote) {
        return;
    }

    const attendingMembers = [];
    const notAttendingMembers = [];

    for (const [userId, choice] of activeVote.votes) {
        if (choice === 'attending') {
            attendingMembers.push(userId);
        }

        if (choice === 'not_attending') {
            notAttendingMembers.push(userId);
        }
    }

    const attendingList =
        formatVoteMemberList(
            attendingMembers,
            'No members have voted Attending.'
        );

    const notAttendingList =
        formatVoteMemberList(
            notAttendingMembers,
            'No members have selected Can’t Attend.'
        );

    const totalVotes =
        attendingMembers.length +
        notAttendingMembers.length;

    const votesEmbed = new EmbedBuilder()
        .setColor('#24589B')
        .setTitle(
            `👥 Current Votes (${totalVotes})`
        )
        .setDescription(
            [
                `Vote goal: **${activeVote.goal} attending member${
                    activeVote.goal === 1 ? '' : 's'
                }**`,
                '',
                'Votes shown here update whenever a member changes their response.',
            ].join('\n')
        )
        .addFields(
            {
                name:
                    `✅ Attending — ${attendingMembers.length}`,
                value: attendingList,
                inline: false,
            },
            {
                name:
                    `❌ Can’t Attend — ${notAttendingMembers.length}`,
                value: notAttendingList,
                inline: false,
            }
        )
        .setFooter({
            text:
                `${SERVER_NAME} • Private Vote Information`,
        })
        .setTimestamp();

    await interaction.reply({
        embeds: [votesEmbed],
        flags: MessageFlags.Ephemeral,
    });
}

/*
 * ==========================================
 * ACTIVE VOTE VALIDATION
 * ==========================================
 */

function validateActiveVote(interaction) {
    const activeVote =
        sessionManager.getVote();

    if (!activeVote) {
        interaction
            .reply({
                content:
                    '❌ This server vote is no longer active.',
                flags: MessageFlags.Ephemeral,
            })
            .catch(() => null);

        return null;
    }

    const isCorrectVoteMessage =
        interaction.guildId ===
            activeVote.guildId &&
        interaction.channelId ===
            activeVote.channelId &&
        interaction.message.id ===
            activeVote.messageId;

    if (!isCorrectVoteMessage) {
        interaction
            .reply({
                content:
                    '❌ This button does not belong to the currently active server vote.',
                flags: MessageFlags.Ephemeral,
            })
            .catch(() => null);

        return null;
    }

    return activeVote;
}

/*
 * ==========================================
 * COMPLETE SERVER VOTE
 * ==========================================
 */

async function completeServerVote(
    interaction,
    activeVote
) {
    const attendeeIds =
        sessionManager.getAttendingMembers();

    const attendeeCount =
        attendeeIds.length;

    const completedVoteEmbed =
        createCompletedVoteEmbed({
            interaction,
            activeVote,
            attendeeCount,
        });

    /*
     * Turn off the original vote buttons.
     */

    try {
        await interaction.message.edit({
            embeds: [completedVoteEmbed],
            components: [
                createDisabledVoteButtons(),
            ],
        });
    } catch (error) {
        console.error(
            'Could not mark the server vote as completed:',
            error
        );
    }

    const startupEmbed =
        createStartupEmbed({
            interaction,
            activeVote,
            attendeeCount,
        });

    const attendanceNotification =
        createAttendanceNotification(
            attendeeIds
        );

    /*
     * Discord requires real mentions in message
     * content for notifications to occur.
     */

    const usersToMention =
        attendeeCount <= 20
            ? attendeeIds
            : [];

    const startupMessagePayload = {
        content: attendanceNotification,
        embeds: [
            startupEmbed,
            createSessionDashboardEmbed({
                guildIcon:
                    getGuildIcon(interaction),
            }),
        ],

        allowedMentions: {
            users: usersToMention,
            roles: [],
            parse: [],
        },
    };

    /*
     * The startup message is a brand-new Discord
     * message, so the banner must be attached again.
     */

    if (fs.existsSync(SESSION_BANNER_PATH)) {
        startupMessagePayload.files = [
            createSessionBannerAttachment(),
        ];
    } else {
        console.error(
            'The Sessions banner could not be attached to the startup message:',
            SESSION_BANNER_PATH
        );
    }

    try {
        const startupMessage =
            await interaction.channel.send(
                startupMessagePayload
            );

        sessionManager.startSession({
            guildId: activeVote.guildId,
            channelId: activeVote.channelId,
            hostId: activeVote.hostId,
            hostUsername:
                activeVote.hostUsername,
            startupMessageId:
                startupMessage.id,
            attendeeIds,
            roleplayZone:
                activeVote.roleplayZone,
            notes: activeVote.notes,
            startedAt: Date.now(),
        });

        startSessionPlayerCountMonitor({
            client: interaction.client,
            guildId: activeVote.guildId,
            channelId: activeVote.channelId,
            messageId: startupMessage.id,
        });

        sessionManager.clearVote();
        await saveSessionState();

        await announceSessionEvent(
            'session_started',
            {
                sourceChannelId:
                    activeVote.channelId,
                hostUsername:
                    activeVote.hostUsername,
                attendeeCount,
                roleplayZone:
                    activeVote.roleplayZone,
                notes: activeVote.notes,
            }
        );

        console.log(
            `🚓 Session automatically started with ${attendeeCount} confirmed attendee(s).`
        );
    } catch (error) {
        console.error(
            'Error while posting automatic server startup:',
            error
        );

        /*
         * Allow the startup to be attempted again
         * if Discord rejected the message.
         */

        activeVote.completed = false;
        await saveSessionState();

        await interaction.channel
            .send({
                content:
                    '❌ The vote goal was reached, but I could not post the Server Startup. Please check my channel permissions.',
            })
            .catch(() => null);
    }
}

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
        getGuildIcon(interaction);

    const endsTimestamp = Math.floor(
        activeVote.endsAt / 1000
    );

    const voteEmbed = new EmbedBuilder()
        .setColor('#24589B')
        .setAuthor({
            name: SERVER_NAME,
            iconURL:
                guildIcon ?? undefined,
        })
        .setImage(
            `attachment://${SESSION_BANNER_NAME}`
        )
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
                value:
                    '`Waiting for Votes`',
                inline: true,
            }
        )
        .setFooter({
            text:
                `${SERVER_NAME} • Session Management`,
            iconURL:
                guildIcon ?? undefined,
        })
        .setTimestamp();

    if (guildIcon) {
        voteEmbed.setThumbnail(guildIcon);
    }

    addSessionDetails(voteEmbed, activeVote);

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
        getGuildIcon(interaction);

    const completedTimestamp =
        Math.floor(Date.now() / 1000);

    const completedEmbed =
        new EmbedBuilder()
            .setColor('#3A8D48')
            .setAuthor({
                name: SERVER_NAME,
                iconURL:
                    guildIcon ?? undefined,
            })
            .setImage(
                `attachment://${SESSION_BANNER_NAME}`
            )
            .setTitle(
                '✅ Server Vote Completed'
            )
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
                    value:
                        `\`${JOIN_CODE}\``,
                    inline: true,
                },
                {
                    name: '👤 Hosted By',
                    value:
                        `\`${activeVote.hostUsername}\``,
                    inline: true,
                },
                {
                    name:
                        '📊 Final Attendance',
                    value:
                        `\`${attendeeCount} member${
                            attendeeCount === 1
                                ? ''
                                : 's'
                        }\``,
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
                iconURL:
                    guildIcon ?? undefined,
            })
            .setTimestamp();

    if (guildIcon) {
        completedEmbed.setThumbnail(
            guildIcon
        );
    }

    addSessionDetails(
        completedEmbed,
        activeVote
    );

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
        getGuildIcon(interaction);

    const startedTimestamp =
        Math.floor(Date.now() / 1000);

    const startupEmbed =
        new EmbedBuilder()
            .setColor('#2D6FA7')
            .setAuthor({
                name: SERVER_NAME,
                iconURL:
                    guildIcon ?? undefined,
            })
            .setImage(
                `attachment://${SESSION_BANNER_NAME}`
            )
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
                    value:
                        `\`${JOIN_CODE}\``,
                    inline: true,
                },
                {
                    name: '👤 Hosted By',
                    value:
                        `\`${activeVote.hostUsername}\``,
                    inline: true,
                },
                {
                    name:
                        '📊 Confirmed Attendance',
                    value:
                        `\`${attendeeCount} member${
                            attendeeCount === 1
                                ? ''
                                : 's'
                        }\``,
                    inline: true,
                },
                {
                    name: '🟢 Status',
                    value: '`Online`',
                    inline: true,
                },
                {
                    name:
                        '⏰ Session Started',
                    value:
                        `<t:${startedTimestamp}:F>\n` +
                        `<t:${startedTimestamp}:R>`,
                    inline: true,
                }
            )
            .setFooter({
                text:
                    `${SERVER_NAME} • Session Management`,
                iconURL:
                    guildIcon ?? undefined,
            })
            .setTimestamp();

    if (guildIcon) {
        startupEmbed.setThumbnail(
            guildIcon
        );
    }

    addSessionDetails(
        startupEmbed,
        activeVote
    );

    return startupEmbed;
}

function addSessionDetails(embed, session) {
    embed.addFields({
        name: '🗺️ Roleplay Zone',
        value: session.roleplayZone ?? 'Statewide',
        inline: true,
    });

    if (session.notes) {
        embed.addFields({
            name: '📝 Session Notes',
            value: session.notes,
        });
    }

    return embed;
}

/*
 * ==========================================
 * ACTIVE BUTTONS
 * ==========================================
 */

function createActiveVoteButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ssu_attending')
            .setLabel('Attending')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(
                'ssu_not_attending'
            )
            .setLabel("Can't Attend")
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('ssu_view_votes')
            .setLabel('View Votes')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary)
    );
}

/*
 * ==========================================
 * DISABLED BUTTONS
 * ==========================================
 */

function createDisabledVoteButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(
                'ssu_attending_closed'
            )
            .setLabel('Attending')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId(
                'ssu_not_attending_closed'
            )
            .setLabel("Can't Attend")
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId(
                'ssu_view_votes_closed'
            )
            .setLabel('View Votes')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );
}

/*
 * ==========================================
 * VOTE CONFIRMATION
 * ==========================================
 */

function createVoteConfirmation({
    selectedChoice,
    previousChoice,
}) {
    if (selectedChoice === 'attending') {
        if (
            previousChoice === 'attending'
        ) {
            return (
                '✅ You are already confirmed as ' +
                '**Attending**.'
            );
        }

        if (
            previousChoice ===
            'not_attending'
        ) {
            return (
                '✅ Your response was changed to ' +
                '**Attending**.'
            );
        }

        return (
            '✅ **You’re confirmed!** You will be included ' +
            'in the startup attendance notification.'
        );
    }

    if (
        previousChoice ===
        'not_attending'
    ) {
        return (
            '❌ Your response is already set to ' +
            '**Can’t Attend**.'
        );
    }

    if (
        previousChoice === 'attending'
    ) {
        return (
            '❌ Your response was changed to ' +
            '**Can’t Attend**.'
        );
    }

    return (
        '❌ Your response was recorded. You will not be ' +
        'included in the startup attendance notification.'
    );
}

/*
 * ==========================================
 * ATTENDANCE NOTIFICATION
 * ==========================================
 */

function createAttendanceNotification(
    attendeeIds
) {
    const attendeeCount =
        attendeeIds.length;

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
                .map(
                    (userId) =>
                        `<@${userId}>`
                )
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
                .map(
                    (userId) =>
                        `<@${userId}>`
                )
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
 * VOTE MEMBER LIST
 * ==========================================
 */

function formatVoteMemberList(
    memberIds,
    emptyMessage
) {
    if (memberIds.length === 0) {
        return `*${emptyMessage}*`;
    }

    /*
     * Prevent the embed field from becoming
     * excessively large.
     */

    const visibleMemberIds =
        memberIds.slice(0, 40);

    const memberList =
        visibleMemberIds
            .map(
                (userId, index) =>
                    `${index + 1}. <@${userId}>`
            )
            .join('\n');

    if (memberIds.length <= 40) {
        return memberList;
    }

    return (
        memberList +
        `\n\n*...and ${
            memberIds.length - 40
        } more.*`
    );
}

/*
 * ==========================================
 * PROGRESS BAR
 * ==========================================
 */

function createProgressBar(
    current,
    goal
) {
    const totalBlocks = 10;

    const safeGoal =
        Math.max(goal, 1);

    const percentage = Math.min(
        current / safeGoal,
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

/*
 * ==========================================
 * SESSION BANNER ATTACHMENT
 * ==========================================
 */

function createSessionBannerAttachment() {
    return new AttachmentBuilder(
        SESSION_BANNER_PATH,
        {
            name: SESSION_BANNER_NAME,
        }
    );
}

/*
 * ==========================================
 * GUILD ICON
 * ==========================================
 */

function getGuildIcon(interaction) {
    return brands.assets.logo;
}
