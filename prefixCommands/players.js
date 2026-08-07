const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');
const {
    parsePlayerRecord,
} = require('../utils/playerResolver');

function formatPlayer(player, index) {
    const parsedPlayer = parsePlayerRecord(player);

    return [
        `**${index + 1}. ${parsedPlayer.username}**`,
        parsedPlayer.userId
            ? ` · \`${parsedPlayer.userId}\``
            : '',
        ` — ${parsedPlayer.permission}`,
    ].join('');
}

module.exports = {
    name: 'players',
    description: 'Lists players currently in the ER:LC server.',
    usage: '?players',

    async execute({ message }) {
        const players = await erlcService.getPlayers();
        const lines = players.slice(0, 40).map(formatPlayer);
        let playerList = lines.join('\n');

        if (!playerList) {
            playerList =
                '*No players are currently in the server.*';
        } else if (playerList.length > 3900) {
            playerList = `${playerList.slice(0, 3890)}\n…`;
        }

        const embed = createEmbed(
            `Server Players — ${players.length}`,
            'isrp',
            {
                guild: message.guild,
                client: message.client,
            }
        )
            .setDescription(playerList)
            .addFields({
                name: 'Data Source',
                value: erlcService.isMockMode()
                    ? '🧪 Mock server data'
                    : '🟢 Live ER:LC API',
                inline: true,
            });

        if (players.length > 40) {
            embed.addFields({
                name: 'Display Limit',
                value: `Showing 40 of ${players.length} players.`,
            });
        }

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};
