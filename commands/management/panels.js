const {
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const {
    PANEL_CHOICES,
    getPanelDefinitions,
    runPanelOperation,
} = require('../../utils/panelControlCenter');

function addPanelOption(subcommand) {
    return subcommand.addStringOption((option) =>
        option
            .setName('panel')
            .setDescription('Optional: manage only one panel.')
            .setRequired(false)
            .addChoices(PANEL_CHOICES)
    );
}

function formatResult(result) {
    const { definition, message, panel, status } = result;
    const location = panel?.channelId ? ` <#${panel.channelId}>` : '';

    switch (status) {
        case 'live':
            return `✅ **${definition.label}** — [Open](${message.url})`;
        case 'refreshed':
            return `✅ **${definition.label}** — refreshed`;
        case 'repaired':
            return `✅ **${definition.label}** — repaired${location}`;
        case 'already_live':
            return `✅ **${definition.label}** — already working`;
        case 'missing':
            return `⚠️ **${definition.label}** — message missing${location}`;
        case 'channel_unavailable':
            return `❌ **${definition.label}** — saved channel unavailable`;
        case 'not_configured':
            return `➖ **${definition.label}** — not set up (${definition.setupCommand})`;
        default:
            return `❌ **${definition.label}** — could not be checked`;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panels')
        .setDescription('Checks and maintains the permanent bot panels.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            addPanelOption(
                subcommand
                    .setName('status')
                    .setDescription('Checks every saved panel.')
            )
        )
        .addSubcommand((subcommand) =>
            addPanelOption(
                subcommand
                    .setName('refresh')
                    .setDescription('Updates panels that are still online.')
            )
        )
        .addSubcommand((subcommand) =>
            addPanelOption(
                subcommand
                    .setName('repair')
                    .setDescription('Reposts saved panels whose message was deleted.')
            )
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: 'This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const definitions = getPanelDefinitions(interaction.guildId);
        if (!definitions.length) {
            await interaction.reply({
                content: 'This server does not have permanent panels configured.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const action = interaction.options.getSubcommand();
        const panelId = interaction.options.getString('panel');
        if (
            panelId &&
            !definitions.some((definition) => definition.id === panelId)
        ) {
            await interaction.reply({
                content: 'That panel belongs to the other Illinois server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const results = await runPanelOperation({
            action,
            client: interaction.client,
            guild: interaction.guild,
            panelId,
            userId: interaction.user.id,
        });
        const heading = {
            status: 'Panel Status',
            refresh: 'Panel Refresh',
            repair: 'Panel Repair',
        }[action];

        await interaction.editReply({
            content: [`**${heading}**`, '', ...results.map(formatResult)].join(
                '\n'
            ),
            allowedMentions: { parse: [] },
        });
    },
};
