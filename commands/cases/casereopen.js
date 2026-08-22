const {
    findCase,
    reopenCase,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    createCaseEmbed,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE REOPEN HANDLER
 * ============================================================
 *
 * Handles:
 * /case reopen
 */

module.exports = {
    subcommandName: 'reopen',

    async execute(interaction) {
        try {
            const access =
                await validateCaseAccess(
                    interaction,
                    {
                        visibility: 'private',
                    }
                );

            if (!access.allowed) {
                return;
            }

            const {
                guildConfiguration,
            } = access;

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            const reopenReason =
                interaction.options
                    .getString(
                        'reason',
                        true
                    )
                    .trim();

            const existingCase =
                await findCase(
                    interaction.guildId,
                    caseId
                );

            if (!existingCase) {
                return sendCaseError(
                    interaction,
                    `No case was found with the permanent ID \`${caseId}\`.`,
                    'Case Not Found'
                );
            }

            /*
             * Prevent invalid state changes.
             */

            if (
                existingCase.status ===
                'open'
            ) {
                return sendCaseError(
                    interaction,
                    `Case \`${existingCase.id}\` is already open.`,
                    'Case Already Open'
                );
            }

            if (
                existingCase.status ===
                'voided'
            ) {
                return sendCaseError(
                    interaction,
                    `Case \`${existingCase.id}\` has been voided and cannot be reopened.`,
                    'Case Is Voided'
                );
            }

            /*
             * Reopen the case.
             */

            const reopenedCase =
                await reopenCase(
                    interaction.guildId,
                    caseId,
                    {
                        performedById:
                            interaction.user.id,

                        performedByUsername:
                            interaction.user.username,

                        reason:
                            reopenReason,
                    }
                );

            if (!reopenedCase) {
                return sendCaseError(
                    interaction,
                    `Unable to reopen case \`${caseId}\`.`,
                    'Case Reopen Failed'
                );
            }

            const embed =
                await createCaseEmbed(
                    interaction,
                    guildConfiguration,
                    reopenedCase,
                    {
                        title:
                            '🔓 ISRP | Case Reopened',

                        includeAuditLog: true,

                        auditLimit: 5,
                    }
                );

            return interaction.editReply({
                content:
                    `✅ Case \`${reopenedCase.id}\` was reopened.`,

                embeds: [
                    embed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case reopen:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while reopening this case.',
                'Unable to Reopen Case'
            ).catch(() => {});
        }
    },
};
