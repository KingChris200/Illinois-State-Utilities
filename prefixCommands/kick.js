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
    name: 'kick',
    description: 'Requests confirmation to kick an online player.',
    usage: '?kick <player> <reason>',
    cooldownSeconds: 5,

    async execute({ message, args, config }) {
        const playerQuery = args[0];
        const reason = args.slice(1).join(' ').trim();

        if (!playerQuery || !reason) {
            await message.reply(
                'Usage: `?kick <player> <reason>`'
            );
            return;
        }

        if (reason.length > 300) {
            await message.reply(
                'Kick reasons must be 300 characters or fewer.'
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

        const command = `:kick ${resolved.player.username}`;
        const confirmation = createConfirmation({
            action: 'kick',
            command,
            player: resolved.player,
            reason,
            executorId: message.author.id,
            executorMention: `${message.author}`,
            mockMode: config.mockMode,
            dryRun: config.dryRun,
        });
        const embed = createModerationPreview({
            action: 'Kick',
            player: resolved.player,
            executor: message.author,
            reason,
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
            attachPromptMessage(
                confirmation.id,
                promptMessage
            );
        } catch (error) {
            removeConfirmation(confirmation.id);
            throw error;
        }
    },
};
