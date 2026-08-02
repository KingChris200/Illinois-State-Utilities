const erlcService = require('../services/erlcService');

module.exports = {
    name: 'players',
    description: 'Lists players currently in the ER:LC server.',
    usage: '?players',

    async execute({ message }) {
        const players = await erlcService.getPlayers();

        if (!players.length) {
            await message.reply('There are no players in the server.');
            return;
        }

        const lines = players.slice(0, 40).map((player) => {
            const name = player.Player || player.Username || 'Unknown';
            const permission = player.Permission || 'Normal';
            return `• ${name} — ${permission}`;
        });

        await message.reply({
            content: [
                `**Players (${players.length})**`,
                ...lines,
                players.length > 40
                    ? `…and ${players.length - 40} more.`
                    : '',
            ]
                .filter(Boolean)
                .join('\n'),
            allowedMentions: { parse: [] },
        });
    },
};
