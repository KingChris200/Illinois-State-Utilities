const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');

module.exports = {
    name: 'm',
    description: 'Broadcasts a message to the ER:LC server.',
    usage: '?m <message>',
    cooldownSeconds: 5,

    async execute({ message, args, config }) {
        const text = args.join(' ').trim();

        if (!text) {
            await message.reply('Usage: `?m <message>`');
            return;
        }

        const result = await erlcService.executeCommand(
            `:m ${text}`,
            { dryRun: config.dryRun }
        );
        const embed = createEmbed(
            result.dryRun
                ? 'Message Preview'
                : 'Server Message Sent',
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
