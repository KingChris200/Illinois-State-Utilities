const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');

/*
 * ============================================================
 * MODULAR CASE COMMAND HANDLERS
 * ============================================================
 *
 * Every handler owns the execution logic for one subcommand.
 *
 * To add another case feature later:
 *
 * 1. Create its module.
 * 2. Import it below.
 * 3. Add it to caseSubcommands.
 * 4. Register its slash-command options.
 */

const caseView =
    require('./caseview');

const caseEdit =
    require('./caseedit');

const caseClose =
    require('./caseclose');

const caseReopen =
    require('./casereopen');

const caseVoid =
    require('./casevoid');

const caseSearch =
    require('./casesearch');

const caseList =
    require('./caselist');

const caseExport =
    require('./caseexport');

/*
 * ============================================================
 * SHARED COMMAND CHOICES
 * ============================================================
 */

const CASE_TYPE_CHOICES = [
    {
        name: 'Promotion',
        value: 'promotion',
    },
    {
        name: 'Demotion',
        value: 'demotion',
    },
    {
        name: 'Notice',
        value: 'notice',
    },
    {
        name: 'Inactivity Notice',
        value: 'inactivity_notice',
    },
    {
        name: 'Warning',
        value: 'warning',
    },
    {
        name: 'Strike',
        value: 'strike',
    },
    {
        name: 'Termination',
        value: 'termination',
    },
    {
        name: 'Blacklist',
        value: 'blacklist',
    },
    {
        name: 'Award',
        value: 'award',
    },
    {
        name: 'Leave of Absence',
        value: 'loa',
    },
    {
        name: 'Other',
        value: 'other',
    },
];

const CASE_STATUS_CHOICES = [
    {
        name: 'Open Cases',
        value: 'open',
    },
    {
        name: 'Closed Cases',
        value: 'closed',
    },
    {
        name: 'Voided Cases',
        value: 'voided',
    },
];

const VISIBILITY_CHOICES = [
    {
        name:
            'Private — Only you can see it',
        value: 'private',
    },
    {
        name:
            'Public — Everyone can see it',
        value: 'public',
    },
];

/*
 * ============================================================
 * SUBCOMMAND ROUTER
 * ============================================================
 *
 * The map connects Discord's selected subcommand name to the
 * module that handles it.
 */

const caseSubcommands =
    new Map(
        [
            caseView,
            caseEdit,
            caseClose,
            caseReopen,
            caseVoid,
            caseSearch,
            caseList,
            caseExport,
        ].map((commandModule) => [
            commandModule.subcommandName,
            commandModule,
        ])
    );

/*
 * ============================================================
 * SAFE ROUTER ERROR RESPONSE
 * ============================================================
 */

async function sendRouterError(
    interaction,
    message
) {
    const payload = {
        content:
            `❌ ${message}`,

        allowedMentions: {
            parse: [],
        },
    };

    /*
     * Once an interaction has been deferred or replied to,
     * Discord requires editReply() or followUp().
     */

    if (interaction.deferred) {
        return interaction.editReply({
            ...payload,
            embeds: [],
            components: [],
            files: [],
        });
    }

    if (interaction.replied) {
        return interaction.followUp({
            ...payload,
            flags:
                MessageFlags.Ephemeral,
        });
    }

    return interaction.reply({
        ...payload,
        flags:
            MessageFlags.Ephemeral,
    });
}

/*
 * ============================================================
 * COMMAND DEFINITION
 * ============================================================
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription(
            'View and manage Illinois State Utilities case records.'
        )

        /*
         * --------------------------------------------------------
         * /case view
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('view')
                .setDescription(
                    'View a case using its permanent ID.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName(
                            'visibility'
                        )
                        .setDescription(
                            'Choose whether the response is private or public.'
                        )
                        .addChoices(
                            ...VISIBILITY_CHOICES
                        )
                        .setRequired(false)
                )
        )

        /*
         * --------------------------------------------------------
         * /case edit
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('edit')
                .setDescription(
                    'Edit the saved details of a case.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName(
                            'reason-for-edit'
                        )
                        .setDescription(
                            'Explain why this case is being edited.'
                        )
                        .setMinLength(3)
                        .setMaxLength(500)
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('title')
                        .setDescription(
                            'A corrected or updated case title.'
                        )
                        .setMaxLength(200)
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName(
                            'case-reason'
                        )
                        .setDescription(
                            'A corrected or updated case reason.'
                        )
                        .setMaxLength(1000)
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('evidence')
                        .setDescription(
                            'A corrected evidence link or reference.'
                        )
                        .setMaxLength(1000)
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('notes')
                        .setDescription(
                            'Corrected or updated case notes.'
                        )
                        .setMaxLength(750)
                        .setRequired(false)
                )
        )

        /*
         * --------------------------------------------------------
         * /case close
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('close')
                .setDescription(
                    'Close an open case.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Explain why the case is being closed.'
                        )
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        )

        /*
         * --------------------------------------------------------
         * /case reopen
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('reopen')
                .setDescription(
                    'Reopen a previously closed case.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Explain why the case is being reopened.'
                        )
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        )

        /*
         * --------------------------------------------------------
         * /case void
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('void')
                .setDescription(
                    'Void a case without deleting its record.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Explain why the case is being voided.'
                        )
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        )

        /*
         * --------------------------------------------------------
         * /case search
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('search')
                .setDescription(
                    'Search case records using combined filters.'
                )

                .addStringOption((option) =>
                    option
                        .setName('query')
                        .setDescription(
                            'Search IDs, names, titles, reasons, evidence, and notes.'
                        )
                        .setMinLength(1)
                        .setMaxLength(200)
                        .setRequired(false)
                )

                .addUserOption((option) =>
                    option
                        .setName(
                            'staff-member'
                        )
                        .setDescription(
                            'Only show cases belonging to this staff member.'
                        )
                        .setRequired(false)
                )

                .addUserOption((option) =>
                    option
                        .setName('issued-by')
                        .setDescription(
                            'Only show cases issued by this user.'
                        )
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('type')
                        .setDescription(
                            'Only show a particular case type.'
                        )
                        .addChoices(
                            ...CASE_TYPE_CHOICES
                        )
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('status')
                        .setDescription(
                            'Only show cases with this status.'
                        )
                        .addChoices(
                            ...CASE_STATUS_CHOICES
                        )
                        .setRequired(false)
                )

                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription(
                            'The maximum number of results to display.'
                        )
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)
                )
        )

        /*
         * --------------------------------------------------------
         * /case list
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription(
                    'Display the server’s most recent case records.'
                )

                .addUserOption((option) =>
                    option
                        .setName(
                            'staff-member'
                        )
                        .setDescription(
                            'Only show cases belonging to this staff member.'
                        )
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('type')
                        .setDescription(
                            'Only show a particular case type.'
                        )
                        .addChoices(
                            ...CASE_TYPE_CHOICES
                        )
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName('status')
                        .setDescription(
                            'Only show cases with this status.'
                        )
                        .addChoices(
                            ...CASE_STATUS_CHOICES
                        )
                        .setRequired(false)
                )

                .addIntegerOption((option) =>
                    option
                        .setName('limit')
                        .setDescription(
                            'The maximum number of cases to display.'
                        )
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(false)
                )

                .addStringOption((option) =>
                    option
                        .setName(
                            'visibility'
                        )
                        .setDescription(
                            'Choose whether the response is private or public.'
                        )
                        .addChoices(
                            ...VISIBILITY_CHOICES
                        )
                        .setRequired(false)
                )
        )

        /*
         * --------------------------------------------------------
         * /case export
         * --------------------------------------------------------
         */

        .addSubcommand((subcommand) =>
            subcommand
                .setName('export')
                .setDescription(
                    'Export a complete case record as a text file.'
                )

                .addStringOption((option) =>
                    option
                        .setName('case-id')
                        .setDescription(
                            'The permanent ID of the case.'
                        )
                        .setRequired(true)
                )

                .addStringOption((option) =>
                    option
                        .setName(
                            'visibility'
                        )
                        .setDescription(
                            'Choose whether the exported file is private or public.'
                        )
                        .addChoices(
                            ...VISIBILITY_CHOICES
                        )
                        .setRequired(false)
                )
        ),

    /*
     * ============================================================
     * ROUTER EXECUTION
     * ============================================================
     */

    async execute(interaction) {
        try {
            /*
             * Slash commands should never run outside a server.
             */

            if (!interaction.inGuild()) {
                return interaction.reply({
                    content:
                        '❌ This command can only be used inside a Discord server.',

                    flags:
                        MessageFlags.Ephemeral,

                    allowedMentions: {
                        parse: [],
                    },
                });
            }

            /*
             * Determine which /case subcommand Discord received.
             */

            const subcommandName =
                interaction.options
                    .getSubcommand(true);

            /*
             * Locate its registered handler.
             */

            const commandModule =
                caseSubcommands.get(
                    subcommandName
                );

            if (!commandModule) {
                console.error(
                    `No case handler is registered for subcommand: ${subcommandName}`
                );

                return sendRouterError(
                    interaction,
                    'That case-management action is not currently available.'
                );
            }

            if (
                typeof commandModule.execute !==
                'function'
            ) {
                console.error(
                    `The case handler "${subcommandName}" does not export an execute function.`
                );

                return sendRouterError(
                    interaction,
                    'That case-management action is configured incorrectly.'
                );
            }

            /*
             * Hand complete control to the selected module.
             *
             * Each module handles:
             * - Permissions
             * - Response visibility
             * - Deferring the interaction
             * - Database actions
             * - User-facing responses
             */

            return await commandModule.execute(
                interaction
            );
        } catch (error) {
            console.error(
                'Error routing /case command:',
                error
            );

            return sendRouterError(
                interaction,
                'Something went wrong while opening the case-management system. Please try again and check the bot logs if the problem continues.'
            ).catch(
                (responseError) => {
                    console.error(
                        'Unable to send /case router error response:',
                        responseError
                    );
                }
            );
        }
    },
};