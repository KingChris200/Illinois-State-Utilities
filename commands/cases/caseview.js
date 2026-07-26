const {
    findCase,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    createCaseEmbed,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE VIEW HANDLER
 * ============================================================
 *
 * Handles:
 * /case view
 *
 * The slash-command options themselves will be registered
 * inside commands/cases/case.js.
 */

module.exports = {
    subcommandName: 'view',

    async execute(interaction) {
        try {
            /*
             * Determine whether the response should be
             * private or visible to everyone.
             */

            const visibility =
                interaction.options.getString(
                    'visibility'
                ) || 'private';

            /*
             * Validate:
             * - Command is being used in a server
             * - User has case-management permissions
             * - Bot has been configured
             * - Interaction has been deferred
             */

            const access =
                await validateCaseAccess(
                    interaction,
                    {
                        visibility,
                    }
                );

            if (!access.allowed) {
                return;
            }

            const {
                guildConfiguration,
            } = access;

            /*
             * Read and normalize the permanent case ID.
             */

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            /*
             * Search the current server's case database.
             */

            const caseRecord =
                await findCase(
                    interaction.guildId,
                    caseId
                );

            if (!caseRecord) {
                return sendCaseError(
                    interaction,
                    `No case was found with the permanent ID \`${caseId}\`. Please confirm that the ID was entered correctly.`,
                    'Case Not Found'
                );
            }

            /*
             * Create the complete case-record embed using
             * the shared presentation toolkit.
             */

            const caseEmbed =
                await createCaseEmbed(
                    interaction,
                    guildConfiguration,
                    caseRecord,
                    {
                        title:
                            '📁 ISRP | Case Record',

                        includeAuditLog:
                            true,

                        auditLimit:
                            5,
                    }
                );

            /*
             * Display the case.
             *
             * Mentions are disabled so saved user IDs cannot
             * unexpectedly ping staff members when a case is
             * viewed publicly.
             */

            return interaction.editReply({
                content: null,

                embeds: [
                    caseEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case view:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while retrieving this case record. Please try again and check the bot logs if the problem continues.',
                'Unable to View Case'
            ).catch(() => {});
        }
    },
};