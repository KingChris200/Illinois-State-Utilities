const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
} = require('discord.js');

const {
    announceSessionEvent,
} = require('../../services/sessionErlcAutomation');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sessionlow')
        .setDescription('Announce that the current session needs more players.')
        .addIntegerOption((option) =>
            option
                .setName('players')
                .setDescription('The current number of players in the session.')
                .setMinValue(0)
                .setMaxValue(40)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('notes')
                .setDescription('Additional information for members.')
                .setMaxLength(500)
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName('ping')
                .setDescription('The role to notify about the low session.')
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
            const playerCount = interaction.options.getInteger('players');
            const notes = interaction.options.getString('notes');
            const pingRole = interaction.options.getRole('ping');
            const selectedChannel = interaction.options.getChannel('channel');

            const destinationChannel = selectedChannel || interaction.channel;

            if (!destinationChannel || !destinationChannel.isTextBased()) {
                return interaction.reply({
                    content: '❌ I could not find a valid channel for this announcement.',
                    ephemeral: true,
                });
            }

            const descriptionLines = [
                'The current Illinois State Roleplay session is beginning to lose activity.',
                '',
                'We need more **officers, civilians, firefighters, and dispatchers** to help keep today’s roleplay active!',
                '',
                '**Session Status**',
                '🟢 Active — Players Needed',
                '',
                '**Server Information**',
                'Server Name: Illinois State Roleplay | Strict',
                'Server Code: `ILLINOISrp`',
                '',
                `**Session Host**`,
                `${interaction.user}`,
            ];

            if (playerCount !== null) {
                descriptionLines.push(
                    '',
                    '**Current Player Count**',
                    `${playerCount} player${playerCount === 1 ? '' : 's'}`
                );
            }

            if (notes) {
                descriptionLines.push(
                    '',
                    '**Notes**',
                    notes
                );
            }

            descriptionLines.push(
                '',
                'We appreciate everyone who joins and helps keep the session active.',
                '',
                '**Join up, Illinois!**'
            );

            const sessionLowEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('ISRP | Session Low')
                .setDescription(descriptionLines.join('\n'))
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setFooter({
                    text: 'Illinois State Utilities • Supporting Illinois State Roleplay',
                    iconURL: interaction.client.user.displayAvatarURL(),
                })
                .setTimestamp();

            const messageContent = pingRole ? `${pingRole}` : undefined;

            await destinationChannel.send({
                content: messageContent,
                embeds: [sessionLowEmbed],
                allowedMentions: {
                    roles: pingRole ? [pingRole.id] : [],
                },
            });

            await announceSessionEvent('session_low', {
                sourceChannelId: destinationChannel.id,
                playerCount,
                hostUsername: interaction.user.username,
                notes,
            });

            await interaction.reply({
                content: `✅ The session-low announcement was sent successfully in ${destinationChannel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error executing /sessionlow:', error);

            const errorMessage = {
                content: '❌ Something went wrong while sending the session-low announcement.',
                ephemeral: true,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(() => {});
            } else {
                await interaction.reply(errorMessage).catch(() => {});
            }
        }
    },
};
