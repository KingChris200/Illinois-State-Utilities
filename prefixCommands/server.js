const erlcService = require('../services/erlcService');

module.exports = {
    name: 'server',
    description: 'Shows the current ER:LC server status.',
    usage: '?server',

    async execute({ message }) {
        const server = await erlcService.getServer();

        await message.reply({
            content: [
                '**ER:LC Server**',
                `Name: ${server.Name || 'Unknown'}`,
                `Owner: ${server.OwnerId || 'Unknown'}`,
                `Players: ${server.CurrentPlayers ?? 'Unknown'}/${server.MaxPlayers ?? 'Unknown'}`,
                `Join key: ${server.JoinKey || 'Unavailable'}`,
            ].join('\n'),
            allowedMentions: { parse: [] },
        });
    },
};
