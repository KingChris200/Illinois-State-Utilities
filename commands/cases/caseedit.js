const {
    findCase,
    updateCase,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    createCaseEmbed,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE EDIT HANDLER
 * ============================================================
 *
 * Handles:
 * /case edit
 *
 * The slash-command options are registered inside:
 * commands/cases/case.js
 */

module.exports = {
    subcommandName: 'edit',

    async execute(interaction) {
        try {
            /*
             * Editing case records should always remain private.
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
             * Read required options.
             */

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            const editReason =
                interaction.options
                    .getString(
                        'reason-for-edit',
                        true
                    )
                    .trim();

            /*
             * Find the existing case before attempting any changes.
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
             * Match Discord option names to the database fields
             * accepted by updateCase().
             */

            const editableFields = [
                {
                    optionName: 'title',
                    databaseField: 'title',
                },
                {
                    optionName: 'case-reason',
                    databaseField: 'reason',
                },
                {
                    optionName: 'evidence',
                    databaseField: 'evidence',
                },
                {
                    optionName: 'notes',
                    databaseField: 'notes',
                },
            ];

            const updates = {};

            /*
             * Only include fields that were actually provided.
             *
             * An empty string is preserved so management can clear
             * a saved field intentionally.
             */

            for (
                const field of
                editableFields
            ) {
                const providedValue =
                    interaction.options
                        .getString(
                            field.optionName
                        );

                if (
                    providedValue !==
                    null
                ) {
                    updates[
                        field.databaseField
                    ] =
                        providedValue.trim();
                }
            }

            if (
                Object.keys(updates)
                    .length === 0
            ) {
                return sendCaseError(
                    interaction,
                    'You must provide at least one field to edit: the title, case reason, evidence, or notes.',
                    'No Changes Provided'
                );
            }

            /*
             * Remove fields whose new value is identical to the
             * currently saved value.
             *
             * This prevents useless audit entries such as:
             * "Title: Example → Example"
             */

            const actualUpdates = {};

            for (
                const [
                    field,
                    newValue,
                ] of Object.entries(
                    updates
                )
            ) {
                const currentValue =
                    existingCase[
                        field
                    ];

                const normalizedCurrent =
                    currentValue ===
                        null ||
                    currentValue ===
                        undefined
                        ? ''
                        : String(
                              currentValue
                          ).trim();

                const normalizedNew =
                    String(
                        newValue
                    ).trim();

                if (
                    normalizedCurrent !==
                    normalizedNew
                ) {
                    actualUpdates[
                        field
                    ] = newValue;
                }
            }

            if (
                Object.keys(
                    actualUpdates
                ).length === 0
            ) {
                return sendCaseError(
                    interaction,
                    'The information you provided is already saved on this case. No changes were made.',
                    'No New Changes'
                );
            }

            /*
             * Update the case and create its audit entry.
             */

            const updatedCase =
                await updateCase(
                    interaction.guildId,
                    caseId,
                    {
                        performedById:
                            interaction.user.id,

                        performedByUsername:
                            interaction.user
                                .username,

                        reason:
                            editReason,

                        action:
                            'case_updated',

                        updates:
                            actualUpdates,
                    }
                );

            if (!updatedCase) {
                return sendCaseError(
                    interaction,
                    `Case \`${caseId}\` could not be updated. It may no longer exist in the database.`,
                    'Case Update Failed'
                );
            }

            /*
             * Build the updated case record.
             */

            const updatedEmbed =
                await createCaseEmbed(
                    interaction,
                    guildConfiguration,
                    updatedCase,
                    {
                        title:
                            '✏️ ISRP | Case Updated',

                        includeAuditLog:
                            true,

                        auditLimit:
                            5,
                    }
                );

            /*
             * Mentions remain disabled so the updated embed does not
             * unexpectedly ping the staff member or case issuer.
             */

            return interaction.editReply({
                content:
                    `✅ Case \`${updatedCase.id}\` was updated.`,

                embeds: [
                    updatedEmbed,
                ],

                allowedMentions: {
                    parse: [],
                },
            });
        } catch (error) {
            console.error(
                'Error executing /case edit:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while updating this case. Please try again and check the bot logs if the problem continues.',
                'Unable to Edit Case'
            ).catch(() => {});
        }
    },
};
