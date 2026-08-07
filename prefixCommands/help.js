const createEmbed = require('../utils/createEmbed');
const {
    memberCanUseCommand,
} = require('../utils/prefixCommandPermissions');

const CATEGORY_ORDER = [
    {
        name: 'Information & Status',
        commands: [
            'help',
            'id',
            'status',
            'apicheck',
            'players',
            'server',
        ],
    },
    {
        name: 'Live Server Intelligence',
        commands: [
            'operations',
            'staff',
            'queue',
            'modcalls',
            'joinlogs',
            'kl',
            'vehicles',
            'logs',
        ],
    },
    {
        name: 'Server Announcements',
        commands: ['m', 'h'],
    },
    {
        name: 'Player Moderation',
        commands: [
            'warn',
            'kick',
            'ban',
            'unban',
            'respawn',
            'heal',
            'wanted',
            'unwanted',
        ],
    },
];

const CONFIRMED_COMMANDS = new Set([
    'warn',
    'kick',
    'ban',
    'unban',
    'respawn',
    'heal',
    'wanted',
    'unwanted',
]);

const READ_ONLY_COMMANDS = new Set([
    'status',
    'apicheck',
    'players',
    'server',
    'staff',
    'operations',
    'queue',
    'modcalls',
    'joinlogs',
    'kl',
    'vehicles',
    'logs',
]);

module.exports = {
    name: 'help',
    description: 'Shows commands available to you.',
    usage: '?help [command]',
    staffOnly: false,
    cooldownSeconds: 1,

    async execute({ message, args, config }) {
        const query = args[0]?.toLowerCase();

        if (query) {
            await sendCommandHelp(message, query, config);
            return;
        }

        const commands = getUniqueCommands(message.client)
            .filter((command) =>
                memberCanUseCommand(
                    message.member,
                    command,
                    config
                )
            );
        const commandsByName = new Map(
            commands.map((command) => [command.name, command])
        );
        const embed = createEmbed(
            'Illinois State Utilities Command Center'
        )
            .setDescription(
                [
                    'Only commands available to you are shown below.',
                    'Use `?help <command>` for permissions, aliases, cooldown, and safety details.',
                ].join('\n')
            )
            .addFields(
                ...CATEGORY_ORDER.map((category) => ({
                    name: category.name,
                    value: formatCategory(
                        category.commands,
                        commandsByName
                    ),
                })),
                {
                    name: 'Current Mode',
                    value: getMode(config),
                    inline: true,
                },
                {
                    name: 'Commands Available',
                    value: String(commands.length),
                    inline: true,
                },
                {
                    name: 'Safety Key',
                    value:
                        '🛡️ = requires a private confirmation before execution',
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

async function sendCommandHelp(message, query, config) {
    const command = message.client.prefixCommands.get(query);

    if (
        !command ||
        !memberCanUseCommand(message.member, command, config)
    ) {
        await message.reply(
            'That command does not exist or is not available to you.'
        );
        return;
    }

    const aliases = command.aliases?.length
        ? command.aliases
              .map((alias) => `\`${config.prefix}${alias}\``)
              .join(', ')
        : 'None';
    const permission = command.staffOnly === false
        ? 'Everyone'
        : command.permissionLevel === 'senior'
          ? 'Senior staff'
          : 'Configured staff';
    const cooldown =
        command.cooldownSeconds ??
        config.defaultCooldownSeconds;
    const confirmed = CONFIRMED_COMMANDS.has(command.name);
    const embed = createEmbed(
        `Command Help — ${config.prefix}${command.name}`
    )
        .setDescription(command.description)
        .addFields(
            {
                name: 'Usage',
                value: `\`${command.usage || `${config.prefix}${command.name}`}\``,
            },
            {
                name: 'Permission',
                value: permission,
                inline: true,
            },
            {
                name: 'Cooldown',
                value: `${cooldown} second${cooldown === 1 ? '' : 's'}`,
                inline: true,
            },
            {
                name: 'Aliases',
                value: aliases,
                inline: true,
            },
            {
                name: 'Execution Safety',
                value: confirmed
                    ? '🛡️ Requires confirmation; the target is checked again before execution.'
                    : READ_ONLY_COMMANDS.has(command.name)
                      ? 'Read-only; this command cannot modify the ER:LC server.'
                      : 'Runs through the protected command router and cooldown system.',
            },
            {
                name: 'Current Mode',
                value: getMode(config),
            }
        );

    await message.reply({
        embeds: [embed],
        allowedMentions: { parse: [] },
    });
}

function getUniqueCommands(client) {
    return [...new Set(client.prefixCommands.values())];
}

function formatCategory(commandNames, commandsByName) {
    const lines = commandNames
        .map((name) => commandsByName.get(name))
        .filter(Boolean)
        .map((command) => {
            const shield = CONFIRMED_COMMANDS.has(command.name)
                ? ' 🛡️'
                : '';
            return `\`${command.usage}\`${shield} — ${command.description}`;
        });

    return lines.join('\n') || '*No commands available*';
}

function getMode(config) {
    if (config.mockMode) {
        return '🧪 Mock Mode';
    }

    if (config.dryRun) {
        return '🛡️ Dry-Run Mode';
    }

    return '🟢 Live Mode';
}

module.exports.formatCategory = formatCategory;
module.exports.getMode = getMode;
