const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { checkIsReviewer, revokeMovement } = require('../../utils/movementUtils');
 
const HR_ROLE = "1529318152318484510";

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movement-revoke')
        .setDescription('Revoke a previously logged staff movement.')
        .addStringOption((option) =>
            option
                .setName('case-id')
                .setDescription('The Case ID of the movement to revoke.')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('The reason this movement is being revoked.')
                .setMinLength(3)
                .setMaxLength(500)
                .setRequired(true)
        ),
 
    async execute(interaction) {
        if (!checkIsReviewer(interaction.member)) {
            return interaction.reply({
                content: 'You do not have permission to revoke staff movements.',
                flags: MessageFlags.Ephemeral,
            });
        }
 
        const recordId = interaction.options.getString('case-id', true).trim();
        const revokeReason = interaction.options.getString('reason', true);
 
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
 
        const result = await revokeMovement({
            guild: interaction.guild,
            recordId,
            revokedBy: interaction.user,
            revokeReason,
        });
 
        if (!result.success) {
            return interaction.editReply({ content: result.reason });
        }
 
        return interaction.editReply({
            content: `Case \`${recordId}\` has been revoked.`,
        });
    },
};
