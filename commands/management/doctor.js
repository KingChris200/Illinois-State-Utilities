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
const {
    getCommandAnalytics,
} = require('../../services/commandAnalyticsService');
const {
    getErrorSummary,
} = require('../../services/errorReportingService');
const {
    auditCommandPermissions,
} = require('../../services/commandPermissionAudit');

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
        )
        .addStringOption((option) =>
            option
                .setName('view')
                .setDescription('Choose the private reliability report to view.')
                .addChoices(
                    { name: 'Launch Readiness', value: 'readiness' },
                    { name: 'Command Usage', value: 'usage' },
                    { name: 'Recent Errors', value: 'errors' },
                    { name: 'Permission Audit', value: 'permissions' }
                )
                .setRequired(false)
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
            const view =
                interaction.options.getString?.('view') || 'readiness';
            let embed;

            if (view === 'usage') {
                embed = createUsageEmbed(
                    await getCommandAnalytics(interaction.guildId)
                );
            } else if (view === 'errors') {
                embed = createErrorsEmbed(
                    await getErrorSummary(interaction.guildId)
                );
            } else if (view === 'permissions') {
                embed = createPermissionAuditEmbed(
                    auditCommandPermissions()
                );
            } else {
                const report = await runConfigurationDoctor({
                    client: interaction.client,
                    guild: interaction.guild,
                });
                embed = createDoctorEmbed(interaction, report);
            }

            await interaction.editReply({
                embeds: [embed],
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
    createErrorsEmbed,
    createPermissionAuditEmbed,
    createUsageEmbed,
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

    return embed;
}

function createUsageEmbed(report) {
    const topCommands = report.commands.slice(0, 10);
    const averageDuration = report.total.uses > 0
        ? Math.round(report.total.totalDurationMs / report.total.uses)
        : 0;

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Command Usage')
        .setDescription(
            `Private, aggregate usage from the last **${report.days} days**. No command text or member IDs are stored.`
        )
        .addFields(
            {
                name: 'Overview',
                value: [
                    `**${report.total.uses}** uses`,
                    `**${report.total.failures}** errors`,
                    `**${report.total.denied}** blocked attempts`,
                    `**${averageDuration} ms** average runtime`,
                ].join(' • '),
            },
            {
                name: 'Most Used',
                value: topCommands.length > 0
                    ? topCommands
                          .map((command, index) =>
                              `${index + 1}. **${command.name}** — **${command.uses}**`
                          )
                          .join('\n')
                    : 'No command usage has been recorded yet.',
            }
        )
        .setFooter({ text: 'Local aggregate analytics' })
        .setTimestamp();
}

function createErrorsEmbed(summary) {
    const records = summary.records.slice(0, 8);

    return new EmbedBuilder()
        .setColor(records.length > 0 ? 0xe67e22 : 0x2ecc71)
        .setTitle('Recent Errors')
        .setDescription(
            summary.channelId
                ? `New errors are sent privately to <#${summary.channelId}> and stored locally.`
                : 'Errors are stored locally. Add `BOT_ERROR_LOG_CHANNEL_ID` to send them to a private Discord channel.'
        )
        .addFields({
            name: `Latest Records (${summary.totalStored} stored)`,
            value: records.length > 0
                ? records
                      .map((record) => {
                          const timestamp = Math.floor(
                              new Date(record.createdAt).getTime() / 1000
                          );
                          return `**${record.id}** • **${record.context}** • <t:${timestamp}:R>`;
                      })
                      .join('\n')
                : 'No errors have been recorded.',
        })
        .setFooter({ text: 'Sensitive stack traces are never posted to Discord' })
        .setTimestamp();
}

function createPermissionAuditEmbed(report) {
    const findingLines = report.findings.slice(0, 10).map(
        (finding) =>
            `**/${finding.command}** — ${finding.detail}`
    );

    return new EmbedBuilder()
        .setColor(report.status === 'pass' ? 0x2ecc71 : 0xe74c3c)
        .setTitle('Permission Audit')
        .setDescription(
            report.status === 'pass'
                ? 'Every command has a reviewed access policy and every server workflow is disabled in DMs.'
                : 'One or more commands need an access-policy review.'
        )
        .addFields(
            {
                name: 'Coverage',
                value: [
                    `**${report.checkedCommands}** commands checked`,
                    `**${report.discordProtected}** protected by Discord permissions`,
                    `**${report.runtimeProtected}** protected by server roles`,
                    `**${report.memberFacing}** member or mixed workflows`,
                ].join('\n'),
            },
            {
                name: 'Findings',
                value: findingLines.length > 0
                    ? findingLines.join('\n')
                    : '✅ No unclassified or DM-enabled commands found.',
            }
        )
        .setFooter({ text: 'Read-only access review' })
        .setTimestamp();
}
