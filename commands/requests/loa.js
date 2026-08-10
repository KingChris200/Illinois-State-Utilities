const {
    MessageFlags,
    SlashCommandBuilder,
} = require('discord.js');

const {
    showLoaManage,
    submitLoaRequest,
} = require('../../utils/loaManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loa')
        .setDescription('Request or manage your leave of absence.')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('request')
                .setDescription('Request a leave of absence.')
                .addIntegerOption((option) =>
                    option
                        .setName('duration')
                        .setDescription('How many days you need away (1–90).')
                        .setMinValue(1)
                        .setMaxValue(90)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Why you need a leave of absence.')
                        .setMinLength(5)
                        .setMaxLength(750)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('start')
                        .setDescription('Optional start date: YYYY-MM-DD. Defaults to today.')
                        .setMinLength(10)
                        .setMaxLength(10)
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('manage')
                .setDescription('View, cancel, or end your own leave of absence.')
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: 'This command can only be used inside the ISRP server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'request') {
                await submitLoaRequest(interaction, {
                    duration: interaction.options.getInteger('duration', true),
                    reason: interaction.options.getString('reason', true),
                    start: interaction.options.getString('start'),
                });
                return;
            }

            await showLoaManage(interaction);
        } catch (error) {
            console.error('Error executing /loa:', error);
            await interaction
                .editReply(
                    'Something went wrong while processing the LOA request.'
                )
                .catch(() => null);
        }
    },
};
