const {
    replyWithResolverError,
} = require('../utils/moderationCommandUtils');
const { PlayerResolverError } = require('../utils/playerResolver');
const {
    attachPlayerPanelMessage,
    createPlayerIntelligencePanel,
    removePlayerPanel,
} = require('../utils/playerIntelligenceManager');

module.exports = {
    name: 'player',
    description:
        'Opens an interactive intelligence profile for an online player.',
    usage: '?player <username or Roblox ID>',
    cooldownSeconds: 8,

    async execute({ message, args, config }) {
        const query = args[0];

        if (!query) {
            await message.reply(
                'Usage: `?player <username or Roblox ID>`'
            );
            return;
        }

        let panel;

        try {
            panel = await createPlayerIntelligencePanel({
                query,
                executorId: message.author.id,
                executorMention: `${message.author}`,
                guild: message.guild,
                client: message.client,
                config,
            });
        } catch (error) {
            if (error instanceof PlayerResolverError) {
                await replyWithResolverError(message, error);
                return;
            }

            throw error;
        }

        try {
            const panelMessage = await message.reply({
                embeds: [panel.embed],
                components: [panel.components],
                allowedMentions: { parse: [] },
            });
            attachPlayerPanelMessage(
                panel.id,
                panelMessage
            );
        } catch (error) {
            removePlayerPanel(panel.id);
            throw error;
        }
    },
};
