const {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const brands = require('../../config/branding');
const {
    MAIN_SERVER_ID,
} = require('../../config/serverConfigs');
const {
    createDataBackup,
    getDataBackupStatus,
} = require('../../services/dataBackupService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDMPermission(false)
        .setDescription(
            'Reviews or creates private local data backups.'
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('status')
                .setDescription(
                    'Shows the automatic backup status.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('create')
                .setDescription(
                    'Creates a backup of the current JSON data now.'
                )
        ),

    async execute(interaction) {
        if (
            !interaction.inGuild?.() ||
            interaction.guildId !== MAIN_SERVER_ID ||
            !canManageBackups(interaction)
        ) {
            await interaction.reply({
                content:
                    '❌ This private backup tool is restricted to authorized ISRP management.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        try {
            const subcommand =
                interaction.options.getSubcommand();

            if (subcommand === 'create') {
                const result =
                    await createDataBackup();

                await interaction.editReply({
                    embeds: [
                        createBackupResultEmbed(
                            interaction,
                            result
                        ),
                    ],
                    allowedMentions: { parse: [] },
                });
                return;
            }

            const status =
                await getDataBackupStatus();

            await interaction.editReply({
                embeds: [
                    createBackupStatusEmbed(
                        interaction,
                        status
                    ),
                ],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            console.error(
                '[DATA BACKUP] Command failed:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ The backup operation failed. The existing live data was not changed.',
                embeds: [],
                allowedMentions: { parse: [] },
            });
        }
    },

    canManageBackups,
    createBackupResultEmbed,
    createBackupStatusEmbed,
};

function canManageBackups(interaction) {
    if (
        interaction.guild?.ownerId ===
        interaction.user?.id
    ) {
        return true;
    }

    return Boolean(
        interaction.member?.permissions?.has?.(
            PermissionFlagsBits.Administrator
        ) ||
            interaction.member?.permissions?.has?.(
                PermissionFlagsBits.ManageGuild
            )
    );
}

function createBackupStatusEmbed(
    interaction,
    status
) {
    const embed = new EmbedBuilder()
        .setColor(
            status.enabled
                ? 0x2ecc71
                : 0xf1c40f
        )
        .setTitle('💾 Data Backup Status')
        .setDescription(
            'Backups are private local snapshots of the bot’s JSON data. They are never committed to GitHub.'
        )
        .addFields(
            {
                name: 'Automatic Backups',
                value: status.enabled
                    ? '✅ Enabled'
                    : '⚠️ Disabled',
                inline: true,
            },
            {
                name: 'Runtime',
                value: status.running
                    ? '🟢 Running'
                    : '⚪ Not running',
                inline: true,
            },
            {
                name: 'Stored Snapshots',
                value: `**${status.storedBackupCount}**`,
                inline: true,
            },
            {
                name: 'Schedule',
                value: `Every **${formatDuration(status.configuration.intervalMs)}** • Keep **${status.configuration.retention}** snapshots`,
            },
            {
                name: 'Last Result',
                value: formatLastResult(status),
            },
            {
                name: 'Important',
                value:
                    'These snapshots protect against accidental local data damage. Copy the `backups` folder to a secure off-device location for full disaster recovery.',
            }
        )
        .setFooter({
            text: brands.isrp.footer,
        })
        .setTimestamp();

    const icon = interaction.guild.iconURL?.({
        extension: 'png',
        size: 256,
    });

    if (icon) {
        embed.setThumbnail(icon);
    }

    return embed;
}

function createBackupResultEmbed(
    interaction,
    result
) {
    const created = result.status === 'created';
    const embed = new EmbedBuilder()
        .setColor(created ? 0x2ecc71 : 0xf1c40f)
        .setTitle(
            created
                ? '✅ Data Backup Created'
                : 'ℹ️ No Live Data to Back Up'
        )
        .setDescription(
            created
                ? `A protected local snapshot containing **${result.fileCount} JSON files** was created successfully.`
                : 'The data directory does not contain JSON records yet, so no empty snapshot was created.'
        )
        .addFields({
            name: 'Retention Cleanup',
            value:
                result.removedBackups?.length > 0
                    ? `Removed **${result.removedBackups.length}** expired snapshot(s).`
                    : 'No expired snapshots needed removal.',
        })
        .setFooter({
            text: brands.isrp.footer,
        })
        .setTimestamp();

    const icon = interaction.guild.iconURL?.({
        extension: 'png',
        size: 256,
    });

    if (icon) {
        embed.setThumbnail(icon);
    }

    return embed;
}

function formatLastResult(status) {
    if (status.lastStatus === 'failed') {
        return '❌ The most recent backup attempt failed. Check the bot terminal for protected error details.';
    }

    if (!status.lastBackupAt) {
        return 'No backup attempt has been recorded during this runtime.';
    }

    const timestamp = Math.floor(
        new Date(status.lastBackupAt).getTime() /
            1000
    );

    if (status.lastStatus === 'no_data') {
        return `No JSON data was available <t:${timestamp}:R>.`;
    }

    return `✅ Backed up **${status.lastFileCount} files** <t:${timestamp}:R>.`;
}

function formatDuration(milliseconds) {
    const hours = milliseconds / 3_600_000;

    if (Number.isInteger(hours)) {
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    return `${Math.round(milliseconds / 60_000)} minutes`;
}
