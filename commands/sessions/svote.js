const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('svote')
        .setDescription(
            'Starts an official Illinois State Roleplay session vote.'
        )

        .addIntegerOption((option) =>
            option
                .setName('votes-needed')
                .setDescription(
                    'The number of votes needed for the session.'
                )
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )

        .addStringOption((option) =>
            option
                .setName('roleplay-zone')
                .setDescription(
                    'The roleplay zone for the session.'
                )
                .setRequired(true)
                .setMaxLength(100)
        )

        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription(
                    'Optional notes for the session vote.'
                )
                .setRequired(false)
                .setMaxLength(500)
        )

        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription(
                    'An optional role to ping for the session vote.'
                )
                .setRequired(false)
        )

        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'The channel where the vote should be posted.'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const votesNeeded =
            interaction.options.getInteger(
                'votes-needed',
                true
            );

        const roleplayZone =
            interaction.options.getString(
                'roleplay-zone',
                true
            );

        const notes =
            interaction.options.getString('notes') ??
            'N/A';

        const pingRole =
            interaction.options.getRole('ping');

        const channel =
            interaction.options.getChannel('channel') ??
            interaction.channel;

        if (!channel || !channel.isTextBased()) {
            return interaction.reply({
                content:
                    '❌ I cannot post a session vote in that channel.',
                ephemeral: true,
            });
        }

        const serverIcon =
            interaction.guild.iconURL({
                dynamic: true,
                size: 256,
            }) ??
            interaction.client.user.displayAvatarURL();

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('ISRP | Session Vote')
            .setDescription(
                [
                    'Please vote for the session! We all have **1 hour** to vote or the vote will be canceled!',
                    '',
                    'If you vote, you **MUST** join in-game!',
                    'If not, it can lead to an infraction.',
                    'This especially applies to the **Staff Team**.',
                    '',
                    `**Host:** ${interaction.user}`,
                    `**Votes Needed:** ${votesNeeded}`,
                    `**Roleplay Zone:** ${roleplayZone}`,
                    `**Notes:** ${notes}`,
                ].join('\n')
            )
            .setThumbnail(serverIcon)
            .setFooter({
                text:
                    'Illinois State Utilities • Supporting Illinois State Roleplay',
                iconURL:
                    interaction.client.user.displayAvatarURL(),
            })
            .setTimestamp();

        try {
            const voteMessage = await channel.send({
                content: pingRole
                    ? `${pingRole}`
                    : undefined,

                embeds: [embed],

                allowedMentions: {
                    roles: pingRole
                        ? [pingRole.id]
                        : [],
                    users: [],
                    parse: [],
                },
            });

            await voteMessage.react('✅');
            await voteMessage.react('❌');

            await interaction.reply({
                content:
                    `✅ The session vote was successfully posted in ${channel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error(
                '❌ Error while running /svote:'
            );
            console.error(error);

            const errorMessage =
                '❌ I could not post the session vote. Make sure I have permission to view the channel, send messages, embed links, read message history, and add reactions.';

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                await interaction.followUp({
                    content: errorMessage,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true,
                });
            }
        }
    },
};