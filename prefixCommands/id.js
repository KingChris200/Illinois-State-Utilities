const robloxService = require('../services/robloxService');

module.exports = {
    name: 'id',
    description: 'Looks up a Roblox user ID.',
    usage: '?id <Roblox username>',
    staffOnly: false,

    async execute({ message, args }) {
        const username = args[0];

        if (!username) {
            await message.reply('Usage: `?id <Roblox username>`');
            return;
        }

        const user = await robloxService.findUserId(username);

        if (!user) {
            await message.reply(
                `No Roblox account was found for \`${username}\`.`
            );
            return;
        }

        await message.reply({
            content: [
                `**${user.name}** (${user.displayName})`,
                `Roblox user ID: \`${user.id}\``,
                `Profile: https://www.roblox.com/users/${user.id}/profile`,
            ].join('\n'),
            allowedMentions: { parse: [] },
        });
    },
};
