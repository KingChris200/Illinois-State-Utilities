const erlcService = require('../services/erlcService');
const {
    createModerationPreview,
    isSafePreviewMode,
    replyLiveModerationLocked,
    replyWithResolverError,
    resolveOnlinePlayer,
} = require('../utils/moderationCommandUtils');

module.exports = {
    name: 'respawn',
    aliases: ['re'],
    description: 'Previews respawning an online player.',
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

        const command = `:respawn ${resolved.player.username}`;
        const result = await erlcService.executeCommand(command, {
            dryRun: true,
        });
        const embed = createModerationPreview({
            action: 'Respawn',
            player: resolved.player,
            executor: message.author,
            command: result.command,
        });

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
