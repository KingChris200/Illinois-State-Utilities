const {
    MessageFlags,
} = require('discord.js');
const {
    recordCommandUsage,
} = require('../services/commandAnalyticsService');
const {
    reportError,
} = require('../services/errorReportingService');

async function handleAutocomplete(interaction) {
    const command =
        interaction.client.commands.get(
            interaction.commandName
        );

    if (
        !command ||
        typeof command.autocomplete !== 'function'
    ) {
        await interaction.respond([]).catch(() => {});
        return;
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        await reportError({
            client: interaction.client,
            error,
            context: 'Command autocomplete',
            command: `/${interaction.commandName}`,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            userId: interaction.user?.id,
        });

        await interaction.respond([]).catch(() => {});
    }
}

async function handleSlashCommand(interaction) {
    const startedAt = Date.now();
    const command =
        interaction.client.commands.get(
            interaction.commandName
        );

    if (!command) {
        console.error(
            `No command matching /${interaction.commandName} was found.`
        );

        return;
    }

    try {
        await command.execute(interaction);
        await recordCommandUsage({
            guildId: interaction.guildId,
            commandName: interaction.commandName,
            type: 'slash',
            outcome: 'success',
            durationMs: Date.now() - startedAt,
        }).catch(() => null);
    } catch (error) {
        const record = await reportError({
            client: interaction.client,
            error,
            context: 'Slash command',
            command: `/${interaction.commandName}`,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            userId: interaction.user?.id,
        });
        await recordCommandUsage({
            guildId: interaction.guildId,
            commandName: interaction.commandName,
            type: 'slash',
            outcome: 'error',
            durationMs: Date.now() - startedAt,
        }).catch(() => null);

        const errorMessage = {
            content:
                `❌ Something went wrong. Reference: \`${record.id}\``,
            flags: MessageFlags.Ephemeral,
        };

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            await interaction
                .followUp(errorMessage)
                .catch(() => null);
        } else {
            await interaction
                .reply(errorMessage)
                .catch(() => null);
        }
    }
}

module.exports = {
    handleAutocomplete,
    handleSlashCommand,
};
