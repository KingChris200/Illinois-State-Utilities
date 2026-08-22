const {
    findCase,
    closeCase,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    createCaseEmbed,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE CLOSE HANDLER
 * ============================================================
 *
 * Handles:
 * /case close
 *
 * The slash-command options are registered inside:
 * commands/cases/case.js
 */

module.exports = {
    subcommandName: 'close',

    async execute(interaction) {
        try {
            /*
             * Case status changes should remain private.
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
             * Read the command options.
             */

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            const closureReason =
                interaction.options
                    .getString(
                        'reason',
                        true
                    )
                    .trim();

            /*
             * Retrieve the current case before attempting
             * to change its status.
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
             * Prevent invalid or duplicate status changes.
             */

            if (
                existingCase.status ===
                'closed'
            ) {
                return sendCaseError(
                    interaction,
                    `Case \`${existingCase.id}\` is already closed. Use \`/case reopen\` before attempting to close it again.`,
                    'Case Already Closed'
                );
            }

            if (
                existingCase.status ===
                'voided'
            ) {
                return sendCaseError(
                    interaction,
                    `Case \`${existingCase.id}\` is voided and cannot be closed. Reopen the case first if it needs to become active again.`,
                    'Case Is Voided'
                );
            }

            /*
             * Close the case through the central case manager.
             *
             * The manager handles:
             * - Changing the status
             * - Recording the closure time
             * - Updating the last-modified time
             * - Adding the audit entry
             */

            const closedCase =
                await closeCase(
                    interaction.guildId,
                    caseId,
                    {
                        performedById:
                            interaction.user.id,

                        performedByUsername:
                            interaction.user
                                .username,

                        reason:
                            closureReason,
                    }
                );

            if (!closedCase) {
                return sendCaseError(
                    interaction,
                    `Case \`${caseId}\` could not be closed. It may no longer exist in the database.`,
                    'Case Closure Failed'
                );
            }

            /*
             * Build the updated case record.
             */

            const closedCaseEmbed =
                await createCaseEmbed(
                    interaction,
                    guildConfiguration,
                    closedCase,
                    {
                        title:
                            '🔒 ISRP | Case Closed',

                        includeAuditLog:
                            true,

                        auditLimit:
                            5,
                    }
                );

            /*
             * Display the completed status change.
             *
             * Mentions are disabled so viewing the record does
             * not unexpectedly ping the staff member or issuer.
             */

            return interaction.editReply({
                content:
                    `✅ Case \`${closedCase.id}\` was closed.`,

                embeds: [
                    closedCaseEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case close:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while closing this case. Please try again and check the bot logs if the problem continues.',
                'Unable to Close Case'
            ).catch(() => {});
        }
    },
};
