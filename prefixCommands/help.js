module.exports = {
    name: 'help',
    description: 'Shows remote-command help.',
    usage: '?help',
    staffOnly: false,
    cooldownSeconds: 1,

    async execute({ message, config }) {
        const uniqueCommands = [
            ...new Set(message.client.prefixCommands.values()),
        ];
        const commandLines = uniqueCommands
            .sort((first, second) =>
                first.name.localeCompare(second.name)
            )
            .map(
                (command) =>
                    `\`${command.usage || `${config.prefix}${command.name}`}\` — ${command.description}`
            );

        await message.reply({
            content: [
                '**Illinois State Utilities — Remote Commands**',
                ...commandLines,
                '',
                config.mockMode
                    ? 'Status: Mock mode (sample server data; no ER:LC commands are sent).'
                    : config.dryRun
                      ? 'Status: Dry-run mode (no ER:LC commands are sent).'
                      : 'Status: Live mode.',
            ].join('\n'),
            allowedMentions: { parse: [] },
        });
    },
};
