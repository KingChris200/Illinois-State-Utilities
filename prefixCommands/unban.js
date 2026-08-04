const {
    createModerationPreview,
} = require('../utils/moderationCommandUtils');
const {
    CONFIRMATION_TTL_MS,
    attachPromptMessage,
    createConfirmation,
    removeConfirmation,
} = require('../utils/moderationConfirmationManager');

module.exports = {
    name: 'unban',
    description: 'Requests confirmation to unban a Roblox ID.',
    usage: '?unban <Roblox ID> <reason>',
    permissionLevel: 'senior',
    cooldownSeconds: 10,

    async execute({ message, args, config }) {
        const userId = String(args[0] || '').trim();
        const reason = args.slice(1).join(' ').trim();

        if (!userId || !reason) {
            await message.reply(
                'Usage: `?unban <Roblox ID> <reason>`'
            );
            return;
        }

        if (!/^[1-9]\d{0,19}$/.test(userId)) {
            await message.reply(
                'Provide a complete numeric Roblox user ID.'
            );
            return;
        }

        if (reason.length > 300) {
            await message.reply(
                'Unban reasons must be 300 characters or fewer.'
            );
            return;
        }

        const player = {
            username: 'Banned Roblox User',
            userId,
            permission: 'Not currently online',
        };
        const command = `:unban ${userId}`;
        const confirmation = createConfirmation({
            action: 'unban',
            command,
            player,
            reason,
            requiresOnlineRecheck: false,
            executorId: message.author.id,
            executorMention: `${message.author}`,
            mockMode: config.mockMode,
            dryRun: config.dryRun,
        });
        const embed = createModerationPreview({
            action: 'Unban',
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
