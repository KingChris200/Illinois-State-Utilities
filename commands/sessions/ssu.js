const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    AttachmentBuilder,
    MessageFlags,
} = require('discord.js');

const path = require('path');
const fs = require('fs');

const sessionManager = require('../../utils/sessionManager');
const {
    announceSessionEvent,
} = require('../../services/sessionErlcAutomation');
const sessionAutomationConfig = require(
    '../../config/sessionAutomation'
);
const {
    saveSessionState,
} = require('../../services/sessionStateStore');
const {
    fetchSessionChannel,
} = require('../../utils/sessionChannel');

/*
 * ==========================================
 * ISRP SESSION CONFIGURATION
 * ==========================================
 */

const JOIN_CODE =
    'ILLINOISrp';

/*
 * ==========================================
 * SESSION PING ROLE
 * ==========================================
 *
 * Official Illinois State Roleplay Session Ping role.
 * The startup announcement also intentionally uses @here.
 */

const SESSION_PING_ROLE_ID =
    sessionAutomationConfig.pingRoleId;

/*
 * ==========================================
 * SESSION BANNER
 * ==========================================
 *
 * Required file location:
 *
 * assets/
 * └── thumbnails/
 *     └── sessions-banner-v3.png
 */

const SESSION_BANNER_NAME =
    'sessions-banner-v3.png';

const SESSION_BANNER_PATH = path.join(
    __dirname,
    '../../assets/thumbnails/sessions-banner-v3.png'
);

/*
 * ==========================================
 * SSU COMMAND
 * ==========================================
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription('Start a server vote.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .setDMPermission(false),

    async execute(interaction) {
        /*
         * ==========================================
         * SERVER-ONLY CHECK
         * ==========================================
         */

        if (!interaction.inGuild()) {
            return interaction.reply({
                content:
                    '❌ This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * ==========================================
         * ACTIVE VOTE CHECK
         * ==========================================
         */

        if (sessionManager.hasActiveVote()) {
            return interaction.reply({
                content:
                    '❌ A server vote is already active. Please allow it to finish before beginning another.',
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * ==========================================
         * ACTIVE SESSION CHECK
         * ==========================================
         */

        if (sessionManager.hasActiveSession()) {
            return interaction.reply({
                content:
                    '❌ A session is already active. Run `/ssd` before beginning another startup.',
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * ==========================================
         * BANNER FILE CHECK
         * ==========================================
         */

        if (!fs.existsSync(SESSION_BANNER_PATH)) {
            console.error(
                '❌ The Sessions banner was not found at:',
                SESSION_BANNER_PATH
            );

            return interaction.reply({
                content:
                    '❌ The Sessions banner could not be found.\n\n' +
                    'Make sure the real image is located here:\n' +
                    '`assets/thumbnails/sessions-banner-v3.png`',
                flags: MessageFlags.Ephemeral,
            });
        }

        /*
         * ==========================================
         * COMMAND OPTIONS
         * ==========================================
         */

        const goal = sessionAutomationConfig.voteGoal;
        const durationMinutes =
            sessionAutomationConfig.voteDurationMinutes;
        const roleplayZone = 'Statewide';
        const notes = null;

        const startedAt =
            Date.now();

        const endsAt =
            startedAt +
            durationMinutes * 60 * 1000;

        const endsTimestamp =
            Math.floor(endsAt / 1000);

        /*
         * ==========================================
         * SERVER ICON
         * ==========================================
         */


        /*
         * ==========================================
         * SESSION BANNER ATTACHMENT
         * ==========================================
         */

        const sessionBanner =
            new AttachmentBuilder(
                SESSION_BANNER_PATH,
                {
                    name:
                        SESSION_BANNER_NAME,
                }
            );

        /*
         * ==========================================
         * INITIAL PROGRESS BAR
         * ==========================================
         */

        const progressBar =
            createProgressBar(
                0,
                goal
            );

        /*
         * ==========================================
         * SERVER VOTE EMBED
         * ==========================================
         */

        const voteEmbed =
            new EmbedBuilder()
                .setColor('#24589B')
                .setImage(
                    `attachment://${SESSION_BANNER_NAME}`
                )
                .setTitle('Server Vote')
                .setDescription(
                    [
                        'Would you join a session right now?',
                        '',
                        `**Code:** \`${JOIN_CODE}\``,
                        `**Host:** ${interaction.user.username}`,
                        `**Area:** ${roleplayZone}`,
                        `**Votes:** 0/${goal}`,
                        progressBar,
                        `**Ends:** <t:${endsTimestamp}:R>`,
                        ...(notes ? ['', notes] : []),
                    ].join('\n')
                )
                .setFooter({
                    text: 'Vote only if you plan to join',
                })
                .setTimestamp();

        /*
         * ==========================================
         * SERVER VOTE BUTTONS
         * ==========================================
         *
         * This is exactly where the three-button
         * section belongs.
         */

        const voteButtons =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            'ssu_attending'
                        )
                        .setLabel(
                            'Attending'
                        )
                        .setEmoji('✅')
                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            'ssu_not_attending'
                        )
                        .setLabel(
                            "Can't Attend"
                        )
                        .setEmoji('❌')
                        .setStyle(
                            ButtonStyle.Secondary
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            'ssu_view_votes'
                        )
                        .setLabel(
                            'View Votes'
                        )
                        .setEmoji('👥')
                        .setStyle(
                            ButtonStyle.Primary
                        )
                );

        /*
         * Defer the command response while the
         * public vote message is being sent.
         */

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        try {
            const destinationChannel =
                await fetchSessionChannel(interaction);

            if (!destinationChannel) {
                return interaction.editReply({
                    content:
                        `❌ The Sessions channel <#${sessionAutomationConfig.channelId}> is unavailable.`,
                });
            }

            /*
             * ==========================================
             * SEND SERVER VOTE
             * ==========================================
             */

            const voteMessage =
                await destinationChannel.send({
                    content:
                        `<@&${SESSION_PING_ROLE_ID}> @here`,

                    files: [
                        sessionBanner,
                    ],

                    embeds: [
                        voteEmbed,
                    ],

                    components: [
                        voteButtons,
                    ],

                    allowedMentions: {
                        roles: [
                            SESSION_PING_ROLE_ID,
                        ],
                        users: [],
                        parse: [
                            'everyone',
                        ],
                    },
                });

            /*
             * ==========================================
             * SAVE ACTIVE VOTE
             * ==========================================
             */

            sessionManager.createVote({
                guildId:
                    interaction.guild.id,

                channelId:
                    destinationChannel.id,

                messageId:
                    voteMessage.id,

                hostId:
                    interaction.user.id,

                hostUsername:
                    interaction.user.username,

                goal,

                roleplayZone,

                notes,

                startedAt,

                endsAt,
            });

            await saveSessionState();

            await announceSessionEvent('vote_started', {
                sourceChannelId: destinationChannel.id,
                hostUsername: interaction.user.username,
                voteGoal: goal,
                roleplayZone,
                notes,
            });

            /*
             * Confirm privately that the command
             * successfully started.
             */

            await interaction.editReply({
                content:
                    `✅ Server vote posted in ${destinationChannel}.\n` +
                    `Goal: **${goal}** • Duration: **${durationMinutes} minute${
                        durationMinutes === 1
                            ? ''
                            : 's'
                    }**`,
            });

            console.log(
                `🗳️ Server vote started by ${interaction.user.username}.`
            );

            console.log(
                `📊 Vote goal: ${goal}`
            );

            console.log(
                `⏰ Vote duration: ${durationMinutes} minute(s)`
            );

            console.log(
                `🖼️ Session banner: ${SESSION_BANNER_PATH}`
            );

            /*
             * ==========================================
             * AUTOMATIC VOTE EXPIRATION
             * ==========================================
             */

            setTimeout(async () => {
                const activeVote =
                    sessionManager.getVote();

                /*
                 * Stop if the vote no longer exists,
                 * another vote replaced it, or the
                 * session already started.
                 */

                if (
                    !activeVote ||
                    activeVote.messageId !==
                        voteMessage.id ||
                    activeVote.completed
                ) {
                    return;
                }

                const attendingCount =
                    sessionManager
                        .getAttendingCount();

                const expiredProgressBar =
                    createProgressBar(
                        attendingCount,
                        goal
                    );

                /*
                 * Build the expired vote embed while
                 * preserving the attached banner.
                 */

                const expiredEmbed =
                    new EmbedBuilder()
                        .setColor(
                            '#A83A3A'
                        )
                        .setImage(
                            `attachment://${SESSION_BANNER_NAME}`
                        )
                        .setTitle('Vote Ended')
                        .setDescription(
                            [
                                'The vote ended before it reached the goal.',
                                '',
                                `**Host:** ${interaction.user.username}`,
                                `**Votes:** ${attendingCount}/${goal}`,
                                expiredProgressBar,
                            ].join('\n')
                        )
                        .setFooter({
                            text: 'Illinois State Roleplay',
                        })
                        .setTimestamp();

                /*
                 * Disable every vote button.
                 */

                const disabledButtons =
                    createDisabledVoteButtons();

                try {
                    await voteMessage.edit({
                        embeds: [
                            expiredEmbed,
                        ],

                        components: [
                            disabledButtons,
                        ],
                    });
                } catch (error) {
                    console.error(
                        '❌ Could not update the expired server vote:',
                        error
                    );
                }

                sessionManager.clearVote();
                await saveSessionState();

                console.log(
                    '⌛ Server vote expired before reaching its goal.'
                );
            }, durationMinutes * 60 * 1000);
        } catch (error) {
            console.error(
                '❌ Error while creating the server vote:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ I could not create the server vote.\n\n' +
                    'Please make sure I have permission to:\n' +
                    '• View the channel\n' +
                    '• Send messages\n' +
                    '• Embed links\n' +
                    '• Attach files\n' +
                    '• Mention the Bot Tester role',
            });
        }
    },
};

/*
 * ==========================================
 * DISABLED VOTE BUTTONS
 * ==========================================
 */

function createDisabledVoteButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    'ssu_attending_closed'
                )
                .setLabel(
                    'Attending'
                )
                .setEmoji('✅')
                .setStyle(
                    ButtonStyle.Success
                )
                .setDisabled(true),

            new ButtonBuilder()
                .setCustomId(
                    'ssu_not_attending_closed'
                )
                .setLabel(
                    "Can't Attend"
                )
                .setEmoji('❌')
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(true),

            new ButtonBuilder()
                .setCustomId(
                    'ssu_view_votes_closed'
                )
                .setLabel(
                    'View Votes'
                )
                .setEmoji('👥')
                .setStyle(
                    ButtonStyle.Primary
                )
                .setDisabled(true)
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

    const percentage =
        Math.min(
            current / safeGoal,
            1
        );

    const filledBlocks =
        Math.round(
            percentage *
                totalBlocks
        );

    const emptyBlocks =
        totalBlocks -
        filledBlocks;

    return (
        '▰'.repeat(
            filledBlocks
        ) +
        '▱'.repeat(
            emptyBlocks
        )
    );
}
