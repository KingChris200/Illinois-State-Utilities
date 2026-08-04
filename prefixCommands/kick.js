const erlcService = require('../services/erlcService');
const {
    createModerationPreview,
    isSafePreviewMode,
    replyLiveModerationLocked,
    replyWithResolverError,
    resolveOnlinePlayer,
} = require('../utils/moderationCommandUtils');

module.exports = {
    name: 'kick',
    description: 'Previews kicking an online player.',
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

        if (!isSafePreviewMode(config)) {
            await replyLiveModerationLocked(message);
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
        const result = await erlcService.executeCommand(command, {
            dryRun: true,
        });
        const embed = createModerationPreview({
            action: 'Kick',
            player: resolved.player,
            executor: message.author,
            reason,
            command: result.command,
        });

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
