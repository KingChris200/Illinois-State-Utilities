const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');

const {
    checkIsReviewer,
    revokeMovement,
} = require('../../utils/movementUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movement-revoke')
        .setDescription(
            'Revoke a previously logged staff movement.'
        )

        .addStringOption((option) =>
            option
                .setName('case-id')
                .setDescription(
                    'The Case ID of the movement to revoke.'
                )
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription(
                    'Why this movement is being revoked.'
                )
                .setMinLength(3)
                .setMaxLength(500)
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            if (
                !interaction.inGuild() ||
                !interaction.guild
            ) {
                return interaction.reply({
                    content:
                        'This command can only be used inside a server.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (
                !checkIsReviewer(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        'You do not have permission to revoke staff movements.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const recordId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            const revokeReason =
                interaction.options
                    .getString(
                        'reason',
                        true
                    )
                    .trim();

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const result =
                await revokeMovement({
                    guild:
                        interaction.guild,
                    recordId,
                    revokedBy:
                        interaction.user,
                    revokeReason,
                });

            if (!result.success) {
                return interaction.editReply({
                    content:
                        result.reason,
                });
            }

            let roleNote = '';

            if (
                result.rankResult &&
                !result.rankResult.applied
            ) {
                roleNote =
                    '\n\n⚠️ The movement was revoked, but its rank change could not be reversed: ' +
                    result.rankResult.error;
            }

            return interaction.editReply({
                content:
                    `Case \`${recordId}\` has been revoked.` +
                    roleNote,
            });
        } catch (error) {
            console.error(
                'Movement revoke command error:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return interaction.editReply({
                    content:
                        'An error occurred while revoking this movement. Check the bot console.',
                });
            }

            return interaction.reply({
                content:
                    'An error occurred while revoking this movement. Check the bot console.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};