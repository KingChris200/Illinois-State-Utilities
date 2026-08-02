const erlcService = require('../services/erlcService');

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

        await message.reply(
            result.dryRun
                ? `Dry run: would execute \`${result.command}\`.`
                : 'Server message sent successfully.'
        );
    },
};
