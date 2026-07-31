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
const sessionManager = require('../../utils/sessionManager');

const SERVER_NAME = 'Illinois State Roleplay | Strict';
const JOIN_CODE = 'ILLINOISrp';

/*
 * ==========================================
 * SESSION PING ROLE
 * ==========================================
 *
 * This role is pinged whenever a new Server Vote
 * begins using /ssu.
 *
 * Current testing role:
 * • Bot Tester
 *
 * Once testing has been completed, replace this
 * role ID with the official Session Ping role.
 */

const SESSION_PING_ROLE_ID = '1532533275745062932';

/*
 * ==========================================
 * SESSION BANNER
 * ==========================================
 *
 * Image location:
 * assets/thumbnails/session-started.png
 */

const SESSION_BANNER_PATH = path.join(
    __dirname,
    '../../assets/thumbnails/session-started.png'
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription(
            'Begin an automated server vote and startup.'
        )
        .addIntegerOption((option) =>
            option
                .setName('goal')
                .setDescription(
                    'Number of attending votes required.'
                )
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)
        )
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
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content:
                    '❌ This command can only be used inside a server.',
                ephemeral: true,
            });
        }

        if (
            !SESSION_PING_ROLE_ID ||
            SESSION_PING_ROLE_ID ===
                'PUT_YOUR_BOT_TESTER_ROLE_ID_HERE'
        ) {
            return interaction.reply({
                content:
                    '❌ The Session Ping role has not been configured in `ssu.js`.',
                ephemeral: true,
            });
        }

        if (sessionManager.hasActiveVote()) {
            return interaction.reply({
                content:
                    '❌ A server vote is already active. Please allow it to finish before beginning another.',
                ephemeral: true,
            });
        }

        if (sessionManager.hasActiveSession()) {
            return interaction.reply({
                content:
                    '❌ A session is already active. Run `/ssd` before beginning another startup.',
                ephemeral: true,
            });
        }

        const goal =
            interaction.options.getInteger('goal') ?? 10;

        const durationMinutes =
            interaction.options.getInteger('duration') ?? 5;

        const startedAt = Date.now();

        const endsAt =
            startedAt + durationMinutes * 60 * 1000;

        const endsTimestamp = Math.floor(
            endsAt / 1000
        );

        const guildIcon =
            interaction.guild.iconURL({
                extension: 'png',
                size: 256,
            }) ?? null;

        /*
         * Creates the banner attachment.
         *
         * The attachment name must exactly match the filename
         * used in voteEmbed.setImage().
         */

        const sessionBanner = new AttachmentBuilder(
            SESSION_BANNER_PATH,
            {
                name: 'session-started.png',
            }
        );

        const voteEmbed = new EmbedBuilder()
            .setColor('#24589B')
            .setAuthor({
                name: SERVER_NAME,
                iconURL: guildIcon ?? undefined,
            })
            .setImage(
                'attachment://session-started.png'
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
                    value: `\`${interaction.user.username}\``,
                    inline: true,
                },
                {
                    name: '📊 Vote Progress',
                    value: `\`0 / ${goal}\``,
                    inline: true,
                },
                {
                    name: '⏰ Voting Ends',
                    value: `<t:${endsTimestamp}:R>`,
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

        const voteButtons =
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ssu_attending')
                    .setLabel('Attending')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('ssu_not_attending')
                    .setLabel("Can't Attend")
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.deferReply({
            ephemeral: true,
        });

        try {
            const voteMessage =
                await interaction.channel.send({
                    content:
                        `📢 <@&${SESSION_PING_ROLE_ID}> — ` +
                        '**a new server vote has started!**',

                    /*
                     * Uploads the local Sessions banner.
                     */

                    files: [sessionBanner],

                    embeds: [voteEmbed],
                    components: [voteButtons],

                    allowedMentions: {
                        roles: [SESSION_PING_ROLE_ID],
                        users: [],
                        parse: [],
                    },
                });

            sessionManager.createVote({
                guildId: interaction.guild.id,
                channelId: interaction.channel.id,
                messageId: voteMessage.id,
                hostId: interaction.user.id,
                hostUsername:
                    interaction.user.username,
                goal,
                startedAt,
                endsAt,
            });

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

            /*
             * Automatically expires the vote when its timer ends,
             * even if nobody presses another button.
             */

            setTimeout(async () => {
                const activeVote =
                    sessionManager.getVote();

                if (
                    !activeVote ||
                    activeVote.messageId !==
                        voteMessage.id ||
                    activeVote.completed
                ) {
                    return;
                }

                const attendingCount =
                    sessionManager.getAttendingCount();

                const expiredEmbed =
                    EmbedBuilder.from(voteEmbed)
                        .spliceFields(2, 3)
                        .addFields(
                            {
                                name:
                                    '📊 Final Vote Progress',
                                value:
                                    `\`${attendingCount} / ${goal}\``,
                                inline: true,
                            },
                            {
                                name:
                                    '⏰ Voting Ended',
                                value:
                                    `<t:${Math.floor(
                                        Date.now() / 1000
                                    )}:R>`,
                                inline: true,
                            },
                            {
                                name: '🔴 Status',
                                value:
                                    '`Vote Goal Not Reached`',
                                inline: true,
                            }
                        );

                const disabledButtons =
                    createDisabledVoteButtons();

                try {
                    await voteMessage.edit({
                        embeds: [expiredEmbed],
                        components: [
                            disabledButtons,
                        ],
                    });
                } catch (error) {
                    console.error(
                        'Could not update expired server vote:',
                        error
                    );
                }

                sessionManager.clearVote();
            }, durationMinutes * 60 * 1000);
        } catch (error) {
            console.error(
                'Error while creating the server vote:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ I could not create the server vote. Make sure I can view the channel, send messages, mention the role, attach files, use external emojis, and embed links.',
            });
        }
    },
};

function createDisabledVoteButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ssu_attending_closed')
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
            .setDisabled(true)
    );
}