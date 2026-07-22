const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const fs = require('node:fs/promises');
const path = require('node:path');

const CONFIG_FILE = path.join(
    process.cwd(),
    'data',
    'guild-configs.json'
);

async function readConfigurations() {
    try {
        const fileContents = await fs.readFile(CONFIG_FILE, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }

        throw error;
    }
}

function convertHexToDecimal(hexColor) {
    const cleanedColor = hexColor
        .replace(/^#/, '')
        .replace(/^0x/i, '');

    const parsedColor = Number.parseInt(cleanedColor, 16);

    if (Number.isNaN(parsedColor)) {
        return 0x3498db;
    }

    return parsedColor;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription(
            'View the saved Illinois State Utilities configuration.'
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

            const canViewConfiguration =
                interaction.memberPermissions?.has(
                    PermissionFlagsBits.ManageGuild
                ) ||
                interaction.memberPermissions?.has(
                    PermissionFlagsBits.Administrator
                );

            if (!canViewConfiguration) {
                return interaction.reply({
                    content:
                        '❌ You need the **Manage Server** permission to view the bot configuration.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const configurations = await readConfigurations();
            const guildConfiguration =
                configurations[interaction.guildId];

            if (!guildConfiguration) {
                return interaction.editReply({
                    content:
                        '❌ Illinois State Utilities has not been configured in this server yet.\n\nRun `/setup` first.',
                });
            }

            const {
                serverName,
                serverCode,
                owners,
                announcementRoleId,
                sessionChannelId,
                logChannelId,
                brandColor,
                configuredBy,
                updatedAt,
            } = guildConfiguration;

            const primaryOwner =
                owners?.primary || 'Not provided';

            const secondaryOwner =
                owners?.secondary || 'Not provided';

            const configuredByMention =
                configuredBy?.discordUserId
                    ? `<@${configuredBy.discordUserId}>`
                    : 'Unknown';

            const formattedUpdateTime = updatedAt
                ? `<t:${Math.floor(
                      new Date(updatedAt).getTime() / 1000
                  )}:F>`
                : 'Unknown';

            const relativeUpdateTime = updatedAt
                ? `<t:${Math.floor(
                      new Date(updatedAt).getTime() / 1000
                  )}:R>`
                : 'Unknown';

            const configEmbed = new EmbedBuilder()
                .setColor(
                    convertHexToDecimal(
                        brandColor || '#3498DB'
                    )
                )
                .setTitle(
                    'Illinois State Utilities | Server Configuration'
                )
                .setDescription(
                    [
                        'Below are the settings currently saved for this server.',
                        '',
                        '**Server Name**',
                        serverName || 'Not provided',
                        '',
                        '**Server Code**',
                        serverCode
                            ? `\`${serverCode}\``
                            : 'Not provided',
                        '',
                        '**Server Owners**',
                        `Primary: ${primaryOwner}`,
                        `Secondary: ${secondaryOwner}`,
                        '',
                        '**Announcement Role**',
                        announcementRoleId
                            ? `<@&${announcementRoleId}>`
                            : 'Not configured',
                        '',
                        '**Session Channel**',
                        sessionChannelId
                            ? `<#${sessionChannelId}>`
                            : 'Not configured',
                        '',
                        '**Management Log Channel**',
                        logChannelId
                            ? `<#${logChannelId}>`
                            : 'Not configured',
                        '',
                        '**Brand Color**',
                        `\`${brandColor || '#3498DB'}\``,
                        '',
                        '**Configuration Details**',
                        `Configured By: ${configuredByMention}`,
                        `Last Updated: ${formattedUpdateTime}`,
                        `Updated: ${relativeUpdateTime}`,
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
                embeds: [configEmbed],
            });
        } catch (error) {
            console.error('Error executing /config:', error);

            const errorMessage = {
                content:
                    '❌ Something went wrong while loading the server configuration.',
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