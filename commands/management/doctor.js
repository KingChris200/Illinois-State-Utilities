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
    runConfigurationDoctor,
} = require('../../services/configurationDoctor');

const STATUS_DETAILS = {
    pass: {
        emoji: '✅',
        label: 'Ready',
    },
    warning: {
        emoji: '⚠️',
        label: 'Review',
    },
    fail: {
        emoji: '❌',
        label: 'Needs Attention',
    },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('doctor')
        .setDMPermission(false)
        .setDescription(
            'Privately checks the bot configuration and permissions.'
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {
        if (
            !interaction.inGuild?.() ||
            interaction.guildId !== MAIN_SERVER_ID ||
            !canRunDoctor(interaction)
        ) {
            await interaction.reply({
                content:
                    '❌ This private diagnostic is restricted to authorized ISRP management.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        try {
            const report =
                await runConfigurationDoctor({
                    client: interaction.client,
                    guild: interaction.guild,
                });

            await interaction.editReply({
                embeds: [
                    createDoctorEmbed(
                        interaction,
                        report
                    ),
                ],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            console.error(
                '[CONFIGURATION DOCTOR] Check failed:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ The diagnostic could not finish. No configuration or data was changed.',
                embeds: [],
                allowedMentions: { parse: [] },
            });
        }
    },

    canRunDoctor,
    createDoctorEmbed,
};

function canRunDoctor(interaction) {
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

function createDoctorEmbed(interaction, report) {
    const color =
        report.overallStatus === 'fail'
            ? 0xe74c3c
            : report.overallStatus === 'warning'
              ? 0xf1c40f
              : 0x2ecc71;
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Bot Check')
        .setDescription(
            [
                'A read-only check of the bot’s important configuration, channels, permissions, Staff Guide, and backup protection.',
                '',
                `✅ **${report.summary.pass} ready** • ⚠️ **${report.summary.warning} to review** • ❌ **${report.summary.fail} needing attention**`,
            ].join('\n')
        )
        .addFields(
            report.checks.map((check) => {
                const status =
                    STATUS_DETAILS[check.status];

                return {
                    name:
                        `${status.emoji} ${check.name} — ${status.label}`,
                    value: check.detail,
                };
            })
        )
        .setFooter({
            text:
                `${brands.isrp.footer} • Read-only diagnostic`,
        })
        .setTimestamp(
            new Date(report.checkedAt)
        );

    const icon = interaction.guild.iconURL?.({
        extension: 'png',
        size: 256,
    });

    if (icon) {
        embed.setThumbnail(icon);
    }

    return embed;
}
