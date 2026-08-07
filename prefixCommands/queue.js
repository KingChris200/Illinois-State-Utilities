const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');
const {
    cleanInlineCode,
} = require('../utils/erlcActivityUtils');

module.exports = {
    name: 'queue',
    description: 'Shows the current ER:LC server queue.',
    usage: '?queue',
    cooldownSeconds: 5,

    async execute({ message }) {
        const queue = await erlcService.getQueue();
        const visibleQueue = queue.slice(0, 25);
        const lines = visibleQueue.map(
            (userId, index) =>
                `**${index + 1}.** Roblox ID \`${cleanInlineCode(userId, 24)}\``
        );

        if (queue.length > visibleQueue.length) {
            lines.push(
                `*…and ${queue.length - visibleQueue.length} more waiting*`
            );
        }

        const embed = createEmbed(
            `Server Queue — ${queue.length}`,
            'isrp'
        )
            .setDescription(
                lines.join('\n') ||
                    '*Nobody is currently waiting to join.*'
            )
            .addFields({
                name: 'Queue Order',
                value:
                    'Players are displayed in the order returned by ER:LC.',
            });

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
