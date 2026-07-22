const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Creates and sends a custom embed.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        )

        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('The title of the embed.')
                .setRequired(true)
                .setMaxLength(256)
        )

        .addStringOption((option) =>
            option
                .setName('description')
                .setDescription('The main message inside the embed.')
                .setRequired(true)
                .setMaxLength(4000)
        )

        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'The channel where the embed should be sent.'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('color')
                .setDescription(
                    'A HEX color, such as #3498DB.'
                )
                .setRequired(false)
                .setMaxLength(7)
        )

        .addStringOption((option) =>
            option
                .setName('thumbnail')
                .setDescription(
                    'A direct image URL for the thumbnail.'
                )
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('image')
                .setDescription(
                    'A direct image URL for the large image.'
                )
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('footer')
                .setDescription(
                    'Optional footer text.'
                )
                .setRequired(false)
                .setMaxLength(2048)
        )

        .addBooleanOption((option) =>
            option
                .setName('timestamp')
                .setDescription(
                    'Add the current date and time to the embed.'
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const title = interaction.options.getString(
            'title',
            true
        );

        const description = interaction.options.getString(
            'description',
            true
        );

        const channel =
            interaction.options.getChannel('channel') ||
            interaction.channel;

        const colorInput =
            interaction.options.getString('color');

        const thumbnail =
            interaction.options.getString('thumbnail');

        const image =
            interaction.options.getString('image');

        const footer =
            interaction.options.getString('footer');

        const timestamp =
            interaction.options.getBoolean('timestamp') ??
            true;

        const defaultColor = '#3498DB';
        let embedColor = defaultColor;

        if (colorInput) {
            const normalizedColor = colorInput.startsWith('#')
                ? colorInput
                : `#${colorInput}`;

            const validHexColor =
                /^#[0-9A-Fa-f]{6}$/.test(normalizedColor);

            if (!validHexColor) {
                return interaction.reply({
                    content:
                        '❌ That color is invalid. Please use a six-digit HEX color such as `#3498DB`.',
                    ephemeral: true,
                });
            }

            embedColor = normalizedColor;
        }

        const isValidUrl = (value) => {
            try {
                const url = new URL(value);

                return (
                    url.protocol === 'http:' ||
                    url.protocol === 'https:'
                );
            } catch {
                return false;
            }
        };

        if (thumbnail && !isValidUrl(thumbnail)) {
            return interaction.reply({
                content:
                    '❌ The thumbnail must be a valid image URL.',
                ephemeral: true,
            });
        }

        if (image && !isValidUrl(image)) {
            return interaction.reply({
                content:
                    '❌ The image must be a valid image URL.',
                ephemeral: true,
            });
        }

        if (!channel || !channel.isTextBased()) {
            return interaction.reply({
                content:
                    '❌ I cannot send an embed in that channel.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(title)
            .setDescription(description);

        if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        if (image) {
            embed.setImage(image);
        }

        if (footer) {
            embed.setFooter({
                text: footer,
            });
        } else {
            embed.setFooter({
                text: 'Illinois State Utilities • Supporting Illinois State Roleplay',
            });
        }

        if (timestamp) {
            embed.setTimestamp();
        }

        try {
            await channel.send({
                embeds: [embed],
                allowedMentions: {
                    parse: [],
                },
            });

            await interaction.reply({
                content: `✅ Your embed was successfully sent in ${channel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('❌ Error while running /embed:');
            console.error(error);

            const errorMessage =
                '❌ I could not send the embed. Please check my channel permissions and try again.';

            if (interaction.replied || interaction.deferred) {
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