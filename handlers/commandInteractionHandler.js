const {
    MessageFlags,
} = require('discord.js');

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
        console.error(
            `Error while autocompleting /${interaction.commandName}:`,
            error
        );

        await interaction.respond([]).catch(() => {});
    }
}

async function handleSlashCommand(interaction) {
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
    } catch (error) {
        console.error(
            `Error while executing /${interaction.commandName}:`,
            error
        );

        const errorMessage = {
            content:
                '❌ An unexpected error occurred while running this command.',
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
