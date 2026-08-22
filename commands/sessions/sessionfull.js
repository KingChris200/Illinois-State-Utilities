const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const {
    announceSessionEvent,
} = require('../../services/sessionErlcAutomation');
const brands = require('../../config/branding');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sessionfull')
        .setDescription('Let members know the session has enough players.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName('players')
                .setDescription('The current number of players in the session.')
                .setMinValue(1)
                .setMaxValue(40)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription('Optional notes for members.')
                .setMaxLength(500)
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription('The role to notify about the full session.')
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel where the announcement will be sent.')
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.reply({
                    content: '❌ This command can only be used inside a server.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const canAnnounce =
                interaction.memberPermissions?.has(
                    PermissionFlagsBits.ManageGuild
                ) ||
                interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                );

            if (!canAnnounce) {
                return interaction.reply({
                    content:
                        '❌ You need the **Manage Server** permission to send session announcements.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const playerCount = interaction.options.getInteger('players');
            const notes = interaction.options.getString('notes');
            const pingRole = interaction.options.getRole('ping');
            const selectedChannel = interaction.options.getChannel('channel');

            const destinationChannel = selectedChannel || interaction.channel;

            if (
                destinationChannel?.guildId !== interaction.guildId
            ) {
                return interaction.reply({
                    content:
                        '❌ The announcement channel must belong to this server.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!destinationChannel || !destinationChannel.isTextBased()) {
                return interaction.reply({
                    content: '❌ I could not find a valid channel for this announcement.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const descriptionLines = [
                'The session has enough players now. Thanks for joining!',
                '',
                '**Code:** `ILLINOISrp`',
            ];

            if (playerCount !== null) {
                descriptionLines.push(
                    '',
                    `**Players:** ${playerCount}/40`
                );
            }

            if (notes) {
                descriptionLines.push(
                    '',
                    `**Notes:** ${notes}`
                );
            }

            const sessionFullEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Session Update')
                .setDescription(descriptionLines.join('\n'))
                .setImage(brands.assets.sessionBanner)
                .setFooter({
                    text: `Posted by ${interaction.user.username}`,
                })
                .setTimestamp();

            const messageContent = pingRole ? `${pingRole}` : undefined;

            await destinationChannel.send({
                content: messageContent,
                embeds: [sessionFullEmbed],
                allowedMentions: {
                    roles: pingRole ? [pingRole.id] : [],
                },
            });

            await announceSessionEvent('session_full', {
                sourceChannelId: destinationChannel.id,
                playerCount,
                hostUsername: interaction.user.username,
                notes,
            });

            await interaction.reply({
                content: `✅ Session update posted in ${destinationChannel}.`,
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            console.error('Error executing /sessionfull:', error);

            const errorMessage = {
                content: '❌ Something went wrong while sending the session-full announcement.',
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(() => {});
            } else {
                await interaction.reply(errorMessage).catch(() => {});
            }
        }
    },
};
