const erlcService = require('../services/erlcService');

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

        await message.reply(
            result.dryRun
                ? `Dry run: would execute \`${result.command}\`.`
                : 'Server hint sent successfully.'
        );
    },
};
