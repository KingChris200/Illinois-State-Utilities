const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const {
    updateDatabase,
} = require('../../utils/database');

function normalizeHexColor(colorInput) {
    const cleanedColor = colorInput
        .trim()
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    if (!/^[0-9A-Fa-f]{6}$/.test(cleanedColor)) {
        return null;
    }

    return {
        hex: `#${cleanedColor.toUpperCase()}`,
        decimal: Number.parseInt(cleanedColor, 16),
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure Illinois State Utilities for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        // Required options must always come first.
        .addStringOption((option) =>
            option
                .setName('server-name')
                .setDescription('The full ER:LC server name.')
                .setMaxLength(100)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('server-code')
                .setDescription('The ER:LC server join code.')
                .setMaxLength(50)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('primary-owner')
                .setDescription('The primary owner’s Roblox username.')
                .setMaxLength(50)
                .setRequired(true)
        )
        .addRoleOption((option) =>
            option
                .setName('announcement-role')
                .setDescription(
                    'The role normally pinged for session announcements.'
                )
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName('session-channel')
                .setDescription(
                    'The channel used for session announcements.'
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName('log-channel')
                .setDescription('The channel used for management logs.')
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(true)
        )

        // Optional options must come after all required options.
        .addStringOption((option) =>
            option
                .setName('secondary-owner')
                .setDescription('The secondary owner’s Roblox username.')
                .setMaxLength(50)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('brand-color')
                .setDescription('The main embed color, such as #3498DB.')
                .setMaxLength(8)
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.reply({
                    content:
                        '❌ This command can only be used inside a server.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const canConfigureServer =
                interaction.memberPermissions?.has(
                    PermissionFlagsBits.ManageGuild
                ) ||
                interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                );

            if (!canConfigureServer) {
                return interaction.reply({
                    content:
                        '❌ You need the **Manage Server** permission to configure Illinois State Utilities.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const serverName = interaction.options
                .getString('server-name', true)
                .trim();

            const serverCode = interaction.options
                .getString('server-code', true)
                .trim();

            const primaryOwner = interaction.options
                .getString('primary-owner', true)
                .trim();

            const announcementRole = interaction.options.getRole(
                'announcement-role',
                true
            );

            const sessionChannel = interaction.options.getChannel(
                'session-channel',
                true
            );

            const logChannel = interaction.options.getChannel(
                'log-channel',
                true
            );

            const secondaryOwner =
                interaction.options
                    .getString('secondary-owner')
                    ?.trim() || null;

            const colorInput =
                interaction.options.getString('brand-color') || '#3498DB';

            const brandColor = normalizeHexColor(colorInput);

            if (!brandColor) {
                return interaction.editReply({
                    content:
                        '❌ The brand color must be a valid six-digit hex color, such as `#3498DB`.',
                });
            }

            const guildConfiguration = {
                guildId: interaction.guildId,
                guildName: interaction.guild.name,

                serverName,
                serverCode,

                owners: {
                    primary: primaryOwner,
                    secondary: secondaryOwner,
                },

                announcementRoleId: announcementRole.id,
                sessionChannelId: sessionChannel.id,
                logChannelId: logChannel.id,

                brandColor: brandColor.hex,

                configuredBy: {
                    discordUserId: interaction.user.id,
                    discordUsername: interaction.user.username,
                },

                updatedAt: new Date().toISOString(),
            };

            await updateDatabase(
                'guild-configs',
                (configurations) => {
                    configurations[interaction.guildId] =
                        guildConfiguration;

                    return configurations;
                },
                {}
            );

            const ownerDisplay = secondaryOwner
                ? `${primaryOwner}\n${secondaryOwner}`
                : primaryOwner;

            const setupEmbed = new EmbedBuilder()
                .setColor(brandColor.decimal)
                .setTitle(
                    'Illinois State Utilities | Setup Complete'
                )
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL:
                        interaction.guild.iconURL({
                            extension: 'png',
                            size: 256,
                        }) || undefined,
                })
                .setDescription(
                    [
                        'Illinois State Utilities has been configured successfully!',
                        '',
                        '**Server Name**',
                        serverName,
                        '',
                        '**Server Code**',
                        `\`${serverCode}\``,
                        '',
                        '**Server Owners**',
                        ownerDisplay,
                        '',
                        '**Announcement Role**',
                        `${announcementRole}`,
                        '',
                        '**Session Channel**',
                        `${sessionChannel}`,
                        '',
                        '**Management Log Channel**',
                        `${logChannel}`,
                        '',
                        '**Brand Color**',
                        `\`${brandColor.hex}\``,
                    ].join('\n')
                )
                .setThumbnail(
                    interaction.guild.iconURL({
                        dynamic: true,
                    })
                )
                .setFooter({
                    text:
                        'Illinois State Utilities • Configuration System',
                    iconURL:
                        interaction.client.user.displayAvatarURL(),
                })
                .setTimestamp();

            await interaction.editReply({
                content:
                    '✅ Configuration saved! Future commands will use these settings automatically.',
                embeds: [setupEmbed],
            });

            const logEmbed = new EmbedBuilder()
                .setColor(brandColor.decimal)
                .setTitle('Server Configuration Updated')
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL:
                        interaction.guild.iconURL({
                            extension: 'png',
                            size: 256,
                        }) || undefined,
                })
                .setDescription(
                    [
                        `**Updated By:** ${interaction.user}`,
                        `**Server Name:** ${serverName}`,
                        `**Server Code:** \`${serverCode}\``,
                        `**Primary Owner:** ${primaryOwner}`,
                        `**Secondary Owner:** ${
                            secondaryOwner || 'Not provided'
                        }`,
                        `**Announcement Role:** ${announcementRole}`,
                        `**Session Channel:** ${sessionChannel}`,
                        `**Log Channel:** ${logChannel}`,
                        `**Brand Color:** \`${brandColor.hex}\``,
                    ].join('\n')
                )
                .setFooter({
                    text:
                        'Illinois State Utilities • Management Logs',
                    iconURL:
                        interaction.client.user.displayAvatarURL(),
                })
                .setTimestamp();

            await logChannel
                .send({
                    embeds: [logEmbed],
                })
                .catch((error) => {
                    console.error(
                        'The configuration was saved, but the log message could not be sent:',
                        error
                    );
                });
        } catch (error) {
            console.error('Error executing /setup:', error);

            const errorMessage = {
                content:
                    '❌ Something went wrong while saving the server configuration.',
            };

            if (interaction.deferred || interaction.replied) {
                await interaction
                    .editReply(errorMessage)
                    .catch(() => {});
            } else {
                await interaction
                    .reply({
                        ...errorMessage,
                        flags: MessageFlags.Ephemeral,
                    })
                    .catch(() => {});
            }
        }
    },
};
