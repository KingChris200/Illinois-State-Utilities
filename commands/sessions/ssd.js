const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssd')
        .setDescription(
            'Posts the official Illinois State Roleplay session shutdown.'
        )

        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription(
                    'Optional notes for the session shutdown.'
                )
                .setRequired(false)
                .setMaxLength(500)
        )

        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription(
                    'An optional role to ping for the shutdown.'
                )
                .setRequired(false)
        )

        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'The channel where the shutdown should be posted.'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        ),

    async execute(interaction) {
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
                    '❌ I cannot post the session shutdown in that channel.',
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
            .setColor('#E74C3C')
            .setTitle('ISRP | Session Shutdown')
            .setDescription(
                [
                    'The Illinois State Roleplay session has officially concluded.',
                    '',
                    'Thank you to everyone who participated in today’s session!',
                    '',
                    'Please disconnect from the server and remain respectful in all community channels.',
                    '',
                    `**Session Host:** ${interaction.user}`,
                    `**Notes:** ${notes}`,
                    '',
                    '**We hope to see you at the next session!**',
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
            await channel.send({
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

            await interaction.reply({
                content:
                    `✅ The session shutdown was successfully posted in ${channel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error(
                '❌ Error while running /ssd:'
            );
            console.error(error);

            const errorMessage =
                '❌ I could not post the session shutdown. Make sure I can view the channel, send messages, and embed links.';

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