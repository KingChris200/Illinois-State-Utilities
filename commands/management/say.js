const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Sends a message through Illinois State Utilities.')
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('The message the bot should send.')
                .setRequired(true)
                .setMaxLength(2000)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    async execute(interaction) {
        const message = interaction.options.getString(
            'message',
            true
        );

        try {
            await interaction.channel.send({
                content: message,
                allowedMentions: {
                    parse: [],
                },
            });

            await interaction.reply({
                content: '✅ Your message was sent successfully.',
                ephemeral: true,
            });
        } catch (error) {
            console.error('❌ Error while running /say:');
            console.error(error);

            await interaction.reply({
                content:
                    '❌ I could not send that message in this channel.',
                ephemeral: true,
            });
        }
    },
};