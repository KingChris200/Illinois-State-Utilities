const {
    findCase,
    voidCase,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    createCaseEmbed,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE VOID HANDLER
 * ============================================================
 *
 * Handles:
 * /case void
 *
 * The slash-command options are registered inside:
 * commands/cases/case.js
 */

module.exports = {
    subcommandName: 'void',

    async execute(interaction) {
        try {
            /*
             * Voiding a case is a sensitive management action,
             * so the response should always remain private.
             */

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

            /*
             * Read and normalize the required command options.
             */

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            const voidReason =
                interaction.options
                    .getString(
                        'reason',
                        true
                    )
                    .trim();

            /*
             * A void reason should never be empty after trimming.
             */

            if (!voidReason) {
                return sendCaseError(
                    interaction,
                    'You must provide a valid reason explaining why this case is being voided.',
                    'Void Reason Required'
                );
            }

            /*
             * Retrieve the existing case before changing
             * its status.
             */

            const existingCase =
                await findCase(
                    interaction.guildId,
                    caseId
                );

            if (!existingCase) {
                return sendCaseError(
                    interaction,
                    `No case was found with the permanent ID \`${caseId}\`. Please confirm that the ID was entered correctly.`,
                    'Case Not Found'
                );
            }

            /*
             * Prevent duplicate status changes and unnecessary
             * audit-log entries.
             */

            if (
                existingCase.status ===
                'voided'
            ) {
                return sendCaseError(
                    interaction,
                    `Case \`${existingCase.id}\` has already been voided.`,
                    'Case Already Voided'
                );
            }

            /*
             * Void the case through the central case manager.
             *
             * The manager is responsible for:
             * - Changing the status to voided
             * - Recording the void timestamp
             * - Updating the last-modified timestamp
             * - Recording who performed the action
             * - Adding the reason to the audit history
             */

            const voidedCase =
                await voidCase(
                    interaction.guildId,
                    caseId,
                    {
                        performedById:
                            interaction.user.id,

                        performedByUsername:
                            interaction.user
                                .username,

                        reason:
                            voidReason,
                    }
                );

            if (!voidedCase) {
                return sendCaseError(
                    interaction,
                    `Case \`${caseId}\` could not be voided. It may no longer exist in the database.`,
                    'Case Void Failed'
                );
            }

            /*
             * Build the updated case record using the shared
             * case presentation system.
             */

            const voidedCaseEmbed =
                await createCaseEmbed(
                    interaction,
                    guildConfiguration,
                    voidedCase,
                    {
                        title:
                            '🚫 ISRP | Case Voided',

                        includeAuditLog:
                            true,

                        auditLimit:
                            5,
                    }
                );

            /*
             * Display the completed action.
             *
             * Mentions are disabled so the staff member and
             * issuer shown in the embed are not pinged.
             */

            return interaction.editReply({
                content:
                    `✅ Case \`${voidedCase.id}\` has been voided successfully.`,

                embeds: [
                    voidedCaseEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case void:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while voiding this case. Please try again and check the bot logs if the problem continues.',
                'Unable to Void Case'
            ).catch(() => {});
        }
    },
};