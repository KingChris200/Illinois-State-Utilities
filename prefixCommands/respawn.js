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
    name: 'respawn',
    aliases: ['re'],
    description:
        'Requests confirmation to respawn an online player.',
    usage: '?respawn <player>',
    cooldownSeconds: 5,

    async execute({ message, args, config }) {
        const playerQuery = args[0];

        if (!playerQuery) {
            await message.reply(
                'Usage: `?respawn <player>`'
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

        const command = `:respawn ${resolved.player.username}`;
        const confirmation = createConfirmation({
            action: 'respawn',
            command,
            player: resolved.player,
            reason: null,
            executorId: message.author.id,
            executorMention: `${message.author}`,
            mockMode: config.mockMode,
            dryRun: config.dryRun,
        });
        const embed = createModerationPreview({
            action: 'Respawn',
            player: resolved.player,
            executor: message.author,
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
