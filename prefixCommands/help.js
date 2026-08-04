const createEmbed = require('../utils/createEmbed');

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
        const mode = config.mockMode
            ? '🧪 Mock Mode'
            : config.dryRun
              ? '🛡️ Dry-Run Mode'
              : '🟢 Live Mode';
        const embed = createEmbed('Remote Command Center')
            .setDescription(
                [
                    'Manage and monitor the Illinois State Roleplay private server.',
                    '',
                    commandLines.join('\n'),
                ].join('\n')
            )
            .addFields(
                {
                    name: 'Current Mode',
                    value: mode,
                    inline: true,
                },
                {
                    name: 'Prefix',
                    value: `\`${config.prefix}\``,
                    inline: true,
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
