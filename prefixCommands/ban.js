const {
    createModerationPreview,
    replyWithResolverError,
    resolveOnlinePlayer,
} = require('../utils/moderationCommandUtils');
const {
    CONFIRMATION_TTL_MS,
    attachPromptMessage,
    createConfirmation,
    removeConfirmation,
} = require('../utils/moderationConfirmationManager');

module.exports = {
    name: 'ban',
    description: 'Requests confirmation to ban an online player.',
    usage: '?ban <player> <reason>',
    permissionLevel: 'senior',
    cooldownSeconds: 10,

    async execute({ message, args, config }) {
        const playerQuery = args[0];
        const reason = args.slice(1).join(' ').trim();

        if (!playerQuery || !reason) {
            await message.reply(
                'Usage: `?ban <player> <reason>`'
            );
            return;
        }

        if (reason.length > 300) {
            await message.reply(
                'Ban reasons must be 300 characters or fewer.'
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

        await sendConfirmation({
            message,
            config,
            action: 'ban',
            actionName: 'Ban',
            command: `:ban ${resolved.player.username}`,
            player: resolved.player,
            reason,
            requiresOnlineRecheck: true,
        });
    },
};

async function sendConfirmation({
    message,
    config,
    action,
    actionName,
    command,
    player,
    reason,
    requiresOnlineRecheck,
}) {
    const confirmation = createConfirmation({
        action,
        command,
        player,
        reason,
        requiresOnlineRecheck,
        executorId: message.author.id,
        executorMention: `${message.author}`,
        mockMode: config.mockMode,
        dryRun: config.dryRun,
    });
    const embed = createModerationPreview({
        action: actionName,
        player,
        executor: message.author,
        reason,
        command,
        mockMode: config.mockMode || config.dryRun,
        expiresInSeconds: CONFIRMATION_TTL_MS / 1000,
    });

    try {
        const promptMessage = await message.reply({
            embeds: [embed],
            components: [confirmation.components],
            allowedMentions: { parse: [] },
        });
        attachPromptMessage(confirmation.id, promptMessage);
    } catch (error) {
        removeConfirmation(confirmation.id);
        throw error;
    }
}
