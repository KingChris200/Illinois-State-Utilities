const {
    AttachmentBuilder,
} = require('discord.js');

const {
    findCase,
} = require('../../utils/caseManager');

const {
    validateCaseAccess,
    buildCaseExportText,
    sendCaseError,
} = require('./casecomponents');

/*
 * ============================================================
 * CASE EXPORT HANDLER
 * ============================================================
 *
 * Handles:
 * /case export
 */

module.exports = {
    subcommandName: 'export',

    async execute(interaction) {
        try {

            const access =
                await validateCaseAccess(
                    interaction
                );

            if (!access.allowed) {
                return;
            }

            const caseId =
                interaction.options
                    .getString(
                        'case-id',
                        true
                    )
                    .trim();

            /*
             * Retrieve the case.
             */

            const caseRecord =
                await findCase(
                    interaction.guildId,
                    caseId
                );

            if (!caseRecord) {
                return sendCaseError(
                    interaction,
                    `No case was found with the ID \`${caseId}\`.`,
                    'Case Not Found'
                );
            }

            /*
             * Generate the export text.
             */

            const exportText =
                buildCaseExportText(
                    caseRecord
                );

            /*
             * Discord-safe filename.
             */

            const safeFileName =
                String(caseRecord.id)
                    .replace(
                        /[^a-zA-Z0-9-_]/g,
                        '_'
                    );

            /*
             * Create the attachment.
             */

            const attachment =
                new AttachmentBuilder(
                    Buffer.from(
                        exportText,
                        'utf8'
                    ),
                    {
                        name:
                            `${safeFileName}.txt`,
                    }
                );

            /*
             * Send it.
             */

            return interaction.editReply({
                content:
                    `📄 Case \`${caseRecord.id}\` was exported.`,
                files: [
                    attachment,
                ],
                allowedMentions: {
                    parse: [],
                },
            });

        } catch (error) {

            console.error(
                'Error executing /case export:',
                error
            );

            return sendCaseError(
                interaction,
                'Something went wrong while exporting this case.',
                'Export Failed'
            ).catch(() => {});
        }
    },
};
