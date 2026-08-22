const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');

const {
    createSessionControlPayload,
} = require('../../utils/sessionControlManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('session')
        .setDescription('Manage the current session.')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('manage')
                .setDescription('Open the private session management panel.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.reply(
            createSessionControlPayload(interaction.user.id)
        );
    },
};
