module.exports = {
    name: 'interactionCreate',

    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(
            interaction.commandName
        );

        if (!command) {
            console.error(
                `❌ No command matching /${interaction.commandName} was found.`
            );

            await interaction.reply({
                content: 'This command could not be found.',
                ephemeral: true,
            });

            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(
                `❌ Error while running /${interaction.commandName}:`
            );
            console.error(error);

            const errorMessage = {
                content:
                    'An error occurred while running this command. Please try again later.',
                ephemeral: true,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};