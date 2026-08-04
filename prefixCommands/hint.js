const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');

module.exports = {
    name: 'h',
    description: 'Broadcasts a hint to the ER:LC server.',
    usage: '?h <message>',
    cooldownSeconds: 5,

    async execute({ message, args, config }) {
        const text = args.join(' ').trim();

        if (!text) {
            await message.reply('Usage: `?h <message>`');
            return;
        }

        const result = await erlcService.executeCommand(
            `:h ${text}`,
            { dryRun: config.dryRun }
        );
        const embed = createEmbed(
            result.dryRun
                ? 'Hint Preview'
                : 'Server Hint Sent',
            'isrp'
        )
            .setDescription(`> ${text}`)
            .addFields({
                name: 'Status',
                value: result.dryRun
                    ? '🧪 Mock/Dry run — nothing was sent in-game.'
                    : '✅ Delivered to the ER:LC server.',
            });

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
