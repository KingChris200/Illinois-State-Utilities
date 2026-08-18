const { Events } = require('discord.js');
const config = require('../config/prefixCommands');
const loadPrefixCommands = require('../handlers/prefixCommandHandler');
const logPrefixCommand = require('../utils/prefixCommandLogger');
const {
    memberCanUseCommand,
} = require('../utils/prefixCommandPermissions');
const erlcService = require('../services/erlcService');
const {
    handleTicketMessage,
} = require('../utils/ticketManager');

const cooldowns = new Map();

module.exports = {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (
            message.author.bot ||
            !message.guild
        ) {
            return;
        }

        if (await handleTicketMessage(message)) {
            return;
        }

        if (!message.content.startsWith(config.prefix)) {
            return;
        }

        if (!client.prefixCommands) {
            loadPrefixCommands(client);
        }

        const input = message.content
            .slice(config.prefix.length)
            .trim();

        if (!input) {
            return;
        }

        const [rawName, ...args] = input.split(/\s+/);
        const commandName = rawName.toLowerCase();
        const command = client.prefixCommands.get(commandName);

        if (!command) {
            return;
        }

        if (
            !memberCanUseCommand(
                message.member,
                command,
                config
            )
        ) {
            await message.reply(
                'You do not have permission to use this command.'
            );
            await logPrefixCommand(
                message,
                commandName,
                'permission_denied'
            );
            return;
        }

        if (
            config.allowedChannelIds.length > 0 &&
            !config.allowedChannelIds.includes(message.channelId)
        ) {
            await message.reply(
                'Remote commands are not enabled in this channel.'
            );
            await logPrefixCommand(
                message,
                commandName,
                'channel_denied'
            );
            return;
        }

        const cooldownSeconds =
            command.cooldownSeconds ??
            config.defaultCooldownSeconds;
        const cooldownKey = `${message.guildId}:${message.author.id}:${command.name}`;
        const availableAt = cooldowns.get(cooldownKey) || 0;

        if (availableAt > Date.now()) {
            const remaining = Math.ceil(
                (availableAt - Date.now()) / 1000
            );
            await message.reply(
                `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before using that command again.`
            );
            return;
        }

        const cooldownExpiresAt =
            Date.now() + cooldownSeconds * 1000;

        cooldowns.set(
            cooldownKey,
            cooldownExpiresAt
        );

        const cleanupTimer = setTimeout(() => {
            if (
                cooldowns.get(cooldownKey) ===
                cooldownExpiresAt
            ) {
                cooldowns.delete(cooldownKey);
            }
        }, Math.max(cooldownSeconds * 1000, 0));

        cleanupTimer.unref?.();

        try {
            await command.execute({
                message,
                args,
                config,
            });
            await logPrefixCommand(
                message,
                commandName,
                config.dryRun || config.mockMode
                    ? 'mock_success'
                    : 'success'
            );
        } catch (error) {
            console.error(
                `Error while executing ?${commandName}:`,
                error
            );

            const response =
                error instanceof erlcService.ErlcServiceError
                    ? erlcService.getPublicErrorMessage(error)
                    : 'An unexpected error occurred while running this command.';

            await message.reply(response).catch(() => null);
            await logPrefixCommand(
                message,
                commandName,
                error.code || 'error'
            );
        }
    },
};
