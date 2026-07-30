const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');

const sessionManager = require('../../utils/sessionManager');

const SESSION_PING_ROLE_ID = '1377126063926411334';
const SERVER_CODE = 'ILLINOISrp';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription(
            'Start a server vote for an Illinois State Roleplay session.'
        )
        .addIntegerOption(option =>
            option
                .setName('goal')
                .setDescription(
                    'The number of attending votes required to start the session.'
                )
                .setMinValue(1)
                .setMaxValue(50)
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription(
                    'How many minutes the server vote should remain open.'
                )
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ This command can only be used inside a server.',
                ephemeral: true,
            });
        }

        if (sessionManager.hasActiveVote()) {
            return interaction.reply({
                content:
                    '❌ A server vote is already running. Please allow the current vote to finish before starting another one.',
                ephemeral: true,
            });
        }

        if (sessionManager.hasActiveSession()) {
            return interaction.reply({
                content:
                    '❌ A session is already active. Use `/ssd` before starting another session.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({
            ephemeral: true,
        });

        const voteGoal = interaction.options.getInteger('goal') ?? 8;
        const durationMinutes =
            interaction.options.getInteger('duration') ?? 10;

        const voteStartedAt = Date.now();
        const voteEndsAt = voteStartedAt + durationMinutes * 60 * 1000;
        const voteEndsTimestamp = Math.floor(voteEndsAt / 1000);

        const guildIcon =
            interaction.guild.iconURL({
                extension: 'png',
                size: 256,
            }) ?? null;

        const voteEmbed = new EmbedBuilder()
            .setColor('#1E3A5F')
            .setAuthor({
                name: 'Illinois State Roleplay | Strict',
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
                    name: '🎮 Server Code',
                    value: `\`${SERVER_CODE}\``,
                    inline: true,
                },
                {
                    name: '👤 Hosted By',
                    value: `${interaction.user}`,
                    inline: true,
                },
                {
                    name: '📊 Vote Progress',
                    value: `\`0 / ${voteGoal}\``,
                    inline: true,
                },
                {
                    name: '⏰ Voting Ends',
                    value: `<t:${voteEndsTimestamp}:R>`,
                    inline: true,
                },
                {
                    name: '🟡 Status',
                    value: '`Waiting for Votes`',
                    inline: true,
                }
            )
            .setFooter({
                text: 'Illinois State Roleplay | Strict • Session Management',
                iconURL: guildIcon ?? undefined,
            })
            .setTimestamp();

        if (guildIcon) {
            voteEmbed.setThumbnail(guildIcon);
        }

        const voteButtons = new ActionRowBuilder().addComponents(
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

        try {
            const voteMessage = await interaction.channel.send({
                content: `<@&${SESSION_PING_ROLE_ID}>`,
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
                goal: voteGoal,
                durationMinutes,
                startedAt: voteStartedAt,
                endsAt: voteEndsAt,
            });

            await interaction.editReply({
                content:
                    `✅ The server vote was successfully posted in ${interaction.channel}.\n\n` +
                    `**Vote Goal:** ${voteGoal}\n` +
                    `**Duration:** ${durationMinutes} minutes\n` +
                    `**Server Code:** \`${SERVER_CODE}\``,
            });
        } catch (error) {
            console.error('Error while creating the server vote:', error);

            sessionManager.clearVote();

            await interaction.editReply({
                content:
                    '❌ I could not create the server vote. Make sure I can view the channel, send messages, embed links, mention roles, and use application commands.',
            });
        }
    },
};