const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

const brands = require('../../config/branding');

const DEFAULT_TITLE = 'Community Announcement';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription(
            'Sends a polished Illinois State Roleplay announcement.'
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        )
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('What should the announcement say?')
                .setRequired(true)
                .setMaxLength(4000)
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription(
                    `Optional heading (defaults to "${DEFAULT_TITLE}").`
                )
                .setRequired(false)
                .setMaxLength(256)
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription(
                    'Where to post it (defaults to this channel).'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const message = interaction.options
            .getString('message', true)
            .trim();
        const customTitle = interaction.options
            .getString('title')
            ?.trim();
        const channel =
            interaction.options.getChannel('channel') ||
            interaction.channel;

        if (!message) {
            await interaction.reply({
                content:
                    '❌ Please include some text for the announcement.',
                ephemeral: true,
            });
            return;
        }

        if (!canSendEmbed(channel, interaction)) {
            await interaction.reply({
                content:
                    '❌ I cannot post embeds in that channel. Please choose a channel where I can view messages, send messages, and embed links.',
                ephemeral: true,
            });
            return;
        }

        const embed = createAnnouncementEmbed({
            interaction,
            title: customTitle || DEFAULT_TITLE,
            message,
        });

        try {
            await channel.send({
                embeds: [embed],
                allowedMentions: {
                    parse: [],
                    users: [],
                    roles: [],
                },
            });

            await interaction.reply({
                content:
                    `✅ Your announcement was posted in ${channel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error while running /embed:', error);

            const errorMessage =
                '❌ I could not post the announcement. Please check my channel permissions and try again.';

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

    createAnnouncementEmbed,
    canSendEmbed,
};

/**
 * Build the consistent public announcement style used by /embed.
 */
function createAnnouncementEmbed({
    interaction,
    title,
    message,
}) {
    const brand = brands.isrp || brands.utilities;
    const guildName =
        interaction.guild?.name || brand.name;
    const serverLogo = getServerLogo(interaction, brand);

    const embed = new EmbedBuilder()
        .setColor(brand.color)
        .setAuthor({
            name: guildName,
            ...(serverLogo
                ? { iconURL: serverLogo }
                : {}),
        })
        .setTitle(title)
        .setDescription(message)
        .setFooter({
            text: brand.footer,
            ...(serverLogo
                ? { iconURL: serverLogo }
                : {}),
        })
        .setTimestamp();

    if (serverLogo) {
        embed.setThumbnail(serverLogo);
    }

    return embed;
}

/**
 * Prefer the Discord server icon so branding stays current automatically.
 */
function getServerLogo(interaction, brand) {
    const guildIcon = interaction.guild?.iconURL?.({
        extension: 'png',
        size: 256,
    });

    return guildIcon || brand.logo || null;
}

/**
 * Validate the destination before attempting a public post.
 */
function canSendEmbed(channel, interaction) {
    if (
        !channel ||
        typeof channel.isTextBased !== 'function' ||
        !channel.isTextBased() ||
        typeof channel.send !== 'function'
    ) {
        return false;
    }

    const botMember = interaction.guild?.members?.me;

    if (
        !botMember ||
        typeof channel.permissionsFor !== 'function'
    ) {
        return true;
    }

    const permissions = channel.permissionsFor(botMember);

    return Boolean(
        permissions?.has(PermissionFlagsBits.ViewChannel) &&
            permissions?.has(PermissionFlagsBits.SendMessages) &&
            permissions?.has(PermissionFlagsBits.EmbedLinks)
    );
}
