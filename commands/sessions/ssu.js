const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    AttachmentBuilder,
} = require('discord.js');

const path = require('path');
const fs = require('fs');

const sessionManager = require('../../utils/sessionManager');

/*
 * ==========================================
 * ISRP SESSION CONFIGURATION
 * ==========================================
 */

const SERVER_NAME =
    'Illinois State Roleplay | Strict';

const JOIN_CODE =
    'ILLINOISrp';

/*
 * ==========================================
 * SESSION PING ROLE
 * ==========================================
 *
 * This currently uses the Bot Tester role
 * while the Session Startup system is tested.
 *
 * Replace this ID later with the official
 * Session Ping role ID.
 */

const SESSION_PING_ROLE_ID =
    '1532533275745062932';

/*
 * ==========================================
 * SESSION BANNER
 * ==========================================
 *
 * Required file location:
 *
 * assets/
 * └── thumbnails/
 *     └── session-started.png
 */

const SESSION_BANNER_NAME =
    'session-started.png';

const SESSION_BANNER_PATH = path.join(
    __dirname,
    '../../assets/thumbnails/session-started.png'
);

/*
 * ==========================================
 * SSU COMMAND
 * ==========================================
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription(
            'Begin an automated server vote and startup.'
        )

        /*
         * Vote goal option.
         */

        .addIntegerOption((option) =>
            option
                .setName('goal')
                .setDescription(
                    'The number of Attending votes required to begin the session.'
                )
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)
        )

        /*
         * Vote duration option.
         */

        .addIntegerOption((option) =>
            option
                .setName('duration')
                .setDescription(
                    'How many minutes the server vote should remain open.'
                )
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false)
        )

        /*
         * Members need Manage Server permission
         * to use this command.
         */

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

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
                ephemeral: true,
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
                ephemeral: true,
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
                ephemeral: true,
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
                    '`assets/thumbnails/session-started.png`',
                ephemeral: true,
            });
        }

        /*
         * ==========================================
         * COMMAND OPTIONS
         * ==========================================
         */

        const goal =
            interaction.options.getInteger(
                'goal'
            ) ?? 10;

        const durationMinutes =
            interaction.options.getInteger(
                'duration'
            ) ?? 5;

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

        const guildIcon =
            interaction.guild.iconURL({
                extension: 'png',
                size: 256,
            }) ?? null;

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

                .setAuthor({
                    name: SERVER_NAME,
                    iconURL:
                        guildIcon ??
                        undefined,
                })

                .setImage(
                    `attachment://${SESSION_BANNER_NAME}`
                )

                .setTitle(
                    '🗳️ Server Vote'
                )

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
                        name:
                            '🎮 Join Code',
                        value:
                            `\`${JOIN_CODE}\``,
                        inline: true,
                    },
                    {
                        name:
                            '👤 Hosted By',
                        value:
                            `\`${interaction.user.username}\``,
                        inline: true,
                    },
                    {
                        name:
                            '📊 Vote Progress',
                        value:
                            `\`0 / ${goal}\`\n${progressBar}`,
                        inline: true,
                    },
                    {
                        name:
                            '⏰ Voting Ends',
                        value:
                            `<t:${endsTimestamp}:R>`,
                        inline: true,
                    },
                    {
                        name:
                            '🟡 Status',
                        value:
                            '`Waiting for Votes`',
                        inline: true,
                    }
                )

                .setFooter({
                    text:
                        `${SERVER_NAME} • Session Management`,
                    iconURL:
                        guildIcon ??
                        undefined,
                })

                .setTimestamp();

        /*
         * Add the server icon as the thumbnail.
         */

        if (guildIcon) {
            voteEmbed.setThumbnail(
                guildIcon
            );
        }

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
            ephemeral: true,
        });

        try {
            /*
             * ==========================================
             * SEND SERVER VOTE
             * ==========================================
             */

            const voteMessage =
                await interaction.channel.send({
                    content:
                        `📢 <@&${SESSION_PING_ROLE_ID}> — ` +
                        '**a new server vote has started!**',

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
                        parse: [],
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
                    interaction.channel.id,

                messageId:
                    voteMessage.id,

                hostId:
                    interaction.user.id,

                hostUsername:
                    interaction.user.username,

                goal,

                startedAt,

                endsAt,
            });

            /*
             * Confirm privately that the command
             * successfully started.
             */

            await interaction.editReply({
                content:
                    `✅ Server vote successfully started in ${interaction.channel}.\n\n` +
                    `**Vote Goal:** ${goal}\n` +
                    `**Voting Duration:** ${durationMinutes} minute${
                        durationMinutes === 1
                            ? ''
                            : 's'
                    }`,
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

                        .setAuthor({
                            name:
                                SERVER_NAME,
                            iconURL:
                                guildIcon ??
                                undefined,
                        })

                        .setImage(
                            `attachment://${SESSION_BANNER_NAME}`
                        )

                        .setTitle(
                            '⌛ Server Vote Expired'
                        )

                        .setDescription(
                            [
                                'The server vote has ended before the required attendance goal was reached.',
                                '',
                                'A new vote may be started when the community is ready.',
                            ].join('\n')
                        )

                        .addFields(
                            {
                                name:
                                    '🎮 Join Code',
                                value:
                                    `\`${JOIN_CODE}\``,
                                inline: true,
                            },
                            {
                                name:
                                    '👤 Hosted By',
                                value:
                                    `\`${interaction.user.username}\``,
                                inline: true,
                            },
                            {
                                name:
                                    '📊 Final Progress',
                                value:
                                    `\`${attendingCount} / ${goal}\`\n${expiredProgressBar}`,
                                inline: true,
                            },
                            {
                                name:
                                    '🔴 Status',
                                value:
                                    '`Vote Goal Not Reached`',
                                inline: true,
                            },
                            {
                                name:
                                    '🕒 Voting Ended',
                                value:
                                    `<t:${Math.floor(
                                        Date.now() /
                                            1000
                                    )}:R>`,
                                inline: true,
                            }
                        )

                        .setFooter({
                            text:
                                `${SERVER_NAME} • Session Management`,
                            iconURL:
                                guildIcon ??
                                undefined,
                        })

                        .setTimestamp();

                if (guildIcon) {
                    expiredEmbed.setThumbnail(
                        guildIcon
                    );
                }

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