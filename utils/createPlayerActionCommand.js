const {
    createModerationPreview,
    replyWithResolverError,
    resolveOnlinePlayer,
} = require('./moderationCommandUtils');
const {
    CONFIRMATION_TTL_MS,
    attachPromptMessage,
    createConfirmation,
    removeConfirmation,
} = require('./moderationConfirmationManager');

function createPlayerActionCommand({
    name,
    actionName,
    description,
    reasonRequired = false,
    includeReasonInCommand = false,
    cooldownSeconds = 5,
}) {
    const usage = reasonRequired
        ? `?${name} <player> <reason>`
        : `?${name} <player>`;

    return {
        name,
        description,
        usage,
        cooldownSeconds,

        async execute({ message, args, config }) {
            const playerQuery = args[0];
            const reason = args.slice(1).join(' ').trim();

            if (!playerQuery || (reasonRequired && !reason)) {
                await message.reply(`Usage: \`${usage}\``);
                return;
            }

            if (reason.length > 300) {
                await message.reply(
                    `${actionName} reasons must be 300 characters or fewer.`
                );
                return;
            }

            let resolved;

            try {
                resolved = await resolveOnlinePlayer(playerQuery);
            } catch (error) {
                await replyWithResolverError(message, error);
                return;
            }

            const command = [
                `:${name}`,
                resolved.player.username,
                includeReasonInCommand ? reason : null,
            ]
                .filter(Boolean)
                .join(' ');
            const confirmation = createConfirmation({
                action: name,
                command,
                player: resolved.player,
                reason: reason || null,
                requiresOnlineRecheck: true,
                executorId: message.author.id,
                executorMention: `${message.author}`,
                mockMode: config.mockMode,
                dryRun: config.dryRun,
            });
            const embed = createModerationPreview({
                action: actionName,
                player: resolved.player,
                executor: message.author,
                reason: reason || null,
                command,
                mockMode: config.mockMode || config.dryRun,
                expiresInSeconds:
                    CONFIRMATION_TTL_MS / 1000,
            });

            try {
                const promptMessage = await message.reply({
                    embeds: [embed],
                    components: [confirmation.components],
                    allowedMentions: { parse: [] },
                });
                await attachPromptMessage(
                    confirmation.id,
                    promptMessage
                );
            } catch (error) {
                removeConfirmation(confirmation.id);
                throw error;
            }
        },
    };
}

module.exports = createPlayerActionCommand;
