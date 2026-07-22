const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu')
        .setDescription(
            'Posts the official Illinois State Roleplay session startup.'
        )

        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription(
                    'An optional role to ping for the session startup.'
                )
                .setRequired(false)
        )

        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'The channel where the session startup should be posted.'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription(
                    'Optional additional notes for the session.'
                )
                .setRequired(false)
                .setMaxLength(500)
        ),

    async execute(interaction) {
        const pingRole =
            interaction.options.getRole('ping');

        const channel =
            interaction.options.getChannel('channel') ??
            interaction.channel;

        const notes =
            interaction.options.getString('notes');

        if (!channel || !channel.isTextBased()) {
            return interaction.reply({
                content:
                    '❌ I cannot post the session startup in that channel.',
                ephemeral: true,
            });
        }

        const serverIcon =
            interaction.guild.iconURL({
                dynamic: true,
                size: 256,
            }) ??
            interaction.client.user.displayAvatarURL();

        const description = [
            'If you have voted for the session, you **MUST** join up!',
            'If not, you will be punished!',
            '',
            '**Server Information**',
            '',
            '**Server Owner:** Scottattack155',
            '**Server Name:** Illinois State Roleplay | Strict',
            '**Server Code:** `ILLINOISrp`',
            '',
            '**Join up, Illinois!**',
        ];

        if (notes) {
            description.push(
                '',
                `**Notes:** ${notes}`
            );
        }

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('ISRP | Session Start Up!')
            .setDescription(description.join('\n'))
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
                    `✅ The session startup was successfully posted in ${channel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error(
                '❌ Error while running /ssu:'
            );
            console.error(error);

            const errorMessage =
                '❌ I could not post the session startup. Make sure I can view the channel, send messages, and embed links.';

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