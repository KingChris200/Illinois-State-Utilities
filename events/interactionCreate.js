const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'interactionCreate',

    async execute(interaction) {
        /*
         * ====================================================
         * AUTOCOMPLETE INTERACTIONS
         * ====================================================
         */

        if (interaction.isAutocomplete()) {
            const command =
                interaction.client.commands.get(
                    interaction.commandName
                );

            if (!command) {
                console.error(
                    `❌ No command matching /${interaction.commandName} was found for autocomplete.`
                );

                return;
            }

            if (
                typeof command.autocomplete !==
                'function'
            ) {
                console.error(
                    `❌ /${interaction.commandName} does not have an autocomplete handler.`
                );

                return interaction
                    .respond([])
                    .catch(() => {});
            }

            try {
                await command.autocomplete(
                    interaction
                );
            } catch (error) {
                console.error(
                    `❌ Error while handling autocomplete for /${interaction.commandName}:`
                );

                console.error(error);

                await interaction
                    .respond([])
                    .catch(() => {});
            }

            return;
        }

        /*
         * ====================================================
         * SLASH COMMAND INTERACTIONS
         * ====================================================
         */

        if (
            !interaction.isChatInputCommand()
        ) {
            return;
        }

        const command =
            interaction.client.commands.get(
                interaction.commandName
            );

        if (!command) {
            console.error(
                `❌ No command matching /${interaction.commandName} was found.`
            );

            await interaction.reply({
                content:
                    '❌ This command could not be found.',
                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        try {
            await command.execute(
                interaction
            );
        } catch (error) {
            console.error(
                `❌ Error while running /${interaction.commandName}:`
            );

            console.error(error);

            const errorMessage = {
                content:
                    '❌ An error occurred while running this command. Please try again later.',
            };

            if (
                interaction.deferred
            ) {
                await interaction
                    .editReply(
                        errorMessage
                    )
                    .catch(() => {});

                return;
            }

            if (
                interaction.replied
            ) {
                await interaction
                    .followUp({
                        ...errorMessage,
                        flags:
                            MessageFlags.Ephemeral,
                    })
                    .catch(() => {});

                return;
            }

            await interaction
                .reply({
                    ...errorMessage,
                    flags:
                        MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    },
};